from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import Settings, User
from backend.core.application.schemas import SettingUpdate, SettingResponse
from backend.core.application.audit import log_action
from backend.api.v1.dependencies import require_super_admin, get_client_ip

router = APIRouter(prefix="/settings", tags=["settings"])


class TestEmailRequest(BaseModel):
    to_email: str


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


@router.post("/test-email")
def test_email(
    body: TestEmailRequest,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    from backend.modules.email.service import _get_smtp, _is_smtp_ready, _send
    cfg = _get_smtp(db)
    if not _is_smtp_ready(cfg):
        raise HTTPException(
            status_code=400,
            detail="SMTP não configurado. Defina smtp_host nas configurações antes de testar.",
        )
    platform = cfg.get("platform_name") or "NexaOps"
    html = f"""<!DOCTYPE html>
<html lang="pt-BR"><body style="font-family:system-ui,sans-serif;background:#0f1117;padding:32px;">
<div style="max-width:480px;margin:0 auto;background:#1a1d27;border-radius:12px;padding:32px;border:1px solid #2d3048;">
  <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#f9fafb;">{platform}</p>
  <p style="margin:0 0 20px;font-size:13px;color:#9ca3af;">Teste de configuração SMTP</p>
  <p style="margin:0;font-size:14px;color:#e5e7eb;line-height:1.6;">
    Este é um e-mail de teste enviado pela plataforma <strong>{platform}</strong>.<br>
    Se você recebeu esta mensagem, sua configuração SMTP está funcionando corretamente.
  </p>
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #2d3048;">
    <p style="margin:0;font-size:11px;color:#4b5563;">Enviado para: {body.to_email}</p>
  </div>
</div>
</body></html>"""
    try:
        _send([body.to_email], f"[{platform}] Teste de configuração SMTP", html, cfg)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Falha ao enviar e-mail: {exc}")
    return {"ok": True, "message": f"E-mail de teste enviado para {body.to_email}"}
