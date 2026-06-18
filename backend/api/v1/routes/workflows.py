from datetime import datetime
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import WorkflowTemplate, WorkflowExecution
from backend.api.v1.dependencies import get_current_user
from backend.core.domain.models import User

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.get("")
def list_workflows(
    search: str = Query(None),
    trigger_type: str = Query(None),
    enabled_only: bool = Query(False),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(WorkflowTemplate)
    if not current_user.is_super_admin:
        q = q.filter(WorkflowTemplate.organization_id == current_user.organization_id)
    if search:
        q = q.filter(WorkflowTemplate.name.ilike(f"%{search}%"))
    if trigger_type:
        q = q.filter(WorkflowTemplate.trigger_type == trigger_type)
    if enabled_only:
        q = q.filter(WorkflowTemplate.is_enabled == True)
    total = q.count()
    items = q.order_by(WorkflowTemplate.name).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.post("")
def create_workflow(body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = body.get("organization_id") or current_user.organization_id
    if not current_user.is_super_admin:
        org_id = current_user.organization_id
    wf = WorkflowTemplate(
        organization_id=org_id,
        name=body.get("name", ""),
        description=body.get("description"),
        trigger_type=body.get("trigger_type", "manual"),
        trigger_config=json.dumps(body.get("trigger_config", {})) if isinstance(body.get("trigger_config"), dict) else body.get("trigger_config", "{}"),
        steps=json.dumps(body.get("steps", [])) if isinstance(body.get("steps"), list) else body.get("steps", "[]"),
        is_enabled=body.get("is_enabled", True),
        created_by=current_user.id,
    )
    db.add(wf)
    db.commit()
    db.refresh(wf)
    return wf


@router.get("/{workflow_id}")
def get_workflow(workflow_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wf = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and wf.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    return wf


@router.patch("/{workflow_id}")
def update_workflow(workflow_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wf = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and wf.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    for k, v in body.items():
        if hasattr(wf, k) and k not in ("id", "organization_id"):
            setattr(wf, k, v)
    db.commit()
    db.refresh(wf)
    return wf


@router.delete("/{workflow_id}", status_code=204)
def delete_workflow(workflow_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wf = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and wf.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    db.delete(wf)
    db.commit()


@router.post("/{workflow_id}/execute")
def execute_workflow(workflow_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wf = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and wf.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    if not wf.is_enabled:
        raise HTTPException(status_code=400, detail="Workflow is disabled")
    execution = WorkflowExecution(
        template_id=wf.id,
        organization_id=wf.organization_id,
        trigger_data=json.dumps(body.get("trigger_data", {})),
        status="running",
    )
    db.add(execution)
    wf.run_count = (wf.run_count or 0) + 1
    wf.last_run_at = datetime.utcnow()
    db.commit()
    db.refresh(execution)
    return execution


@router.get("/{workflow_id}/executions")
def list_executions(
    workflow_id: int,
    status: str = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    wf = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and wf.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    q = db.query(WorkflowExecution).filter(WorkflowExecution.template_id == workflow_id)
    if status:
        q = q.filter(WorkflowExecution.status == status)
    total = q.count()
    items = q.order_by(WorkflowExecution.started_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "items": items}
