from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import Problem, ProblemComment, ProblemTicket, Ticket
from backend.api.v1.dependencies import get_current_user
from backend.core.domain.models import User

router = APIRouter(prefix="/problems", tags=["problems"])


def _next_problem_number(db: Session) -> str:
    count = db.query(func.count(Problem.id)).scalar() or 0
    return f"PRB{str(count + 1).zfill(6)}"


def _problem_or_403(problem_id: int, db: Session, current_user: User) -> Problem:
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")
    if not current_user.is_super_admin and p.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    return p


@router.get("")
def list_problems(
    search: str = Query(None),
    status: str = Query(None),
    priority: str = Query(None),
    assigned_to: int = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Problem)
    if not current_user.is_super_admin:
        q = q.filter(Problem.organization_id == current_user.organization_id)
    if search:
        q = q.filter(Problem.title.ilike(f"%{search}%") | Problem.number.ilike(f"%{search}%"))
    if status:
        q = q.filter(Problem.status == status)
    if priority:
        q = q.filter(Problem.priority == priority)
    if assigned_to:
        q = q.filter(Problem.assigned_to == assigned_to)
    total = q.count()
    items = q.order_by(Problem.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.post("")
def create_problem(body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = body.get("organization_id") or current_user.organization_id
    if not current_user.is_super_admin:
        org_id = current_user.organization_id
    number = _next_problem_number(db)
    p = Problem(
        number=number,
        organization_id=org_id,
        title=body.get("title", ""),
        description=body.get("description"),
        category=body.get("category"),
        priority=body.get("priority", "medium"),
        impact=body.get("impact", "medium"),
        status=body.get("status", "open"),
        root_cause=body.get("root_cause"),
        workaround=body.get("workaround"),
        solution=body.get("solution"),
        assigned_to=body.get("assigned_to"),
        created_by=current_user.id,
        asset_id=body.get("asset_id"),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("/stats")
def problem_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Problem)
    if not current_user.is_super_admin:
        q = q.filter(Problem.organization_id == current_user.organization_id)
    total = q.count()
    open_count = q.filter(Problem.status == "open").count()
    resolved = q.filter(Problem.status == "resolved").count()
    return {"total": total, "open": open_count, "resolved": resolved, "closed": q.filter(Problem.status == "closed").count()}


@router.get("/{problem_id}")
def get_problem(problem_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _problem_or_403(problem_id, db, current_user)


@router.patch("/{problem_id}")
def update_problem(problem_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = _problem_or_403(problem_id, db, current_user)
    for k, v in body.items():
        if hasattr(p, k) and k not in ("id", "uuid", "number", "organization_id"):
            setattr(p, k, v)
    if body.get("status") == "resolved" and not p.resolved_at:
        p.resolved_at = datetime.utcnow()
    if body.get("status") == "closed" and not p.closed_at:
        p.closed_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{problem_id}", status_code=204)
def delete_problem(problem_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = _problem_or_403(problem_id, db, current_user)
    db.delete(p)
    db.commit()


@router.get("/{problem_id}/comments")
def list_comments(problem_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _problem_or_403(problem_id, db, current_user)
    return db.query(ProblemComment).filter(ProblemComment.problem_id == problem_id).order_by(ProblemComment.created_at).all()


@router.post("/{problem_id}/comments")
def add_comment(problem_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = _problem_or_403(problem_id, db, current_user)
    c = ProblemComment(
        problem_id=problem_id,
        organization_id=p.organization_id,
        author_id=current_user.id,
        content=body.get("content", ""),
        is_internal=body.get("is_internal", False),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.post("/{problem_id}/link-ticket")
def link_ticket(problem_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = _problem_or_403(problem_id, db, current_user)
    ticket_id = body.get("ticket_id")
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    from sqlalchemy.exc import IntegrityError
    pt = ProblemTicket(problem_id=problem_id, ticket_id=ticket_id)
    try:
        db.add(pt)
        db.commit()
        return {"status": "linked"}
    except IntegrityError:
        db.rollback()
        return {"status": "already_linked"}


@router.get("/{problem_id}/linked-tickets")
def list_linked_tickets(problem_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _problem_or_403(problem_id, db, current_user)
    pts = db.query(ProblemTicket).filter(ProblemTicket.problem_id == problem_id).all()
    return [pt.ticket for pt in pts]
