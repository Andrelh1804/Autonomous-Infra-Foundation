from datetime import datetime
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import AutomationRule
from backend.api.v1.dependencies import get_current_user
from backend.core.domain.models import User

router = APIRouter(prefix="/automations", tags=["automations"])


@router.get("")
def list_automations(
    search: str = Query(None),
    trigger_type: str = Query(None),
    enabled_only: bool = Query(False),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(AutomationRule)
    if not current_user.is_super_admin:
        q = q.filter(AutomationRule.organization_id == current_user.organization_id)
    if search:
        q = q.filter(AutomationRule.name.ilike(f"%{search}%"))
    if trigger_type:
        q = q.filter(AutomationRule.trigger_type == trigger_type)
    if enabled_only:
        q = q.filter(AutomationRule.is_enabled == True)
    total = q.count()
    items = q.order_by(AutomationRule.name).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.post("")
def create_automation(body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = body.get("organization_id") or current_user.organization_id
    if not current_user.is_super_admin:
        org_id = current_user.organization_id
    rule = AutomationRule(
        organization_id=org_id,
        name=body.get("name", ""),
        description=body.get("description"),
        trigger_type=body.get("trigger_type", "manual"),
        trigger_config=json.dumps(body.get("trigger_config", {})) if isinstance(body.get("trigger_config"), dict) else body.get("trigger_config", "{}"),
        conditions=json.dumps(body.get("conditions", [])) if isinstance(body.get("conditions"), list) else body.get("conditions", "[]"),
        actions=json.dumps(body.get("actions", [])) if isinstance(body.get("actions"), list) else body.get("actions", "[]"),
        is_enabled=body.get("is_enabled", True),
        created_by=current_user.id,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.get("/{rule_id}")
def get_automation(rule_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = db.query(AutomationRule).filter(AutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and rule.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    return rule


@router.patch("/{rule_id}")
def update_automation(rule_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = db.query(AutomationRule).filter(AutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and rule.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    for k, v in body.items():
        if hasattr(rule, k) and k not in ("id", "organization_id"):
            setattr(rule, k, v)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{rule_id}", status_code=204)
def delete_automation(rule_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = db.query(AutomationRule).filter(AutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and rule.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    db.delete(rule)
    db.commit()


@router.post("/{rule_id}/toggle")
def toggle_automation(rule_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = db.query(AutomationRule).filter(AutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and rule.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    rule.is_enabled = not rule.is_enabled
    db.commit()
    return {"is_enabled": rule.is_enabled}


@router.post("/{rule_id}/trigger")
def trigger_automation(rule_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = db.query(AutomationRule).filter(AutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and rule.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    if not rule.is_enabled:
        raise HTTPException(status_code=400, detail="Automation rule is disabled")
    rule.run_count = (rule.run_count or 0) + 1
    rule.last_triggered_at = datetime.utcnow()
    db.commit()
    return {"status": "triggered", "run_count": rule.run_count}
