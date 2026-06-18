import hashlib, secrets, uuid as _uuid
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import Endpoint, AgentToken, Organization, Site
from backend.api.v1.dependencies import get_current_user, get_client_ip
from backend.core.domain.models import User

router = APIRouter(prefix="/agents", tags=["agents"])


def _org_filter(current_user: User, db: Session):
    if current_user.is_super_admin:
        return None
    return current_user.organization_id


@router.post("/enroll")
def enroll_agent(body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = body.get("organization_id") or current_user.organization_id
    if not current_user.is_super_admin:
        org_id = current_user.organization_id
    hostname = body.get("hostname", "unknown")
    existing = db.query(Endpoint).filter(
        Endpoint.organization_id == org_id,
        Endpoint.hostname == hostname
    ).first()
    if existing:
        token_str = secrets.token_urlsafe(48)
        token_hash = hashlib.sha256(token_str.encode()).hexdigest()
        jti = str(_uuid.uuid4())
        if existing.agent_token:
            existing.agent_token.token_hash = token_hash
            existing.agent_token.token_jti = jti
            existing.agent_token.is_active = True
            existing.agent_token.expires_at = datetime.utcnow() + timedelta(days=365)
        else:
            at = AgentToken(endpoint_id=existing.id, organization_id=org_id,
                            token_hash=token_hash, token_jti=jti,
                            expires_at=datetime.utcnow() + timedelta(days=365))
            db.add(at)
        db.commit()
        return {"endpoint_id": existing.id, "endpoint_uuid": existing.uuid, "agent_token": token_str, "existing": True}
    ep = Endpoint(
        organization_id=org_id,
        site_id=body.get("site_id"),
        hostname=hostname,
        fqdn=body.get("fqdn"),
        ip_address=body.get("ip_address"),
        mac_address=body.get("mac_address"),
        platform=body.get("platform", "windows"),
        os_name=body.get("os_name"),
        os_version=body.get("os_version"),
        os_build=body.get("os_build"),
        os_arch=body.get("os_arch"),
        cpu_model=body.get("cpu_model"),
        cpu_cores=body.get("cpu_cores"),
        ram_gb=body.get("ram_gb"),
        disk_total_gb=body.get("disk_total_gb"),
        disk_free_gb=body.get("disk_free_gb"),
        agent_version=body.get("agent_version", "1.0.0"),
        agent_status="online",
        last_seen=datetime.utcnow(),
        last_checkin=datetime.utcnow(),
    )
    db.add(ep)
    db.flush()
    token_str = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(token_str.encode()).hexdigest()
    jti = str(_uuid.uuid4())
    at = AgentToken(endpoint_id=ep.id, organization_id=org_id,
                    token_hash=token_hash, token_jti=jti,
                    expires_at=datetime.utcnow() + timedelta(days=365))
    db.add(at)
    db.commit()
    db.refresh(ep)
    return {"endpoint_id": ep.id, "endpoint_uuid": ep.uuid, "agent_token": token_str, "existing": False}


@router.post("/checkin")
def agent_checkin(body: dict, request: Request, db: Session = Depends(get_db)):
    token_str = body.get("agent_token") or request.headers.get("X-Agent-Token")
    if not token_str:
        raise HTTPException(status_code=401, detail="Agent token required")
    token_hash = hashlib.sha256(token_str.encode()).hexdigest()
    at = db.query(AgentToken).filter(AgentToken.token_hash == token_hash, AgentToken.is_active == True).first()
    if not at:
        raise HTTPException(status_code=401, detail="Invalid or expired agent token")
    ep = at.endpoint
    now = datetime.utcnow()
    ep.agent_status = "online"
    ep.last_seen = now
    ep.last_checkin = now
    if body.get("ip_address"):
        ep.ip_address = body["ip_address"]
    if body.get("logged_user"):
        ep.logged_user = body["logged_user"]
    if body.get("disk_free_gb") is not None:
        ep.disk_free_gb = body["disk_free_gb"]
    if body.get("agent_version"):
        ep.agent_version = body["agent_version"]
    at.last_used = now
    db.commit()
    from backend.core.domain.models import RemoteAction
    pending = db.query(RemoteAction).filter(
        RemoteAction.endpoint_id == ep.id,
        RemoteAction.status == "pending"
    ).order_by(RemoteAction.queued_at).limit(5).all()
    commands = [{"id": a.id, "uuid": a.uuid, "command": a.command, "shell": a.shell, "timeout": a.timeout_seconds} for a in pending]
    return {"status": "ok", "pending_commands": commands, "endpoint_uuid": ep.uuid}


@router.post("/checkin/result")
def submit_action_result(body: dict, request: Request, db: Session = Depends(get_db)):
    token_str = body.get("agent_token") or request.headers.get("X-Agent-Token")
    if not token_str:
        raise HTTPException(status_code=401, detail="Agent token required")
    token_hash = hashlib.sha256(token_str.encode()).hexdigest()
    at = db.query(AgentToken).filter(AgentToken.token_hash == token_hash, AgentToken.is_active == True).first()
    if not at:
        raise HTTPException(status_code=401, detail="Invalid agent token")
    from backend.core.domain.models import RemoteAction
    action_id = body.get("action_id")
    if action_id:
        action = db.query(RemoteAction).filter(RemoteAction.id == action_id, RemoteAction.endpoint_id == at.endpoint_id).first()
        if action:
            action.status = "completed" if body.get("success") else "failed"
            action.output = body.get("output")
            action.exit_code = body.get("exit_code")
            action.error_message = body.get("error_message")
            action.completed_at = datetime.utcnow()
            db.commit()
    return {"status": "ok"}


@router.get("")
def list_agents(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Endpoint)
    if not current_user.is_super_admin:
        q = q.filter(Endpoint.organization_id == current_user.organization_id)
    endpoints = q.order_by(Endpoint.hostname).all()
    now = datetime.utcnow()
    result = []
    for ep in endpoints:
        if ep.last_seen and (now - ep.last_seen).total_seconds() > 300:
            if ep.agent_status == "online":
                ep.agent_status = "offline"
        result.append({
            "id": ep.id, "uuid": ep.uuid, "hostname": ep.hostname,
            "ip_address": ep.ip_address, "platform": ep.platform,
            "os_name": ep.os_name, "os_version": ep.os_version,
            "agent_version": ep.agent_version, "agent_status": ep.agent_status,
            "status": ep.status, "last_seen": ep.last_seen,
            "last_checkin": ep.last_checkin, "organization_id": ep.organization_id,
            "risk_score": ep.risk_score, "compliance_score": ep.compliance_score,
            "patch_score": ep.patch_score,
        })
    db.commit()
    return result


@router.get("/stats")
def agent_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Endpoint)
    if not current_user.is_super_admin:
        q = q.filter(Endpoint.organization_id == current_user.organization_id)
    now = datetime.utcnow()
    all_eps = q.all()
    for ep in all_eps:
        if ep.last_seen and (now - ep.last_seen).total_seconds() > 300 and ep.agent_status == "online":
            ep.agent_status = "offline"
    db.commit()
    total = len(all_eps)
    online = sum(1 for e in all_eps if e.agent_status == "online")
    offline = sum(1 for e in all_eps if e.agent_status == "offline")
    windows = sum(1 for e in all_eps if e.platform == "windows")
    linux = sum(1 for e in all_eps if e.platform == "linux")
    macos = sum(1 for e in all_eps if e.platform == "macos")
    return {"total": total, "online": online, "offline": offline, "windows": windows, "linux": linux, "macos": macos}


@router.get("/{endpoint_id}")
def get_agent(endpoint_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    if not current_user.is_super_admin and ep.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    return ep


@router.patch("/{endpoint_id}")
def update_agent(endpoint_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    if not current_user.is_super_admin and ep.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    for k, v in body.items():
        if hasattr(ep, k) and k not in ("id", "uuid", "organization_id"):
            setattr(ep, k, v)
    db.commit()
    db.refresh(ep)
    return ep


@router.delete("/{endpoint_id}", status_code=204)
def delete_agent(endpoint_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and ep.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    db.delete(ep)
    db.commit()


@router.get("/{endpoint_id}/generate-token")
def generate_install_token(endpoint_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and ep.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    token = secrets.token_urlsafe(32)
    return {"install_token": token, "endpoint_id": ep.id, "hostname": ep.hostname}
