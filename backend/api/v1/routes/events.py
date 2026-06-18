from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.core.infrastructure.database import get_db
from backend.core.domain.models import MonitoringEvent, MonitoringIncident, MonitoringTarget, User
from backend.api.v1.dependencies import get_current_user

router = APIRouter(prefix="/events", tags=["events"])


# ── Events ────────────────────────────────────────────────────────────────────

@router.get("")
def list_events(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    severity: Optional[str] = None,
    status: Optional[str] = None,
    event_type: Optional[str] = None,
    target_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(MonitoringEvent)
    if not current_user.is_super_admin:
        q = q.filter(MonitoringEvent.organization_id == current_user.organization_id)
    if severity: q = q.filter(MonitoringEvent.severity == severity)
    if status: q = q.filter(MonitoringEvent.status == status)
    if event_type: q = q.filter(MonitoringEvent.event_type == event_type)
    if target_id: q = q.filter(MonitoringEvent.target_id == target_id)
    total = q.count()
    items = q.order_by(desc(MonitoringEvent.created_at)).offset((page-1)*per_page).limit(per_page).all()
    return {"items": [_event_dict(e) for e in items], "total": total, "page": page, "per_page": per_page}


@router.patch("/{event_id}/acknowledge")
def acknowledge_event(event_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    e = _get_event_or_404(db, event_id, current_user)
    e.status = "acknowledged"
    db.commit(); db.refresh(e)
    return _event_dict(e)


@router.patch("/{event_id}/resolve")
def resolve_event(event_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    e = _get_event_or_404(db, event_id, current_user)
    e.status = "resolved"
    e.resolved_at = datetime.utcnow()
    db.commit(); db.refresh(e)
    return _event_dict(e)


@router.get("/stats")
def event_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(MonitoringEvent)
    if not current_user.is_super_admin:
        q = q.filter(MonitoringEvent.organization_id == current_user.organization_id)
    total = q.count()
    open_ = q.filter(MonitoringEvent.status == "open").count()
    acked = q.filter(MonitoringEvent.status == "acknowledged").count()
    resolved = q.filter(MonitoringEvent.status == "resolved").count()
    critical = q.filter(MonitoringEvent.severity == "critical").count()
    emergency = q.filter(MonitoringEvent.severity == "emergency").count()
    return {"total": total, "open": open_, "acknowledged": acked, "resolved": resolved,
            "critical": critical, "emergency": emergency}


# ── Incidents ─────────────────────────────────────────────────────────────────

@router.get("/incidents")
def list_incidents(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    severity: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(MonitoringIncident)
    if not current_user.is_super_admin:
        q = q.filter(MonitoringIncident.organization_id == current_user.organization_id)
    if status: q = q.filter(MonitoringIncident.status == status)
    if severity: q = q.filter(MonitoringIncident.severity == severity)
    total = q.count()
    items = q.order_by(desc(MonitoringIncident.created_at)).offset((page-1)*per_page).limit(per_page).all()
    return {"items": [_incident_dict(i) for i in items], "total": total, "page": page, "per_page": per_page}


@router.post("/incidents", status_code=201)
def create_incident(body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    inc = MonitoringIncident(
        organization_id=current_user.organization_id,
        title=body["title"],
        description=body.get("description"),
        severity=body.get("severity", "warning"),
        root_cause_target_id=body.get("root_cause_target_id"),
    )
    db.add(inc); db.commit(); db.refresh(inc)
    return _incident_dict(inc)


@router.patch("/incidents/{incident_id}/acknowledge")
def acknowledge_incident(incident_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    inc = _get_incident_or_404(db, incident_id, current_user)
    inc.status = "acknowledged"
    inc.acknowledged_at = datetime.utcnow()
    db.commit(); db.refresh(inc)
    return _incident_dict(inc)


@router.patch("/incidents/{incident_id}/resolve")
def resolve_incident(incident_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    inc = _get_incident_or_404(db, incident_id, current_user)
    inc.status = "resolved"
    inc.resolved_at = datetime.utcnow()
    db.commit(); db.refresh(inc)
    return _incident_dict(inc)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_event_or_404(db, event_id, current_user):
    e = db.query(MonitoringEvent).filter(MonitoringEvent.id == event_id).first()
    if not e: raise HTTPException(404, "Event not found")
    if not current_user.is_super_admin and e.organization_id != current_user.organization_id:
        raise HTTPException(403, "Access denied")
    return e


def _get_incident_or_404(db, incident_id, current_user):
    inc = db.query(MonitoringIncident).filter(MonitoringIncident.id == incident_id).first()
    if not inc: raise HTTPException(404, "Incident not found")
    if not current_user.is_super_admin and inc.organization_id != current_user.organization_id:
        raise HTTPException(403, "Access denied")
    return inc


def _event_dict(e: MonitoringEvent) -> dict:
    return {
        "id": e.id, "event_type": e.event_type, "severity": e.severity,
        "title": e.title, "description": e.description,
        "metric_name": e.metric_name, "metric_value": e.metric_value,
        "threshold_value": e.threshold_value, "status": e.status,
        "target_id": e.target_id,
        "target_name": e.target.name if e.target else None,
        "target_host": e.target.host if e.target else None,
        "incident_id": e.incident_id,
        "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


def _incident_dict(i: MonitoringIncident) -> dict:
    return {
        "id": i.id, "title": i.title, "description": i.description,
        "severity": i.severity, "status": i.status,
        "root_cause_target_id": i.root_cause_target_id,
        "event_count": i.event_count, "affected_targets": i.affected_targets,
        "acknowledged_at": i.acknowledged_at.isoformat() if i.acknowledged_at else None,
        "resolved_at": i.resolved_at.isoformat() if i.resolved_at else None,
        "created_at": i.created_at.isoformat() if i.created_at else None,
        "updated_at": i.updated_at.isoformat() if i.updated_at else None,
    }
