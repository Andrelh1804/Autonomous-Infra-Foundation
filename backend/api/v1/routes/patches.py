from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import Patch, EndpointPatch, Endpoint
from backend.api.v1.dependencies import get_current_user
from backend.core.domain.models import User

router = APIRouter(prefix="/patches", tags=["patches"])


@router.get("")
def list_patches(
    search: str = Query(None),
    severity: str = Query(None),
    platform: str = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Patch)
    if search:
        q = q.filter(Patch.title.ilike(f"%{search}%") | Patch.kb_article.ilike(f"%{search}%"))
    if severity:
        q = q.filter(Patch.severity == severity)
    if platform:
        q = q.filter(Patch.platform == platform)
    total = q.count()
    items = q.order_by(Patch.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.get("/endpoint-patches")
def list_endpoint_patches(
    endpoint_id: int = Query(None),
    status: str = Query(None),
    severity: str = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(EndpointPatch)
    if not current_user.is_super_admin:
        q = q.filter(EndpointPatch.organization_id == current_user.organization_id)
    if endpoint_id:
        q = q.filter(EndpointPatch.endpoint_id == endpoint_id)
    if status:
        q = q.filter(EndpointPatch.status == status)
    if severity:
        q = q.join(Patch).filter(Patch.severity == severity)
    total = q.count()
    items = q.order_by(EndpointPatch.detected_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.get("/summary")
def patch_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(EndpointPatch)
    if not current_user.is_super_admin:
        q = q.filter(EndpointPatch.organization_id == current_user.organization_id)
    total = q.count()
    pending = q.filter(EndpointPatch.status == "pending").count()
    installed = q.filter(EndpointPatch.status == "installed").count()
    failed = q.filter(EndpointPatch.status == "failed").count()
    critical = q.join(Patch).filter(Patch.severity == "critical").count()
    return {"total": total, "pending": pending, "installed": installed, "failed": failed, "critical": critical}


@router.post("/bulk-report")
def bulk_report_patches(body: dict, db: Session = Depends(get_db)):
    endpoint_id = body.get("endpoint_id")
    patches = body.get("patches", [])
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404)
    installed_count = 0
    pending_count = 0
    for p in patches:
        patch_record = None
        if p.get("patch_id"):
            patch_record = db.query(Patch).filter(Patch.patch_id == p["patch_id"]).first()
        if not patch_record:
            patch_record = Patch(
                patch_id=p.get("patch_id", f"PATCH-{endpoint_id}-{p.get('title','')[:20]}"),
                title=p.get("title", ""),
                description=p.get("description"),
                platform=p.get("platform", ep.platform),
                severity=p.get("severity", "moderate"),
                kb_article=p.get("kb_article"),
                product=p.get("product"),
                requires_reboot=p.get("requires_reboot", False),
                release_date=p.get("release_date"),
            )
            db.add(patch_record)
            db.flush()
        ep_patch = db.query(EndpointPatch).filter(
            EndpointPatch.endpoint_id == endpoint_id,
            EndpointPatch.patch_id == patch_record.id
        ).first()
        if not ep_patch:
            ep_patch = EndpointPatch(
                endpoint_id=endpoint_id,
                patch_id=patch_record.id,
                organization_id=ep.organization_id,
                status=p.get("status", "pending"),
            )
            db.add(ep_patch)
        else:
            ep_patch.status = p.get("status", ep_patch.status)
        if p.get("status") == "installed":
            installed_count += 1
        else:
            pending_count += 1
    total = installed_count + pending_count
    if total > 0:
        ep.patch_score = round(installed_count / total * 100)
    db.commit()
    return {"status": "ok", "total": total, "installed": installed_count, "pending": pending_count}
