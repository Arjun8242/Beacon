# TASKS — Distributed Uptime Monitoring Platform

> Generated from PROJECT_STATUS.md and current codebase state.
> Effort: **S** = ~1–2 hrs | **M** = ~2–4 hrs | **L** = ~4–8 hrs

---

## COMPLETED

- [x] Define product requirements (PRD) `S`
- [x] Document system architecture and request flows `M`
- [x] Design database schema, ERD, indexes, and relationships `M`
- [x] Design REST API endpoints, validation rules, and error handling `M`
- [x] Scaffold Turbo/pnpm monorepo with `apps/` and `packages/` `S`
- [x] Initialize `packages/database` with Prisma client singleton `S`
- [x] Initialize `packages/queue` with Redis connection and queue name constants `S`
- [x] Initialize `packages/shared` with `MonitorStatus` enum and `CreateMonitorSchema` `S`
- [x] Stub `apps/api` Express server with health check endpoint `S`
- [x] Stub `apps/worker` BullMQ worker with placeholder processor `S`
- [x] Stub `apps/scheduler` with placeholder interval loop `S`
- [x] Create `docker-compose.yml` with PostgreSQL and Redis services `S`
- [x] Create `.env.example` with database and Redis connection vars `S`

---

## CURRENT SPRINT — M1 Finish + M2 Core Check Loop

### Milestone 1: Foundation (remaining)

#### packages/database — Align Prisma Schema to Design

- [x] Add `MonitorStatus` and `CheckStatus` enums to `schema.prisma` (replace raw strings) `S`
- [-] Add missing Monitor fields: `slug` (unique), `active` (boolean), `lastCheckedAt`, fix `status` to use `MonitorStatus` enum with `PENDING` default `S`
- [x] Add missing Check field: `status` (`CheckStatus` enum), rename `isUp` to proper enum usage `S`
- [x] Add missing Incident fields: `durationSeconds` `S`
- [x] Add `User` field: rename `password` to `passwordHash` `S`
- [x] Fix Monitor index from `@@index([nextCheckAt, status])` to `@@index([active, nextCheckAt])` per design `S`
- [x] Add `@@index([monitorId, startedAt])` to Incident model `S`
- [x] Add `@@index([userId])` and `@@index([userId, createdAt])` to Monitor model `S`
- [x] Run `prisma migrate dev` to generate and apply initial migration `S`
- [x] Run `prisma generate` and verify client exports compile `S`

#### packages/shared — Types, Constants, and Utilities

- [x] Add `CheckStatus` enum (`UP`, `DEGRADED`, `DOWN`) and `MonitorStatus` update (`PENDING`, `UP`, `DOWN`, `DEGRADED`, `PAUSED`) `S`
- [x] Add shared constants: `ALLOWED_INTERVALS`, `DEFAULT_TIMEOUT`, `CONFIRM_DOWN_THRESHOLD` `S`
- [x] Implement `determineStatus(statusCode, error)` utility function `S`
- [x] Implement `slugify(name)` utility function with random suffix `S`
- [x] Implement `calculateUptimePercent(upCount, totalCount)` utility function `S`
- [x] Implement `getWindowStart(window: '24h' | '7d' | '30d')` time utility `S`
- [x] Add `MonitorCheckJob` type definition for BullMQ job payloads `S`
- [x] Update `CreateMonitorSchema` Zod validation: restrict `interval` to `[30, 60, 120, 300, 600]`, remove `method` field `S`

#### packages/queue — Producer and Job Types

- [x] Rename queue name constant from `MONITOR_QUEUE` to `MONITOR_CHECKS` per architecture design `S`
- [x] Create `producer.ts` with `addCheckJob(payload: MonitorCheckJob)` function using `jobId: monitorId` for deduplication `S`
- [x] Add default job options: `attempts: 3`, exponential backoff, `removeOnComplete`, `removeOnFail` `S`
- [x] Export `MonitorCheckJob` type and producer from package index `S`

#### packages/database — Env Config

- [x] Add `JWT_SECRET` and `BCRYPT_COST` to `.env.example` `S`
- [x] Add `WORKER_CONCURRENCY` and `SCHEDULER_INTERVAL_MS` to `.env.example` `S`

#### apps/api — Auth System

- [x] Create `config/env.ts` with Zod-validated environment variables `S`
- [x] Create `authService.ts` — `register(email, password)`: hash with bcrypt, create user, sign JWT `M`
- [x] Create `authService.ts` — `login(email, password)`: verify credentials, sign JWT, timing-safe on miss `S`
- [x] Create `authenticate.ts` middleware — verify JWT, attach `userId` to request `S`
- [x] Create `errorHandler.ts` global middleware — handle Zod, Prisma, and generic errors `S`
- [x] Create `validate.ts` middleware — generic Zod body validation `S`
- [x] Create `routes/auth.ts` — `POST /register`, `POST /login`, `GET /me` `M`
- [x] Wire auth routes and middleware into Express app, add `/api/v1` prefix `S`

#### apps/api — Monitor CRUD

- [x] Create `monitorService.ts` — `create(userId, data)`: validate, generate slug, persist `M`
- [x] Create `monitorService.ts` — `listByUser(userId, page, limit)`: paginated query `S`
- [x] Create `monitorService.ts` — `getById(monitorId, userId)`: ownership check `S`
- [x] Create `monitorService.ts` — `update(monitorId, userId, data)`: ownership check, validate `S`
- [x] Create `monitorService.ts` — `delete(monitorId, userId)`: ownership check, cascade `S`
- [x] Create `monitorService.ts` — `pause(monitorId, userId)` and `resume(monitorId, userId)` `S`
- [x] Create `routes/monitors.ts` — all CRUD + pause/resume routes `M`
- [x] Wire monitor routes behind `authenticate` middleware `S`

---

### Milestone 2: Core Check Loop

#### apps/scheduler — Scheduler Service

- [x] Create `config/env.ts` with validated scheduler environment vars `S`
- [x] Implement scheduler tick: query due monitors (`active=true AND nextCheckAt <= NOW()`) `M`
- [x] Enqueue one BullMQ job per due monitor via `addCheckJob()` from `packages/queue` `S`
- [x] Update `monitor.nextCheckAt = NOW() + interval` after enqueueing `S`
- [x] Replace `setInterval` with `node-cron` running every 30 seconds `S`
- [x] Add error handling: graceful recovery on Redis/PostgreSQL connection failure `S`
- [x] Add structured JSON logging for tick stats (monitors found, jobs enqueued) `S`

#### apps/worker — Check Execution

- [x] Create `config/env.ts` with validated worker environment vars (concurrency, timeout) `S`
- [x] Create `processor/checkRunner.ts` — HTTP GET with `AbortController` timeout, measure response time `M`
- [x] Create `processor/resultPersist.ts` — persist `Check` record to PostgreSQL `S`
- [x] Create `processor/incidentDetect.ts` — stub with open/resolve logic placeholder `S`
- [x] Wire processor into BullMQ Worker with configurable concurrency `S`
- [x] Update `monitor.status` and `monitor.lastCheckedAt` after each check `S`
- [x] Add structured JSON logging for job processing (monitorId, status, responseTime) `S`

#### Integration Verification

- [x] Start Docker Compose (PostgreSQL + Redis), run migration, seed a test user and monitor `M`
- [x] Manually verify: scheduler enqueues jobs → worker processes → check records appear in DB `M`

---

## NEXT SPRINT — M3 Reliability + M4 Metrics API

### Milestone 3: Reliability Layer

#### apps/worker — Incident Detection

- [x] Create `cache/failureCounter.ts` — Redis `INCR`/`DEL`/`GET` for `failures:{monitorId}` with TTL `S`
- [x] Create `cache/statusCache.ts` — Redis `GET`/`SET` for `status:{monitorId}` with TTL `S`
- [x] Implement confirm-down logic in `incidentDetect.ts`: increment counter on non-UP, open incident when threshold reached `M`
- [x] Implement incident resolution in `incidentDetect.ts`: on UP check, resolve open incident, calculate `durationSeconds` `M`
- [x] Enforce single open incident per monitor constraint (query before create) `S`
- [x] Update Redis status cache after each check for dashboard fast reads `S`
- [x] Verify BullMQ retry config handles infrastructure failures (DB down, Redis blip) `S`

### Milestone 4: Metrics API

#### apps/api — Metrics Endpoints

- [x] Create `metricsService.ts` — `getStats(monitorId, window)`: uptime %, total checks, avg response time `M`
- [x] Create `metricsService.ts` — `getChecks(monitorId, window, page, limit)`: paginated check history `S`
- [x] Create `metricsService.ts` — `getIncidents(monitorId, page, limit)`: paginated incident history `S`
- [x] Create `metricsService.ts` — `getLatency(monitorId, window)`: bucketed avg/min/max by time window `M`
- [x] Create `routes/metrics.ts` — `GET /monitors/:id/stats`, `/checks`, `/incidents`, `/latency` `M`
- [x] Wire metrics routes behind `authenticate` middleware with ownership check `S`

#### apps/api — Dashboard Endpoint

- [x] Create `dashboardService.ts` — aggregate summary (total, active, up, down, degraded, paused monitors) `M`
- [x] Include recent incidents (last 5) and per-monitor 24h uptime/avg response time `M`
- [x] Create `routes/dashboard.ts` — `GET /dashboard` `S`

#### apps/api — Public Status Page Endpoint

- [x] Create `statusService.ts` — `getBySlug(slug)`: public data (name, status, uptime 7d, recent incidents) `M`
- [x] Create `routes/status.ts` — `GET /status/:slug` (no auth required) `S`

---

## FUTURE — M5 Dashboard + M6 Polish

### Milestone 5: Next.js Dashboard

#### apps/web — Auth Pages

- [ ] Create typed API client in `lib/api.ts` with JWT token management `M`
- [ ] Build login page at `/auth/login` `M`
- [ ] Build register page at `/auth/register` `M`
- [ ] Add auth guard: redirect unauthenticated users to login `S`

#### apps/web — Monitor List View

- [ ] Build dashboard layout with sidebar/header navigation `M`
- [ ] Build `MonitorCard` component — name, URL, status badge, uptime %, last checked `M`
- [ ] Build monitor list page at `/(dashboard)/page.tsx` with summary stats `M`
- [ ] Add create monitor modal/form with Zod validation `M`
- [ ] Add pause/resume and delete actions on monitor cards `S`
- [ ] Implement polling (30s interval) for real-time status updates `S`

#### apps/web — Monitor Detail View

- [ ] Build monitor detail page at `/(dashboard)/monitors/[id]/page.tsx` `M`
- [ ] Build `LatencyChart` component with Recharts (line chart, time window toggle) `L`
- [ ] Build recent checks table (last 20, timestamp, status, response time, HTTP code) `M`
- [ ] Build `IncidentList` component with start time, resolution time, duration `M`
- [ ] Add uptime % display for 24h / 7d / 30d toggle `S`

#### apps/web — Public Status Page

- [ ] Build public status page at `/status/[slug]/page.tsx` (no auth) `M`
- [ ] Display monitor name, current status, 7d uptime %, last 10 incidents `M`

#### apps/web — UX Polish

- [ ] Add loading skeletons for all data-fetching components `S`
- [ ] Add empty states (first-time user prompt to create monitor) `S`
- [ ] Add error handling with user-readable messages `S`
- [ ] Ensure responsive layout for desktop and tablet `M`

### Milestone 6: Polish and Deploy

#### Testing

- [ ] Unit tests: `determineStatus()`, `calculateUptimePercent()`, `slugify()` `M`
- [ ] Unit tests: incident detection logic (open, resolve, threshold) `M`
- [ ] Integration tests: auth routes (register, login, me) `M`
- [ ] Integration tests: monitor CRUD routes `M`
- [ ] Integration tests: metrics routes with seeded check data `M`

#### Docker and Deployment

- [ ] Write `Dockerfile` for `apps/api` `S`
- [ ] Write `Dockerfile` for `apps/scheduler` `S`
- [ ] Write `Dockerfile` for `apps/worker` `S`
- [ ] Write `Dockerfile` for `apps/web` `S`
- [ ] Create `docker-compose.prod.yml` with all services, networks, health checks `M`
- [ ] Verify full system boot with `docker compose up` in under 3 minutes `M`

#### Database Management

- [ ] Create `jobs/dataRetention.ts` — cron job running daily to delete `Check` records older than 30 days `S`

#### Documentation

- [ ] Write `README.md` with architecture diagram, setup instructions, and env var reference `M`
- [ ] Add API usage examples to README `S`
