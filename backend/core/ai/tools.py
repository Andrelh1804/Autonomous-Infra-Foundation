"""
AI Tool Calling — platform tools available to the AI Copilot.
Each tool queries the DB directly (no HTTP overhead).
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Any
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def execute_tool(tool_name: str, arguments: dict, db: Session, org_id: int) -> str:
    """Dispatch a tool call and return a JSON string result."""
    try:
        handler = TOOL_HANDLERS.get(tool_name)
        if not handler:
            return json.dumps({"error": f"Tool '{tool_name}' not found"})
        result = handler(arguments, db, org_id)
        return json.dumps(result, default=str)
    except Exception as e:
        logger.error(f"Tool {tool_name} error: {e}")
        return json.dumps({"error": str(e)})


# ── Tool Handlers ─────────────────────────────────────────────────────────────

def _get_critical_assets(args: dict, db: Session, org_id: int) -> dict:
    from backend.core.domain.models import Asset
    limit = min(args.get("limit", 10), 50)
    assets = db.query(Asset).filter(
        Asset.organization_id == org_id,
        Asset.criticality.in_(["critical", "high"]),
        Asset.status == "active",
    ).limit(limit).all()
    return {
        "count": len(assets),
        "assets": [{"id": a.id, "hostname": a.hostname, "ip": a.ip_address, "criticality": a.criticality, "status": a.status, "os": a.operating_system} for a in assets]
    }


def _get_offline_assets(args: dict, db: Session, org_id: int) -> dict:
    from backend.core.domain.models import Asset
    limit = min(args.get("limit", 20), 100)
    assets = db.query(Asset).filter(
        Asset.organization_id == org_id,
        Asset.status.in_(["inactive", "offline"]),
    ).limit(limit).all()
    return {"count": len(assets), "assets": [{"id": a.id, "hostname": a.hostname, "ip": a.ip_address, "status": a.status} for a in assets]}


def _get_open_tickets(args: dict, db: Session, org_id: int) -> dict:
    from backend.core.domain.models import Ticket
    priority = args.get("priority")
    q = db.query(Ticket).filter(Ticket.organization_id == org_id, Ticket.status.in_(["open", "in_progress"]))
    if priority:
        q = q.filter(Ticket.priority == priority)
    tickets = q.order_by(Ticket.created_at.desc()).limit(20).all()
    return {
        "count": len(tickets),
        "tickets": [{"id": t.id, "number": t.number, "title": t.title, "priority": t.priority, "status": t.status, "type": t.ticket_type, "created_at": str(t.created_at)} for t in tickets]
    }


def _get_critical_vulnerabilities(args: dict, db: Session, org_id: int) -> dict:
    from backend.core.domain.models import EndpointVulnerability, Vulnerability
    q = db.query(EndpointVulnerability, Vulnerability).join(
        Vulnerability, EndpointVulnerability.vulnerability_id == Vulnerability.id
    ).filter(
        EndpointVulnerability.organization_id == org_id,
        EndpointVulnerability.status == "open",
        Vulnerability.severity.in_(["critical", "high"]),
    ).limit(20)
    results = q.all()
    return {
        "count": len(results),
        "vulnerabilities": [{"cve": v.cve_id, "title": v.title, "severity": v.severity, "cvss": v.cvss_score, "endpoint_id": ev.endpoint_id} for ev, v in results]
    }


def _get_expiring_licenses(args: dict, db: Session, org_id: int) -> dict:
    from backend.core.domain.models import LicenseRecord
    from sqlalchemy import func
    days = args.get("days", 30)
    cutoff = datetime.utcnow().date() + timedelta(days=days)
    licenses = db.query(LicenseRecord).filter(
        LicenseRecord.organization_id == org_id,
        LicenseRecord.status == "active",
        LicenseRecord.expiry_date != None,
        LicenseRecord.expiry_date <= str(cutoff),
    ).all()
    return {
        "count": len(licenses),
        "licenses": [{"id": l.id, "product": l.product, "vendor": l.vendor, "expiry": str(l.expiry_date), "quantity": l.quantity} for l in licenses]
    }


def _get_compliance_summary(args: dict, db: Session, org_id: int) -> dict:
    from backend.core.domain.models import ComplianceCheck, CompliancePolicy
    total = db.query(ComplianceCheck).filter(ComplianceCheck.organization_id == org_id).count()
    passed = db.query(ComplianceCheck).filter(ComplianceCheck.organization_id == org_id, ComplianceCheck.status == "pass").count()
    failed = db.query(ComplianceCheck).filter(ComplianceCheck.organization_id == org_id, ComplianceCheck.status == "fail").count()
    pct = round((passed / total * 100) if total else 0, 1)
    return {"total_checks": total, "passed": passed, "failed": failed, "compliance_pct": pct}


def _get_monitoring_status(args: dict, db: Session, org_id: int) -> dict:
    from backend.core.domain.models import MonitoringTarget
    q = db.query(MonitoringTarget).filter(MonitoringTarget.organization_id == org_id)
    total = q.count()
    up = q.filter(MonitoringTarget.last_status == "up").count()
    down = q.filter(MonitoringTarget.last_status == "down").count()
    return {"total_targets": total, "up": up, "down": down, "availability_pct": round((up / total * 100) if total else 0, 1)}


def _get_recent_alerts(args: dict, db: Session, org_id: int) -> dict:
    from backend.core.domain.models import AlertEvent
    hours = args.get("hours", 24)
    since = datetime.utcnow() - timedelta(hours=hours)
    alerts = db.query(AlertEvent).filter(
        AlertEvent.organization_id == org_id,
        AlertEvent.triggered_at >= since,
    ).order_by(AlertEvent.triggered_at.desc()).limit(20).all()
    return {
        "count": len(alerts),
        "alerts": [{"id": a.id, "title": a.title, "severity": a.severity, "status": a.status, "triggered_at": str(a.triggered_at)} for a in alerts]
    }


def _get_printer_status(args: dict, db: Session, org_id: int) -> dict:
    from backend.core.domain.models import Printer
    printers = db.query(Printer).filter(Printer.organization_id == org_id).limit(50).all()
    critical = [p for p in printers if p.status in ["error", "offline"]]
    return {
        "total": len(printers),
        "critical_count": len(critical),
        "critical_printers": [{"id": p.id, "name": p.name, "ip": p.ip_address, "status": p.status, "location": p.location} for p in critical[:10]]
    }


def _get_endpoint_summary(args: dict, db: Session, org_id: int) -> dict:
    from backend.core.domain.models import Endpoint
    total = db.query(Endpoint).filter(Endpoint.organization_id == org_id).count()
    online = db.query(Endpoint).filter(Endpoint.organization_id == org_id, Endpoint.agent_status == "online").count()
    return {"total": total, "online": online, "offline": total - online, "online_pct": round((online / total * 100) if total else 0, 1)}


def _search_knowledge_base(args: dict, db: Session, org_id: int) -> dict:
    from backend.core.domain.models import KnowledgeArticle
    query = args.get("query", "")
    articles = db.query(KnowledgeArticle).filter(
        KnowledgeArticle.organization_id == org_id,
        KnowledgeArticle.status == "published",
    ).limit(5).all()
    return {
        "count": len(articles),
        "articles": [{"id": a.id, "title": a.title, "category": a.category, "content_preview": (a.content or "")[:300]} for a in articles]
    }


def _get_it_health_summary(args: dict, db: Session, org_id: int) -> dict:
    """Comprehensive IT health summary for the AI."""
    monitoring = _get_monitoring_status({}, db, org_id)
    tickets = _get_open_tickets({"priority": "critical"}, db, org_id)
    compliance = _get_compliance_summary({}, db, org_id)
    endpoints = _get_endpoint_summary({}, db, org_id)
    return {
        "monitoring": monitoring,
        "critical_tickets": tickets["count"],
        "compliance_pct": compliance.get("compliance_pct", 0),
        "endpoints_online_pct": endpoints.get("online_pct", 0),
    }


# ── Tool Registry ─────────────────────────────────────────────────────────────

TOOL_HANDLERS = {
    "get_critical_assets": _get_critical_assets,
    "get_offline_assets": _get_offline_assets,
    "get_open_tickets": _get_open_tickets,
    "get_critical_vulnerabilities": _get_critical_vulnerabilities,
    "get_expiring_licenses": _get_expiring_licenses,
    "get_compliance_summary": _get_compliance_summary,
    "get_monitoring_status": _get_monitoring_status,
    "get_recent_alerts": _get_recent_alerts,
    "get_printer_status": _get_printer_status,
    "get_endpoint_summary": _get_endpoint_summary,
    "search_knowledge_base": _search_knowledge_base,
    "get_it_health_summary": _get_it_health_summary,
}

from backend.core.ai.llm_gateway import Tool

PLATFORM_TOOLS = [
    Tool("get_critical_assets", "Get critical and high-priority IT assets", {
        "type": "object", "properties": {"limit": {"type": "integer", "default": 10}},
    }),
    Tool("get_offline_assets", "Get offline or inactive assets", {
        "type": "object", "properties": {"limit": {"type": "integer", "default": 20}},
    }),
    Tool("get_open_tickets", "Get open support tickets", {
        "type": "object", "properties": {
            "priority": {"type": "string", "enum": ["critical", "high", "medium", "low"]},
            "limit": {"type": "integer", "default": 10},
        },
    }),
    Tool("get_critical_vulnerabilities", "Get open critical/high vulnerabilities", {
        "type": "object", "properties": {},
    }),
    Tool("get_expiring_licenses", "Get licenses expiring soon", {
        "type": "object", "properties": {"days": {"type": "integer", "default": 30}},
    }),
    Tool("get_compliance_summary", "Get compliance check summary", {
        "type": "object", "properties": {},
    }),
    Tool("get_monitoring_status", "Get monitoring targets up/down status", {
        "type": "object", "properties": {},
    }),
    Tool("get_recent_alerts", "Get recent alert events", {
        "type": "object", "properties": {"hours": {"type": "integer", "default": 24}},
    }),
    Tool("get_printer_status", "Get printers with issues (critical/offline)", {
        "type": "object", "properties": {},
    }),
    Tool("get_endpoint_summary", "Get endpoint online/offline summary", {
        "type": "object", "properties": {},
    }),
    Tool("search_knowledge_base", "Search knowledge base articles", {
        "type": "object", "properties": {"query": {"type": "string"}},
        "required": ["query"],
    }),
    Tool("get_it_health_summary", "Get overall IT health summary across all domains", {
        "type": "object", "properties": {},
    }),
]
