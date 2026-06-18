from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import Policy, PolicyCheck, Endpoint
from backend.api.v1.dependencies import get_current_user
from backend.core.domain.models import User

router = APIRouter(prefix="/policies", tags=["policies"])


@router.get("")
def list_policies(
    search: str = Query(None),
    platform: str = Query(None),
    category: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Policy)
    if not current_user.is_super_admin:
        q = q.filter(Policy.organization_id == current_user.organization_id)
    if search:
        q = q.filter(Policy.name.ilike(f"%{search}%"))
    if platform:
        q = q.filter(Policy.platform == platform)
    if category:
        q = q.filter(Policy.category == category)
    return q.order_by(Policy.name).all()


@router.post("")
def create_policy(body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = body.get("organization_id") or current_user.organization_id
    if not current_user.is_super_admin:
        org_id = current_user.organization_id
    import json
    pol = Policy(
        organization_id=org_id,
        name=body.get("name", ""),
        description=body.get("description"),
        platform=body.get("platform", "all"),
        category=body.get("category", "security"),
        is_enabled=body.get("is_enabled", True),
        rules=json.dumps(body.get("rules", [])) if isinstance(body.get("rules"), list) else body.get("rules", "[]"),
    )
    db.add(pol)
    db.commit()
    db.refresh(pol)
    return pol


@router.get("/{policy_id}")
def get_policy(policy_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pol = db.query(Policy).filter(Policy.id == policy_id).first()
    if not pol:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and pol.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    return pol


@router.patch("/{policy_id}")
def update_policy(policy_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pol = db.query(Policy).filter(Policy.id == policy_id).first()
    if not pol:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and pol.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    for k, v in body.items():
        if hasattr(pol, k) and k not in ("id", "organization_id"):
            setattr(pol, k, v)
    db.commit()
    db.refresh(pol)
    return pol


@router.delete("/{policy_id}", status_code=204)
def delete_policy(policy_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pol = db.query(Policy).filter(Policy.id == policy_id).first()
    if not pol:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and pol.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    db.delete(pol)
    db.commit()


@router.get("/{policy_id}/checks")
def list_checks(
    policy_id: int,
    endpoint_id: int = Query(None),
    status: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    pol = db.query(Policy).filter(Policy.id == policy_id).first()
    if not pol:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and pol.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    q = db.query(PolicyCheck).filter(PolicyCheck.policy_id == policy_id)
    if endpoint_id:
        q = q.filter(PolicyCheck.endpoint_id == endpoint_id)
    if status:
        q = q.filter(PolicyCheck.status == status)
    return q.all()
