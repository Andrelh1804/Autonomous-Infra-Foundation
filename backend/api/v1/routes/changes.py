from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import Change, ChangeApproval, ChangeComment
from backend.api.v1.dependencies import get_current_user
from backend.core.domain.models import User

router = APIRouter(prefix="/changes", tags=["changes"])


def _next_change_number(db: Session) -> str:
    count = db.query(func.count(Change.id)).scalar() or 0
    return f"CHG{str(count + 1).zfill(6)}"


def _change_or_403(change_id: int, db: Session, current_user: User) -> Change:
    c = db.query(Change).filter(Change.id == change_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Change not found")
    if not current_user.is_super_admin and c.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    return c


@router.get("")
def list_changes(
    search: str = Query(None),
    status: str = Query(None),
    change_type: str = Query(None),
    risk: str = Query(None),
    assigned_to: int = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Change)
    if not current_user.is_super_admin:
        q = q.filter(Change.organization_id == current_user.organization_id)
    if search:
        q = q.filter(Change.title.ilike(f"%{search}%") | Change.number.ilike(f"%{search}%"))
    if status:
        q = q.filter(Change.status == status)
    if change_type:
        q = q.filter(Change.change_type == change_type)
    if risk:
        q = q.filter(Change.risk == risk)
    if assigned_to:
        q = q.filter(Change.assigned_to == assigned_to)
    total = q.count()
    items = q.order_by(Change.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.post("")
def create_change(body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = body.get("organization_id") or current_user.organization_id
    if not current_user.is_super_admin:
        org_id = current_user.organization_id
    number = _next_change_number(db)
    c = Change(
        number=number,
        organization_id=org_id,
        change_type=body.get("change_type", "normal"),
        title=body.get("title", ""),
        description=body.get("description"),
        category=body.get("category"),
        priority=body.get("priority", "medium"),
        risk=body.get("risk", "medium"),
        impact=body.get("impact", "medium"),
        status=body.get("status", "draft"),
        justification=body.get("justification"),
        implementation_plan=body.get("implementation_plan"),
        rollback_plan=body.get("rollback_plan"),
        test_plan=body.get("test_plan"),
        requested_by=body.get("requested_by") or current_user.id,
        assigned_to=body.get("assigned_to"),
        created_by=current_user.id,
        asset_id=body.get("asset_id"),
        scheduled_start=body.get("scheduled_start"),
        scheduled_end=body.get("scheduled_end"),
    )
    db.add(c)
    db.flush()
    if body.get("approvers"):
        for i, approver_id in enumerate(body["approvers"]):
            approval = ChangeApproval(
                change_id=c.id,
                organization_id=org_id,
                approver_id=approver_id,
                order=i + 1,
            )
            db.add(approval)
    db.commit()
    db.refresh(c)
    return c


@router.get("/calendar")
def change_calendar(
    year: int = Query(None),
    month: int = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Change)
    if not current_user.is_super_admin:
        q = q.filter(Change.organization_id == current_user.organization_id)
    q = q.filter(Change.scheduled_start != None)
    if year and month:
        from calendar import monthrange
        start = datetime(year, month, 1)
        end = datetime(year, month, monthrange(year, month)[1], 23, 59, 59)
        q = q.filter(Change.scheduled_start.between(start, end))
    return q.order_by(Change.scheduled_start).all()


@router.get("/stats")
def change_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Change)
    if not current_user.is_super_admin:
        q = q.filter(Change.organization_id == current_user.organization_id)
    total = q.count()
    by_status = {s: q.filter(Change.status == s).count() for s in ("draft", "review", "approved", "scheduled", "implementing", "completed", "cancelled", "failed")}
    by_type = {t: q.filter(Change.change_type == t).count() for t in ("standard", "normal", "emergency")}
    return {"total": total, "by_status": by_status, "by_type": by_type}


@router.get("/{change_id}")
def get_change(change_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _change_or_403(change_id, db, current_user)


@router.patch("/{change_id}")
def update_change(change_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = _change_or_403(change_id, db, current_user)
    for k, v in body.items():
        if hasattr(c, k) and k not in ("id", "uuid", "number", "organization_id"):
            setattr(c, k, v)
    if body.get("status") == "approved":
        c.approved_at = datetime.utcnow()
    if body.get("status") == "completed":
        c.implemented_at = datetime.utcnow()
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{change_id}", status_code=204)
def delete_change(change_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = _change_or_403(change_id, db, current_user)
    db.delete(c)
    db.commit()


@router.get("/{change_id}/approvals")
def list_approvals(change_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _change_or_403(change_id, db, current_user)
    return db.query(ChangeApproval).filter(ChangeApproval.change_id == change_id).order_by(ChangeApproval.order).all()


@router.post("/{change_id}/approvals/{approval_id}/decide")
def decide_approval(change_id: int, approval_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _change_or_403(change_id, db, current_user)
    approval = db.query(ChangeApproval).filter(ChangeApproval.id == approval_id, ChangeApproval.change_id == change_id).first()
    if not approval:
        raise HTTPException(status_code=404)
    approval.decision = body.get("decision")
    approval.comments = body.get("comments")
    approval.status = "approved" if body.get("decision") == "approve" else "rejected"
    approval.decided_at = datetime.utcnow()
    change = _change_or_403(change_id, db, current_user)
    if approval.status == "approved":
        all_approvals = db.query(ChangeApproval).filter(ChangeApproval.change_id == change_id).all()
        if all(a.status == "approved" for a in all_approvals):
            change.status = "approved"
            change.approved_at = datetime.utcnow()
    elif approval.status == "rejected":
        change.status = "rejected"
        change.rejected_at = datetime.utcnow()
    db.commit()
    return {"status": approval.status}


@router.get("/{change_id}/comments")
def list_comments(change_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _change_or_403(change_id, db, current_user)
    return db.query(ChangeComment).filter(ChangeComment.change_id == change_id).order_by(ChangeComment.created_at).all()


@router.post("/{change_id}/comments")
def add_comment(change_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = _change_or_403(change_id, db, current_user)
    comment = ChangeComment(
        change_id=change_id,
        organization_id=c.organization_id,
        author_id=current_user.id,
        content=body.get("content", ""),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment
