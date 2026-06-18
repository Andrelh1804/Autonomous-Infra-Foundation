---
name: AII Platform Stack
description: Port layout, routing architecture, and key gotchas for the AII/NexaOps platform on Replit.
---

The AII Platform is a custom build outside the pnpm workspace:
- **Backend**: `backend/` — Python 3.12 FastAPI, SQLAlchemy, argon2, JWT. Runs on **port 8008**.
- **Frontend**: `frontend/` — Next.js 15 (App Router), React 19, TailwindCSS v4, React Query, Zustand. Runs on port 5000 (external 80).
- **DB**: Uses Replit's managed PostgreSQL via `DATABASE_URL` secret.

**Why:** User explicitly requested Python FastAPI + Next.js stack instead of the workspace default.

## Port Layout (critical)

| Service | Internal port | Notes |
|---|---|---|
| REPLIT_ARTIFACT_ROUTER | 8000 | Replit's gateway — MUST own this port |
| Artifact api-server (Express) | 8080 | Auto-started by artifact router |
| FastAPI (uvicorn) | **8008** | Cannot use 8000 — artifact router needs it |
| Next.js | 5000 | External port 80 |

**Root cause of old 502 errors:** `REPLIT_ARTIFACT_ROUTER` starts automatically and tries to listen on port 8000 as the browser API gateway. FastAPI was on 8000, causing a port conflict — the router crashed and all browser API requests returned 502.

**Fix:** Moved FastAPI to port 8008. Now the artifact router successfully starts, routes `/api/*` to the artifact api-server (8080), which proxies to FastAPI (8008).

## Browser API routing path

Browser → Replit mTLS proxy → `REPLIT_ARTIFACT_ROUTER` (port 8000) → `artifacts/api-server` (port 8080) → FastAPI (port 8008)

**Fallback:** Next.js rewrites `/api/*` and `/nexaops/api/*` → `http://localhost:8008/api/*` (handles requests that reach Next.js directly).

## Artifact api-server

`artifacts/api-server/src/app.ts` proxies all `/api/*` requests to `http://localhost:${FASTAPI_PORT}` where `FASTAPI_PORT` env defaults to `"8008"`. After code changes, rebuild: `cd artifacts/api-server && pnpm run build`.

## Other notes

- **PostCSS**: `@tailwindcss/postcss` (Tailwind v4 plugin split).
- **Email validation**: Custom regex validator allows `.local` TLD for `admin@aii.local`.
- **Frontend baseURL**: `frontend/services/api.ts` uses `/nexaops/api/v1`. Artifact router does not intercept `/nexaops/*` — those requests go to Next.js which rewrites to FastAPI.
- **Default admin**: `admin@aii.local` / `Admin@2024!`
- **Workflows**: `AII Backend (FastAPI)` (port 8008), `AII Frontend (Next.js)` (port 5000).
