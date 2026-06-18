import json
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from backend.core.infrastructure.database import get_db
from backend.core.domain.models import DiscoverySchedule, User
from backend.core.application.schemas import (
    DiscoveryScheduleCreate, DiscoveryScheduleUpdate, DiscoveryScheduleResponse,
)
from backend.core.application.audit import log_action
from backend.api.v1.dependencies import get_current_user, get_client_ip
from backend.modules.scheduler.scheduler import register_schedule, unregister_schedule, get_scheduler_status

router = APIRouter(prefix="/schedules", tags=["schedules"])


@router.get("")
def list_schedules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(DiscoverySchedule)
    if not current_user.is_super_admin:
        query = query.filter(DiscoverySchedule.organization_id == current_user.organization_id)
    items = query.order_by(DiscoverySchedule.created_at.desc()).all()
    return [DiscoveryScheduleResponse.model_validate(s) for s in items]


@router.post("", response_model=DiscoveryScheduleResponse, status_code=201)
def create_schedule(
    body: DiscoveryScheduleCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_id = current_user.organization_id if not current_user.is_super_admin else (body.organization_id or current_user.organization_id)
    now = datetime.utcnow()
    schedule = DiscoverySchedule(
        organization_id=org_id,
        site_id=body.site_id,
        created_by=current_user.id,
        name=body.name,
        targets=json.dumps(body.targets),
        methods=",".join(body.methods) if body.methods else "icmp,dns",
        interval_minutes=body.interval_minutes,
        is_enabled=body.is_enabled,
        next_run_at=now + timedelta(minutes=body.interval_minutes),
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    if schedule.is_enabled:
        register_schedule(schedule.id, schedule.interval_minutes)

    log_action(db, "CREATE_SCHEDULE", "schedules",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request),
               payload={"name": schedule.name, "interval_minutes": schedule.interval_minutes})
    return schedule


@router.get("/status")
def scheduler_status(current_user: User = Depends(get_current_user)):
    return get_scheduler_status()


@router.get("/{schedule_id}", response_model=DiscoveryScheduleResponse)
def get_schedule(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = db.query(DiscoverySchedule).filter(DiscoverySchedule.id == schedule_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if not current_user.is_super_admin and s.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return s


@router.patch("/{schedule_id}", response_model=DiscoveryScheduleResponse)
def update_schedule(
    schedule_id: int,
    body: DiscoveryScheduleUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = db.query(DiscoverySchedule).filter(DiscoverySchedule.id == schedule_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if not current_user.is_super_admin and s.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")

    data = body.model_dump(exclude_unset=True)
    if "targets" in data:
        data["targets"] = json.dumps(data["targets"])
    if "methods" in data and isinstance(data["methods"], list):
        data["methods"] = ",".join(data["methods"])
    for k, v in data.items():
        setattr(s, k, v)
    s.updated_at = datetime.utcnow()

    if "interval_minutes" in data or "is_enabled" in data:
        if s.is_enabled:
            register_schedule(s.id, s.interval_minutes)
        else:
            unregister_schedule(s.id)

    db.commit()
    db.refresh(s)
    return s


@router.post("/{schedule_id}/toggle", response_model=DiscoveryScheduleResponse)
def toggle_schedule(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = db.query(DiscoverySchedule).filter(DiscoverySchedule.id == schedule_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if not current_user.is_super_admin and s.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")

    s.is_enabled = not s.is_enabled
    s.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(s)

    if s.is_enabled:
        register_schedule(s.id, s.interval_minutes)
    else:
        unregister_schedule(s.id)

    return s


@router.post("/{schedule_id}/run-now", status_code=202)
def run_now(
    schedule_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Trigger an immediate one-shot discovery from this schedule."""
    from fastapi import BackgroundTasks
    from backend.api.v1.routes.discovery import run_discovery_background

    s = db.query(DiscoverySchedule).filter(DiscoverySchedule.id == schedule_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if not current_user.is_super_admin and s.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")

    import threading
    targets = json.loads(s.targets)
    t = threading.Thread(
        target=run_discovery_background,
        args=[_create_job(db, s, current_user.id), targets, s.organization_id, s.site_id],
        daemon=True,
    )
    t.start()
    return {"detail": "Discovery triggered"}


def _create_job(db: Session, s: DiscoverySchedule, user_id: int) -> int:
    from backend.core.domain.models import DiscoveryJob
    job = DiscoveryJob(
        organization_id=s.organization_id,
        site_id=s.site_id,
        created_by=user_id,
        name=f"[Manual] {s.name}",
        targets=s.targets,
        methods=s.methods,
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    s.last_run_at = datetime.utcnow()
    s.last_job_id = job.id
    db.commit()
    return job.id


@router.delete("/{schedule_id}", status_code=204)
def delete_schedule(
    schedule_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = db.query(DiscoverySchedule).filter(DiscoverySchedule.id == schedule_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if not current_user.is_super_admin and s.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    unregister_schedule(s.id)
    db.delete(s)
    db.commit()
