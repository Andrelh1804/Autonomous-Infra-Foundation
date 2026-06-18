# AII Platform — Autonomous Infrastructure Intelligence

Enterprise IT Operations SaaS Platform. Phase 1 foundation with multi-tenant architecture, RBAC, JWT auth, audit logging, and full CRUD for Organizations, Users, and Sites.

## Run & Operate

- **Backend**: `python -m uvicorn backend.api.v1.app:app --host 0.0.0.0 --port 8000 --reload`
- **Frontend**: `cd frontend && PORT=3000 npm run dev`
- **Seed DB**: `python backend/seeds.py`

## Default Credentials

- Email: `admin@aii.local`
- Password: `Admin@2024!`

## Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.x, Pydantic v2, JWT (argon2 hashing)
- **Frontend**: Next.js 15, React 19, TailwindCSS v4, React Query, Zustand
- **Database**: PostgreSQL (Drizzle managed, Replit-hosted)

## Where things live

- `backend/core/domain/models.py` — all SQLAlchemy models (source of truth for DB schema)
- `backend/core/application/schemas.py` — Pydantic schemas for request/response validation
- `backend/api/v1/routes/` — FastAPI route handlers (auth, organizations, users, sites, roles, audit, dashboard, settings)
- `backend/seeds.py` — database seeder (roles, permissions, admin user, org, settings)
- `frontend/app/` — Next.js App Router pages
- `frontend/services/api.ts` — Axios API client with auto token refresh
- `frontend/store/auth.ts` — Zustand auth + theme store

## Architecture decisions

- **Multi-tenant isolation**: every entity (User, Site) is bound to `organization_id`; non-super-admin users can only see their own org's data
- **RBAC**: 5 built-in roles (super_admin, msp_admin, tenant_admin, operator, viewer) with 15 granular permissions across 6 modules
- **JWT sessions**: access tokens (15 min) + refresh tokens (7 days), stored in `user_sessions` table for revocation
- **Argon2**: password hashing via `passlib[argon2]` — more memory-hard than bcrypt
- **Audit log**: every CREATE/UPDATE/DELETE/LOGIN/LOGOUT recorded in `audit_logs` with IP and user agent
- **MFA-ready**: `mfa_secret` and `mfa_enabled` columns on users; backend endpoints ready for TOTP integration

## Product

Phase 1 provides the platform foundation:
- Login/logout with JWT and session management
- Dashboard with org/user/session stats + recent logins
- Full CRUD for Organizations (multi-tenant), Users (with role assignment), Sites
- Role & Permission management
- Audit log viewer
- Platform settings editor
- Dark/light mode toggle

## API Documentation

Swagger UI: `/api/v1/docs`
ReDoc: `/api/v1/redoc`

## User preferences

_Populate as you build._

## Gotchas

- FastAPI backend runs on port 8000; Next.js proxies `/api/*` to `localhost:8000`
- Email validation accepts `.local` TLD (custom validator bypasses pydantic-email-validator's RFC restrictions)
- The existing `artifacts/api-server` (Node.js/Express) artifact is unused by AII — it owns the `/api` proxy path in Replit's router, so frontend→backend communication goes through Next.js's own rewrite rule instead
- Run `python backend/seeds.py` after any schema change to recreate default data
