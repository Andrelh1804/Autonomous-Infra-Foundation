from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session

from backend.core.infrastructure.database import get_db
from backend.core.domain.models import AlertRule, AlertEvent, User
from backend.core.application.schemas import (
    AlertRuleCreate, AlertRuleUpdate, AlertRuleResponse, AlertEventResponse,
)
from backend.core.application.audit import log_action
from backend.api.v1.dependencies import get_current_user, get_client_ip

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/rules", response_model=List[AlertRuleResponse])
def list_rules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(AlertRule)
    if not current_user.is_super_admin:
        q = q.filter(AlertRule.organization_id == current_user.organization_id)
    return q.order_by(AlertRule.created_at.desc()).all()


@router.post("/rules", response_model=AlertRuleResponse, status_code=201)
def create_rule(
    body: AlertRuleCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_id = current_user.organization_id if not current_user.is_super_admin else (body.organization_id or current_user.organization_id)
    rule = AlertRule(
        organization_id=org_id,
        created_by=current_user.id,
        name=body.name,
        is_enabled=body.is_enabled,
        trigger=body.trigger,
        min_hosts_found=body.min_hosts_found,
        channel=body.channel,
        email_recipients=body.email_recipients,
        webhook_url=body.webhook_url,
        webhook_secret=body.webhook_secret,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    log_action(db, "CREATE_ALERT_RULE", "alerts",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request),
               payload={"name": rule.name, "trigger": rule.trigger, "channel": rule.channel})
    return rule


@router.patch("/rules/{rule_id}", response_model=AlertRuleResponse)
def update_rule(
    rule_id: int,
    body: AlertRuleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    if not current_user.is_super_admin and rule.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(rule, k, v)
    db.commit()
    db.refresh(rule)
    return rule


@router.post("/rules/{rule_id}/toggle", response_model=AlertRuleResponse)
def toggle_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    if not current_user.is_super_admin and rule.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    rule.is_enabled = not rule.is_enabled
    db.commit()
    db.refresh(rule)
    return rule


@router.post("/rules/{rule_id}/test", status_code=202)
def test_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a test notification for this rule (uses a synthetic payload)."""
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    if not current_user.is_super_admin and rule.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")

    from backend.core.domain.models import Settings
    smtp = {r.key: r.value for r in db.query(Settings).all()}
    platform_name = smtp.get("platform_name", "AII Platform")

    from backend.modules.alerts.sender import _email_body, _send_email, _send_webhook
    import json
    from datetime import datetime

    # Build a synthetic job-like object for the template
    class FakeJob:
        id = 0
        name = "Test Alert — do not act on this"
        status = "completed"
        organization_id = rule.organization_id
        hosts_scanned = 42
        hosts_found = 7
        targets = '["192.168.1.0/24"]'
        error_message = None
        started_at = datetime.utcnow()
        finished_at = datetime.utcnow()

    subject, body_html = _email_body(rule.trigger, FakeJob(), platform_name)

    event = AlertEvent(
        rule_id=rule.id,
        discovery_job_id=None,
        trigger=rule.trigger,
        channel=rule.channel,
        payload=json.dumps({"test": True}),
    )

    channels = rule.channel.split(",") if "," in (rule.channel or "") else [rule.channel]
    errors = []
    for channel in channels:
        channel = channel.strip()
        try:
            if channel == "email":
                recipients = [r.strip() for r in (rule.email_recipients or "").split(",") if r.strip()]
                if not recipients:
                    raise ValueError("No email recipients configured")
                _send_email(recipients, f"[TEST] {subject}", body_html, smtp)
            elif channel == "webhook":
                if not rule.webhook_url:
                    raise ValueError("No webhook URL configured")
                payload = {"test": True, "trigger": rule.trigger, "rule_name": rule.name, "sent_at": datetime.utcnow().isoformat()}
                _send_webhook(rule.webhook_url, payload, rule.webhook_secret)
            event.status = "sent"
        except Exception as e:
            event.status = "failed"
            event.error_message = str(e)
            errors.append(str(e))

    db.add(event)
    db.commit()

    if errors:
        raise HTTPException(status_code=422, detail="; ".join(errors))
    return {"detail": "Test notification sent"}


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(
    rule_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    if not current_user.is_super_admin and rule.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(rule)
    db.commit()


@router.get("/events")
def list_events(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    rule_id: Optional[int] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(AlertEvent).join(AlertRule)
    if not current_user.is_super_admin:
        q = q.filter(AlertRule.organization_id == current_user.organization_id)
    if rule_id:
        q = q.filter(AlertEvent.rule_id == rule_id)
    if status:
        q = q.filter(AlertEvent.status == status)
    total = q.count()
    items = q.order_by(AlertEvent.sent_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {
        "items": [AlertEventResponse.model_validate(e) for e in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.get("/stats")
def alert_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q_rules = db.query(AlertRule)
    q_events = db.query(AlertEvent).join(AlertRule)
    if not current_user.is_super_admin:
        q_rules = q_rules.filter(AlertRule.organization_id == current_user.organization_id)
        q_events = q_events.filter(AlertRule.organization_id == current_user.organization_id)
    return {
        "total_rules": q_rules.count(),
        "enabled_rules": q_rules.filter(AlertRule.is_enabled == True).count(),
        "total_events": q_events.count(),
        "sent_events": q_events.filter(AlertEvent.status == "sent").count(),
        "failed_events": q_events.filter(AlertEvent.status == "failed").count(),
    }
