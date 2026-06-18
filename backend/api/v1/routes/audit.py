from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import AuditLog, User
from backend.core.application.schemas import AuditLogResponse
from backend.api.v1.dependencies import get_current_user

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
def list_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    module: Optional[str] = None,
    action: Optional[str] = None,
    user_email: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if not current_user.is_super_admin:
        query = query.filter(AuditLog.user_id == current_user.id)
    if module:
        query = query.filter(AuditLog.module == module)
    if action:
        query = query.filter(AuditLog.action == action)
    if user_email:
        query = query.filter(AuditLog.user_email.ilike(f"%{user_email}%"))
    if date_from:
        try:
            query = query.filter(AuditLog.created_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            query = query.filter(AuditLog.created_at <= datetime.fromisoformat(date_to))
        except ValueError:
            pass

    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return {
        "items": [AuditLogResponse.model_validate(a) for a in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.get("/meta")
def audit_meta(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from sqlalchemy import distinct
    modules = [r[0] for r in db.query(distinct(AuditLog.module)).all() if r[0]]
    actions = [r[0] for r in db.query(distinct(AuditLog.action)).all() if r[0]]
    return {"modules": sorted(modules), "actions": sorted(actions)}
