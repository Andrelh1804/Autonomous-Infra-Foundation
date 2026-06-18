from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import Site, User
from backend.core.application.schemas import SiteCreate, SiteUpdate, SiteResponse
from backend.core.application.audit import log_action
from backend.api.v1.dependencies import get_current_user, get_client_ip

router = APIRouter(prefix="/sites", tags=["sites"])


@router.get("")
def list_sites(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    organization_id: Optional[int] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Site)
    if not current_user.is_super_admin:
        query = query.filter(Site.organization_id == current_user.organization_id)
    elif organization_id:
        query = query.filter(Site.organization_id == organization_id)
    if search:
        query = query.filter(Site.name.ilike(f"%{search}%"))

    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return {
        "items": [SiteResponse.model_validate(s) for s in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.post("", response_model=SiteResponse, status_code=201)
def create_site(
    body: SiteCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_id = current_user.organization_id
    site = Site(organization_id=org_id, **body.model_dump())
    db.add(site)
    db.commit()
    db.refresh(site)
    log_action(db, "CREATE_SITE", "sites",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request), payload={"name": site.name})
    return site


@router.get("/{site_id}", response_model=SiteResponse)
def get_site(
    site_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    if not current_user.is_super_admin and site.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return site


@router.patch("/{site_id}", response_model=SiteResponse)
def update_site(
    site_id: int,
    body: SiteUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    if not current_user.is_super_admin and site.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(site, field, value)
    db.commit()
    db.refresh(site)
    log_action(db, "UPDATE_SITE", "sites",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request), payload={"id": site_id})
    return site


@router.delete("/{site_id}", status_code=204)
def delete_site(
    site_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    if not current_user.is_super_admin and site.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(site)
    db.commit()
    log_action(db, "DELETE_SITE", "sites",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request), payload={"id": site_id})
