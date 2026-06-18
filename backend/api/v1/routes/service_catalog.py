from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import ServiceCatalogItem
from backend.api.v1.dependencies import get_current_user
from backend.core.domain.models import User

router = APIRouter(prefix="/service-catalog", tags=["service-catalog"])


@router.get("")
def list_catalog(
    search: str = Query(None),
    category: str = Query(None),
    enabled_only: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(ServiceCatalogItem)
    if not current_user.is_super_admin:
        q = q.filter(ServiceCatalogItem.organization_id == current_user.organization_id)
    if enabled_only:
        q = q.filter(ServiceCatalogItem.is_enabled == True)
    if search:
        q = q.filter(ServiceCatalogItem.name.ilike(f"%{search}%") | ServiceCatalogItem.description.ilike(f"%{search}%"))
    if category:
        q = q.filter(ServiceCatalogItem.category == category)
    return q.order_by(ServiceCatalogItem.order, ServiceCatalogItem.name).all()


@router.post("")
def create_item(body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = body.get("organization_id") or current_user.organization_id
    if not current_user.is_super_admin:
        org_id = current_user.organization_id
    import json
    item = ServiceCatalogItem(
        organization_id=org_id,
        name=body.get("name", ""),
        description=body.get("description"),
        category=body.get("category"),
        icon=body.get("icon", "package"),
        sla_hours=body.get("sla_hours", 8.0),
        requires_approval=body.get("requires_approval", False),
        approver_id=body.get("approver_id"),
        default_assignee_id=body.get("default_assignee_id"),
        form_fields=json.dumps(body.get("form_fields", [])) if isinstance(body.get("form_fields"), list) else body.get("form_fields", "[]"),
        is_enabled=body.get("is_enabled", True),
        order=body.get("order", 0),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/categories")
def list_categories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(ServiceCatalogItem.category).distinct()
    if not current_user.is_super_admin:
        q = q.filter(ServiceCatalogItem.organization_id == current_user.organization_id)
    return [r[0] for r in q.all() if r[0]]


@router.get("/{item_id}")
def get_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(ServiceCatalogItem).filter(ServiceCatalogItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and item.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    return item


@router.patch("/{item_id}")
def update_item(item_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(ServiceCatalogItem).filter(ServiceCatalogItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and item.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    for k, v in body.items():
        if hasattr(item, k) and k not in ("id", "organization_id"):
            setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(ServiceCatalogItem).filter(ServiceCatalogItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and item.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    db.delete(item)
    db.commit()


@router.post("/{item_id}/request")
def request_from_catalog(item_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(ServiceCatalogItem).filter(ServiceCatalogItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and item.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    from backend.core.domain.models import Ticket, SlaPolicy
    from sqlalchemy import func
    count = db.query(func.count(Ticket.id)).scalar() or 0
    number = f"REQ{str(count + 1).zfill(6)}"
    from datetime import timedelta
    resolution_due = None
    if item.sla_hours:
        from datetime import datetime
        resolution_due = datetime.utcnow() + timedelta(hours=item.sla_hours)
    t = Ticket(
        number=number,
        organization_id=item.organization_id,
        ticket_type="service_request",
        title=f"[SR] {item.name}",
        description=body.get("description") or f"Solicitação: {item.name}",
        category=item.category,
        priority="medium",
        status="open",
        source="catalog",
        created_by=current_user.id,
        requester_id=current_user.id,
        assigned_to=item.default_assignee_id,
        resolution_due_at=resolution_due,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t
