from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from .. import models, database, auth
from datetime import date, timedelta

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

# Revenue filter: completed + paid only
def _revenue_filter():
    return [
        models.Appointment.status == "completed",
        models.Appointment.payment_status == "paid",
    ]

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    today = date.today()

    total_customers = db.query(models.Customer).count()

    # Today's appointments (all statuses)
    appointments_today = db.query(models.Appointment).filter(
        models.Appointment.date == today
    ).count()

    # Upcoming appointments (booked/pending, today and future)
    upcoming_appointments = db.query(models.Appointment).filter(
        models.Appointment.date >= today,
        models.Appointment.status.in_(["booked", "pending"])
    ).count()

    # Total revenue (all time, completed + paid only)
    total_revenue = db.query(func.sum(models.Appointment.total_amount)).filter(
        *_revenue_filter()
    ).scalar() or 0.0

    # Revenue today
    revenue_today = db.query(func.sum(models.Appointment.total_amount)).filter(
        models.Appointment.date == today,
        *_revenue_filter()
    ).scalar() or 0.0

    # Revenue this month
    first_of_month = today.replace(day=1)
    revenue_month = db.query(func.sum(models.Appointment.total_amount)).filter(
        models.Appointment.date >= first_of_month,
        *_revenue_filter()
    ).scalar() or 0.0

    # Revenue last 7 days breakdown for chart
    revenue_7days = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        day_rev = db.query(func.sum(models.Appointment.total_amount)).filter(
            models.Appointment.date == d,
            *_revenue_filter()
        ).scalar() or 0.0
        revenue_7days.append({"date": d.isoformat(), "revenue": float(day_rev)})

    # Customers last 6 months for chart
    customer_growth = []
    for i in range(5, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        count = db.query(models.Customer).filter(
            extract('year', models.Customer.created_at) == y,
            extract('month', models.Customer.created_at) == m
        ).count()
        month_label = date(y, m, 1).strftime("%b %Y")
        customer_growth.append({"month": month_label, "count": count})

    # Recent activity (last 10 appointments with details)
    recent = db.query(models.Appointment).order_by(
        models.Appointment.date.desc(),
        models.Appointment.time.desc()
    ).limit(10).all()

    recent_activity = []
    for a in recent:
        recent_activity.append({
            "id": a.id,
            "customer_name": a.customer.name if a.customer else "Unknown",
            "date": a.date.isoformat(),
            "time": str(a.time)[:5],
            "status": a.status,
            "payment_status": a.payment_status or "unpaid",
            "total_amount": float(a.total_amount),
            "services": [s.service_name for s in a.services],
            "staff_name": a.assigned_staff.name if a.assigned_staff else None,
        })

    # Top customers by revenue (completed + paid only)
    top_customers = db.query(
        models.Customer.name,
        func.count(models.Appointment.id).label("visits"),
        func.sum(models.Appointment.total_amount).label("spent")
    ).join(models.Appointment).filter(
        *_revenue_filter()
    ).group_by(models.Customer.id).order_by(
        func.sum(models.Appointment.total_amount).desc()
    ).limit(5).all()

    top_customers_list = [
        {"name": c.name, "visits": c.visits, "spent": float(c.spent)}
        for c in top_customers
    ]

    return {
        "total_customers": total_customers,
        "appointments_today": appointments_today,
        "upcoming_appointments": upcoming_appointments,
        "total_revenue": float(total_revenue),
        "revenue_today": float(revenue_today),
        "revenue_month": float(revenue_month),
        "revenue_7days": revenue_7days,
        "customer_growth": customer_growth,
        "recent_activity": recent_activity,
        "top_customers": top_customers_list,
    }
