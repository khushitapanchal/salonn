from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List
import traceback
from .. import models, schemas, database, auth

router = APIRouter(prefix="/api/users", tags=["Users"])


def require_admin(current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/", response_model=List[schemas.UserResponse])
def get_users(db: Session = Depends(database.get_db), current_user: models.User = Depends(require_admin)):
    return db.query(models.User).all()


@router.post("/", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(require_admin)):
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        name=user.name,
        email=user.email,
        phone=user.phone,
        password=hashed_password,
        role=user.role,
        is_active=1,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.put("/{user_id}", response_model=schemas.UserResponse)
def update_user(user_id: int, user_update: schemas.UserUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_update.name is not None:
        user.name = user_update.name
    if user_update.email is not None:
        existing = db.query(models.User).filter(models.User.email == user_update.email, models.User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = user_update.email
    if user_update.phone is not None:
        user.phone = user_update.phone
    if user_update.role is not None:
        user.role = user_update.role
    if user_update.password is not None and user_update.password.strip():
        user.password = auth.get_password_hash(user_update.password)

    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/toggle-status", response_model=schemas.UserResponse)
def toggle_user_status(user_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    user.is_active = 0 if user.is_active == 1 else 1
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}/performance")
def get_user_performance(user_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(require_admin)):
    """Get staff member performance: customers attended, services, revenue."""
    try:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # All appointments assigned to this staff - eager load relationships
        appointments = db.query(models.Appointment).options(
            joinedload(models.Appointment.customer),
            joinedload(models.Appointment.services),
        ).filter(
            models.Appointment.assigned_staff_id == user_id
        ).all()

        total_appointments = len(appointments)
        completed = [a for a in appointments if a.status == "completed"]
        total_completed = len(completed)
        total_revenue = float(sum(float(a.paid_amount or 0) for a in completed))

        # Unique customers served
        customer_ids = set(a.customer_id for a in appointments)
        total_customers = len(customer_ids)

        # Services provided (from completed appointments)
        service_counts: dict = {}
        for a in completed:
            for s in a.services:
                name = s.service_name or "Unknown"
                if name not in service_counts:
                    service_counts[name] = {"count": 0, "revenue": 0.0}
                service_counts[name]["count"] += 1
                service_counts[name]["revenue"] += float(s.price_at_booking or 0)

        services_breakdown = [
            {"name": k, "count": v["count"], "revenue": v["revenue"]}
            for k, v in sorted(service_counts.items(), key=lambda x: x[1]["revenue"], reverse=True)
        ]

        # Recent appointments (last 10)
        recent = sorted(appointments, key=lambda a: (a.date, a.time), reverse=True)[:10]
        recent_list = []
        for a in recent:
            recent_list.append({
                "id": a.id,
                "customer_name": a.customer.name if a.customer else "Unknown",
                "customer_phone": a.customer.phone if a.customer else "",
                "date": a.date.isoformat(),
                "time": str(a.time)[:5],
                "status": a.status,
                "payment_status": a.payment_status or "unpaid",
                "total_amount": float(a.total_amount or 0),
                "paid_amount": float(a.paid_amount or 0),
                "services": [s.service_name or "Unknown" for s in a.services],
            })

        return {
            "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role},
            "total_appointments": total_appointments,
            "total_completed": total_completed,
            "total_customers": total_customers,
            "total_revenue": total_revenue,
            "services_breakdown": services_breakdown,
            "recent_appointments": recent_list,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading performance: {str(e)}")


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    db.delete(user)
    db.commit()
    return {"detail": "User deleted successfully"}
