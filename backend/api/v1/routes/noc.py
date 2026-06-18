from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.core.infrastructure.database import get_db
from backend.core.domain.models import (
    MonitoringTarget, MonitoringEvent, MonitoringIncident,
    PrinterSupply, MetricSample, User,
)
from backend.api.v1.dependencies import get_current_user

router = APIRouter(prefix="/noc", tags=["noc"])


@router.get("/overview")
def noc_overview(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org_filter = {} if current_user.is_super_admin else {"organization_id": current_user.organization_id}

    tq = db.query(MonitoringTarget)
    if not current_user.is_super_admin:
        tq = tq.filter(MonitoringTarget.organization_id == current_user.organization_id)
    targets = tq.all()
    total_targets = len(targets)
    online = sum(1 for t in targets if t.is_online is True)
    offline = sum(1 for t in targets if t.is_online is False)

    eq = db.query(MonitoringEvent)
    if not current_user.is_super_admin:
        eq = eq.filter(MonitoringEvent.organization_id == current_user.organization_id)
    open_events = eq.filter(MonitoringEvent.status == "open").count()
    critical_events = eq.filter(MonitoringEvent.severity.in_(["critical","emergency"]), MonitoringEvent.status == "open").count()

    iq = db.query(MonitoringIncident)
    if not current_user.is_super_admin:
        iq = iq.filter(MonitoringIncident.organization_id == current_user.organization_id)
    open_incidents = iq.filter(MonitoringIncident.status == "open").count()

    pq = db.query(PrinterSupply).join(MonitoringTarget)
    if not current_user.is_super_admin:
        pq = pq.filter(MonitoringTarget.organization_id == current_user.organization_id)
    critical_supplies = pq.filter(PrinterSupply.risk_level.in_(["critical","empty"])).count()

    avg_health = round(sum(t.health_score or 100 for t in targets) / max(total_targets, 1), 1)

    status = "healthy"
    if critical_events > 0 or offline > total_targets * 0.3:
        status = "critical"
    elif open_events > 5 or offline > 0:
        status = "degraded"

    return {
        "status": status,
        "targets": {"total": total_targets, "online": online, "offline": offline, "unknown": total_targets - online - offline},
        "events": {"open": open_events, "critical": critical_events},
        "incidents": {"open": open_incidents},
        "printers": {"critical_supplies": critical_supplies},
        "avg_health": avg_health,
        "updated_at": datetime.utcnow().isoformat(),
    }


@router.get("/timeline")
def noc_timeline(hours: int = 24, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    since = datetime.utcnow() - timedelta(hours=hours)
    q = db.query(MonitoringEvent).filter(MonitoringEvent.created_at >= since)
    if not current_user.is_super_admin:
        q = q.filter(MonitoringEvent.organization_id == current_user.organization_id)
    events = q.order_by(desc(MonitoringEvent.created_at)).limit(100).all()
    return [
        {
            "id": e.id, "title": e.title, "severity": e.severity,
            "status": e.status, "event_type": e.event_type,
            "target_name": e.target.name if e.target else None,
            "created_at": e.created_at.isoformat(),
        }
        for e in events
    ]


@router.get("/health-map")
def health_map(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(MonitoringTarget)
    if not current_user.is_super_admin:
        q = q.filter(MonitoringTarget.organization_id == current_user.organization_id)
    targets = q.all()

    open_events_by_target: dict = {}
    eq = db.query(MonitoringEvent).filter(MonitoringEvent.status == "open")
    if not current_user.is_super_admin:
        eq = eq.filter(MonitoringEvent.organization_id == current_user.organization_id)
    for e in eq.all():
        if e.target_id:
            open_events_by_target.setdefault(e.target_id, []).append(e.severity)

    result = []
    for t in targets:
        evs = open_events_by_target.get(t.id, [])
        computed_status = "online" if t.is_online else ("offline" if t.is_online is False else "unknown")
        if any(s in ["critical","emergency"] for s in evs):
            computed_status = "critical"
        elif any(s == "warning" for s in evs):
            computed_status = "warning"
        result.append({
            "id": t.id, "name": t.name, "host": t.host,
            "device_type": t.device_type, "vendor": t.vendor,
            "health_score": t.health_score, "status": computed_status,
            "open_events": len(evs), "site_id": t.site_id,
            "site_name": t.site.name if t.site else None,
        })
    return result
