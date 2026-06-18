from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import Organization, User
from backend.core.application.schemas import (
    OrganizationCreate, OrganizationUpdate, OrganizationResponse
)
from backend.core.application.audit import log_action
from backend.api.v1.dependencies import get_current_user, require_super_admin, get_client_ip

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("")
def list_organizations(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Organization)
    if not current_user.is_super_admin and current_user.organization_id:
        query = query.filter(Organization.id == current_user.organization_id)
    if search:
        query = query.filter(Organization.name.ilike(f"%{search}%"))

    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return {
        "items": [OrganizationResponse.model_validate(o) for o in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.post("", response_model=OrganizationResponse, status_code=201)
def create_organization(
    body: OrganizationCreate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    org = Organization(**body.model_dump())
    db.add(org)
    db.commit()
    db.refresh(org)
    log_action(db, "CREATE_ORGANIZATION", "organizations",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request),
               payload={"name": org.name})
    return org


@router.get("/{org_id}", response_model=OrganizationResponse)
def get_organization(
    org_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if not current_user.is_super_admin and current_user.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return org


@router.patch("/{org_id}", response_model=OrganizationResponse)
def update_organization(
    org_id: int,
    body: OrganizationUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if not current_user.is_super_admin and current_user.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(org, field, value)
    db.commit()
    db.refresh(org)
    log_action(db, "UPDATE_ORGANIZATION", "organizations",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request),
               payload={"id": org_id})
    return org


@router.delete("/{org_id}", status_code=204)
def delete_organization(
    org_id: int,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    db.delete(org)
    db.commit()
    log_action(db, "DELETE_ORGANIZATION", "organizations",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request),
               payload={"id": org_id})
