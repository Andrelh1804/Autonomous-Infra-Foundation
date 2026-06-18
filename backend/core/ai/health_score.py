"""
Global IT Health Score — 0–100 composite metric.
Computed from monitoring, incidents, compliance, vulnerabilities, endpoints.
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session


def compute_health_score(db: Session, org_id: int) -> dict:
    scores = {}

    # ── Monitoring (25 pts) ──────────────────────────────────────────────────
    try:
        from backend.core.domain.models import MonitoringTarget
        total = db.query(MonitoringTarget).filter(MonitoringTarget.organization_id == org_id).count()
        up = db.query(MonitoringTarget).filter(MonitoringTarget.organization_id == org_id, MonitoringTarget.last_status == "up").count()
        monitoring_pct = (up / total) if total > 0 else 1.0
        scores["monitoring"] = {"score": round(monitoring_pct * 25), "max": 25, "detail": f"{up}/{total} targets up"}
    except Exception:
        scores["monitoring"] = {"score": 20, "max": 25, "detail": "N/A"}

    # ── Incidents (25 pts) ───────────────────────────────────────────────────
    try:
        from backend.core.domain.models import Ticket
        critical = db.query(Ticket).filter(
            Ticket.organization_id == org_id,
            Ticket.ticket_type == "incident",
            Ticket.status.in_(["open", "in_progress"]),
            Ticket.priority == "critical",
        ).count()
        high = db.query(Ticket).filter(
            Ticket.organization_id == org_id,
            Ticket.ticket_type == "incident",
            Ticket.status.in_(["open", "in_progress"]),
            Ticket.priority == "high",
        ).count()
        deductions = min(critical * 5 + high * 2, 25)
        scores["incidents"] = {"score": max(0, 25 - deductions), "max": 25, "detail": f"{critical} critical, {high} high incidents"}
    except Exception:
        scores["incidents"] = {"score": 20, "max": 25, "detail": "N/A"}

    # ── Security / Vulnerabilities (20 pts) ──────────────────────────────────
    try:
        from backend.core.domain.models import EndpointVulnerability, Vulnerability
        critical_vulns = db.query(EndpointVulnerability).join(
            Vulnerability, EndpointVulnerability.vulnerability_id == Vulnerability.id
        ).filter(
            EndpointVulnerability.organization_id == org_id,
            EndpointVulnerability.status == "open",
            Vulnerability.severity == "critical",
        ).count()
        deductions = min(critical_vulns * 3, 20)
        scores["security"] = {"score": max(0, 20 - deductions), "max": 20, "detail": f"{critical_vulns} critical open vulns"}
    except Exception:
        scores["security"] = {"score": 15, "max": 20, "detail": "N/A"}

    # ── Compliance (15 pts) ──────────────────────────────────────────────────
    try:
        from backend.core.domain.models import ComplianceCheck
        total = db.query(ComplianceCheck).filter(ComplianceCheck.organization_id == org_id).count()
        passed = db.query(ComplianceCheck).filter(ComplianceCheck.organization_id == org_id, ComplianceCheck.status == "pass").count()
        pct = (passed / total) if total > 0 else 1.0
        scores["compliance"] = {"score": round(pct * 15), "max": 15, "detail": f"{round(pct*100)}% compliant"}
    except Exception:
        scores["compliance"] = {"score": 12, "max": 15, "detail": "N/A"}

    # ── Capacity / Endpoints (15 pts) ────────────────────────────────────────
    try:
        from backend.core.domain.models import Endpoint
        total = db.query(Endpoint).filter(Endpoint.organization_id == org_id).count()
        online = db.query(Endpoint).filter(Endpoint.organization_id == org_id, Endpoint.agent_status == "online").count()
        pct = (online / total) if total > 0 else 1.0
        scores["endpoints"] = {"score": round(pct * 15), "max": 15, "detail": f"{online}/{total} endpoints online"}
    except Exception:
        scores["endpoints"] = {"score": 12, "max": 15, "detail": "N/A"}

    total_score = sum(v["score"] for v in scores.values())

    if total_score >= 85:
        status = "excellent"
        color = "emerald"
    elif total_score >= 70:
        status = "good"
        color = "green"
    elif total_score >= 50:
        status = "warning"
        color = "amber"
    elif total_score >= 30:
        status = "critical"
        color = "orange"
    else:
        status = "critical"
        color = "red"

    return {
        "score": total_score,
        "max_score": 100,
        "status": status,
        "color": color,
        "breakdown": scores,
        "computed_at": datetime.utcnow().isoformat(),
    }
