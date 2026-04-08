from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime
import logging
import traceback
from .. import models, schemas, database, auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])

@router.get("/staff", response_model=List[schemas.UserResponse])
def get_staff_members(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.User).all()

@router.get("/debug")
def debug_appointments(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Temporary debug endpoint to see raw appointment data and errors."""
    try:
        appointments = db.query(models.Appointment).options(
            joinedload(models.Appointment.customer),
            joinedload(models.Appointment.assigned_staff),
            joinedload(models.Appointment.services),
        ).all()
        results = []
        for a in appointments:
            try:
                serialized = schemas.AppointmentResponse.model_validate(a)
                results.append({"id": a.id, "status": "ok"})
            except Exception as e:
                results.append({
                    "id": a.id,
                    "status": "error",
                    "error": str(e),
                    "raw": {
                        "date": str(a.date),
                        "time": str(a.time),
                        "time_type": type(a.time).__name__,
                        "total_amount": str(a.total_amount),
                        "total_amount_type": type(a.total_amount).__name__,
                        "paid_amount": str(a.paid_amount),
                        "paid_amount_type": type(a.paid_amount).__name__,
                        "customer": a.customer.name if a.customer else None,
                        "customer_created_at": str(a.customer.created_at) if a.customer else None,
                        "services_count": len(a.services),
                        "payment_status": a.payment_status,
                    }
                })
        return {"count": len(appointments), "results": results}
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}

@router.get("/", response_model=List[schemas.AppointmentResponse])
def get_appointments(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        appointments = db.query(models.Appointment).filter(
            models.Appointment.customer_id.isnot(None)
        ).options(
            joinedload(models.Appointment.customer),
            joinedload(models.Appointment.assigned_staff),
            joinedload(models.Appointment.services),
        ).all()
        return appointments
    except Exception as e:
        logger.error(f"Error fetching appointments: {e}")
        raise

@router.post("/", response_model=schemas.AppointmentResponse)
def create_appointment(appointment: schemas.AppointmentCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    if not appointment.service_ids:
        raise HTTPException(status_code=400, detail="At least one service is required")

    services = db.query(models.Service).filter(models.Service.id.in_(appointment.service_ids)).all()
    if len(services) != len(appointment.service_ids):
        raise HTTPException(status_code=400, detail="One or more services not found")

    if appointment.total_amount_override is not None and appointment.total_amount_override > 0:
        total_amount = float(appointment.total_amount_override)
    else:
        total_amount = float(sum([float(service.price) for service in services]))

    # For "paid" status, paid_amount = total; for "unpaid", paid_amount = 0
    if appointment.payment_status == "paid":
        paid_amount = total_amount
    elif appointment.payment_status == "unpaid":
        paid_amount = 0
    else:
        paid_amount = float(appointment.paid_amount or 0)

    new_app = models.Appointment(
        customer_id=appointment.customer_id,
        assigned_staff_id=appointment.assigned_staff_id,
        date=appointment.date,
        time=appointment.time,
        status=appointment.status,
        payment_status=appointment.payment_status,
        payment_mode=appointment.payment_mode,
        package_name=appointment.package_name,
        paid_amount=paid_amount,
        total_amount=total_amount,
        completed_at=datetime.utcnow() if appointment.status == "completed" else None,
    )
    sp = appointment.service_prices or {}
    for service in services:
        price = sp.get(str(service.id), sp.get(service.id, float(service.price)))
        new_app.services.append(models.AppointmentService(
            service_id=service.id,
            service_name=service.name,
            price_at_booking=float(price),
        ))

    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return new_app

@router.put("/{appointment_id}", response_model=schemas.AppointmentResponse)
def update_appointment(appointment_id: int, appointment: schemas.AppointmentCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    app = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found")

    services = db.query(models.Service).filter(models.Service.id.in_(appointment.service_ids)).all()
    if len(services) != len(appointment.service_ids):
        raise HTTPException(status_code=400, detail="One or more services not found")

    # Build a map of existing snapshot prices to preserve them
    existing_snapshots = {s.service_id: s for s in app.services}

    # For each service: use override price if provided, else keep snapshot or current price
    sp = appointment.service_prices or {}
    new_service_items = []
    total_amount = 0
    for service in services:
        override_price = sp.get(str(service.id), sp.get(service.id))
        if override_price is not None:
            price = float(override_price)
            new_service_items.append(models.AppointmentService(
                service_id=service.id,
                service_name=service.name,
                price_at_booking=price,
            ))
            total_amount += price
        elif service.id in existing_snapshots:
            old = existing_snapshots[service.id]
            new_service_items.append(models.AppointmentService(
                service_id=service.id,
                service_name=old.service_name,
                price_at_booking=old.price_at_booking,
            ))
            total_amount += old.price_at_booking
        else:
            new_service_items.append(models.AppointmentService(
                service_id=service.id,
                service_name=service.name,
                price_at_booking=service.price,
            ))
            total_amount += service.price

    # Use package price override if provided
    if appointment.total_amount_override is not None and appointment.total_amount_override > 0:
        total_amount = float(appointment.total_amount_override)

    # Auto-set completed_at when status changes to completed
    if appointment.status == "completed" and app.status != "completed":
        app.completed_at = datetime.utcnow()
    elif appointment.status != "completed":
        app.completed_at = None

    # For "paid" status, paid_amount = total; for "unpaid", paid_amount = 0
    if appointment.payment_status == "paid":
        paid_amount = total_amount
    elif appointment.payment_status == "unpaid":
        paid_amount = 0
    else:
        paid_amount = appointment.paid_amount or 0

    app.customer_id = appointment.customer_id
    app.assigned_staff_id = appointment.assigned_staff_id
    app.date = appointment.date
    app.time = appointment.time
    app.status = appointment.status
    app.payment_status = appointment.payment_status
    app.payment_mode = appointment.payment_mode
    app.package_name = appointment.package_name
    app.paid_amount = paid_amount
    app.total_amount = total_amount

    # Replace service associations
    app.services.clear()
    for item in new_service_items:
        app.services.append(item)

    db.commit()
    db.refresh(app)
    return app

@router.put("/{appointment_id}/status", response_model=schemas.AppointmentResponse)
def update_appointment_status(appointment_id: int, status: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    app = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Auto-set completed_at when marking as completed
    if status == "completed" and app.status != "completed":
        app.completed_at = datetime.utcnow()
    elif status != "completed":
        app.completed_at = None

    app.status = status
    db.commit()
    db.refresh(app)
    return app

@router.delete("/{appointment_id}")
def delete_appointment(appointment_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    app = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found")
    db.delete(app)
    db.commit()
    return {"detail": "Appointment deleted successfully"}
