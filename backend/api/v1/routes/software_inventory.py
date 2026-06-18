from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import SoftwareInstallation, Endpoint
from backend.api.v1.dependencies import get_current_user
from backend.core.domain.models import User

router = APIRouter(prefix="/software-inventory", tags=["software-inventory"])


@router.get("")
def list_software(
    search: str = Query(None),
    publisher: str = Query(None),
    is_system: bool = Query(None),
    endpoint_id: int = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(SoftwareInstallation)
    if not current_user.is_super_admin:
        q = q.filter(SoftwareInstallation.organization_id == current_user.organization_id)
    if search:
        q = q.filter(
            SoftwareInstallation.name.ilike(f"%{search}%") |
            SoftwareInstallation.publisher.ilike(f"%{search}%")
        )
    if publisher:
        q = q.filter(SoftwareInstallation.publisher.ilike(f"%{publisher}%"))
    if is_system is not None:
        q = q.filter(SoftwareInstallation.is_system == is_system)
    if endpoint_id:
        q = q.filter(SoftwareInstallation.endpoint_id == endpoint_id)
    total = q.count()
    items = q.order_by(SoftwareInstallation.name).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.get("/summary")
def software_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(SoftwareInstallation)
    if not current_user.is_super_admin:
        q = q.filter(SoftwareInstallation.organization_id == current_user.organization_id)
    total = q.count()
    unique_apps = db.query(func.count(func.distinct(SoftwareInstallation.name)))
    if not current_user.is_super_admin:
        unique_apps = unique_apps.filter(SoftwareInstallation.organization_id == current_user.organization_id)
    unique_count = unique_apps.scalar() or 0
    top_q = db.query(
        SoftwareInstallation.name,
        SoftwareInstallation.publisher,
        func.count(SoftwareInstallation.id).label("install_count")
    )
    if not current_user.is_super_admin:
        top_q = top_q.filter(SoftwareInstallation.organization_id == current_user.organization_id)
    top = top_q.group_by(SoftwareInstallation.name, SoftwareInstallation.publisher).order_by(func.count(SoftwareInstallation.id).desc()).limit(20).all()
    return {
        "total_installations": total,
        "unique_applications": unique_count,
        "top_applications": [{"name": r.name, "publisher": r.publisher, "install_count": r.install_count} for r in top]
    }


@router.post("/bulk-report")
def bulk_report_software(body: dict, db: Session = Depends(get_db)):
    endpoint_id = body.get("endpoint_id")
    org_id = body.get("organization_id")
    items = body.get("software", [])
    if not endpoint_id or not items:
        raise HTTPException(status_code=400, detail="endpoint_id and software list required")
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    for sw in items:
        existing = db.query(SoftwareInstallation).filter(
            SoftwareInstallation.endpoint_id == endpoint_id,
            SoftwareInstallation.name == sw.get("name"),
            SoftwareInstallation.version == sw.get("version")
        ).first()
        if not existing:
            inst = SoftwareInstallation(
                endpoint_id=endpoint_id,
                organization_id=ep.organization_id,
                name=sw.get("name", ""),
                publisher=sw.get("publisher"),
                version=sw.get("version"),
                install_date=sw.get("install_date"),
                install_location=sw.get("install_location"),
                install_size_mb=sw.get("install_size_mb"),
                is_system=sw.get("is_system", False),
                is_64bit=sw.get("is_64bit", True),
                source=sw.get("source", "registry"),
                uninstall_string=sw.get("uninstall_string"),
            )
            db.add(inst)
    db.commit()
    return {"status": "ok", "reported": len(items)}


@router.delete("/{sw_id}", status_code=204)
def delete_software(sw_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sw = db.query(SoftwareInstallation).filter(SoftwareInstallation.id == sw_id).first()
    if not sw:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and sw.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    db.delete(sw)
    db.commit()
