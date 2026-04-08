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
    # Get per-appointment service details with the appointment total
    rows = (
        db.query(
            models.AppointmentService.appointment_id,
            models.AppointmentService.service_id,
            models.AppointmentService.price_at_booking,
            models.Appointment.total_amount,
            models.Service.id.label("sid"),
            models.Service.name,
            models.Service.category,
            models.Service.price,
        )
        .join(
            models.Appointment,
            models.Appointment.id == models.AppointmentService.appointment_id,
        )
        .join(
            models.Service,
            models.Service.id == models.AppointmentService.service_id,
        )
        .filter(*_revenue_filter())
        .all()
    )

    # For each appointment, compute each service's proportional share of total_amount
    # Group by appointment first to get per-appointment totals
    from collections import defaultdict
    appt_services = defaultdict(list)  # appointment_id -> list of (service_id, price_at_booking)
    appt_total = {}  # appointment_id -> total_amount
    service_info = {}  # service_id -> (name, category, price)

    for r in rows:
        appt_services[r.appointment_id].append((r.service_id, float(r.price_at_booking or 0)))
        appt_total[r.appointment_id] = float(r.total_amount or 0)
        service_info[r.service_id] = (r.name, r.category, float(r.price))

    # Calculate proportional revenue per service
    service_revenue = defaultdict(float)
    service_bookings = defaultdict(int)

    for appt_id, svc_list in appt_services.items():
        total = appt_total[appt_id]
        sum_prices = sum(p for _, p in svc_list)
        for svc_id, price in svc_list:
            service_bookings[svc_id] += 1
            if sum_prices > 0:
                service_revenue[svc_id] += (price / sum_prices) * total
            else:
                service_revenue[svc_id] += total / len(svc_list)

    total_bookings = sum(service_bookings.values()) or 1
    data = []
    for svc_id, (name, category, price) in service_info.items():
        bookings = service_bookings[svc_id]
        revenue = service_revenue[svc_id]
        data.append({
            "id": svc_id,
            "name": name,
            "category": category,
            "price": price,
            "bookings": bookings,
            "revenue": round(revenue, 2),
            "percentage": round((bookings / total_bookings) * 100, 1),
        })

    data.sort(key=lambda x: x["bookings"], reverse=True)
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
