import json
from typing import Optional
from sqlalchemy.orm import Session
from backend.core.domain.models import AuditLog


def log_action(
    db: Session,
    action: str,
    module: str,
    user_id: Optional[int] = None,
    user_email: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    payload: Optional[dict] = None,
):
    entry = AuditLog(
        user_id=user_id,
        user_email=user_email,
        action=action,
        module=module,
        ip_address=ip_address,
        user_agent=user_agent,
        payload=json.dumps(payload) if payload else None,
    )
    db.add(entry)
    db.commit()
