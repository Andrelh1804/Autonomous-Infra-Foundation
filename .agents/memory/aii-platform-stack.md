---
name: AII Platform Stack
description: AII Platform uses Python FastAPI + Next.js, not the default Node.js workspace stack. Both run as separate workflows.
---

The AII Platform is a custom build outside the pnpm workspace:
- **Backend**: `backend/` — Python 3.12 FastAPI, SQLAlchemy, argon2, JWT. Runs on port 8000.
- **Frontend**: `frontend/` — Next.js 15 (App Router), React 19, TailwindCSS v4, React Query, Zustand. Runs on port 3000.
- **DB**: Uses Replit's managed PostgreSQL via `DATABASE_URL` secret.

**Why:** User explicitly requested Python FastAPI + Next.js stack instead of the workspace default (Node.js/Express + React Vite).

**How to apply:** When continuing work on this project, always target `backend/` for API changes and `frontend/` for UI changes. Do NOT add routes to `artifacts/api-server` (the old Node.js stub).

**PostCSS**: Uses `@tailwindcss/postcss` (not `tailwindcss` directly) because Tailwind v4 split its PostCSS plugin.

**Email validation**: Custom regex validator (not pydantic's EmailStr) to allow `.local` TLD for `admin@aii.local`.

**Proxy**: Next.js rewrites `/api/*` → `http://localhost:8000/api/*` in `next.config.js`. Replit's shared proxy routes `/__mockup` and `/api` to other artifacts, so the AII frontend is accessed directly on port 3000 in the preview pane by switching to the frontend workflow.

**Workflows**:
- `AII Backend (FastAPI)` — console, port 8000
- `AII Frontend (Next.js)` — webview, port 3000

**Default admin**: `admin@aii.local` / `Admin@2024!`
