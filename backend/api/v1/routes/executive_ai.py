"""
Executive AI — health score, executive reports, and AI search.
GET  /ai/executive/health    — global IT health score
POST /ai/executive/report    — generate executive report
POST /ai/search              — semantic AI search
GET  /ai/prompts             — list prompt templates
POST /ai/prompts             — create prompt template
"""
import json
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.core.infrastructure.database import get_db
from backend.api.v1.routes.auth import get_current_user
from backend.core.domain.models import User, PromptTemplate, AIAuditLog
from backend.core.ai.llm_gateway import chat_completion, _get_model
from backend.core.ai.tools import execute_tool
from backend.core.ai.health_score import compute_health_score
from backend.core.ai.rag_engine import search_documents

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["Executive AI"])


@router.get("/executive/health")
def get_health_score(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return compute_health_score(db, user.organization_id)


class ReportRequest(BaseModel):
    report_type: str = "weekly"  # daily/weekly/monthly/executive
    include_sections: Optional[list[str]] = None


@router.post("/executive/report")
def generate_report(req: ReportRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    health = compute_health_score(db, user.organization_id)
    monitoring = json.loads(execute_tool("get_monitoring_status", {}, db, user.organization_id))
    tickets = json.loads(execute_tool("get_open_tickets", {}, db, user.organization_id))
    vulns = json.loads(execute_tool("get_critical_vulnerabilities", {}, db, user.organization_id))
    licenses = json.loads(execute_tool("get_expiring_licenses", {"days": 30}, db, user.organization_id))
    compliance = json.loads(execute_tool("get_compliance_summary", {}, db, user.organization_id))
    alerts = json.loads(execute_tool("get_recent_alerts", {"hours": 168}, db, user.organization_id))

    data_block = f"""
IT Health Score: {health['score']}/100 ({health['status']})
Health Breakdown: {json.dumps(health['breakdown'])}
Monitoring: {monitoring['up']}/{monitoring['total_targets']} targets up ({monitoring['availability_pct']}% availability)
Open Tickets: {tickets['count']} total
Critical Vulnerabilities: {vulns['count']} open
Expiring Licenses (30d): {licenses['count']}
Compliance: {compliance.get('compliance_pct', 0)}% ({compliance.get('passed', 0)} passed / {compliance.get('failed', 0)} failed)
Alerts (7d): {alerts['count']}
"""

    type_prompts = {
        "daily": "Generate a concise daily IT operations report in Markdown. Include: summary, incidents, alerts, recommendations.",
        "weekly": "Generate a comprehensive weekly IT report in Markdown. Include: executive summary, health score analysis, incidents, vulnerabilities, compliance, license alerts, top recommendations.",
        "monthly": "Generate a detailed monthly IT report in Markdown. Include: executive summary, KPIs, trends, incidents analysis, security posture, compliance status, cost optimization opportunities.",
        "executive": "Generate a 1-page executive IT summary in Markdown. Focus on business impact, risks, and key decisions needed. Use non-technical language.",
    }

    prompt = [
        {"role": "system", "content": f"You are an IT operations reporting expert. {type_prompts.get(req.report_type, type_prompts['weekly'])} Use today's date: {datetime.utcnow().strftime('%Y-%m-%d')}. Respond in Portuguese (Brazil)."},
        {"role": "user", "content": f"Generate the report based on this data:\n{data_block}"},
    ]

    response = chat_completion(prompt, model=_get_model(), temperature=0.4, max_tokens=2000)

    audit = AIAuditLog(
        organization_id=user.organization_id,
        user_id=user.id,
        action="report",
        model=response.model,
        prompt_tokens=response.prompt_tokens,
        completion_tokens=response.completion_tokens,
        total_tokens=response.total_tokens,
        latency_ms=response.latency_ms,
    )
    db.add(audit)
    db.commit()

    return {
        "report": response.content,
        "type": req.report_type,
        "health_score": health["score"],
        "generated_at": datetime.utcnow().isoformat(),
        "model": response.model,
        "tokens": response.total_tokens,
    }


class SearchRequest(BaseModel):
    query: str
    search_type: str = "all"  # all/knowledge/tickets/assets
    limit: int = 8


@router.post("/search")
def ai_search(req: SearchRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    source_types = None
    if req.search_type == "knowledge":
        source_types = ["knowledge_article"]
    elif req.search_type == "tickets":
        source_types = ["ticket"]

    # Vector / keyword search
    doc_results = search_documents(db, user.organization_id, req.query, limit=req.limit, source_types=source_types)

    # Also search assets by hostname/IP
    asset_results = []
    if req.search_type in ("all", "assets"):
        from backend.core.domain.models import Asset
        from sqlalchemy import or_
        assets = db.query(Asset).filter(
            Asset.organization_id == user.organization_id,
            or_(
                Asset.hostname.ilike(f"%{req.query}%"),
                Asset.ip_address.ilike(f"%{req.query}%"),
                Asset.description.ilike(f"%{req.query}%"),
            ),
        ).limit(5).all()
        asset_results = [{"type": "asset", "title": a.hostname, "detail": f"{a.ip_address} — {a.status}", "id": a.id} for a in assets]

    return {
        "query": req.query,
        "documents": doc_results,
        "assets": asset_results,
        "total": len(doc_results) + len(asset_results),
    }


@router.post("/rag/index")
def index_documents(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Index knowledge base articles and resolved tickets for RAG."""
    from backend.core.ai.rag_engine import index_knowledge_base, index_resolved_tickets
    kb_count = index_knowledge_base(db, user.organization_id)
    ticket_count = index_resolved_tickets(db, user.organization_id)
    return {"indexed": {"knowledge_articles": kb_count, "tickets": ticket_count}}


# Prompt Templates
@router.get("/prompts")
def list_prompts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    prompts = db.query(PromptTemplate).filter(
        (PromptTemplate.organization_id == user.organization_id) | (PromptTemplate.is_system == True)
    ).all()
    return [{"id": p.id, "name": p.name, "category": p.category, "description": p.description, "is_system": p.is_system, "version": p.version} for p in prompts]


@router.post("/prompts")
def create_prompt(body: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    prompt = PromptTemplate(
        organization_id=user.organization_id,
        created_by=user.id,
        **{k: v for k, v in body.items() if k in ["name", "description", "category", "template", "variables"]},
    )
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    return {"id": prompt.id, "name": prompt.name}


@router.get("/stats")
def get_ai_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from backend.core.domain.models import AIConversation, AIMessage, AIAuditLog
    convs = db.query(AIConversation).filter(AIConversation.organization_id == user.organization_id).count()
    msgs = db.query(AIMessage).join(AIConversation).filter(AIConversation.organization_id == user.organization_id).count()
    from sqlalchemy import func
    tokens = db.query(func.sum(AIAuditLog.total_tokens)).filter(AIAuditLog.organization_id == user.organization_id).scalar() or 0
    provider = __import__("backend.core.ai.llm_gateway", fromlist=["_get_provider"])._get_provider()
    return {
        "conversations": convs,
        "messages": msgs,
        "total_tokens": tokens,
        "provider": provider,
        "model": _get_model(),
        "is_configured": provider != "mock",
    }
