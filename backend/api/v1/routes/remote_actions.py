from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import RemoteAction, Endpoint
from backend.api.v1.dependencies import get_current_user
from backend.core.domain.models import User

router = APIRouter(prefix="/remote-actions", tags=["remote-actions"])


@router.get("")
def list_actions(
    endpoint_id: int = Query(None),
    status: str = Query(None),
    action_type: str = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(RemoteAction)
    if not current_user.is_super_admin:
        q = q.filter(RemoteAction.organization_id == current_user.organization_id)
    if endpoint_id:
        q = q.filter(RemoteAction.endpoint_id == endpoint_id)
    if status:
        q = q.filter(RemoteAction.status == status)
    if action_type:
        q = q.filter(RemoteAction.action_type == action_type)
    total = q.count()
    items = q.order_by(RemoteAction.queued_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.post("")
def create_action(body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ep = db.query(Endpoint).filter(Endpoint.id == body.get("endpoint_id")).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    if not current_user.is_super_admin and ep.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    action = RemoteAction(
        endpoint_id=ep.id,
        organization_id=ep.organization_id,
        created_by=current_user.id,
        action_type=body.get("action_type", "command"),
        shell=body.get("shell", "auto"),
        command=body.get("command", ""),
        args=body.get("args"),
        timeout_seconds=body.get("timeout_seconds", 60),
        status="pending",
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return action


@router.get("/{action_id}")
def get_action(action_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    action = db.query(RemoteAction).filter(RemoteAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and action.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    return action


@router.patch("/{action_id}")
def update_action(action_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    action = db.query(RemoteAction).filter(RemoteAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and action.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    for k, v in body.items():
        if hasattr(action, k) and k not in ("id", "uuid"):
            setattr(action, k, v)
    if body.get("status") == "completed":
        action.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(action)
    return action


@router.post("/{action_id}/cancel")
def cancel_action(action_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    action = db.query(RemoteAction).filter(RemoteAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and action.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    if action.status not in ("pending", "running"):
        raise HTTPException(status_code=400, detail="Cannot cancel a completed action")
    action.status = "cancelled"
    action.completed_at = datetime.utcnow()
    db.commit()
    return {"status": "cancelled"}


@router.delete("/{action_id}", status_code=204)
def delete_action(action_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    action = db.query(RemoteAction).filter(RemoteAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and action.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    db.delete(action)
    db.commit()
