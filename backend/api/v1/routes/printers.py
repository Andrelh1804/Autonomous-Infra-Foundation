from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.core.infrastructure.database import get_db
from backend.core.domain.models import MonitoringTarget, PrinterSupply, User
from backend.api.v1.dependencies import get_current_user

router = APIRouter(prefix="/printers", tags=["printers"])


@router.get("")
def list_printers(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    is_online: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(MonitoringTarget).filter(MonitoringTarget.device_type == "printer")
    if not current_user.is_super_admin:
        q = q.filter(MonitoringTarget.organization_id == current_user.organization_id)
    if is_online is not None:
        q = q.filter(MonitoringTarget.is_online == is_online)
    if search:
        like = f"%{search}%"
        q = q.filter(MonitoringTarget.name.ilike(like) | MonitoringTarget.host.ilike(like))
    total = q.count()
    targets = q.order_by(desc(MonitoringTarget.created_at)).offset((page-1)*per_page).limit(per_page).all()
    result = []
    for t in targets:
        supplies = db.query(PrinterSupply).filter(PrinterSupply.target_id == t.id).order_by(desc(PrinterSupply.sampled_at)).all()
        supply_map: dict = {}
        for s in supplies:
            if s.supply_type not in supply_map:
                supply_map[s.supply_type] = _supply_dict(s)
        result.append({**_target_dict(t), "supplies": list(supply_map.values())})
    return {"items": result, "total": total, "page": page, "per_page": per_page}


@router.get("/{target_id}")
def get_printer(target_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = _get_printer_or_404(db, target_id, current_user)
    supplies = db.query(PrinterSupply).filter(PrinterSupply.target_id == t.id).order_by(desc(PrinterSupply.updated_at)).all()
    return {**_target_dict(t), "supplies": [_supply_dict(s) for s in supplies]}


@router.get("/{target_id}/supplies")
def get_supplies(target_id: int, hours: int = Query(168, ge=1, le=720), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = _get_printer_or_404(db, target_id, current_user)
    since = datetime.utcnow() - timedelta(hours=hours)
    supplies = db.query(PrinterSupply).filter(
        PrinterSupply.target_id == t.id,
        PrinterSupply.sampled_at >= since,
    ).order_by(PrinterSupply.sampled_at).all()
    by_type: dict = {}
    for s in supplies:
        by_type.setdefault(s.supply_type, []).append(_supply_dict(s))
    return {"target_id": target_id, "supplies_by_type": by_type}


@router.get("/summary/critical")
def critical_supplies(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(PrinterSupply).join(MonitoringTarget).filter(
        PrinterSupply.risk_level.in_(["warning", "critical", "empty"])
    )
    if not current_user.is_super_admin:
        q = q.filter(MonitoringTarget.organization_id == current_user.organization_id)
    items = q.order_by(PrinterSupply.level_percent).limit(50).all()
    result = []
    for s in items:
        d = _supply_dict(s)
        d["target_name"] = s.target.name if s.target else None
        d["target_host"] = s.target.host if s.target else None
        result.append(d)
    return result


def _get_printer_or_404(db, target_id, current_user):
    t = db.query(MonitoringTarget).filter(MonitoringTarget.id == target_id, MonitoringTarget.device_type == "printer").first()
    if not t: raise HTTPException(404, "Printer not found")
    if not current_user.is_super_admin and t.organization_id != current_user.organization_id:
        raise HTTPException(403, "Access denied")
    return t


def _target_dict(t):
    return {
        "id": t.id, "name": t.name, "host": t.host, "vendor": t.vendor,
        "is_online": t.is_online, "is_enabled": t.is_enabled,
        "last_polled_at": t.last_polled_at.isoformat() if t.last_polled_at else None,
        "health_score": t.health_score, "site_id": t.site_id,
        "site_name": t.site.name if t.site else None,
    }


def _supply_dict(s):
    return {
        "id": s.id, "supply_type": s.supply_type, "current_level": s.current_level,
        "max_level": s.max_level, "level_percent": s.level_percent,
        "daily_consumption": s.daily_consumption, "days_remaining": s.days_remaining,
        "estimated_empty_at": s.estimated_empty_at.isoformat() if s.estimated_empty_at else None,
        "risk_level": s.risk_level, "page_count_total": s.page_count_total,
        "page_count_mono": s.page_count_mono, "page_count_color": s.page_count_color,
        "sampled_at": s.sampled_at.isoformat() if s.sampled_at else None,
    }
