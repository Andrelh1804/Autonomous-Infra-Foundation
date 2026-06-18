"""
Alert Sender — dispatches email and webhook notifications when discovery events fire.
"""
import json
import hmac
import hashlib
import logging
import smtplib
import urllib.request
import urllib.error
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from sqlalchemy.orm import Session

from backend.core.domain.models import AlertRule, AlertEvent, DiscoveryJob

log = logging.getLogger("aii.alerts")


# ── Email ──────────────────────────────────────────────────────────────────────

def _get_smtp_settings(db: Session) -> dict:
    from backend.core.domain.models import Settings
    keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_password",
            "smtp_from", "platform_name"]
    rows = db.query(Settings).filter(Settings.key.in_(keys)).all()
    return {r.key: r.value for r in rows}


def _send_email(recipients: list[str], subject: str, body_html: str, smtp: dict) -> None:
    host = smtp.get("smtp_host", "")
    if not host:
        raise ValueError("SMTP host not configured in platform settings")

    port = int(smtp.get("smtp_port") or 587)
    user = smtp.get("smtp_user", "")
    password = smtp.get("smtp_password", "")
    from_addr = smtp.get("smtp_from") or user or "noreply@aii.local"
    platform = smtp.get("platform_name", "AII Platform")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{platform} <{from_addr}>"
    msg["To"] = ", ".join(recipients)
    msg.attach(MIMEText(body_html, "html"))

    with smtplib.SMTP(host, port, timeout=10) as server:
        server.ehlo()
        server.starttls()
        if user and password:
            server.login(user, password)
        server.sendmail(from_addr, recipients, msg.as_string())


# ── Webhook ────────────────────────────────────────────────────────────────────

def _send_webhook(url: str, payload: dict, secret: Optional[str]) -> None:
    body = json.dumps(payload, default=str).encode()
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "AII-Platform/2.0",
        "X-AII-Event": payload.get("trigger", "unknown"),
    }
    if secret:
        sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        headers["X-AII-Signature"] = f"sha256={sig}"

    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=10) as resp:
        if resp.status >= 400:
            raise ValueError(f"Webhook returned HTTP {resp.status}")


# ── Email template ─────────────────────────────────────────────────────────────

def _email_body(trigger: str, job: DiscoveryJob, platform_name: str) -> tuple[str, str]:
    targets = json.loads(job.targets or "[]")
    targets_str = ", ".join(targets[:5]) + (f" +{len(targets)-5} more" if len(targets) > 5 else "")

    trigger_labels = {
        "job_completed":    ("Discovery Completed ✅", "#10b981"),
        "job_failed":       ("Discovery Failed ❌",    "#ef4444"),
        "new_assets_found": ("New Assets Found 🔍",    "#6366f1"),
    }
    title, color = trigger_labels.get(trigger, ("Discovery Alert", "#6366f1"))
    subject = f"[{platform_name}] {title} — {job.name or f'Job #{job.id}'}"

    duration = ""
    if job.started_at and job.finished_at:
        secs = int((job.finished_at - job.started_at).total_seconds())
        duration = f"{secs}s"

    body = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#0f1117;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1d27;border-radius:12px;overflow:hidden;border:1px solid #2d3048;">
      <tr>
        <td style="background:{color};padding:4px 0;"></td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;">
            {platform_name}
          </p>
          <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#f9fafb;">{title}</h1>

          <table width="100%" cellpadding="0" cellspacing="0">
            {"".join(f'''
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #2d3048;color:#9ca3af;font-size:13px;width:40%;">{k}</td>
              <td style="padding:8px 0;border-bottom:1px solid #2d3048;color:#f9fafb;font-size:13px;font-weight:500;">{v}</td>
            </tr>''' for k, v in [
                ("Job", job.name or f"Job #{job.id}"),
                ("Status", job.status.capitalize()),
                ("Targets", targets_str or "—"),
                ("Hosts scanned", str(job.hosts_scanned or 0)),
                ("Hosts found", str(job.hosts_found or 0)),
                ("Duration", duration or "—"),
                ("Completed at", (job.finished_at or datetime.utcnow()).strftime("%Y-%m-%d %H:%M UTC")),
            ])}
          </table>

          {'<p style="margin:24px 0 0;padding:12px 16px;background:#ef444420;border-left:3px solid #ef4444;border-radius:4px;color:#fca5a5;font-size:13px;">' + (job.error_message or '') + '</p>' if job.error_message else ''}

          <p style="margin:24px 0 0;font-size:12px;color:#6b7280;">
            This is an automated alert from <strong style="color:#9ca3af;">{platform_name}</strong>.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>"""

    return subject, body


# ── Main dispatcher ────────────────────────────────────────────────────────────

def fire_alerts(db: Session, job_id: int, trigger: str) -> None:
    """
    Called after a discovery job finishes. Finds matching enabled rules
    and dispatches email/webhook notifications.
    """
    job = db.query(DiscoveryJob).filter(DiscoveryJob.id == job_id).first()
    if not job:
        return

    rules = db.query(AlertRule).filter(
        AlertRule.organization_id == job.organization_id,
        AlertRule.is_enabled == True,
        AlertRule.trigger == trigger,
    ).all()

    if not rules:
        return

    smtp = _get_smtp_settings(db)
    platform_name = smtp.get("platform_name", "AII Platform")

    for rule in rules:
        # For new_assets_found, check threshold
        if trigger == "new_assets_found" and (job.hosts_found or 0) < (rule.min_hosts_found or 1):
            continue

        subject, body_html = _email_body(trigger, job, platform_name)
        payload = {
            "trigger": trigger,
            "rule_id": rule.id,
            "rule_name": rule.name,
            "job_id": job.id,
            "job_name": job.name,
            "job_status": job.status,
            "organization_id": job.organization_id,
            "hosts_scanned": job.hosts_scanned,
            "hosts_found": job.hosts_found,
            "targets": json.loads(job.targets or "[]"),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "finished_at": job.finished_at.isoformat() if job.finished_at else None,
            "error_message": job.error_message,
            "sent_at": datetime.utcnow().isoformat(),
        }

        channels = rule.channel.split(",") if "," in (rule.channel or "") else [rule.channel]

        for channel in channels:
            channel = channel.strip()
            event = AlertEvent(
                rule_id=rule.id,
                discovery_job_id=job.id,
                trigger=trigger,
                channel=channel,
                payload=json.dumps(payload),
            )
            try:
                if channel == "email":
                    recipients = [r.strip() for r in (rule.email_recipients or "").split(",") if r.strip()]
                    if not recipients:
                        raise ValueError("No email recipients configured")
                    _send_email(recipients, subject, body_html, smtp)

                elif channel == "webhook":
                    if not rule.webhook_url:
                        raise ValueError("No webhook URL configured")
                    _send_webhook(rule.webhook_url, payload, rule.webhook_secret)

                event.status = "sent"
                log.info(f"Alert sent: rule={rule.name!r} trigger={trigger} channel={channel} job={job.id}")

            except Exception as e:
                event.status = "failed"
                event.error_message = str(e)
                log.warning(f"Alert failed: rule={rule.name!r} error={e}")

            db.add(event)

    try:
        db.commit()
    except Exception:
        db.rollback()
