"""
System email service — sends transactional emails (password reset, etc.)
using the SMTP credentials stored in platform Settings.
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy.orm import Session

log = logging.getLogger("nexaops.email")

PLATFORM_NAME = "NexaOps"
BRAND_COLOR = "#6366f1"


def _get_smtp(db: Session) -> dict:
    from backend.core.domain.models import Settings
    keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_password",
            "smtp_from", "platform_name"]
    rows = db.query(Settings).filter(Settings.key.in_(keys)).all()
    return {r.key: r.value for r in rows}


def _is_smtp_ready(cfg: dict) -> bool:
    return bool(cfg.get("smtp_host", "").strip())


def _send(recipients: list[str], subject: str, html: str, cfg: dict) -> None:
    host = cfg["smtp_host"].strip()
    port = int(cfg.get("smtp_port") or 587)
    user = cfg.get("smtp_user", "")
    password = cfg.get("smtp_password", "")
    platform = cfg.get("platform_name") or PLATFORM_NAME
    from_addr = cfg.get("smtp_from") or user or f"noreply@nexaops.local"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{platform} <{from_addr}>"
    msg["To"] = ", ".join(recipients)
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(host, port, timeout=10) as server:
        server.ehlo()
        server.starttls()
        if user and password:
            server.login(user, password)
        server.sendmail(from_addr, recipients, msg.as_string())


def _reset_html(reset_link: str, expires_hours: int, platform: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#0f1117;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0"
           style="background:#1a1d27;border-radius:16px;overflow:hidden;border:1px solid #2d3048;">

      <!-- Header bar -->
      <tr><td style="background:{BRAND_COLOR};height:4px;"></td></tr>

      <!-- Body -->
      <tr><td style="padding:40px 36px;">

        <!-- Logo text -->
        <p style="margin:0 0 28px;font-size:20px;font-weight:800;color:#f9fafb;letter-spacing:-.02em;">
          {platform}
          <span style="font-size:11px;font-weight:500;color:#6b7280;margin-left:8px;letter-spacing:.06em;text-transform:uppercase;">
            Smart Infrastructure
          </span>
        </p>

        <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f9fafb;line-height:1.3;">
          Redefinição de senha
        </h1>
        <p style="margin:0 0 28px;font-size:14px;color:#9ca3af;line-height:1.6;">
          Recebemos uma solicitação para redefinir a senha da sua conta no <strong style="color:#e5e7eb;">{platform}</strong>.
          Clique no botão abaixo para criar uma nova senha.
        </p>

        <!-- CTA Button -->
        <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
          <tr>
            <td style="border-radius:10px;background:{BRAND_COLOR};">
              <a href="{reset_link}"
                 style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;
                        color:#ffffff;text-decoration:none;border-radius:10px;
                        letter-spacing:-.01em;">
                Redefinir minha senha →
              </a>
            </td>
          </tr>
        </table>

        <!-- Fallback link -->
        <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">
          Se o botão não funcionar, copie e cole este link no seu navegador:
        </p>
        <p style="margin:0 0 28px;font-size:11px;color:#6366f1;word-break:break-all;">
          {reset_link}
        </p>

        <!-- Warning -->
        <div style="background:#1f2133;border:1px solid #2d3048;border-radius:8px;padding:14px 16px;margin-bottom:28px;">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
            🔒 <strong style="color:#e5e7eb;">Este link expira em {expires_hours} hora{'s' if expires_hours > 1 else ''}.</strong>
            Se você não solicitou a redefinição, ignore este e-mail — sua senha permanece inalterada.
          </p>
        </div>

        <!-- Footer -->
        <p style="margin:0;font-size:11px;color:#4b5563;border-top:1px solid #2d3048;padding-top:20px;">
          Este é um e-mail automático do <strong style="color:#6b7280;">{platform}</strong>. Não responda a este e-mail.
        </p>

      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>"""


def send_password_reset_email(
    db: Session,
    to_email: str,
    reset_token: str,
    base_url: str,
    expires_hours: int = 1,
) -> bool:
    """
    Send a password-reset email. Returns True if sent, False if SMTP not configured.
    Raises on SMTP errors so the caller can surface them.
    """
    cfg = _get_smtp(db)
    if not _is_smtp_ready(cfg):
        log.info("SMTP not configured — skipping password reset email for %s", to_email)
        return False

    platform = cfg.get("platform_name") or PLATFORM_NAME
    reset_link = f"{base_url}/reset-password?token={reset_token}"
    subject = f"[{platform}] Redefinição de senha"
    html = _reset_html(reset_link, expires_hours, platform)

    _send([to_email], subject, html, cfg)
    log.info("Password reset email sent to %s", to_email)
    return True
