import os
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

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="AII — Autonomous Infrastructure Intelligence",
    description="Enterprise IT Operations Platform API",
    version="1.0.0",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json",
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


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "service": "AII API"}
