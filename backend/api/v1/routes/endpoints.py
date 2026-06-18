from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import Endpoint, SoftwareInstallation, EndpointPatch, EndpointVulnerability, ComplianceCheck, Job, RemoteAction
from backend.api.v1.dependencies import get_current_user
from backend.core.domain.models import User

router = APIRouter(prefix="/endpoints", tags=["endpoints"])


def _ep_or_403(endpoint_id: int, db: Session, current_user: User) -> Endpoint:
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    if not current_user.is_super_admin and ep.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    return ep


@router.get("")
def list_endpoints(
    search: str = Query(None),
    platform: str = Query(None),
    status: str = Query(None),
    agent_status: str = Query(None),
    site_id: int = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Endpoint)
    if not current_user.is_super_admin:
        q = q.filter(Endpoint.organization_id == current_user.organization_id)
    if search:
        q = q.filter(
            Endpoint.hostname.ilike(f"%{search}%") |
            Endpoint.ip_address.ilike(f"%{search}%") |
            Endpoint.os_name.ilike(f"%{search}%")
        )
    if platform:
        q = q.filter(Endpoint.platform == platform)
    if status:
        q = q.filter(Endpoint.status == status)
    if agent_status:
        now = datetime.utcnow()
        from sqlalchemy import and_
        eps = q.all()
        for ep in eps:
            if ep.last_seen and (now - ep.last_seen).total_seconds() > 300 and ep.agent_status == "online":
                ep.agent_status = "offline"
        db.commit()
        q = q.filter(Endpoint.agent_status == agent_status)
    if site_id:
        q = q.filter(Endpoint.site_id == site_id)
    total = q.count()
    items = q.order_by(Endpoint.hostname).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.get("/{endpoint_id}")
def get_endpoint(endpoint_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _ep_or_403(endpoint_id, db, current_user)


@router.get("/{endpoint_id}/software")
def list_software(
    endpoint_id: int,
    search: str = Query(None),
    is_system: bool = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _ep_or_403(endpoint_id, db, current_user)
    q = db.query(SoftwareInstallation).filter(SoftwareInstallation.endpoint_id == endpoint_id)
    if search:
        q = q.filter(SoftwareInstallation.name.ilike(f"%{search}%") | SoftwareInstallation.publisher.ilike(f"%{search}%"))
    if is_system is not None:
        q = q.filter(SoftwareInstallation.is_system == is_system)
    total = q.count()
    items = q.order_by(SoftwareInstallation.name).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.get("/{endpoint_id}/patches")
def list_patches(
    endpoint_id: int,
    status: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _ep_or_403(endpoint_id, db, current_user)
    q = db.query(EndpointPatch).filter(EndpointPatch.endpoint_id == endpoint_id)
    if status:
        q = q.filter(EndpointPatch.status == status)
    return q.all()


@router.get("/{endpoint_id}/vulnerabilities")
def list_vulns(
    endpoint_id: int,
    status: str = Query(None),
    severity: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _ep_or_403(endpoint_id, db, current_user)
    q = db.query(EndpointVulnerability).filter(EndpointVulnerability.endpoint_id == endpoint_id)
    if status:
        q = q.filter(EndpointVulnerability.status == status)
    return q.all()


@router.get("/{endpoint_id}/compliance")
def list_compliance(
    endpoint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _ep_or_403(endpoint_id, db, current_user)
    return db.query(ComplianceCheck).filter(ComplianceCheck.endpoint_id == endpoint_id).all()


@router.get("/{endpoint_id}/jobs")
def list_jobs(
    endpoint_id: int,
    status: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _ep_or_403(endpoint_id, db, current_user)
    q = db.query(Job).filter(Job.endpoint_id == endpoint_id)
    if status:
        q = q.filter(Job.status == status)
    return q.order_by(Job.created_at.desc()).limit(50).all()


@router.get("/{endpoint_id}/remote-actions")
def list_remote_actions(
    endpoint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _ep_or_403(endpoint_id, db, current_user)
    return db.query(RemoteAction).filter(RemoteAction.endpoint_id == endpoint_id).order_by(RemoteAction.queued_at.desc()).limit(50).all()


@router.patch("/{endpoint_id}")
def update_endpoint(endpoint_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ep = _ep_or_403(endpoint_id, db, current_user)
    for k, v in body.items():
        if hasattr(ep, k) and k not in ("id", "uuid", "organization_id"):
            setattr(ep, k, v)
    db.commit()
    db.refresh(ep)
    return ep


@router.delete("/{endpoint_id}", status_code=204)
def delete_endpoint(endpoint_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ep = _ep_or_403(endpoint_id, db, current_user)
    db.delete(ep)
    db.commit()
