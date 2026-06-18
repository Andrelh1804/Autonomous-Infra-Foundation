---
name: Phase 4+5 Architecture
description: RMM (Phase 4) and ITSM (Phase 5) modules added to AII Platform — routes, pages, nav, API service, DB tables.
---

## Phase 4 — Endpoint Management & RMM

### Backend routes (backend/api/v1/routes/)
agents.py, endpoints.py, software_inventory.py, licenses.py, vulnerabilities.py, compliance.py, remote_actions.py, patches.py, jobs.py, policies.py

### Frontend pages (frontend/app/)
agent-center/, endpoints/, software-inventory/, licenses/, vulnerabilities/, patches/, compliance/, remote-actions/, jobs/, policies/

### API service objects (frontend/services/api.ts)
agentsApi, endpointsApi, softwareApi, licensesApi, vulnsApi, complianceApi, remoteActionsApi, patchesApi, jobsApi, policiesApi

## Phase 5 — ITSM Enterprise

### Backend routes (backend/api/v1/routes/)
tickets.py, problems.py, changes.py, service_catalog.py, knowledge_base.py, sla.py, workflows.py, automations.py

### Frontend pages (frontend/app/)
tickets/, problems/, changes/, service-catalog/, knowledge-base/, sla/, workflows/, automations/

### API service objects (frontend/services/api.ts)
ticketsApi, problemsApi, changesApi, serviceCatalogApi, knowledgeBaseApi, slaApi, workflowsApi, automationsApi

## Navigation groups added (frontend/components/Layout.tsx)
- "Endpoint Management" group with 10 items
- "ITSM" group with 8 items

## DB Tables
Created via `Base.metadata.create_all(bind=engine)` — safe to re-run, CREATE TABLE IF NOT EXISTS semantics.

## Agent
agent/aii_agent.py — cross-platform Python agent for Windows/Linux/macOS.
Enrollment: `python aii_agent.py --enroll --server <url> --org-token <token>`

**Why:** Separation of Phase 4 (RMM) and Phase 5 (ITSM) is intentional — keeps concerns separate and allows incremental deployment.
