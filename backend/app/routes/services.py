from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas, database, auth

router = APIRouter(prefix="/api/services", tags=["Services"])

@router.get("/", response_model=List[schemas.ServiceResponse])
def get_services(db: Session = Depends(database.get_db)):
    # Return only top-level services (parent_id is None), sub_services load via relationship
    services = db.query(models.Service).filter(models.Service.parent_id == None).all()
    return services

@router.get("/all", response_model=List[schemas.SubServiceResponse])
def get_all_services_flat(db: Session = Depends(database.get_db)):
    """Return all services (parents + subs) as a flat list - used by appointment booking."""
    return db.query(models.Service).all()

@router.get("/categories")
def get_categories(db: Session = Depends(database.get_db)):
    """Return all unique categories with their sub-categories."""
    services = db.query(models.Service).all()
    cats: dict = {}
    for s in services:
        cat = s.category or 'Uncategorized'
        if cat not in cats:
            cats[cat] = set()
        if s.sub_category:
            cats[cat].add(s.sub_category)
    return {cat: sorted(list(subs)) for cat, subs in cats.items()}

@router.post("/", response_model=schemas.ServiceResponse)
def create_service(service: schemas.ServiceCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    if service.parent_id:
        parent = db.query(models.Service).filter(models.Service.id == service.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent service not found")
    new_service = models.Service(**service.model_dump())
    db.add(new_service)
    db.commit()
    db.refresh(new_service)
    return new_service

@router.put("/{service_id}", response_model=schemas.ServiceResponse)
def update_service(service_id: int, service_update: schemas.ServiceCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    service = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    for key, value in service_update.model_dump().items():
        setattr(service, key, value)
    db.commit()
    db.refresh(service)
    return service

@router.delete("/{service_id}")
def delete_service(service_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    service = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # Also delete sub-services
    sub_ids = [s.id for s in service.sub_services]
    all_ids = [service_id] + sub_ids

    # Clear FK reference but keep snapshot data for history
    db.query(models.AppointmentService).filter(
        models.AppointmentService.service_id.in_(all_ids)
    ).update({models.AppointmentService.service_id: None}, synchronize_session='fetch')

    # Delete sub-services first, then parent
    for sub in service.sub_services:
        db.delete(sub)
    db.delete(service)
    db.commit()
    return {"detail": "Service deleted successfully"}

@router.delete("/category/{category_name}")
def delete_category(category_name: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Delete all services in a category."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    services = db.query(models.Service).filter(models.Service.category == category_name).all()
    if not services:
        raise HTTPException(status_code=404, detail="Category not found")

    all_ids = [s.id for s in services]
    # Clear FK references in appointment history
    db.query(models.AppointmentService).filter(
        models.AppointmentService.service_id.in_(all_ids)
    ).update({models.AppointmentService.service_id: None}, synchronize_session='fetch')

    for s in services:
        db.delete(s)
    db.commit()
    return {"detail": f"Category '{category_name}' and all its services deleted"}

@router.delete("/category/{category_name}/sub/{sub_category_name}")
def delete_sub_category(category_name: str, sub_category_name: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Delete all services in a sub-category."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    services = db.query(models.Service).filter(
        models.Service.category == category_name,
        models.Service.sub_category == sub_category_name,
    ).all()
    if not services:
        raise HTTPException(status_code=404, detail="Sub-category not found")

    all_ids = [s.id for s in services]
    # Also get sub-services of these services
    sub_service_ids = []
    for s in services:
        sub_service_ids.extend([sub.id for sub in s.sub_services])
    all_ids.extend(sub_service_ids)

    db.query(models.AppointmentService).filter(
        models.AppointmentService.service_id.in_(all_ids)
    ).update({models.AppointmentService.service_id: None}, synchronize_session='fetch')

    # Delete sub-services first
    for s in services:
        for sub in s.sub_services:
            db.delete(sub)
    for s in services:
        db.delete(s)
    db.commit()
    return {"detail": f"Sub-category '{sub_category_name}' deleted"}
