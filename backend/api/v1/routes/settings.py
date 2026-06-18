from typing import List
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import Settings, User
from backend.core.application.schemas import SettingUpdate, SettingResponse
from backend.core.application.audit import log_action
from backend.api.v1.dependencies import require_super_admin, get_client_ip

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=List[SettingResponse])
def list_settings(
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    return db.query(Settings).all()


@router.patch("/{key}", response_model=SettingResponse)
def update_setting(
    key: str,
    body: SettingUpdate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    setting = db.query(Settings).filter(Settings.key == key).first()
    if not setting:
        setting = Settings(key=key, value=body.value)
        db.add(setting)
    else:
        setting.value = body.value
    db.commit()
    db.refresh(setting)
    log_action(db, "UPDATE_SETTING", "settings",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request), payload={"key": key})
    return setting
