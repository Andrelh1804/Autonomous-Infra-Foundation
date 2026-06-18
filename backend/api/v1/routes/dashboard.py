from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import Organization, User, UserSession, AuditLog
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
