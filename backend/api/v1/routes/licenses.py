from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import LicenseRecord, LicenseAssignment
from backend.api.v1.dependencies import get_current_user
from backend.core.domain.models import User

router = APIRouter(prefix="/licenses", tags=["licenses"])


@router.get("")
def list_licenses(
    search: str = Query(None),
    status: str = Query(None),
    license_type: str = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(LicenseRecord)
    if not current_user.is_super_admin:
        q = q.filter(LicenseRecord.organization_id == current_user.organization_id)
    if search:
        q = q.filter(LicenseRecord.product.ilike(f"%{search}%") | LicenseRecord.vendor.ilike(f"%{search}%"))
    if status:
        q = q.filter(LicenseRecord.status == status)
    if license_type:
        q = q.filter(LicenseRecord.license_type == license_type)
    total = q.count()
    items = q.order_by(LicenseRecord.vendor, LicenseRecord.product).offset((page - 1) * per_page).limit(per_page).all()
    result = []
    for lic in items:
        used = db.query(func.count(LicenseAssignment.id)).filter(LicenseAssignment.license_id == lic.id).scalar() or 0
        d = {c.name: getattr(lic, c.name) for c in lic.__table__.columns}
        d["used_count"] = used
        d["available"] = max(0, lic.quantity - used)
        result.append(d)
    return {"total": total, "page": page, "per_page": per_page, "items": result}


@router.post("")
def create_license(body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = body.get("organization_id") or current_user.organization_id
    if not current_user.is_super_admin:
        org_id = current_user.organization_id
    lic = LicenseRecord(
        organization_id=org_id,
        vendor=body.get("vendor", ""),
        product=body.get("product", ""),
        edition=body.get("edition"),
        version=body.get("version"),
        license_type=body.get("license_type", "per_seat"),
        quantity=body.get("quantity", 1),
        cost_per_unit=body.get("cost_per_unit"),
        currency=body.get("currency", "BRL"),
        cost_center=body.get("cost_center"),
        purchase_date=body.get("purchase_date"),
        expiry_date=body.get("expiry_date"),
        renewal_date=body.get("renewal_date"),
        license_key=body.get("license_key"),
        notes=body.get("notes"),
        status=body.get("status", "active"),
    )
    db.add(lic)
    db.commit()
    db.refresh(lic)
    return lic


@router.get("/summary")
def license_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(LicenseRecord)
    if not current_user.is_super_admin:
        q = q.filter(LicenseRecord.organization_id == current_user.organization_id)
    all_lics = q.all()
    total_licenses = len(all_lics)
    total_seats = sum(l.quantity for l in all_lics)
    total_cost = sum((l.cost_per_unit or 0) * l.quantity for l in all_lics)
    expiring_soon = [l for l in all_lics if l.expiry_date and l.expiry_date <= (datetime.utcnow().date().isoformat()[:7] + "-31")]
    return {
        "total_licenses": total_licenses,
        "total_seats": total_seats,
        "total_annual_cost": total_cost,
        "expiring_soon": len(expiring_soon),
    }


@router.get("/{license_id}")
def get_license(license_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lic = db.query(LicenseRecord).filter(LicenseRecord.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and lic.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    return lic


@router.patch("/{license_id}")
def update_license(license_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lic = db.query(LicenseRecord).filter(LicenseRecord.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and lic.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    for k, v in body.items():
        if hasattr(lic, k) and k not in ("id", "organization_id"):
            setattr(lic, k, v)
    db.commit()
    db.refresh(lic)
    return lic


@router.delete("/{license_id}", status_code=204)
def delete_license(license_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lic = db.query(LicenseRecord).filter(LicenseRecord.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and lic.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    db.delete(lic)
    db.commit()


@router.post("/{license_id}/assign")
def assign_license(license_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lic = db.query(LicenseRecord).filter(LicenseRecord.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and lic.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    assignment = LicenseAssignment(
        license_id=license_id,
        endpoint_id=body.get("endpoint_id"),
        user_id=body.get("user_id"),
        notes=body.get("notes"),
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get("/{license_id}/assignments")
def list_assignments(license_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lic = db.query(LicenseRecord).filter(LicenseRecord.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and lic.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    return db.query(LicenseAssignment).filter(LicenseAssignment.license_id == license_id).all()
