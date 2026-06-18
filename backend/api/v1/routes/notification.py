from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json

from backend.core.infrastructure.database import get_db
from backend.core.domain.models import NotificationChannel, User
from backend.api.v1.dependencies import get_current_user

router = APIRouter(prefix="/notification", tags=["notification"])


@router.get("/channels")
def list_channels(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(NotificationChannel)
    if not current_user.is_super_admin:
        q = q.filter(NotificationChannel.organization_id == current_user.organization_id)
    return [_chan_dict(c) for c in q.order_by(NotificationChannel.name).all()]


@router.post("/channels", status_code=201)
def create_channel(body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = NotificationChannel(
        organization_id=current_user.organization_id,
        name=body["name"],
        channel_type=body["channel_type"],
        is_enabled=body.get("is_enabled", True),
        config=json.dumps(body.get("config", {})),
    )
    db.add(c); db.commit(); db.refresh(c)
    return _chan_dict(c)


@router.patch("/channels/{channel_id}")
def update_channel(channel_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = _get_or_404(db, channel_id, current_user)
    if "name" in body: c.name = body["name"]
    if "is_enabled" in body: c.is_enabled = body["is_enabled"]
    if "config" in body: c.config = json.dumps(body["config"])
    db.commit(); db.refresh(c)
    return _chan_dict(c)


@router.delete("/channels/{channel_id}", status_code=204)
def delete_channel(channel_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = _get_or_404(db, channel_id, current_user)
    db.delete(c); db.commit()


@router.post("/channels/{channel_id}/test", status_code=202)
def test_channel(channel_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = _get_or_404(db, channel_id, current_user)
    cfg = json.loads(c.config or "{}")
    if c.channel_type == "webhook" and cfg.get("webhook_url"):
        import requests
        try:
            r = requests.post(cfg["webhook_url"], json={"test": True, "source": "AII Platform", "message": "Test notification"}, timeout=5)
            return {"status": "sent", "http_status": r.status_code}
        except Exception as ex:
            return {"status": "failed", "error": str(ex)}
    return {"status": "skipped", "reason": "No testable config found"}


def _get_or_404(db, channel_id, current_user):
    c = db.query(NotificationChannel).filter(NotificationChannel.id == channel_id).first()
    if not c: raise HTTPException(404, "Channel not found")
    if not current_user.is_super_admin and c.organization_id != current_user.organization_id:
        raise HTTPException(403, "Access denied")
    return c


def _chan_dict(c: NotificationChannel) -> dict:
    try:
        cfg = json.loads(c.config) if c.config else {}
    except Exception:
        cfg = {}
    return {
        "id": c.id, "name": c.name, "channel_type": c.channel_type,
        "is_enabled": c.is_enabled, "config": cfg,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }
