---
name: Phase 6 AI Architecture
description: LLM Gateway, Tool Calling, RAG Engine, Health Score, AI Copilot, AI Operations Center, Executive AI — full AIOps layer.
---

## Backend — core/ai/

- `llm_gateway.py` — multi-provider (OpenAI/Anthropic/mock). Provider auto-detected from env vars OPENAI_API_KEY / ANTHROPIC_API_KEY / AI_PROVIDER. Falls back to mock with user-friendly message when unconfigured.
- `tools.py` — 12 platform tools for AI Tool Calling: get_critical_assets, get_offline_assets, get_open_tickets, get_critical_vulnerabilities, get_expiring_licenses, get_compliance_summary, get_monitoring_status, get_recent_alerts, get_printer_status, get_endpoint_summary, search_knowledge_base, get_it_health_summary. All query DB directly.
- `health_score.py` — 0-100 composite score (monitoring 25pts + incidents 25pts + security 20pts + compliance 15pts + endpoints 15pts).
- `rag_engine.py` — chunk/embed/search documents using pgvector cosine similarity; keyword fallback when no API key.

## Backend — routes/

- `ai_copilot.py` — POST /ai/chat (tool calling loop up to 5 iterations), GET/DELETE /ai/conversations, GET /ai/audit
- `ai_ops.py` — GET /ai/ops/dashboard, GET/POST /ai/ops/insights/generate, GET /ai/ops/recommendations, POST /ai/ops/rca, POST /ai/ops/summarize
- `executive_ai.py` — GET /ai/executive/health, POST /ai/executive/report, POST /ai/search, POST /ai/rag/index, GET/POST /ai/prompts, GET /ai/stats

## DB Models (appended to models.py)

AIConversation, AIMessage, VectorDocument (embedding as JSON, pgvector via raw SQL), AIRecommendation, AIInsight, AIAuditLog, PromptTemplate

## Frontend Pages

- /ai-copilot — full chat UI with sidebar conversation history, quick prompts, tool badges, latency display
- /ai-ops — health gauge, ops dashboard, AI insights, recommendations, RCA tool
- /executive — score display (0-100), breakdown bars, report generator (daily/weekly/monthly/executive), markdown output
- /ai-insights — insight list with severity filter, mark-read, generate button
- /ai-search — semantic + keyword search across assets/knowledge/tickets, indexing trigger
- /ai-reports — report type selector, generator, download .md, AI audit log

## Packages installed (pip --break-system-packages)

openai, anthropic, tiktoken, pgvector, httpx

## Package installed (pnpm in frontend)

react-markdown ^10.1.0

## pgvector

Extension enabled via `CREATE EXTENSION IF NOT EXISTS vector` in app startup context. Embeddings stored as JSON (not pgvector column type) to avoid SQLAlchemy type registration complexity; cosine similarity computed in Python.

**Why:** Registering pgvector column type with SQLAlchemy requires custom TypeDecorator and alembic support — storing as JSON is simpler and works identically for the scale needed.

## Mock mode

When no API key is configured, all LLM calls return a helpful "configure your API key" message. Health score and tool calls still work fully — only LLM inference is mocked.

## API key configuration

- Env var: OPENAI_API_KEY or ANTHROPIC_API_KEY
- Or: platform DB settings key "openai_api_key" (via PlatformSettings model)
- Control: AI_PROVIDER env var ("openai", "anthropic", or "mock")
- Model: AI_MODEL env var (default "gpt-4o-mini")
