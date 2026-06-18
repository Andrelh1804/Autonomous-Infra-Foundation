"""
AI Copilot — conversational AI with platform tool calling.
POST /ai/chat         — send message, get AI response
GET  /ai/conversations — list conversations
GET  /ai/conversations/{id} — get conversation + messages
DELETE /ai/conversations/{id} — delete conversation
"""
import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from backend.core.infrastructure.database import get_db
from backend.api.v1.routes.auth import get_current_user
from backend.core.domain.models import User, AIConversation, AIMessage, AIAuditLog
from backend.core.ai.llm_gateway import chat_completion, _get_model
from backend.core.ai.tools import PLATFORM_TOOLS, execute_tool

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["AI Copilot"])

SYSTEM_PROMPT = """You are AII Copilot, an expert AI assistant for IT operations and infrastructure management.

You have access to tools that query the live platform data. Use them to answer questions accurately.

Guidelines:
- Always use tools to get real data before answering questions about the infrastructure
- Respond in the same language the user uses (Portuguese or English)
- Be concise but comprehensive
- When reporting issues, prioritize critical ones first
- Format lists and tables clearly using markdown
- Always cite the data source (tool used) in your response

Current date/time: {datetime_now}
"""


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None
    model: Optional[str] = None


def _get_or_create_conversation(db: Session, user: User, conv_id: Optional[int], model: str) -> AIConversation:
    if conv_id:
        conv = db.query(AIConversation).filter(
            AIConversation.id == conv_id,
            AIConversation.organization_id == user.organization_id,
        ).first()
        if not conv:
            raise HTTPException(404, "Conversation not found")
        return conv

    # Create new
    conv = AIConversation(
        organization_id=user.organization_id,
        user_id=user.id,
        model=model,
        is_active=True,
    )
    db.add(conv)
    db.flush()
    return conv


def _build_messages(db: Session, conv: AIConversation, new_user_msg: str) -> list[dict]:
    system = SYSTEM_PROMPT.format(datetime_now=datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"))
    messages = [{"role": "system", "content": system}]

    # Load conversation history (last 20 messages)
    history = db.query(AIMessage).filter(
        AIMessage.conversation_id == conv.id
    ).order_by(AIMessage.id.desc()).limit(20).all()
    history.reverse()

    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": new_user_msg})
    return messages


@router.post("/chat")
def chat(req: ChatRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    model = req.model or _get_model()
    conv = _get_or_create_conversation(db, user, req.conversation_id, model)

    # Set title from first message
    if not conv.title:
        conv.title = req.message[:100]
        db.flush()

    messages = _build_messages(db, conv, req.message)

    # Save user message
    user_msg = AIMessage(
        conversation_id=conv.id,
        role="user",
        content=req.message,
    )
    db.add(user_msg)
    db.flush()

    # First LLM call (with tools)
    response = chat_completion(messages, tools=PLATFORM_TOOLS, model=model)

    tool_results_log = []

    # Handle tool calling loop
    max_iterations = 5
    iterations = 0
    while response.tool_calls and iterations < max_iterations:
        iterations += 1
        # Add assistant message with tool calls
        messages.append({
            "role": "assistant",
            "content": response.content or "",
            "tool_calls": [
                {"id": tc["id"], "type": "function", "function": {"name": tc["name"], "arguments": json.dumps(tc["arguments"])}}
                for tc in response.tool_calls
            ],
        })

        # Execute each tool
        for tc in response.tool_calls:
            result_str = execute_tool(tc["name"], tc["arguments"], db, user.organization_id)
            tool_results_log.append({"tool": tc["name"], "args": tc["arguments"]})
            messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": result_str,
            })

        # Second LLM call with tool results
        response = chat_completion(messages, model=model)

    # Save assistant response
    assistant_msg = AIMessage(
        conversation_id=conv.id,
        role="assistant",
        content=response.content,
        tool_results=tool_results_log if tool_results_log else None,
        tokens_used=response.total_tokens,
        model=response.model,
        latency_ms=response.latency_ms,
    )
    db.add(assistant_msg)

    # Update conversation stats
    conv.total_tokens = (conv.total_tokens or 0) + response.total_tokens
    conv.updated_at = datetime.utcnow()

    # Audit log
    audit = AIAuditLog(
        organization_id=user.organization_id,
        user_id=user.id,
        conversation_id=conv.id,
        action="chat",
        model=response.model,
        prompt_tokens=response.prompt_tokens,
        completion_tokens=response.completion_tokens,
        total_tokens=response.total_tokens,
        latency_ms=response.latency_ms,
        tools_called=tool_results_log,
    )
    db.add(audit)
    db.commit()

    return {
        "conversation_id": conv.id,
        "message_id": assistant_msg.id,
        "content": response.content,
        "model": response.model,
        "tokens": response.total_tokens,
        "latency_ms": response.latency_ms,
        "tools_used": [t["tool"] for t in tool_results_log],
    }


@router.get("/conversations")
def list_conversations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    convs = db.query(AIConversation).filter(
        AIConversation.organization_id == user.organization_id,
        AIConversation.is_active == True,
    ).order_by(AIConversation.updated_at.desc()).limit(50).all()
    return [
        {
            "id": c.id,
            "title": c.title or "Conversa sem título",
            "model": c.model,
            "total_tokens": c.total_tokens,
            "created_at": c.created_at,
            "updated_at": c.updated_at,
        }
        for c in convs
    ]


@router.get("/conversations/{conv_id}")
def get_conversation(conv_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    conv = db.query(AIConversation).filter(
        AIConversation.id == conv_id,
        AIConversation.organization_id == user.organization_id,
    ).first()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    messages = db.query(AIMessage).filter(AIMessage.conversation_id == conv_id).order_by(AIMessage.id).all()
    return {
        "id": conv.id,
        "title": conv.title,
        "model": conv.model,
        "total_tokens": conv.total_tokens,
        "created_at": conv.created_at,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "tools_used": [t["tool"] for t in (m.tool_results or [])],
                "tokens": m.tokens_used,
                "latency_ms": m.latency_ms,
                "created_at": m.created_at,
            }
            for m in messages
        ],
    }


@router.delete("/conversations/{conv_id}")
def delete_conversation(conv_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    conv = db.query(AIConversation).filter(
        AIConversation.id == conv_id,
        AIConversation.organization_id == user.organization_id,
    ).first()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    conv.is_active = False
    db.commit()
    return {"status": "deleted"}


@router.get("/audit")
def get_audit_log(limit: int = 50, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    logs = db.query(AIAuditLog).filter(
        AIAuditLog.organization_id == user.organization_id,
    ).order_by(AIAuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "action": l.action,
            "model": l.model,
            "total_tokens": l.total_tokens,
            "latency_ms": l.latency_ms,
            "tools_called": l.tools_called,
            "created_at": l.created_at,
        }
        for l in logs
    ]
