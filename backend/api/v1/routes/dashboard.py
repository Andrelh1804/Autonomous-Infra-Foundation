from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import (
    Organization, User, UserSession, AuditLog,
    Asset, DiscoveryJob, DiscoverySchedule,
)
from backend.core.application.schemas import DashboardStats
from backend.api.v1.dependencies import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.is_super_admin:
        total_orgs = db.query(Organization).count()
        active_orgs = db.query(Organization).filter(Organization.status == "active").count()
        total_users = db.query(User).count()
    else:
        total_orgs = 1
        active_orgs = 1
        total_users = db.query(User).filter(User.organization_id == current_user.organization_id).count()

    active_sessions = db.query(UserSession).filter(UserSession.is_active == True).count()

    return DashboardStats(
        total_organizations=total_orgs,
        total_users=total_users,
        active_sessions=active_sessions,
        active_organizations=active_orgs,
    )


@router.get("/recent-access")
def get_recent_access(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog).filter(AuditLog.action == "LOGIN").order_by(AuditLog.created_at.desc())
    if not current_user.is_super_admin:
        query = query.filter(AuditLog.user_id == current_user.id)
    items = query.limit(10).all()
    return [
        {
            "user_email": a.user_email,
            "ip_address": a.ip_address,
            "created_at": a.created_at,
        }
        for a in items
    ]


@router.get("/discovery-health")
def discovery_health(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_id = current_user.organization_id

    # Total assets in CMDB
    aq = db.query(func.count(Asset.id)).filter(Asset.organization_id == org_id)
    total_assets = aq.scalar() or 0

    # Active schedules + soonest next run
    sq = db.query(DiscoverySchedule).filter(
        DiscoverySchedule.organization_id == org_id,
        DiscoverySchedule.is_enabled == True,
    )
    active_schedules = sq.count()
    next_sched = sq.order_by(DiscoverySchedule.next_run_at.asc().nullslast()).first()
    next_run_at = next_sched.next_run_at if next_sched else None

    # Last finished job
    last_job_row = (
        db.query(DiscoveryJob)
        .filter(DiscoveryJob.organization_id == org_id,
                DiscoveryJob.status.in_(["completed", "failed"]))
        .order_by(DiscoveryJob.finished_at.desc())
        .first()
    )
    last_job = None
    if last_job_row:
        last_job = {
            "id":          last_job_row.id,
            "name":        last_job_row.name,
            "status":      last_job_row.status,
            "hosts_found": last_job_row.hosts_found or 0,
            "finished_at": last_job_row.finished_at,
        }

    # Assets found per day — last 7 days
    cutoff = datetime.utcnow() - timedelta(days=7)
    rows = (
        db.query(
            func.date(DiscoveryJob.finished_at).label("day"),
            func.sum(DiscoveryJob.hosts_found).label("found"),
        )
        .filter(
            DiscoveryJob.organization_id == org_id,
            DiscoveryJob.status == "completed",
            DiscoveryJob.finished_at >= cutoff,
        )
        .group_by(func.date(DiscoveryJob.finished_at))
        .order_by(func.date(DiscoveryJob.finished_at))
        .all()
    )
    # Pad to exactly 7 days (fill zeros for missing days)
    found_by_day: dict[str, int] = {str(r.day): int(r.found or 0) for r in rows}
    daily: list[dict] = []
    for i in range(7):
        d = (datetime.utcnow() - timedelta(days=6 - i)).strftime("%Y-%m-%d")
        daily.append({"date": d, "hosts_found": found_by_day.get(d, 0)})

    # Job summary last 7 days
    job_rows = (
        db.query(DiscoveryJob.status, func.count(DiscoveryJob.id).label("n"))
        .filter(
            DiscoveryJob.organization_id == org_id,
            DiscoveryJob.created_at >= cutoff,
        )
        .group_by(DiscoveryJob.status)
        .all()
    )
    jobs_7d: dict[str, int] = {r.status: r.n for r in job_rows}

    return {
        "total_assets":       total_assets,
        "active_schedules":   active_schedules,
        "next_run_at":        next_run_at,
        "last_job":           last_job,
        "daily_assets_found": daily,
        "jobs_last_7d": {
            "completed": jobs_7d.get("completed", 0),
            "failed":    jobs_7d.get("failed", 0),
            "running":   jobs_7d.get("running", 0),
            "total":     sum(jobs_7d.values()),
        },
    }
