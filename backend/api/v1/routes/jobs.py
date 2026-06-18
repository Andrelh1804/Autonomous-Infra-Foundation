from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import Job, Endpoint
from backend.api.v1.dependencies import get_current_user
from backend.core.domain.models import User

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("")
def list_jobs(
    endpoint_id: int = Query(None),
    status: str = Query(None),
    job_type: str = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Job)
    if not current_user.is_super_admin:
        q = q.filter(Job.organization_id == current_user.organization_id)
    if endpoint_id:
        q = q.filter(Job.endpoint_id == endpoint_id)
    if status:
        q = q.filter(Job.status == status)
    if job_type:
        q = q.filter(Job.job_type == job_type)
    total = q.count()
    items = q.order_by(Job.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.post("")
def create_job(body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ep = db.query(Endpoint).filter(Endpoint.id == body.get("endpoint_id")).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    if not current_user.is_super_admin and ep.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    import json
    job = Job(
        endpoint_id=ep.id,
        organization_id=ep.organization_id,
        created_by=current_user.id,
        job_type=body.get("job_type", "script"),
        name=body.get("name", ""),
        description=body.get("description"),
        parameters=json.dumps(body.get("parameters", {})) if isinstance(body.get("parameters"), dict) else body.get("parameters"),
        status="pending",
        scheduled_at=body.get("scheduled_at"),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and job.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    return job


@router.patch("/{job_id}")
def update_job(job_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and job.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    for k, v in body.items():
        if hasattr(job, k) and k not in ("id", "uuid", "organization_id"):
            setattr(job, k, v)
    if body.get("status") == "running" and not job.started_at:
        job.started_at = datetime.utcnow()
    if body.get("status") in ("completed", "failed", "cancelled") and not job.completed_at:
        job.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return job


@router.post("/{job_id}/cancel")
def cancel_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and job.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    if job.status not in ("pending", "running"):
        raise HTTPException(status_code=400, detail="Cannot cancel a finished job")
    job.status = "cancelled"
    job.completed_at = datetime.utcnow()
    db.commit()
    return {"status": "cancelled"}


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and job.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    db.delete(job)
    db.commit()
