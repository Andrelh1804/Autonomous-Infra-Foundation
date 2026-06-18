from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import Role, Permission, RolePermission
from backend.core.application.schemas import RoleCreate, RoleUpdate, RoleResponse, PermissionResponse
from backend.core.application.audit import log_action
from backend.api.v1.dependencies import get_current_user, require_super_admin, get_client_ip
from backend.core.domain.models import User

router = APIRouter(tags=["roles & permissions"])


@router.get("/roles")
def list_roles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    roles = db.query(Role).all()
    result = []
    for r in roles:
        perms = [rp.permission.name for rp in r.role_permissions]
        result.append({"id": r.id, "name": r.name, "description": r.description, "permissions": perms})
    return result


@router.post("/roles", status_code=201)
def create_role(
    body: RoleCreate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    if db.query(Role).filter(Role.name == body.name).first():
        raise HTTPException(status_code=409, detail="Role already exists")
    role = Role(name=body.name, description=body.description)
    db.add(role)
    db.flush()
    for pid in (body.permission_ids or []):
        perm = db.query(Permission).filter(Permission.id == pid).first()
        if perm:
            db.add(RolePermission(role_id=role.id, permission_id=perm.id))
    db.commit()
    db.refresh(role)
    log_action(db, "CREATE_ROLE", "roles",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request), payload={"name": role.name})
    return {"id": role.id, "name": role.name, "description": role.description}


@router.patch("/roles/{role_id}")
def update_role(
    role_id: int,
    body: RoleUpdate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if body.name:
        role.name = body.name
    if body.description is not None:
        role.description = body.description
    if body.permission_ids is not None:
        db.query(RolePermission).filter(RolePermission.role_id == role_id).delete()
        for pid in body.permission_ids:
            perm = db.query(Permission).filter(Permission.id == pid).first()
            if perm:
                db.add(RolePermission(role_id=role.id, permission_id=perm.id))
    db.commit()
    db.refresh(role)
    log_action(db, "UPDATE_ROLE", "roles",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request), payload={"id": role_id})
    perms = [rp.permission.name for rp in role.role_permissions]
    return {"id": role.id, "name": role.name, "description": role.description, "permissions": perms}


@router.delete("/roles/{role_id}", status_code=204)
def delete_role(
    role_id: int,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    db.delete(role)
    db.commit()
    log_action(db, "DELETE_ROLE", "roles",
               user_id=current_user.id, user_email=current_user.email,
               ip_address=get_client_ip(request), payload={"id": role_id})


@router.get("/permissions")
def list_permissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    perms = db.query(Permission).all()
    return [PermissionResponse.model_validate(p) for p in perms]
