import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from backend.api.v1.routes.auth import router as auth_router
from backend.api.v1.routes.organizations import router as org_router
from backend.api.v1.routes.users import router as users_router
from backend.api.v1.routes.sites import router as sites_router
from backend.api.v1.routes.roles import router as roles_router
from backend.api.v1.routes.audit import router as audit_router
from backend.api.v1.routes.dashboard import router as dashboard_router
from backend.api.v1.routes.settings import router as settings_router
from backend.api.v1.routes.assets import router as assets_router
from backend.api.v1.routes.discovery import router as discovery_router
from backend.api.v1.routes.schedules import router as schedules_router
from backend.api.v1.routes.alerts import router as alerts_router
from backend.api.v1.routes.monitoring import router as monitoring_router
from backend.api.v1.routes.printers import router as printers_router
from backend.api.v1.routes.events import router as events_router
from backend.api.v1.routes.noc import router as noc_router
from backend.api.v1.routes.notification import router as notification_router

# Phase 6 — AI Copilot, AIOps, RAG
from backend.api.v1.routes.ai_copilot import router as ai_copilot_router
from backend.api.v1.routes.ai_ops import router as ai_ops_router
from backend.api.v1.routes.executive_ai import router as executive_ai_router

# Phase 4 — Endpoint Management & RMM
from backend.api.v1.routes.agents import router as agents_router
from backend.api.v1.routes.endpoints import router as endpoints_router
from backend.api.v1.routes.software_inventory import router as software_router
from backend.api.v1.routes.licenses import router as licenses_router
from backend.api.v1.routes.vulnerabilities import router as vulns_router
from backend.api.v1.routes.compliance import router as compliance_router
from backend.api.v1.routes.remote_actions import router as remote_actions_router
from backend.api.v1.routes.patches import router as patches_router
from backend.api.v1.routes.jobs import router as jobs_router
from backend.api.v1.routes.policies import router as policies_router

# Phase 5 — ITSM Enterprise
from backend.api.v1.routes.tickets import router as tickets_router
from backend.api.v1.routes.problems import router as problems_router
from backend.api.v1.routes.changes import router as changes_router
from backend.api.v1.routes.service_catalog import router as catalog_router
from backend.api.v1.routes.knowledge_base import router as kb_router
from backend.api.v1.routes.sla import router as sla_router
from backend.api.v1.routes.workflows import router as workflows_router
from backend.api.v1.routes.automations import router as automations_router

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.modules.scheduler.scheduler import start_scheduler, stop_scheduler
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="AII — Autonomous Infrastructure Intelligence",
    description="Enterprise IT Operations Platform API",
    version="1.0.0",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = os.environ.get("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(auth_router, prefix=PREFIX)
app.include_router(org_router, prefix=PREFIX)
app.include_router(users_router, prefix=PREFIX)
app.include_router(sites_router, prefix=PREFIX)
app.include_router(roles_router, prefix=PREFIX)
app.include_router(audit_router, prefix=PREFIX)
app.include_router(dashboard_router, prefix=PREFIX)
app.include_router(settings_router, prefix=PREFIX)
app.include_router(assets_router, prefix=PREFIX)
app.include_router(discovery_router, prefix=PREFIX)
app.include_router(schedules_router, prefix=PREFIX)
app.include_router(alerts_router, prefix=PREFIX)
app.include_router(monitoring_router, prefix=PREFIX)
app.include_router(printers_router, prefix=PREFIX)
app.include_router(events_router, prefix=PREFIX)
app.include_router(noc_router, prefix=PREFIX)
app.include_router(notification_router, prefix=PREFIX)

# Phase 4 — Endpoint Management & RMM
app.include_router(agents_router, prefix=PREFIX)
app.include_router(endpoints_router, prefix=PREFIX)
app.include_router(software_router, prefix=PREFIX)
app.include_router(licenses_router, prefix=PREFIX)
app.include_router(vulns_router, prefix=PREFIX)
app.include_router(compliance_router, prefix=PREFIX)
app.include_router(remote_actions_router, prefix=PREFIX)
app.include_router(patches_router, prefix=PREFIX)
app.include_router(jobs_router, prefix=PREFIX)
app.include_router(policies_router, prefix=PREFIX)

# Phase 5 — ITSM Enterprise
app.include_router(tickets_router, prefix=PREFIX)
app.include_router(problems_router, prefix=PREFIX)
app.include_router(changes_router, prefix=PREFIX)
app.include_router(catalog_router, prefix=PREFIX)
app.include_router(kb_router, prefix=PREFIX)
app.include_router(sla_router, prefix=PREFIX)
app.include_router(workflows_router, prefix=PREFIX)
app.include_router(automations_router, prefix=PREFIX)

# Phase 6 — AI Copilot, AIOps, RAG
app.include_router(ai_copilot_router, prefix=PREFIX)
app.include_router(ai_ops_router, prefix=PREFIX)
app.include_router(executive_ai_router, prefix=PREFIX)


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "service": "AII API"}
