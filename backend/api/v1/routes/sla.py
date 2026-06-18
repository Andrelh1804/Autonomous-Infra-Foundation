from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import SlaPolicy, Ticket
from backend.api.v1.dependencies import get_current_user
from backend.core.domain.models import User

router = APIRouter(prefix="/sla", tags=["sla"])


@router.get("/policies")
def list_policies(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(SlaPolicy)
    if not current_user.is_super_admin:
        q = q.filter(SlaPolicy.organization_id == current_user.organization_id)
    return q.order_by(SlaPolicy.name).all()


@router.post("/policies")
def create_policy(body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = body.get("organization_id") or current_user.organization_id
    if not current_user.is_super_admin:
        org_id = current_user.organization_id
    pol = SlaPolicy(
        organization_id=org_id,
        name=body.get("name", ""),
        description=body.get("description"),
        priority=body.get("priority", "medium"),
        response_hours=body.get("response_hours", 4.0),
        resolution_hours=body.get("resolution_hours", 24.0),
        business_hours_only=body.get("business_hours_only", True),
        is_default=body.get("is_default", False),
        is_enabled=body.get("is_enabled", True),
    )
    db.add(pol)
    db.commit()
    db.refresh(pol)
    return pol


@router.get("/policies/{policy_id}")
def get_policy(policy_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pol = db.query(SlaPolicy).filter(SlaPolicy.id == policy_id).first()
    if not pol:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and pol.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    return pol


@router.patch("/policies/{policy_id}")
def update_policy(policy_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pol = db.query(SlaPolicy).filter(SlaPolicy.id == policy_id).first()
    if not pol:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and pol.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    for k, v in body.items():
        if hasattr(pol, k) and k not in ("id", "organization_id"):
            setattr(pol, k, v)
    db.commit()
    db.refresh(pol)
    return pol


@router.delete("/policies/{policy_id}", status_code=204)
def delete_policy(policy_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pol = db.query(SlaPolicy).filter(SlaPolicy.id == policy_id).first()
    if not pol:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and pol.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    db.delete(pol)
    db.commit()


@router.get("/dashboard")
def sla_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Ticket)
    if not current_user.is_super_admin:
        q = q.filter(Ticket.organization_id == current_user.organization_id)
    now = datetime.utcnow()
    total = q.filter(Ticket.status.notin_(["closed"])).count()
    breached = q.filter(Ticket.sla_breached == True).count()
    at_risk = q.filter(
        Ticket.resolution_due_at != None,
        Ticket.resolution_due_at > now,
        Ticket.resolution_due_at < now + timedelta(hours=2),
        Ticket.status.notin_(["resolved", "closed"])
    ).count()
    on_time = q.filter(Ticket.sla_breached == False, Ticket.status.in_(["resolved", "closed"])).count()
    resolved_total = q.filter(Ticket.status.in_(["resolved", "closed"])).count()
    sla_pct = round(on_time / resolved_total * 100, 1) if resolved_total > 0 else 100.0
    avg_resolution_mins = db.query(
        func.avg(func.extract('epoch', Ticket.resolved_at - Ticket.created_at) / 60)
    )
    if not current_user.is_super_admin:
        avg_resolution_mins = avg_resolution_mins.filter(Ticket.organization_id == current_user.organization_id)
    avg_resolution_mins = avg_resolution_mins.filter(Ticket.resolved_at != None).scalar()
    return {
        "total_open": total,
        "sla_breached": breached,
        "at_risk": at_risk,
        "sla_compliance_pct": sla_pct,
        "avg_resolution_minutes": round(float(avg_resolution_mins or 0), 1),
    }
