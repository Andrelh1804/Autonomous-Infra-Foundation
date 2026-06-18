from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.core.infrastructure.database import get_db
from backend.core.domain.models import Vulnerability, EndpointVulnerability, Endpoint
from backend.api.v1.dependencies import get_current_user
from backend.core.domain.models import User

router = APIRouter(prefix="/vulnerabilities", tags=["vulnerabilities"])


@router.get("")
def list_vulnerabilities(
    search: str = Query(None),
    severity: str = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Vulnerability)
    if search:
        q = q.filter(
            Vulnerability.title.ilike(f"%{search}%") |
            Vulnerability.cve_id.ilike(f"%{search}%") |
            Vulnerability.affected_product.ilike(f"%{search}%")
        )
    if severity:
        q = q.filter(Vulnerability.severity == severity)
    total = q.count()
    items = q.order_by(Vulnerability.cvss_score.desc().nullslast()).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.post("")
def create_vulnerability(body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="Only admins can create vulnerabilities")
    vuln = Vulnerability(
        cve_id=body.get("cve_id"),
        title=body.get("title", ""),
        description=body.get("description"),
        cvss_score=body.get("cvss_score"),
        cvss_vector=body.get("cvss_vector"),
        severity=body.get("severity", "medium"),
        affected_product=body.get("affected_product"),
        affected_vendor=body.get("affected_vendor"),
        affected_versions=body.get("affected_versions"),
        patch_available=body.get("patch_available", False),
        patch_url=body.get("patch_url"),
        reference_urls=body.get("reference_urls"),
    )
    db.add(vuln)
    db.commit()
    db.refresh(vuln)
    return vuln


@router.get("/endpoint-vulns")
def list_endpoint_vulns(
    status: str = Query(None),
    severity: str = Query(None),
    endpoint_id: int = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(EndpointVulnerability)
    if not current_user.is_super_admin:
        q = q.filter(EndpointVulnerability.organization_id == current_user.organization_id)
    if status:
        q = q.filter(EndpointVulnerability.status == status)
    if endpoint_id:
        q = q.filter(EndpointVulnerability.endpoint_id == endpoint_id)
    if severity:
        q = q.join(Vulnerability).filter(Vulnerability.severity == severity)
    total = q.count()
    items = q.order_by(EndpointVulnerability.detected_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.get("/summary")
def vuln_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(EndpointVulnerability)
    if not current_user.is_super_admin:
        q = q.filter(EndpointVulnerability.organization_id == current_user.organization_id)
    total = q.count()
    open_count = q.filter(EndpointVulnerability.status == "open").count()
    by_severity = {}
    for sev in ("critical", "high", "medium", "low"):
        cnt = q.join(Vulnerability).filter(Vulnerability.severity == sev).count()
        by_severity[sev] = cnt
    return {"total": total, "open": open_count, "by_severity": by_severity}


@router.post("/endpoint-vulns")
def report_endpoint_vuln(body: dict, db: Session = Depends(get_db)):
    endpoint_id = body.get("endpoint_id")
    vuln_id = body.get("vulnerability_id")
    org_id = body.get("organization_id")
    if not endpoint_id or not vuln_id:
        raise HTTPException(status_code=400, detail="endpoint_id and vulnerability_id required")
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404)
    from sqlalchemy.exc import IntegrityError
    ev = EndpointVulnerability(
        endpoint_id=endpoint_id,
        vulnerability_id=vuln_id,
        organization_id=ep.organization_id,
        status=body.get("status", "open"),
    )
    try:
        db.add(ev)
        db.commit()
        db.refresh(ev)
        return ev
    except IntegrityError:
        db.rollback()
        return db.query(EndpointVulnerability).filter(
            EndpointVulnerability.endpoint_id == endpoint_id,
            EndpointVulnerability.vulnerability_id == vuln_id
        ).first()


@router.patch("/endpoint-vulns/{ev_id}")
def update_endpoint_vuln(ev_id: int, body: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ev = db.query(EndpointVulnerability).filter(EndpointVulnerability.id == ev_id).first()
    if not ev:
        raise HTTPException(status_code=404)
    if not current_user.is_super_admin and ev.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403)
    for k, v in body.items():
        if hasattr(ev, k) and k not in ("id",):
            setattr(ev, k, v)
    if body.get("status") == "resolved":
        ev.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(ev)
    return ev
