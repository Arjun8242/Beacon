# Project Status: Distributed Uptime Monitoring Platform

## 1. Project Overview
The Distributed Uptime Monitoring Platform is a self-hostable, production-grade V1 product that enables developers and small engineering teams to monitor the availability and latency of HTTP/HTTPS endpoints.

## 2. Project Goal
Deliver a reliable, distributed, queue-based monitoring system that automatically detects outages, avoids false positives, opens/closes incident records, and surfaces metrics via a Next.js dashboard, while demonstrating strong production engineering practices.

## 3. Current Architecture Summary
The system operates as a Turbo/pnpm monorepo divided into four core services and three shared packages:
* **Services:** 
  * `apps/web`: Next.js frontend dashboard and public status pages.
  * `apps/api`: Express REST API for auth, monitor CRUD, and metrics.
  * `apps/scheduler`: Standalone node-cron process that enqueues monitoring jobs.
  * `apps/worker`: Stateless BullMQ worker pool that executes HTTP checks and handles incident logic.
* **Shared Packages:** `packages/database` (Prisma/PostgreSQL), `packages/queue` (BullMQ/Redis), `packages/shared` (types/utils).

## 4. Tech Stack
* **Frontend:** Next.js 14, TypeScript
* **Backend:** Node.js 20, Express, TypeScript
* **Database & ORM:** PostgreSQL 16, Prisma
* **Queue & Cache:** Redis 7, BullMQ
* **Monorepo:** Turborepo, pnpm
* **Infrastructure:** Docker, Docker Compose

## 5. Major Features
* HTTP/HTTPS endpoint monitoring with custom check intervals (30s to 600s).
* Distributed, horizontally scalable check execution.
* Automatic incident detection and resolution with confirm-down thresholding.
* Uptime percentage calculation and response time aggregation.
* JWT-based authentication and isolated user environments.
* Public status pages with custom slugs.

## 6. Repository Structure
The project is structured as a Turbo/pnpm monorepo:
```text
uptime-monitor/
├── apps/
│   ├── api/          (Express REST API)
│   ├── scheduler/    (Cron job for enqueueing checks)
│   ├── web/          (Next.js frontend)
│   └── worker/       (BullMQ consumer for HTTP checks)
└── packages/
    ├── database/     (Prisma client & schema)
    ├── queue/        (BullMQ shared setup & Redis connection)
    └── shared/       (Types, constants & utils)
```

## 7. Current Progress
* Defined initial product requirements (PRD).
* Documented high-level system architecture and request flows.
* Finalized database schema, ERD, indexing strategy, and relationships.
* Designed REST API endpoints, validation rules, and error handling.
* Scaffolded the Turbo/pnpm monorepo structure with all `apps` and `packages`.
* Initialized `packages/queue`, `packages/database`, `apps/worker`, and `apps/scheduler`.
* Aligned Prisma models and enums, applied initial migration, and generated Prisma client.
* **[M1]** Implemented shared types, constants, and utilities in `packages/shared`.
* **[M1]** Configured shared BullMQ queues and Redis producer logic in `packages/queue`.
* **[M1]** Built full Express Auth System in `apps/api` (register, login, JWT middleware, error handling).
* **[M1]** Built full Monitor CRUD endpoints in `apps/api` (create, list, get, update, delete, pause, resume).
* **[M2]** Built the `apps/scheduler` service to run a node-cron tick and enqueue checks.
* **[M2]** Built the `apps/worker` service to execute HTTP probes and persist results.
* **[M2]** Set up local development environment with Docker Compose for end-to-end integration testing.
* **[M3]** Implemented Reliability Layer: incident detection, Redis failure counters, and incident state transitions.
* **[M4]** Implemented Metrics API for charts, check history, and latency buckets.
* **[M4]** Built Dashboard API and Public Status Page API endpoints.
* **[M5]** Created Next.js API client with JWT token management.
* **[M5]** Replicated nautical-themed reference design for Auth and Landing pages.
* **[M5]** Built full Dashboard shell, Monitor list view, and Monitor detail view using custom theme and micro-animations.
* **[M5]** Built Public Status Page with animated nautical scene.

## 8. Current Focus
* Writing unit and integration tests across services.
* Dockerizing all apps (`api`, `scheduler`, `worker`, `web`).
* Creating the production `docker-compose.prod.yml` configuration.
* Setting up daily cron job for data retention.
* Finalizing `README.md` with setup instructions, API usage examples, and architecture diagrams.

## 9. Current Phase
* **Phase:** Milestone 6 (Polish and Deploy) - Execution

## 10. Next Milestone
* **M6 — Polish and Deploy:** Finalize tests, containerization, and documentation.

## 11. Future Milestones
* None (Milestone 6 is the final milestone for V1).

## 12. Important Technical Decisions
* **Stateless Scheduler:** The scheduler uses PostgreSQL (`nextCheckAt`) to determine due checks instead of per-monitor cron jobs, preventing state loss on restarts.
* **Separation of Retry Logic:** BullMQ retries handle infrastructure failures (e.g., worker crash), while monitoring logic uses consecutive check failures (via Redis counters) to detect actual outages.
* **Immutable Check Records:** Probe results are append-only to ensure accurate historical metric calculations and auditability.
* **Denormalized Monitor Status:** `MonitorStatus` is updated by the worker and stored on the `Monitor` entity for fast, lightweight dashboard reads without querying history.

## 13. Known Risks / Blockers
* **Database Load:** The `checks` table will grow rapidly. The `(monitorId, checkedAt)` composite index is critical; future archival/retention strategies may be needed. (Planned for M6 data retention job)
* **Scheduler Duplication:** Duplicate jobs could inflate metrics. Mitigated by using the `monitor.id` as the BullMQ `jobId` for deduplication.
* **Redis Dependency:** Complete Redis failure halts job processing and incident detection. Scheduler handles Redis connection errors gracefully in V1.
