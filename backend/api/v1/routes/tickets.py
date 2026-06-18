from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import Ticket, TicketComment, TicketAttachment, TicketActivity, SlaPolicy
from backend.api.v1.dependencies import get_current_user
from backend.core.domain.models import User

router = APIRouter(prefix="/tickets", tags=["tickets"])

TICKET_COUNTER_KEY = "ticket_counter"


def _next_ticket_number(db: Session, ticket_type: str) -> str:
    prefix = {"incident": "INC", "service_request": "REQ", "problem": "PRB", "change": "CHG"}.get(ticket_type, "TKT")
    count = db.query(func.count(Ticket.id)).scalar() or 0
    return f"{prefix}{str(count + 1).zfill(6)}"


def _ticket_or_403(ticket_id: int, db: Session, current_user: User) -> Ticket:
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not current_user.is_super_admin and t.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    return t


@router.get("")
def list_tickets(
    search: str = Query(None),
    ticket_type: str = Query(None),
    status: str = Query(None),
    priority: str = Query(None),
    assigned_to: int = Query(None),
    source: str = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Ticket)
    if not current_user.is_super_admin:
        q = q.filter(Ticket.organization_id == current_user.organization_id)
    if search:
        q = q.filter(Ticket.title.ilike(f"%{search}%") | Ticket.number.ilike(f"%{search}%"))
    if ticket_type:
        q = q.filter(Ticket.ticket_type == ticket_type)
    if status:
        q = q.filter(Ticket.status == status)
    if priority:
        q = q.filter(Ticket.priority == priority)
    if assigned_to:
        q = q.filter(Ticket.assigned_to == assigned_to)
    if source:
        q = q.filter(Ticket.source == source)
    total = q.count()
    items = q.order_by(Ticket.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.post("")
def create_ticket(body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = body.get("organization_id") or current_user.organization_id
    if not current_user.is_super_admin:
        org_id = current_user.organization_id
    ticket_type = body.get("ticket_type", "incident")
    number = _next_ticket_number(db, ticket_type)
    sla = None
    if body.get("sla_policy_id"):
        sla = db.query(SlaPolicy).filter(SlaPolicy.id == body["sla_policy_id"]).first()
    elif body.get("priority"):
        sla = db.query(SlaPolicy).filter(
            SlaPolicy.organization_id == org_id,
            SlaPolicy.priority == body["priority"],
            SlaPolicy.is_enabled == True
        ).first()
    now = datetime.utcnow()
    response_due = None
    resolution_due = None
    if sla:
        from datetime import timedelta
        response_due = now + timedelta(hours=sla.response_hours)
        resolution_due = now + timedelta(hours=sla.resolution_hours)
    t = Ticket(
        number=number,
        organization_id=org_id,
        ticket_type=ticket_type,
        title=body.get("title", ""),
        description=body.get("description"),
        category=body.get("category"),
        subcategory=body.get("subcategory"),
        priority=body.get("priority", "medium"),
        impact=body.get("impact", "medium"),
        urgency=body.get("urgency", "medium"),
        status=body.get("status", "open"),
        source=body.get("source", "manual"),
        assigned_to=body.get("assigned_to"),
        created_by=current_user.id,
        requester_id=body.get("requester_id"),
        sla_policy_id=sla.id if sla else None,
        asset_id=body.get("asset_id"),
        endpoint_id=body.get("endpoint_id"),
        monitoring_event_id=body.get("monitoring_event_id"),
        response_due_at=response_due,
        resolution_due_at=resolution_due,
    )
    db.add(t)
    db.flush()
    activity = TicketActivity(
        ticket_id=t.id,
        organization_id=org_id,
        actor_id=current_user.id,
        action="created",
        notes=f"Ticket {number} criado via {body.get('source', 'manual')}",
    )
    db.add(activity)
    db.commit()
    db.refresh(t)
    return t


@router.get("/stats")
def ticket_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Ticket)
    if not current_user.is_super_admin:
        q = q.filter(Ticket.organization_id == current_user.organization_id)
    total = q.count()
    open_count = q.filter(Ticket.status.in_(["open", "in_progress", "pending"])).count()
    resolved = q.filter(Ticket.status == "resolved").count()
    closed = q.filter(Ticket.status == "closed").count()
    breached = q.filter(Ticket.sla_breached == True).count()
    by_priority = {}
    for p in ("critical", "high", "medium", "low"):
        by_priority[p] = q.filter(Ticket.priority == p).count()
    by_type = {}
    for t in ("incident", "service_request", "problem", "change"):
        by_type[t] = q.filter(Ticket.ticket_type == t).count()
    return {
        "total": total, "open": open_count, "resolved": resolved,
        "closed": closed, "sla_breached": breached,
        "by_priority": by_priority, "by_type": by_type
    }


@router.get("/{ticket_id}")
def get_ticket(ticket_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _ticket_or_403(ticket_id, db, current_user)


@router.patch("/{ticket_id}")
def update_ticket(ticket_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    t = _ticket_or_403(ticket_id, db, current_user)
    old_status = t.status
    for k, v in body.items():
        if hasattr(t, k) and k not in ("id", "uuid", "number", "organization_id", "created_at"):
            setattr(t, k, v)
    now = datetime.utcnow()
    if body.get("status") == "resolved" and old_status != "resolved":
        t.resolved_at = now
    if body.get("status") == "closed" and old_status != "closed":
        t.closed_at = now
    if body.get("status") == "in_progress" and not t.responded_at:
        t.responded_at = now
    activity = TicketActivity(
        ticket_id=t.id,
        organization_id=t.organization_id,
        actor_id=current_user.id,
        action="updated",
        notes=f"Ticket atualizado",
        new_value=body.get("status"),
        old_value=old_status if body.get("status") else None,
        field_name="status" if body.get("status") else None,
    )
    db.add(activity)
    db.commit()
    db.refresh(t)
    return t


@router.delete("/{ticket_id}", status_code=204)
def delete_ticket(ticket_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    t = _ticket_or_403(ticket_id, db, current_user)
    db.delete(t)
    db.commit()


@router.get("/{ticket_id}/comments")
def list_comments(ticket_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ticket_or_403(ticket_id, db, current_user)
    return db.query(TicketComment).filter(TicketComment.ticket_id == ticket_id).order_by(TicketComment.created_at).all()


@router.post("/{ticket_id}/comments")
def add_comment(ticket_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    t = _ticket_or_403(ticket_id, db, current_user)
    comment = TicketComment(
        ticket_id=ticket_id,
        organization_id=t.organization_id,
        author_id=current_user.id,
        content=body.get("content", ""),
        is_internal=body.get("is_internal", False),
    )
    db.add(comment)
    activity = TicketActivity(
        ticket_id=ticket_id,
        organization_id=t.organization_id,
        actor_id=current_user.id,
        action="commented",
        notes=f"Comentário {'interno' if body.get('is_internal') else 'público'} adicionado",
    )
    db.add(activity)
    db.commit()
    db.refresh(comment)
    return comment


@router.get("/{ticket_id}/activities")
def list_activities(ticket_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ticket_or_403(ticket_id, db, current_user)
    return db.query(TicketActivity).filter(TicketActivity.ticket_id == ticket_id).order_by(TicketActivity.created_at).all()
