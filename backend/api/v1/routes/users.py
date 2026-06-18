from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.infrastructure.security import get_password_hash, verify_password
from backend.core.domain.models import User, UserRole, Role
from backend.core.application.schemas import (
    UserCreate, UserUpdate, UserResponse, ChangePasswordRequest
)
from backend.core.application.audit import log_action
from backend.api.v1.dependencies import get_current_user, require_super_admin, get_client_ip

router = APIRouter(prefix="/users", tags=["users"])


def _user_to_response(user: User) -> dict:
    roles = [ur.role.name for ur in user.user_roles]
    return {
        "id": user.id,
        "uuid": user.uuid,
        "organization_id": user.organization_id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "active": user.active,
        "is_super_admin": user.is_super_admin,
        "mfa_enabled": user.mfa_enabled,
        "last_login": user.last_login,
        "created_at": user.created_at,
        "roles": roles,
    }


@router.get("")
def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    organization_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if not current_user.is_super_admin:
        query = query.filter(User.organization_id == current_user.organization_id)
    elif organization_id:
        query = query.filter(User.organization_id == organization_id)
    if search:
        query = query.filter(
            (User.first_name.ilike(f"%{search}%")) |
            (User.last_name.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%"))
        )
    total = query.count()
    users = query.offset((page - 1) * per_page).limit(per_page).all()
    return {
        "items": [_user_to_response(u) for u in users],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.post("", status_code=201)
def create_user(
    body: UserCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    org_id = body.organization_id
    if not current_user.is_super_admin:
        org_id = current_user.organization_id

    user = User(
        organization_id=org_id,
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email,
        password_hash=get_password_hash(body.password),
    )
    db.add(user)
    db.flush()

    for role_id in (body.role_ids or []):
        role = db.query(Role).filter(Role.id == role_id).first()
        if role:
            db.add(UserRole(user_id=user.id, role_id=role.id))

    db.commit()
    db.refresh(user)
    log_action(db, "CREATE_USER", "users",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request),
               payload={"email": user.email})
    return _user_to_response(user)


@router.get("/{user_id}")
def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not current_user.is_super_admin and user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return _user_to_response(user)


@router.patch("/{user_id}")
def update_user(
    user_id: int,
    body: UserUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not current_user.is_super_admin and user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")

    data = body.model_dump(exclude_unset=True)
    role_ids = data.pop("role_ids", None)

    for field, value in data.items():
        setattr(user, field, value)

    if role_ids is not None:
        db.query(UserRole).filter(UserRole.user_id == user_id).delete()
        for rid in role_ids:
            role = db.query(Role).filter(Role.id == rid).first()
            if role:
                db.add(UserRole(user_id=user.id, role_id=role.id))

    db.commit()
    db.refresh(user)
    log_action(db, "UPDATE_USER", "users",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request),
               payload={"id": user_id})
    return _user_to_response(user)


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not current_user.is_super_admin and user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    db.delete(user)
    db.commit()
    log_action(db, "DELETE_USER", "users",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request),
               payload={"id": user_id})


@router.post("/{user_id}/change-password", status_code=204)
def change_password(
    user_id: int,
    body: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.id != user_id and not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = get_password_hash(body.new_password)
    db.commit()
    log_action(db, "CHANGE_PASSWORD", "users",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request))
