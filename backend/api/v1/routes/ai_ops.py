"""
AI Operations Center & Insights.
GET  /ai/ops/dashboard   — AI-generated ops overview
GET  /ai/ops/insights    — AI insights list
POST /ai/ops/insights/generate — generate new insights
GET  /ai/ops/recommendations  — recommendations list
PATCH /ai/ops/recommendations/{id} — update status
POST /ai/ops/rca         — root cause analysis
POST /ai/ops/summarize   — summarize a ticket/incident
"""
import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.core.infrastructure.database import get_db
from backend.api.v1.routes.auth import get_current_user
from backend.core.domain.models import User, AIInsight, AIRecommendation, AIAuditLog
from backend.core.ai.llm_gateway import chat_completion, _get_model
from backend.core.ai.tools import execute_tool
from backend.core.ai.health_score import compute_health_score

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai/ops", tags=["AI Operations"])


@router.get("/dashboard")
def get_ops_dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    health = compute_health_score(db, user.organization_id)
    insights = db.query(AIInsight).filter(
        AIInsight.organization_id == user.organization_id,
        AIInsight.is_read == False,
    ).order_by(AIInsight.created_at.desc()).limit(10).all()
    recs = db.query(AIRecommendation).filter(
        AIRecommendation.organization_id == user.organization_id,
        AIRecommendation.status == "open",
    ).order_by(AIRecommendation.created_at.desc()).limit(5).all()

    # Live platform data summaries
    critical_assets = execute_tool("get_critical_assets", {"limit": 5}, db, user.organization_id)
    open_tickets = execute_tool("get_open_tickets", {"priority": "critical"}, db, user.organization_id)
    monitoring = execute_tool("get_monitoring_status", {}, db, user.organization_id)
    alerts = execute_tool("get_recent_alerts", {"hours": 24}, db, user.organization_id)

    import json
    return {
        "health_score": health,
        "insights": [
            {"id": i.id, "type": i.insight_type, "severity": i.severity, "title": i.title, "description": i.description, "created_at": i.created_at}
            for i in insights
        ],
        "recommendations": [
            {"id": r.id, "category": r.category, "priority": r.priority, "title": r.title, "action": r.action, "created_at": r.created_at}
            for r in recs
        ],
        "platform": {
            "critical_assets": json.loads(critical_assets),
            "critical_tickets": json.loads(open_tickets),
            "monitoring": json.loads(monitoring),
            "recent_alerts": json.loads(alerts),
        },
    }


@router.get("/insights")
def list_insights(
    severity: Optional[str] = None,
    is_read: Optional[bool] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(AIInsight).filter(AIInsight.organization_id == user.organization_id)
    if severity:
        q = q.filter(AIInsight.severity == severity)
    if is_read is not None:
        q = q.filter(AIInsight.is_read == is_read)
    items = q.order_by(AIInsight.created_at.desc()).limit(limit).all()
    return [
        {"id": i.id, "type": i.insight_type, "severity": i.severity, "title": i.title, "description": i.description, "is_read": i.is_read, "created_at": i.created_at}
        for i in items
    ]


@router.post("/insights/generate")
def generate_insights(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Use AI to generate insights from current platform state."""
    import json

    health = compute_health_score(db, user.organization_id)
    critical = execute_tool("get_critical_assets", {"limit": 10}, db, user.organization_id)
    tickets = execute_tool("get_open_tickets", {}, db, user.organization_id)
    vulns = execute_tool("get_critical_vulnerabilities", {}, db, user.organization_id)
    licenses = execute_tool("get_expiring_licenses", {"days": 30}, db, user.organization_id)
    monitoring = execute_tool("get_monitoring_status", {}, db, user.organization_id)

    context = f"""Platform state:
Health Score: {health['score']}/100 ({health['status']})
Monitoring: {monitoring}
Critical Assets: {critical}
Open Tickets: {tickets}
Vulnerabilities: {vulns}
Expiring Licenses: {licenses}
"""

    prompt = [
        {"role": "system", "content": "You are an IT operations analyst. Generate 3-5 actionable insights from the data provided. Each insight must be in JSON format within a JSON array. Format: [{\"type\":\"anomaly|trend|risk|optimization\",\"severity\":\"critical|high|medium|low\",\"title\":\"short title\",\"description\":\"detailed explanation\"}]. Return ONLY the JSON array."},
        {"role": "user", "content": context},
    ]

    response = chat_completion(prompt, model=_get_model(), temperature=0.4)

    created = []
    try:
        raw = response.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        insights_data = json.loads(raw)
        for ins in insights_data[:5]:
            insight = AIInsight(
                organization_id=user.organization_id,
                insight_type=ins.get("type", "anomaly"),
                severity=ins.get("severity", "medium"),
                title=ins.get("title", "Insight"),
                description=ins.get("description", ""),
                expires_at=datetime.utcnow() + timedelta(days=1),
            )
            db.add(insight)
            created.append({"title": insight.title, "severity": insight.severity})
    except Exception as e:
        logger.error(f"Failed to parse AI insights: {e} — raw: {response.content[:200]}")

    db.commit()
    return {"generated": len(created), "insights": created}


@router.patch("/insights/{insight_id}/read")
def mark_insight_read(insight_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    insight = db.query(AIInsight).filter(AIInsight.id == insight_id, AIInsight.organization_id == user.organization_id).first()
    if not insight:
        raise HTTPException(404)
    insight.is_read = True
    db.commit()
    return {"status": "ok"}


@router.get("/recommendations")
def list_recommendations(
    status: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(AIRecommendation).filter(AIRecommendation.organization_id == user.organization_id)
    if status:
        q = q.filter(AIRecommendation.status == status)
    if category:
        q = q.filter(AIRecommendation.category == category)
    items = q.order_by(AIRecommendation.created_at.desc()).limit(100).all()
    return [
        {"id": r.id, "category": r.category, "priority": r.priority, "title": r.title, "description": r.description, "impact": r.impact, "action": r.action, "status": r.status, "confidence_score": r.confidence_score, "created_at": r.created_at}
        for r in items
    ]


@router.patch("/recommendations/{rec_id}")
def update_recommendation(rec_id: int, body: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rec = db.query(AIRecommendation).filter(AIRecommendation.id == rec_id, AIRecommendation.organization_id == user.organization_id).first()
    if not rec:
        raise HTTPException(404)
    for k, v in body.items():
        if hasattr(rec, k):
            setattr(rec, k, v)
    rec.updated_at = datetime.utcnow()
    db.commit()
    return {"status": "updated"}


class RcaRequest(BaseModel):
    incident_id: Optional[int] = None
    description: str
    context: Optional[str] = None


@router.post("/rca")
def root_cause_analysis(req: RcaRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """AI-assisted Root Cause Analysis."""
    import json

    # Gather platform context
    monitoring = json.loads(execute_tool("get_monitoring_status", {}, db, user.organization_id))
    alerts = json.loads(execute_tool("get_recent_alerts", {"hours": 48}, db, user.organization_id))
    assets = json.loads(execute_tool("get_critical_assets", {"limit": 10}, db, user.organization_id))

    context_block = f"""
Incident/Problem: {req.description}
Additional Context: {req.context or 'None'}

Current Platform State:
- Monitoring: {monitoring['up']}/{monitoring['total_targets']} targets up ({monitoring['availability_pct']}% availability)
- Recent Alerts (48h): {alerts['count']} alerts
- Critical Assets: {len(assets['assets'])} assets in critical/high state
"""

    prompt = [
        {"role": "system", "content": """You are an expert IT Root Cause Analysis (RCA) engine.
Analyze the incident and platform data provided. Return a structured RCA in JSON format:
{
  "possible_causes": [{"cause": "...", "probability": 0-100, "justification": "..."}],
  "recommended_steps": ["step 1", "step 2", ...],
  "impact_assessment": "...",
  "prevention": "...",
  "confidence": 0-100
}
Return ONLY the JSON."""},
        {"role": "user", "content": context_block},
    ]

    t0 = datetime.utcnow()
    response = chat_completion(prompt, model=_get_model(), temperature=0.2, max_tokens=1500)

    rca_result = None
    try:
        raw = response.content.strip().lstrip("```json").lstrip("```").rstrip("```")
        rca_result = json.loads(raw)
    except Exception:
        rca_result = {"raw_analysis": response.content, "error": "Could not parse structured output"}

    # Audit
    audit = AIAuditLog(
        organization_id=user.organization_id,
        user_id=user.id,
        action="rca",
        model=response.model,
        prompt_tokens=response.prompt_tokens,
        completion_tokens=response.completion_tokens,
        total_tokens=response.total_tokens,
        latency_ms=response.latency_ms,
    )
    db.add(audit)
    db.commit()

    return {"rca": rca_result, "model": response.model, "tokens": response.total_tokens}


class SummarizeRequest(BaseModel):
    ticket_id: Optional[int] = None
    content: Optional[str] = None
    summary_type: str = "technical"  # technical/executive/action_items


@router.post("/summarize")
def summarize(req: SummarizeRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Summarize a ticket or any text content."""
    content = req.content

    if req.ticket_id and not content:
        from backend.core.domain.models import Ticket, TicketComment
        ticket = db.query(Ticket).filter(Ticket.id == req.ticket_id, Ticket.organization_id == user.organization_id).first()
        if not ticket:
            raise HTTPException(404, "Ticket not found")
        comments = db.query(TicketComment).filter(TicketComment.ticket_id == req.ticket_id).order_by(TicketComment.created_at).all()
        content = f"Title: {ticket.title}\nPriority: {ticket.priority}\nStatus: {ticket.status}\nDescription: {ticket.description or ''}\n\nComments:\n" + "\n".join(f"- {c.content}" for c in comments)

    if not content:
        raise HTTPException(400, "No content to summarize")

    type_instructions = {
        "technical": "Generate a technical summary with root cause, impact, resolution steps, and lessons learned.",
        "executive": "Generate a brief executive summary (2-3 sentences) suitable for management reporting.",
        "action_items": "Extract all action items and next steps as a numbered list.",
    }

    prompt = [
        {"role": "system", "content": f"You are an ITSM expert. {type_instructions.get(req.summary_type, type_instructions['technical'])} Respond in the same language as the content."},
        {"role": "user", "content": content[:4000]},
    ]

    response = chat_completion(prompt, model=_get_model(), temperature=0.3, max_tokens=800)

    return {"summary": response.content, "type": req.summary_type, "model": response.model, "tokens": response.total_tokens}
