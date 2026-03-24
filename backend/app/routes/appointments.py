from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from .. import models, schemas, database, auth

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])

@router.get("/staff", response_model=List[schemas.UserResponse])
def get_staff_members(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.User).all()

@router.get("/", response_model=List[schemas.AppointmentResponse])
def get_appointments(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Appointment).all()

@router.post("/", response_model=schemas.AppointmentResponse)
def create_appointment(appointment: schemas.AppointmentCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    services = db.query(models.Service).filter(models.Service.id.in_(appointment.service_ids)).all()
    if len(services) != len(appointment.service_ids):
        raise HTTPException(status_code=400, detail="One or more services not found")

    total_amount = sum([service.price for service in services])

    new_app = models.Appointment(
        customer_id=appointment.customer_id,
        assigned_staff_id=appointment.assigned_staff_id,
        date=appointment.date,
        time=appointment.time,
        status=appointment.status,
        payment_status=appointment.payment_status,
        total_amount=total_amount,
        completed_at=datetime.utcnow() if appointment.status == "completed" else None,
    )
    for service in services:
        new_app.services.append(models.AppointmentService(
            service_id=service.id,
            service_name=service.name,
            price_at_booking=service.price,
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

    # For each service: keep original snapshot if it existed, else use current price
    new_service_items = []
    total_amount = 0
    for service in services:
        if service.id in existing_snapshots:
            # Preserve original price snapshot
            old = existing_snapshots[service.id]
            new_service_items.append(models.AppointmentService(
                service_id=service.id,
                service_name=old.service_name,
                price_at_booking=old.price_at_booking,
            ))
            total_amount += old.price_at_booking
        else:
            # New service added — snapshot current price
            new_service_items.append(models.AppointmentService(
                service_id=service.id,
                service_name=service.name,
                price_at_booking=service.price,
            ))
            total_amount += service.price

    # Auto-set completed_at when status changes to completed
    if appointment.status == "completed" and app.status != "completed":
        app.completed_at = datetime.utcnow()
    elif appointment.status != "completed":
        app.completed_at = None

    app.customer_id = appointment.customer_id
    app.assigned_staff_id = appointment.assigned_staff_id
    app.date = appointment.date
    app.time = appointment.time
    app.status = appointment.status
    app.payment_status = appointment.payment_status
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
