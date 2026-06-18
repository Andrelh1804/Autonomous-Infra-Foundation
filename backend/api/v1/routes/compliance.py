from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import CompliancePolicy, ComplianceCheck, Endpoint
from backend.api.v1.dependencies import get_current_user
from backend.core.domain.models import User

router = APIRouter(prefix="/compliance", tags=["compliance"])


@router.get("/policies")
def list_policies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(CompliancePolicy)
    if not current_user.is_super_admin:
        q = q.filter(CompliancePolicy.organization_id == current_user.organization_id)
    return q.order_by(CompliancePolicy.name).all()


@router.post("/policies")
def create_policy(body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = body.get("organization_id") or current_user.organization_id
    if not current_user.is_super_admin:
        org_id = current_user.organization_id
    import json
    pol = CompliancePolicy(
        organization_id=org_id,
        name=body.get("name", ""),
        description=body.get("description"),
        framework=body.get("framework", "custom"),
        platform=body.get("platform", "all"),
        is_enabled=body.get("is_enabled", True),
        rules=json.dumps(body.get("rules", [])) if isinstance(body.get("rules"), list) else body.get("rules", "[]"),
    )
    db.add(pol)
    db.commit()
    db.refresh(pol)
    return pol


@router.get("/policies/{policy_id}")
def get_policy(policy_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pol = db.query(CompliancePolicy).filter(CompliancePolicy.id == policy_id).first()
    if not pol:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and pol.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    return pol


@router.patch("/policies/{policy_id}")
def update_policy(policy_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pol = db.query(CompliancePolicy).filter(CompliancePolicy.id == policy_id).first()
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


@router.delete("/policies/{policy_id}", status_code=204)
def delete_policy(policy_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pol = db.query(CompliancePolicy).filter(CompliancePolicy.id == policy_id).first()
    if not pol:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and pol.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    db.delete(pol)
    db.commit()


@router.get("/checks")
def list_checks(
    endpoint_id: int = Query(None),
    policy_id: int = Query(None),
    status: str = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(ComplianceCheck)
    if not current_user.is_super_admin:
        q = q.filter(ComplianceCheck.organization_id == current_user.organization_id)
    if endpoint_id:
        q = q.filter(ComplianceCheck.endpoint_id == endpoint_id)
    if policy_id:
        q = q.filter(ComplianceCheck.policy_id == policy_id)
    if status:
        q = q.filter(ComplianceCheck.status == status)
    total = q.count()
    items = q.order_by(ComplianceCheck.checked_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.get("/summary")
def compliance_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(ComplianceCheck)
    if not current_user.is_super_admin:
        q = q.filter(ComplianceCheck.organization_id == current_user.organization_id)
    total = q.count()
    passed = q.filter(ComplianceCheck.status == "pass").count()
    failed = q.filter(ComplianceCheck.status == "fail").count()
    pct = round((passed / total * 100), 1) if total > 0 else 100.0
    endpoints_q = db.query(Endpoint)
    if not current_user.is_super_admin:
        endpoints_q = endpoints_q.filter(Endpoint.organization_id == current_user.organization_id)
    avg_score = endpoints_q.with_entities(func.avg(Endpoint.compliance_score)).scalar() or 100.0
    return {"total_checks": total, "passed": passed, "failed": failed, "compliance_pct": pct, "avg_endpoint_score": round(float(avg_score), 1)}


@router.post("/checks/bulk-report")
def bulk_report_checks(body: dict, db: Session = Depends(get_db)):
    endpoint_id = body.get("endpoint_id")
    policy_id = body.get("policy_id")
    checks = body.get("checks", [])
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404)
    from datetime import datetime
    for chk in checks:
        existing = db.query(ComplianceCheck).filter(
            ComplianceCheck.endpoint_id == endpoint_id,
            ComplianceCheck.policy_id == policy_id,
            ComplianceCheck.rule_name == chk.get("rule_name")
        ).first()
        if existing:
            existing.status = chk.get("status", "unknown")
            existing.value_found = chk.get("value_found")
            existing.value_expected = chk.get("value_expected")
            existing.details = chk.get("details")
            existing.checked_at = datetime.utcnow()
        else:
            c = ComplianceCheck(
                endpoint_id=endpoint_id,
                policy_id=policy_id,
                organization_id=ep.organization_id,
                rule_name=chk.get("rule_name", ""),
                status=chk.get("status", "unknown"),
                value_found=chk.get("value_found"),
                value_expected=chk.get("value_expected"),
                details=chk.get("details"),
            )
            db.add(c)
    total_checks = len(checks)
    passed = sum(1 for c in checks if c.get("status") == "pass")
    if total_checks > 0:
        ep.compliance_score = round(passed / total_checks * 100)
    db.commit()
    return {"status": "ok", "total": total_checks, "passed": passed}
