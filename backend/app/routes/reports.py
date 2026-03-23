from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from .. import models, database, auth
from datetime import date, timedelta
from typing import Optional

router = APIRouter(prefix="/api/reports", tags=["Reports"])


def require_admin(current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# Revenue filter: completed + paid only
def _revenue_filter():
    return [
        models.Appointment.status == "completed",
        models.Appointment.payment_status == "paid",
    ]


@router.get("/daily-revenue")
def daily_revenue_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin),
):
    today = date.today()
    d_start = date.fromisoformat(start_date) if start_date else today - timedelta(days=29)
    d_end = date.fromisoformat(end_date) if end_date else today

    rows = (
        db.query(
            models.Appointment.date,
            func.count(models.Appointment.id).label("appointments"),
            func.sum(models.Appointment.total_amount).label("revenue"),
        )
        .filter(
            models.Appointment.date >= d_start,
            models.Appointment.date <= d_end,
            *_revenue_filter(),
        )
        .group_by(models.Appointment.date)
        .order_by(models.Appointment.date)
        .all()
    )

    # Fill missing dates with zero
    data = []
    current = d_start
    row_map = {r.date: r for r in rows}
    while current <= d_end:
        r = row_map.get(current)
        data.append({
            "date": current.isoformat(),
            "appointments": r.appointments if r else 0,
            "revenue": float(r.revenue) if r else 0.0,
        })
        current += timedelta(days=1)

    total_revenue = sum(d["revenue"] for d in data)
    total_appointments = sum(d["appointments"] for d in data)
    avg_daily = total_revenue / max(len(data), 1)

    return {
        "data": data,
        "summary": {
            "total_revenue": total_revenue,
            "total_appointments": total_appointments,
            "avg_daily_revenue": round(avg_daily, 2),
            "best_day": max(data, key=lambda x: x["revenue"]) if data else None,
        },
    }


@router.get("/monthly-revenue")
def monthly_revenue_report(
    year: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin),
):
    target_year = year or date.today().year

    rows = (
        db.query(
            extract("month", models.Appointment.date).label("month"),
            func.count(models.Appointment.id).label("appointments"),
            func.sum(models.Appointment.total_amount).label("revenue"),
        )
        .filter(
            extract("year", models.Appointment.date) == target_year,
            *_revenue_filter(),
        )
        .group_by(extract("month", models.Appointment.date))
        .order_by(extract("month", models.Appointment.date))
        .all()
    )

    months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]
    row_map = {int(r.month): r for r in rows}
    data = []
    for i in range(1, 13):
        r = row_map.get(i)
        data.append({
            "month": months[i - 1],
            "month_num": i,
            "appointments": r.appointments if r else 0,
            "revenue": float(r.revenue) if r else 0.0,
        })

    total_revenue = sum(d["revenue"] for d in data)
    total_appointments = sum(d["appointments"] for d in data)
    best_month = max(data, key=lambda x: x["revenue"]) if data else None

    return {
        "year": target_year,
        "data": data,
        "summary": {
            "total_revenue": total_revenue,
            "total_appointments": total_appointments,
            "avg_monthly_revenue": round(total_revenue / 12, 2),
            "best_month": best_month,
        },
    }


@router.get("/popular-services")
def popular_services_report(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin),
):
    rows = (
        db.query(
            models.Service.id,
            models.Service.name,
            models.Service.category,
            models.Service.price,
            func.count(models.appointment_services.c.appointment_id).label("bookings"),
        )
        .join(
            models.appointment_services,
            models.Service.id == models.appointment_services.c.service_id,
        )
        .join(
            models.Appointment,
            models.Appointment.id == models.appointment_services.c.appointment_id,
        )
        .filter(*_revenue_filter())
        .group_by(models.Service.id)
        .order_by(func.count(models.appointment_services.c.appointment_id).desc())
        .all()
    )

    total_bookings = sum(r.bookings for r in rows) or 1
    data = []
    for r in rows:
        revenue = float(r.price) * r.bookings
        data.append({
            "id": r.id,
            "name": r.name,
            "category": r.category,
            "price": float(r.price),
            "bookings": r.bookings,
            "revenue": revenue,
            "percentage": round((r.bookings / total_bookings) * 100, 1),
        })

    return {"data": data, "total_bookings": total_bookings}


@router.get("/frequent-customers")
def frequent_customers_report(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin),
):
    rows = (
        db.query(
            models.Customer.id,
            models.Customer.name,
            models.Customer.phone,
            func.count(models.Appointment.id).label("visits"),
            func.sum(models.Appointment.total_amount).label("total_spent"),
            func.max(models.Appointment.date).label("last_visit"),
        )
        .join(models.Appointment)
        .filter(*_revenue_filter())
        .group_by(models.Customer.id)
        .order_by(func.count(models.Appointment.id).desc())
        .limit(20)
        .all()
    )

    data = []
    for r in rows:
        data.append({
            "id": r.id,
            "name": r.name,
            "phone": r.phone,
            "visits": r.visits,
            "total_spent": float(r.total_spent),
            "last_visit": r.last_visit.isoformat() if r.last_visit else None,
            "avg_spend": round(float(r.total_spent) / max(r.visits, 1), 2),
        })

    return {"data": data}
