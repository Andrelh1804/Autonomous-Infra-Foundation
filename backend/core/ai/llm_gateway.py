"""
LLM Gateway — multi-provider abstraction.
Supports: OpenAI, Anthropic, mock (no key).
Provider and model resolved from env vars / platform settings.
"""
import os
import time
import json
import logging
from typing import Any, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class LLMResponse:
    content: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: int = 0
    tool_calls: list = field(default_factory=list)
    finish_reason: str = "stop"


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict


def _get_openai_key() -> Optional[str]:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        try:
            from backend.core.infrastructure.database import SessionLocal
            from backend.core.domain.models import PlatformSettings
            db = SessionLocal()
            try:
                row = db.query(PlatformSettings).filter_by(key="openai_api_key").first()
                if row:
                    key = row.value
            finally:
                db.close()
        except Exception:
            pass
    return key or None


def _get_anthropic_key() -> Optional[str]:
    return os.getenv("ANTHROPIC_API_KEY", "").strip() or None


def _get_provider() -> str:
    provider = os.getenv("AI_PROVIDER", "").strip().lower()
    if not provider:
        if _get_openai_key():
            return "openai"
        if _get_anthropic_key():
            return "anthropic"
    return provider or "mock"


def _get_model() -> str:
    return os.getenv("AI_MODEL", "gpt-4o-mini").strip()


def chat_completion(
    messages: list[dict],
    tools: Optional[list[Tool]] = None,
    model: Optional[str] = None,
    temperature: float = 0.3,
    max_tokens: int = 2048,
) -> LLMResponse:
    provider = _get_provider()
    model = model or _get_model()
    t0 = time.time()

    if provider == "openai":
        return _openai_chat(messages, tools, model, temperature, max_tokens, t0)
    elif provider == "anthropic":
        return _anthropic_chat(messages, tools, model, temperature, max_tokens, t0)
    else:
        return _mock_chat(messages, tools, model, t0)


def _openai_chat(messages, tools, model, temperature, max_tokens, t0) -> LLMResponse:
    from openai import OpenAI
    key = _get_openai_key()
    client = OpenAI(api_key=key)

    kwargs: dict[str, Any] = dict(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    if tools:
        kwargs["tools"] = [
            {"type": "function", "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters,
            }} for t in tools
        ]
        kwargs["tool_choice"] = "auto"

    resp = client.chat.completions.create(**kwargs)
    msg = resp.choices[0].message
    latency = int((time.time() - t0) * 1000)

    tool_calls = []
    if msg.tool_calls:
        for tc in msg.tool_calls:
            tool_calls.append({
                "id": tc.id,
                "name": tc.function.name,
                "arguments": json.loads(tc.function.arguments or "{}"),
            })

    return LLMResponse(
        content=msg.content or "",
        model=model,
        prompt_tokens=resp.usage.prompt_tokens if resp.usage else 0,
        completion_tokens=resp.usage.completion_tokens if resp.usage else 0,
        total_tokens=resp.usage.total_tokens if resp.usage else 0,
        latency_ms=latency,
        tool_calls=tool_calls,
        finish_reason=resp.choices[0].finish_reason or "stop",
    )


def _anthropic_chat(messages, tools, model, temperature, max_tokens, t0) -> LLMResponse:
    import anthropic
    key = _get_anthropic_key()
    client = anthropic.Anthropic(api_key=key)

    # Convert system messages
    system_msg = ""
    filtered = []
    for m in messages:
        if m["role"] == "system":
            system_msg = m["content"]
        else:
            filtered.append(m)

    anthropic_model = model.replace("gpt-4o-mini", "claude-3-haiku-20240307").replace("gpt-4o", "claude-3-5-sonnet-20240620")

    kwargs: dict[str, Any] = dict(
        model=anthropic_model,
        max_tokens=max_tokens,
        messages=filtered,
        temperature=temperature,
    )
    if system_msg:
        kwargs["system"] = system_msg

    resp = client.messages.create(**kwargs)
    latency = int((time.time() - t0) * 1000)
    content = "".join(b.text for b in resp.content if hasattr(b, "text"))

    return LLMResponse(
        content=content,
        model=anthropic_model,
        prompt_tokens=resp.usage.input_tokens,
        completion_tokens=resp.usage.output_tokens,
        total_tokens=resp.usage.input_tokens + resp.usage.output_tokens,
        latency_ms=latency,
        finish_reason=str(resp.stop_reason),
    )


def _mock_chat(messages, tools, model, t0) -> LLMResponse:
    """Fallback when no API key is configured."""
    user_msg = ""
    for m in reversed(messages):
        if m["role"] == "user":
            user_msg = m["content"][:200]
            break

    content = (
        "⚠️ **AI Copilot não configurado.**\n\n"
        "Para ativar o AI Copilot, configure uma chave de API:\n\n"
        "1. Acesse **Configurações → AI Settings**\n"
        "2. Insira sua chave `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY`\n"
        "3. Ou defina a variável de ambiente `OPENAI_API_KEY`\n\n"
        f"*Pergunta recebida: \"{user_msg}\"*"
    )
    return LLMResponse(
        content=content,
        model="mock",
        latency_ms=int((time.time() - t0) * 1000),
        finish_reason="stop",
    )


def get_embeddings(texts: list[str], model: str = "text-embedding-3-small") -> list[list[float]]:
    key = _get_openai_key()
    if not key:
        # Return zero vectors for mock mode
        return [[0.0] * 1536 for _ in texts]
    from openai import OpenAI
    client = OpenAI(api_key=key)
    resp = client.embeddings.create(input=texts, model=model)
    return [item.embedding for item in resp.data]
