"""
OCS Inventory NG integration routes.
All endpoints live under /api/v1/integrations/ocs
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, BackgroundTasks
from sqlalchemy.orm import Session

from backend.core.infrastructure.database import get_db
from backend.core.domain.models import User
from backend.core.application.audit import log_action
from backend.api.v1.dependencies import get_current_user, get_client_ip

from backend.modules.integrations.ocs_inventory.models import (
    OcsIntegration, OcsSyncJob, OcsSyncLog, OcsAsset,
    OcsSoftware, OcsUser, OcsNetwork, OcsChangeLog,
)
from backend.modules.integrations.ocs_inventory.schemas import (
    OcsIntegrationCreate, OcsIntegrationUpdate, OcsIntegrationResponse,
    OcsSyncJobResponse, OcsSyncLogResponse, OcsAssetResponse,
    OcsSoftwareResponse, OcsUserResponse, OcsNetworkResponse,
    OcsChangeLogResponse, OcsTestConnectionResponse,
)
from backend.modules.integrations.ocs_inventory import services

router = APIRouter(prefix="/integrations/ocs", tags=["integrations-ocs"])


def _get_integration(integration_id: int, db: Session, current_user: User) -> OcsIntegration:
    q = db.query(OcsIntegration).filter_by(id=integration_id)
    if not current_user.is_super_admin:
        q = q.filter_by(organization_id=current_user.organization_id)
    integration = q.first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    return integration


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[OcsIntegrationResponse])
def list_integrations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(OcsIntegration)
    if not current_user.is_super_admin:
        q = q.filter_by(organization_id=current_user.organization_id)
    return q.order_by(OcsIntegration.created_at.desc()).all()


@router.post("", response_model=OcsIntegrationResponse, status_code=201)
def create_integration(
    body: OcsIntegrationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    ip: str = Depends(get_client_ip),
):
    org_id = current_user.organization_id if not current_user.is_super_admin else current_user.organization_id
    data = body.model_dump()
    integration = services.create_integration(db, org_id, current_user.id, data)
    log_action(db, "CREATE", "integrations_ocs", user_id=current_user.id,
               user_email=current_user.email, ip_address=ip,
               payload={"integration_id": integration.id, "name": integration.name})
    return integration


@router.get("/{integration_id}", response_model=OcsIntegrationResponse)
def get_integration(
    integration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_integration(integration_id, db, current_user)


@router.patch("/{integration_id}", response_model=OcsIntegrationResponse)
def update_integration(
    integration_id: int,
    body: OcsIntegrationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    ip: str = Depends(get_client_ip),
):
    integration = _get_integration(integration_id, db, current_user)
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    integration = services.update_integration(db, integration, data)
    log_action(db, "UPDATE", "integrations_ocs", user_id=current_user.id,
               user_email=current_user.email, ip_address=ip,
               payload={"integration_id": integration_id})
    return integration


@router.delete("/{integration_id}", status_code=204)
def delete_integration(
    integration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    ip: str = Depends(get_client_ip),
):
    integration = _get_integration(integration_id, db, current_user)
    db.delete(integration)
    db.commit()
    log_action(db, "DELETE", "integrations_ocs", user_id=current_user.id,
               user_email=current_user.email, ip_address=ip,
               payload={"integration_id": integration_id})


# ── Connection & Sync ─────────────────────────────────────────────────────────

@router.post("/{integration_id}/test", response_model=OcsTestConnectionResponse)
def test_connection(
    integration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    ip: str = Depends(get_client_ip),
):
    integration = _get_integration(integration_id, db, current_user)
    result = services.test_connection(db, integration)
    log_action(db, "TEST_CONNECTION", "integrations_ocs", user_id=current_user.id,
               user_email=current_user.email, ip_address=ip,
               payload={"integration_id": integration_id, "success": result["success"]})
    return result


def _bg_sync(integration_id: int, sync_type: str, user_id: int):
    from backend.core.infrastructure.database import SessionLocal
    db = SessionLocal()
    try:
        integration = db.query(OcsIntegration).filter_by(id=integration_id).first()
        if integration:
            services.trigger_sync(db, integration, sync_type=sync_type, triggered_by=user_id)
    finally:
        db.close()


@router.post("/{integration_id}/sync")
def sync_incremental(
    integration_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    ip: str = Depends(get_client_ip),
):
    integration = _get_integration(integration_id, db, current_user)
    if integration.is_paused:
        raise HTTPException(status_code=400, detail="Integration is paused")
    background_tasks.add_task(_bg_sync, integration_id, "incremental", current_user.id)
    log_action(db, "SYNC_INCREMENTAL", "integrations_ocs", user_id=current_user.id,
               user_email=current_user.email, ip_address=ip,
               payload={"integration_id": integration_id})
    return {"message": "Incremental sync started in background", "integration_id": integration_id}


@router.post("/{integration_id}/full-sync")
def sync_full(
    integration_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    ip: str = Depends(get_client_ip),
):
    integration = _get_integration(integration_id, db, current_user)
    if integration.is_paused:
        raise HTTPException(status_code=400, detail="Integration is paused")
    background_tasks.add_task(_bg_sync, integration_id, "full", current_user.id)
    log_action(db, "SYNC_FULL", "integrations_ocs", user_id=current_user.id,
               user_email=current_user.email, ip_address=ip,
               payload={"integration_id": integration_id})
    return {"message": "Full sync started in background", "integration_id": integration_id}


@router.post("/{integration_id}/pause")
def pause_integration(
    integration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    integration = _get_integration(integration_id, db, current_user)
    services.pause_integration(db, integration)
    return {"message": "Integration paused"}


@router.post("/{integration_id}/resume")
def resume_integration(
    integration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    integration = _get_integration(integration_id, db, current_user)
    services.resume_integration(db, integration)
    return {"message": "Integration resumed"}


# ── Status & Dashboard ────────────────────────────────────────────────────────

@router.get("/{integration_id}/status")
def get_status(
    integration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    integration = _get_integration(integration_id, db, current_user)
    return services.get_dashboard_stats(db, integration)


# ── Jobs ──────────────────────────────────────────────────────────────────────

@router.get("/{integration_id}/jobs", response_model=List[OcsSyncJobResponse])
def list_jobs(
    integration_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    integration = _get_integration(integration_id, db, current_user)
    offset = (page - 1) * per_page
    return (
        db.query(OcsSyncJob)
        .filter_by(integration_id=integration.id)
        .order_by(OcsSyncJob.started_at.desc())
        .offset(offset).limit(per_page).all()
    )


# ── Logs ──────────────────────────────────────────────────────────────────────

@router.get("/{integration_id}/logs", response_model=List[OcsSyncLogResponse])
def list_logs(
    integration_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    level: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    integration = _get_integration(integration_id, db, current_user)
    q = db.query(OcsSyncLog).filter_by(integration_id=integration.id)
    if level:
        q = q.filter_by(level=level)
    if category:
        q = q.filter_by(category=category)
    offset = (page - 1) * per_page
    return q.order_by(OcsSyncLog.created_at.desc()).offset(offset).limit(per_page).all()


# ── Assets ────────────────────────────────────────────────────────────────────

@router.get("/{integration_id}/assets", response_model=List[OcsAssetResponse])
def list_assets(
    integration_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    integration = _get_integration(integration_id, db, current_user)
    q = db.query(OcsAsset).filter_by(integration_id=integration.id)
    if search:
        q = q.filter(
            OcsAsset.hostname.ilike(f"%{search}%") |
            OcsAsset.ip_address.ilike(f"%{search}%") |
            OcsAsset.serial_number.ilike(f"%{search}%")
        )
    offset = (page - 1) * per_page
    return q.order_by(OcsAsset.updated_at.desc()).offset(offset).limit(per_page).all()


# ── Software ──────────────────────────────────────────────────────────────────

@router.get("/{integration_id}/software", response_model=List[OcsSoftwareResponse])
def list_software(
    integration_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    integration = _get_integration(integration_id, db, current_user)
    q = db.query(OcsSoftware).filter_by(integration_id=integration.id)
    if search:
        q = q.filter(OcsSoftware.name.ilike(f"%{search}%"))
    offset = (page - 1) * per_page
    return q.order_by(OcsSoftware.name).offset(offset).limit(per_page).all()


# ── Users ──────────────────────────────────────────────────────────────────────

@router.get("/{integration_id}/users", response_model=List[OcsUserResponse])
def list_users(
    integration_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    integration = _get_integration(integration_id, db, current_user)
    q = db.query(OcsUser).filter_by(integration_id=integration.id)
    offset = (page - 1) * per_page
    return q.order_by(OcsUser.username).offset(offset).limit(per_page).all()


# ── Changes ───────────────────────────────────────────────────────────────────

@router.get("/{integration_id}/changes", response_model=List[OcsChangeLogResponse])
def list_changes(
    integration_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    change_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    integration = _get_integration(integration_id, db, current_user)
    q = db.query(OcsChangeLog).filter_by(integration_id=integration.id)
    if change_type:
        q = q.filter_by(change_type=change_type)
    offset = (page - 1) * per_page
    return q.order_by(OcsChangeLog.detected_at.desc()).offset(offset).limit(per_page).all()
