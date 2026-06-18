import asyncio
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request, Query, BackgroundTasks
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db, SessionLocal
from backend.core.domain.models import DiscoveryJob, DiscoveryResult, User, Asset
from backend.core.application.schemas import (
    DiscoveryJobCreate, DiscoveryJobResponse, DiscoveryResultResponse,
)
from backend.core.application.audit import log_action
from backend.api.v1.dependencies import get_current_user, get_client_ip
from backend.modules.network_scan.scanner import expand_target
import json

router = APIRouter(prefix="/discovery", tags=["discovery"])


def run_discovery_background(job_id: int, targets: List[str], organization_id: int, site_id: Optional[int]):
    from backend.modules.discovery.engine import run_discovery
    db = SessionLocal()
    try:
        asyncio.run(run_discovery(db, job_id, targets, organization_id, site_id))
    finally:
        db.close()


@router.get("")
def list_discovery_jobs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(DiscoveryJob)
    if not current_user.is_super_admin:
        query = query.filter(DiscoveryJob.organization_id == current_user.organization_id)
    total = query.count()
    items = query.order_by(DiscoveryJob.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {
        "items": [DiscoveryJobResponse.model_validate(j) for j in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.post("/start", response_model=DiscoveryJobResponse, status_code=201)
def start_discovery(
    body: DiscoveryJobCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_id = current_user.organization_id if not current_user.is_super_admin else (body.organization_id or current_user.organization_id)
    targets = body.targets

    total_ips = sum(len(expand_target(t)) for t in targets)
    if total_ips > 10000:
        raise HTTPException(status_code=400, detail="Target scope too large (max 10,000 IPs)")

    job = DiscoveryJob(
        organization_id=org_id,
        site_id=body.site_id,
        created_by=current_user.id,
        name=body.name or f"Discovery {', '.join(targets[:2])}{'...' if len(targets) > 2 else ''}",
        targets=json.dumps(targets),
        methods=",".join(body.methods) if body.methods else "icmp,dns",
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    log_action(db, "START_DISCOVERY", "discovery",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request),
               payload={"targets": targets, "job_id": job.id})

    background_tasks.add_task(run_discovery_background, job.id, targets, org_id, body.site_id)
    return job


@router.get("/stats")
def discovery_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(DiscoveryJob)
    if not current_user.is_super_admin:
        query = query.filter(DiscoveryJob.organization_id == current_user.organization_id)

    total = query.count()
    completed = query.filter(DiscoveryJob.status == "completed").count()
    running = query.filter(DiscoveryJob.status == "running").count()
    failed = query.filter(DiscoveryJob.status == "failed").count()
    pending = query.filter(DiscoveryJob.status == "pending").count()

    total_found = sum(j.hosts_found or 0 for j in query.all())
    return {
        "total_jobs": total,
        "completed": completed,
        "running": running,
        "failed": failed,
        "pending": pending,
        "total_hosts_found": total_found,
    }


@router.get("/{job_id}", response_model=DiscoveryJobResponse)
def get_discovery_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(DiscoveryJob).filter(DiscoveryJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Discovery job not found")
    if not current_user.is_super_admin and job.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return job


@router.get("/{job_id}/results")
def get_discovery_results(
    job_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(DiscoveryJob).filter(DiscoveryJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Discovery job not found")
    if not current_user.is_super_admin and job.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    query = db.query(DiscoveryResult).filter(DiscoveryResult.discovery_job_id == job_id)
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return {
        "items": [DiscoveryResultResponse.model_validate(r) for r in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.delete("/{job_id}", status_code=204)
def delete_discovery_job(
    job_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(DiscoveryJob).filter(DiscoveryJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Discovery job not found")
    if not current_user.is_super_admin and job.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if job.status == "running":
        raise HTTPException(status_code=400, detail="Cannot delete a running job")
    db.delete(job)
    db.commit()


@router.get("/relationships/all")
def list_all_relationships(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from backend.core.domain.models import AssetRelationship
    query = db.query(AssetRelationship)
    rels = query.all()
    from backend.core.application.schemas import AssetRelationshipResponse
    return [AssetRelationshipResponse.model_validate(r) for r in rels]
