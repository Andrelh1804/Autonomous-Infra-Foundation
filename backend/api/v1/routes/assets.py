from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import (
    Asset, AssetType, Manufacturer, AssetModel, Tag, AssetTag,
    AssetHistory, AssetRelationship, User, Site
)
from backend.core.application.schemas import (
    AssetCreate, AssetUpdate, AssetResponse,
    AssetTypeResponse, ManufacturerResponse, TagResponse,
    AssetHistoryResponse, AssetRelationshipCreate, AssetRelationshipResponse,
)
from backend.core.application.audit import log_action
from backend.api.v1.dependencies import get_current_user, get_client_ip
import json
from datetime import datetime

router = APIRouter(prefix="/assets", tags=["assets"])


# ── Asset Types ────────────────────────────────────────────────────────────────

@router.get("/types", response_model=List[AssetTypeResponse])
def list_asset_types(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(AssetType).order_by(AssetType.name).all()


# ── Manufacturers ──────────────────────────────────────────────────────────────

@router.get("/manufacturers", response_model=List[ManufacturerResponse])
def list_manufacturers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Manufacturer).order_by(Manufacturer.name).all()


# ── Tags ───────────────────────────────────────────────────────────────────────

@router.get("/tags", response_model=List[TagResponse])
def list_tags(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Tag).order_by(Tag.name).all()


@router.post("/tags", response_model=TagResponse, status_code=201)
def create_tag(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tag = Tag(name=body.get("name"), color=body.get("color", "#6366f1"))
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


# ── Assets CRUD ────────────────────────────────────────────────────────────────

@router.get("")
def list_assets(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=200),
    organization_id: Optional[int] = None,
    site_id: Optional[int] = None,
    asset_type_id: Optional[int] = None,
    manufacturer_id: Optional[int] = None,
    status: Optional[str] = None,
    criticality: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Asset)
    if not current_user.is_super_admin:
        query = query.filter(Asset.organization_id == current_user.organization_id)
    elif organization_id:
        query = query.filter(Asset.organization_id == organization_id)

    if site_id:
        query = query.filter(Asset.site_id == site_id)
    if asset_type_id:
        query = query.filter(Asset.asset_type_id == asset_type_id)
    if manufacturer_id:
        query = query.filter(Asset.manufacturer_id == manufacturer_id)
    if status:
        query = query.filter(Asset.status == status)
    if criticality:
        query = query.filter(Asset.criticality == criticality)
    if search:
        query = query.filter(
            Asset.hostname.ilike(f"%{search}%") |
            Asset.ip_address.ilike(f"%{search}%") |
            Asset.fqdn.ilike(f"%{search}%") |
            Asset.serial_number.ilike(f"%{search}%")
        )

    total = query.count()
    items = query.order_by(Asset.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {
        "items": [AssetResponse.model_validate(a) for a in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.post("", response_model=AssetResponse, status_code=201)
def create_asset(
    body: AssetCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = body.model_dump(exclude={"tag_ids"})
    if not current_user.is_super_admin:
        data["organization_id"] = current_user.organization_id
    asset = Asset(**data)
    db.add(asset)
    db.flush()
    if body.tag_ids:
        for tid in body.tag_ids:
            db.add(AssetTag(asset_id=asset.id, tag_id=tid))
    db.commit()
    db.refresh(asset)
    log_action(db, "CREATE_ASSET", "assets",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request), payload={"hostname": asset.hostname, "ip": asset.ip_address})
    return asset


@router.get("/stats")
def asset_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Asset)
    if not current_user.is_super_admin:
        query = query.filter(Asset.organization_id == current_user.organization_id)

    total = query.count()

    type_counts = {}
    for at in db.query(AssetType).all():
        count = query.filter(Asset.asset_type_id == at.id).count()
        type_counts[at.slug] = {"name": at.name, "count": count}

    status_counts = {}
    for status in ["active", "inactive", "maintenance", "retired"]:
        status_counts[status] = query.filter(Asset.status == status).count()

    return {
        "total": total,
        "by_type": type_counts,
        "by_status": status_counts,
    }


@router.get("/{asset_id}", response_model=AssetResponse)
def get_asset(
    asset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not current_user.is_super_admin and asset.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return asset


@router.patch("/{asset_id}", response_model=AssetResponse)
def update_asset(
    asset_id: int,
    body: AssetUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not current_user.is_super_admin and asset.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")

    changes = {}
    data = body.model_dump(exclude_unset=True, exclude={"tag_ids"})
    for field, value in data.items():
        old = getattr(asset, field)
        if old != value:
            changes[field] = {"before": old, "after": value}
        setattr(asset, field, value)

    if changes:
        h = AssetHistory(
            asset_id=asset.id,
            changed_by=current_user.id,
            change_source="manual",
            changes=json.dumps(changes),
        )
        db.add(h)

    if body.tag_ids is not None:
        db.query(AssetTag).filter(AssetTag.asset_id == asset_id).delete()
        for tid in body.tag_ids:
            db.add(AssetTag(asset_id=asset_id, tag_id=tid))

    asset.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(asset)
    log_action(db, "UPDATE_ASSET", "assets",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request), payload={"id": asset_id})
    return asset


@router.delete("/{asset_id}", status_code=204)
def delete_asset(
    asset_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not current_user.is_super_admin and asset.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(asset)
    db.commit()
    log_action(db, "DELETE_ASSET", "assets",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request), payload={"id": asset_id})


# ── Asset History ──────────────────────────────────────────────────────────────

@router.get("/{asset_id}/history", response_model=List[AssetHistoryResponse])
def get_asset_history(
    asset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not current_user.is_super_admin and asset.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return db.query(AssetHistory).filter(AssetHistory.asset_id == asset_id).order_by(AssetHistory.created_at.desc()).all()


# ── Asset Relationships ────────────────────────────────────────────────────────

@router.get("/{asset_id}/relationships")
def get_asset_relationships(
    asset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    rels = db.query(AssetRelationship).filter(
        (AssetRelationship.source_asset_id == asset_id) |
        (AssetRelationship.target_asset_id == asset_id)
    ).all()
    return [AssetRelationshipResponse.model_validate(r) for r in rels]


@router.post("/{asset_id}/relationships", response_model=AssetRelationshipResponse, status_code=201)
def create_asset_relationship(
    asset_id: int,
    body: AssetRelationshipCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from backend.modules.relationship_engine.mapper import create_relationship
    rel = create_relationship(
        db,
        source_id=asset_id,
        target_id=body.target_asset_id,
        relationship_type=body.relationship_type,
        description=body.description,
    )
    return rel


@router.delete("/relationships/{rel_id}", status_code=204)
def delete_relationship(
    rel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from backend.modules.relationship_engine.mapper import delete_relationship
    if not delete_relationship(db, rel_id):
        raise HTTPException(status_code=404, detail="Relationship not found")
