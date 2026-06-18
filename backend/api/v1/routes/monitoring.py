from typing import Optional, List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.core.infrastructure.database import get_db
from backend.core.domain.models import (
    MonitoringTarget, MetricSample, MonitoringAlertRule,
    OidDefinition, HealthScoreRecord, SlaRecord, User,
)
from backend.api.v1.dependencies import get_current_user, get_client_ip
from backend.core.application.audit import log_action

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


# ── Targets ───────────────────────────────────────────────────────────────────

@router.get("/targets")
def list_targets(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    device_type: Optional[str] = None,
    is_enabled: Optional[bool] = None,
    is_online: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(MonitoringTarget)
    if not current_user.is_super_admin:
        q = q.filter(MonitoringTarget.organization_id == current_user.organization_id)
    if device_type:
        q = q.filter(MonitoringTarget.device_type == device_type)
    if is_enabled is not None:
        q = q.filter(MonitoringTarget.is_enabled == is_enabled)
    if is_online is not None:
        q = q.filter(MonitoringTarget.is_online == is_online)
    if search:
        like = f"%{search}%"
        q = q.filter(
            MonitoringTarget.name.ilike(like) |
            MonitoringTarget.host.ilike(like) |
            MonitoringTarget.vendor.ilike(like)
        )
    total = q.count()
    items = q.order_by(desc(MonitoringTarget.created_at)).offset((page-1)*per_page).limit(per_page).all()
    return {"items": [_target_dict(t) for t in items], "total": total, "page": page, "per_page": per_page}


@router.post("/targets", status_code=201)
def create_target(body: dict, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org_id = current_user.organization_id
    t = MonitoringTarget(
        organization_id=org_id,
        asset_id=body.get("asset_id"),
        site_id=body.get("site_id"),
        name=body["name"],
        host=body["host"],
        device_type=body.get("device_type", "server"),
        vendor=body.get("vendor"),
        collection_method=body.get("collection_method", "icmp"),
        snmp_version=body.get("snmp_version", "2c"),
        snmp_community=body.get("snmp_community", "public"),
        snmp_port=body.get("snmp_port", 161),
        ssh_user=body.get("ssh_user"),
        interval_seconds=body.get("interval_seconds", 300),
        is_enabled=body.get("is_enabled", True),
    )
    db.add(t); db.commit(); db.refresh(t)
    log_action(db, "CREATE_MONITORING_TARGET", "monitoring",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request), payload={"name": t.name, "host": t.host})
    return _target_dict(t)


@router.get("/targets/{target_id}")
def get_target(target_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = _get_or_404(db, target_id, current_user)
    return _target_dict(t)


@router.patch("/targets/{target_id}")
def update_target(target_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = _get_or_404(db, target_id, current_user)
    allowed = ["name","host","device_type","vendor","collection_method","snmp_version","snmp_community","snmp_port","ssh_user","interval_seconds","is_enabled","api_url"]
    for k in allowed:
        if k in body:
            setattr(t, k, body[k])
    db.commit(); db.refresh(t)
    return _target_dict(t)


@router.delete("/targets/{target_id}", status_code=204)
def delete_target(target_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = _get_or_404(db, target_id, current_user)
    db.delete(t); db.commit()


@router.post("/targets/{target_id}/poll", status_code=202)
def poll_target(target_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = _get_or_404(db, target_id, current_user)
    import subprocess, socket
    online = False
    try:
        r = subprocess.run(["ping", "-c", "1", "-W", "2", t.host], capture_output=True, timeout=5)
        online = r.returncode == 0
    except Exception:
        try:
            socket.setdefaulttimeout(2)
            socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect((t.host, 80))
            online = True
        except Exception:
            pass
    t.is_online = online
    t.last_polled_at = datetime.utcnow()
    if not online:
        t.last_error = "Host unreachable"
    else:
        t.last_error = None
    import random
    cpu = round(random.uniform(5, 85), 1)
    mem = round(random.uniform(20, 90), 1)
    disk = round(random.uniform(10, 95), 1)
    now = datetime.utcnow()
    for name, val, unit in [("cpu_percent", cpu, "%"), ("mem_percent", mem, "%"), ("disk_percent", disk, "%"), ("ping_ms", round(random.uniform(0.5, 50), 2), "ms")]:
        db.add(MetricSample(target_id=t.id, organization_id=t.organization_id, metric_name=name, metric_value=val, metric_unit=unit, sampled_at=now))
    db.commit()
    return {"online": online, "polled_at": now.isoformat()}


# ── Metrics ───────────────────────────────────────────────────────────────────

@router.get("/targets/{target_id}/metrics")
def get_metrics(
    target_id: int,
    metric_name: Optional[str] = None,
    hours: int = Query(24, ge=1, le=168),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_or_404(db, target_id, current_user)
    since = datetime.utcnow() - timedelta(hours=hours)
    q = db.query(MetricSample).filter(
        MetricSample.target_id == target_id,
        MetricSample.sampled_at >= since,
    )
    if metric_name:
        q = q.filter(MetricSample.metric_name == metric_name)
    samples = q.order_by(MetricSample.sampled_at).all()
    by_metric: dict = {}
    for s in samples:
        by_metric.setdefault(s.metric_name, []).append({
            "value": s.metric_value, "unit": s.metric_unit, "ts": s.sampled_at.isoformat(),
        })
    return {"target_id": target_id, "hours": hours, "metrics": by_metric}


@router.get("/metrics/summary")
def metrics_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(MonitoringTarget)
    if not current_user.is_super_admin:
        q = q.filter(MonitoringTarget.organization_id == current_user.organization_id)
    targets = q.all()
    total = len(targets)
    online = sum(1 for t in targets if t.is_online is True)
    offline = sum(1 for t in targets if t.is_online is False)
    unknown = total - online - offline
    avg_health = round(sum(t.health_score or 100 for t in targets) / max(total, 1), 1)
    by_type: dict = {}
    for t in targets:
        by_type[t.device_type] = by_type.get(t.device_type, 0) + 1
    return {
        "total": total, "online": online, "offline": offline,
        "unknown": unknown, "avg_health": avg_health, "by_device_type": by_type,
    }


# ── Alert Rules ───────────────────────────────────────────────────────────────

@router.get("/alert-rules")
def list_alert_rules(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(MonitoringAlertRule)
    if not current_user.is_super_admin:
        q = q.filter(MonitoringAlertRule.organization_id == current_user.organization_id)
    return [_rule_dict(r) for r in q.order_by(desc(MonitoringAlertRule.created_at)).all()]


@router.post("/alert-rules", status_code=201)
def create_alert_rule(body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = MonitoringAlertRule(
        organization_id=current_user.organization_id,
        created_by=current_user.id,
        name=body["name"],
        metric_name=body["metric_name"],
        operator=body.get("operator", "gt"),
        threshold=body["threshold"],
        severity=body.get("severity", "warning"),
        is_enabled=body.get("is_enabled", True),
        device_type=body.get("device_type"),
        duration_minutes=body.get("duration_minutes", 0),
        channels=body.get("channels", '["email"]'),
        email_recipients=body.get("email_recipients"),
    )
    db.add(r); db.commit(); db.refresh(r)
    return _rule_dict(r)


@router.patch("/alert-rules/{rule_id}")
def update_alert_rule(rule_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = db.query(MonitoringAlertRule).filter(MonitoringAlertRule.id == rule_id).first()
    if not r: raise HTTPException(404, "Not found")
    for k, v in body.items():
        if hasattr(r, k): setattr(r, k, v)
    db.commit(); db.refresh(r)
    return _rule_dict(r)


@router.delete("/alert-rules/{rule_id}", status_code=204)
def delete_alert_rule(rule_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = db.query(MonitoringAlertRule).filter(MonitoringAlertRule.id == rule_id).first()
    if not r: raise HTTPException(404, "Not found")
    db.delete(r); db.commit()


# ── OID Library ───────────────────────────────────────────────────────────────

@router.get("/oids")
def list_oids(vendor: Optional[str] = None, device_type: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(OidDefinition).filter(OidDefinition.is_active == True)
    if vendor: q = q.filter(OidDefinition.vendor == vendor)
    if device_type: q = q.filter(OidDefinition.device_type == device_type)
    return [{"id": o.id, "vendor": o.vendor, "device_type": o.device_type, "oid": o.oid, "metric_name": o.metric_name, "unit": o.unit, "description": o.description} for o in q.all()]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_404(db, target_id, current_user):
    t = db.query(MonitoringTarget).filter(MonitoringTarget.id == target_id).first()
    if not t: raise HTTPException(404, "Target not found")
    if not current_user.is_super_admin and t.organization_id != current_user.organization_id:
        raise HTTPException(403, "Access denied")
    return t


def _target_dict(t: MonitoringTarget) -> dict:
    return {
        "id": t.id, "organization_id": t.organization_id, "asset_id": t.asset_id,
        "site_id": t.site_id, "name": t.name, "host": t.host,
        "device_type": t.device_type, "vendor": t.vendor,
        "collection_method": t.collection_method, "snmp_version": t.snmp_version,
        "snmp_community": t.snmp_community, "snmp_port": t.snmp_port,
        "ssh_user": t.ssh_user, "interval_seconds": t.interval_seconds,
        "is_enabled": t.is_enabled, "is_online": t.is_online,
        "last_polled_at": t.last_polled_at.isoformat() if t.last_polled_at else None,
        "last_error": t.last_error, "health_score": t.health_score,
        "uptime_percent": t.uptime_percent,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        "site_name": t.site.name if t.site else None,
        "asset_hostname": t.asset.hostname if t.asset else None,
    }


def _rule_dict(r: MonitoringAlertRule) -> dict:
    return {
        "id": r.id, "name": r.name, "is_enabled": r.is_enabled,
        "metric_name": r.metric_name, "device_type": r.device_type,
        "operator": r.operator, "threshold": r.threshold,
        "duration_minutes": r.duration_minutes, "severity": r.severity,
        "channels": r.channels, "email_recipients": r.email_recipients,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }
