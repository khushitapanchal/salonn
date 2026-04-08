from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas, database, auth

router = APIRouter(prefix="/api/packages", tags=["Packages"])


def _build_response(pkg: models.Package) -> dict:
    """Build package response with nested service details."""
    return {
        "id": pkg.id,
        "name": pkg.name,
        "price": float(pkg.price),
        "duration": pkg.duration,
        "created_at": pkg.created_at,
        "services": [
            {
                "id": ps.service.id,
                "name": ps.service.name,
                "category": ps.service.category,
                "sub_category": ps.service.sub_category,
                "price": float(ps.service.price),
                "duration": ps.service.duration,
            }
            for ps in pkg.services if ps.service
        ],
    }


@router.get("/", response_model=List[schemas.PackageResponse])
def get_packages(db: Session = Depends(database.get_db)):
    packages = db.query(models.Package).all()
    return [_build_response(p) for p in packages]


@router.post("/", response_model=schemas.PackageResponse)
def create_package(
    pkg: schemas.PackageCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Validate that all service IDs exist
    for sid in pkg.service_ids:
        svc = db.query(models.Service).filter(models.Service.id == sid).first()
        if not svc:
            raise HTTPException(status_code=404, detail=f"Service with id {sid} not found")

    new_pkg = models.Package(name=pkg.name, price=pkg.price, duration=pkg.duration)
    db.add(new_pkg)
    db.flush()

    for sid in pkg.service_ids:
        db.add(models.PackageService(package_id=new_pkg.id, service_id=sid))

    db.commit()
    db.refresh(new_pkg)
    return _build_response(new_pkg)


@router.put("/{package_id}", response_model=schemas.PackageResponse)
def update_package(
    package_id: int,
    pkg: schemas.PackageCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    existing = db.query(models.Package).filter(models.Package.id == package_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Package not found")

    existing.name = pkg.name
    existing.price = pkg.price
    existing.duration = pkg.duration

    # Replace services
    db.query(models.PackageService).filter(models.PackageService.package_id == package_id).delete()
    for sid in pkg.service_ids:
        db.add(models.PackageService(package_id=package_id, service_id=sid))

    db.commit()
    db.refresh(existing)
    return _build_response(existing)


@router.delete("/{package_id}")
def delete_package(
    package_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    pkg = db.query(models.Package).filter(models.Package.id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")

    db.delete(pkg)
    db.commit()
    return {"detail": "Package deleted successfully"}
