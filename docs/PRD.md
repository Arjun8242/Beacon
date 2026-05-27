# PRD — Distributed Uptime Monitoring Platform

**Version:** 1.0  
**Status:** Draft  
**Author:** Arjun Jaiswal  
**Last Updated:** 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals](#3-goals)
4. [Success Criteria](#4-success-criteria)
5. [User Personas](#5-user-personas)
6. [User Stories](#6-user-stories)
7. [Functional Requirements](#7-functional-requirements)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Monitoring Workflow](#9-monitoring-workflow)
10. [Incident Lifecycle](#10-incident-lifecycle)
11. [Metrics and Analytics Requirements](#11-metrics-and-analytics-requirements)
12. [Dashboard Requirements](#12-dashboard-requirements)
13. [API Overview](#13-api-overview)
14. [Risks and Constraints](#14-risks-and-constraints)
15. [Future Enhancements](#15-future-enhancements)
16. [Milestones](#16-milestones)

---

## 1. Executive Summary

The Distributed Uptime Monitoring Platform is a backend-engineering-focused V1 product that enables developers and teams to monitor the availability and latency of HTTP/HTTPS endpoints. Users configure monitors with custom check intervals; a distributed scheduler enqueues check jobs into a Redis-backed BullMQ queue; stateless workers execute the checks in parallel and persist results to PostgreSQL. An incident detection layer automatically opens and closes outage records. A Next.js dashboard surfaces real-time status, uptime percentage, historical latency charts, and incident timelines.

The platform is designed to demonstrate production-grade backend engineering: asynchronous job processing, distributed workers, queue-based decoupling, reliability primitives (retries, confirm-down logic), and observable, containerised services.

---

## 2. Problem Statement

Developers and small engineering teams frequently deploy web services without any visibility into their availability. When a service goes down, the team often learns about it from end users rather than from automated detection. Existing solutions such as UptimeRobot, Pingdom, and Datadog Synthetic Monitoring are either costly at scale or opaque in implementation — teams cannot inspect or modify the monitoring internals.

There is no lightweight, self-hostable, open monitoring platform that is simultaneously production-grade in its architecture and simple enough for a small team to run with a single `docker compose up`. This project fills that gap for V1.

### Core Pain Points

| Pain Point | Impact |
|---|---|
| No visibility into service downtime | Team learns of outages from users, not alerts |
| No historical latency data | Cannot identify degradation trends before they become outages |
| Expensive SaaS monitoring tools | Cost-prohibitive for indie developers and early-stage teams |
| Black-box monitoring internals | Cannot audit or modify check behaviour |
| No structured incident records | Cannot calculate MTTR or downtime SLAs |

---

## 3. Goals

### Primary Goals

- Enable users to create and manage HTTP/HTTPS monitors with configurable check intervals.
- Execute monitoring checks reliably and at scale using a distributed, queue-based worker architecture.
- Detect outages using confirm-down logic to eliminate false positives from transient failures.
- Automatically open and resolve incident records based on status transitions.
- Surface uptime percentage, latency history, and incident timelines on a dashboard.

### Engineering Goals

- Demonstrate correct use of BullMQ + Redis for distributed job processing.
- Demonstrate Prisma + PostgreSQL schema design with appropriate indexes.
- Demonstrate decoupled service architecture (API, scheduler, worker as separate processes).
- Demonstrate Docker Compose multi-service orchestration.
- Produce code and architecture that is explainable end-to-end in a technical interview.

---

## 4. Success Criteria

| Criterion | Target |
|---|---|
| Monitor check execution | 100% of active monitors checked within their configured interval window |
| False positive rate | Zero false outage incidents from single transient failures |
| Check latency | Worker executes and persists a check result within 5 seconds of job enqueue |
| Uptime calculation accuracy | Reported uptime % matches raw check data within ±0.1% |
| Dashboard load time | Dashboard initial render under 2 seconds on a standard connection |
| Retry reliability | Failed checks retried up to N configured attempts before declaring outage |
| Incident auto-resolution | Incident marked resolved within one check cycle after service recovers |
| Local dev bootstrap | `docker compose up` produces a fully running system in under 3 minutes |

---

## 5. User Personas

### Persona 1 — Solo Developer (Primary)

**Name:** Dev Priya  
**Context:** Indie developer with 2–5 deployed web services (APIs, Next.js apps, side projects).  
**Goal:** Know immediately when any service goes down, see latency trends, get a shareable status page.  
**Technical level:** High — comfortable with Docker, APIs, and self-hosting.  
**Frustration:** "UptimeRobot's free tier is too limited and I don't want to pay $20/month for something I could build."

### Persona 2 — Early-Stage Startup Engineer

**Name:** Eng Rohan  
**Context:** 3-person engineering team, several microservices in production.  
**Goal:** Centralised visibility into service health, historical data to bring to post-mortems.  
**Technical level:** High.  
**Frustration:** "We have no structured incident records. When the CEO asks how long we were down last Tuesday, nobody knows."

### Persona 3 — Engineering Interviewer (Meta Persona)

**Name:** Interviewer  
**Context:** Reviewing the project as a portfolio artefact.  
**Goal:** Assess whether the candidate understands distributed systems, queues, and production engineering.  
**What they look for:** Clear architectural decisions, justified technology choices, observable and testable code.

---

## 6. User Stories

### Monitor Management

| ID | Story | Priority |
|---|---|---|
| US-01 | As a user, I can register and log in so that my monitors are private to me. | P0 |
| US-02 | As a user, I can create a monitor by providing a name, URL, and check interval so that the system begins checking my endpoint. | P0 |
| US-03 | As a user, I can view a list of all my monitors with their current status so that I have a single-pane-of-glass view. | P0 |
| US-04 | As a user, I can edit a monitor's name, URL, or interval so that I can adjust monitoring as my services evolve. | P0 |
| US-05 | As a user, I can delete a monitor so that checks stop for decommissioned services. | P0 |
| US-06 | As a user, I can pause and resume a monitor so that I can suppress checks during planned maintenance. | P0 |

### Monitoring Execution

| ID | Story | Priority |
|---|---|---|
| US-07 | As a user, I expect my monitor to be checked at approximately my configured interval so that I have timely status updates. | P0 |
| US-08 | As a user, I expect a single failed check not to immediately create an incident so that I am not flooded with false alerts. | P0 |
| US-09 | As a user, I expect the system to retry a failed check before declaring an outage so that transient errors are handled gracefully. | P0 |

### Incidents

| ID | Story | Priority |
|---|---|---|
| US-10 | As a user, I can see a list of incidents for each monitor so that I have a complete outage history. | P0 |
| US-11 | As a user, I can see when an incident started and when it was resolved so that I can calculate downtime duration. | P0 |
| US-12 | As a user, I expect incidents to be automatically resolved when my service recovers so that I do not have to manually close them. | P0 |

### Dashboard and Metrics

| ID | Story | Priority |
|---|---|---|
| US-13 | As a user, I can see the uptime percentage for each monitor over the last 24 hours and 7 days so that I understand overall reliability. | P0 |
| US-14 | As a user, I can see a latency chart for each monitor so that I can identify performance degradation trends. | P0 |
| US-15 | As a user, I can see recent check results (status, response time, status code) so that I can debug issues. | P0 |
| US-16 | As a user, I can view a public status page for my monitors so that I can share service health with external stakeholders. | P1 |

---

## 7. Functional Requirements

### 7.1 Authentication

| Req ID | Requirement |
|---|---|
| FR-AUTH-01 | Users register with email and password. Passwords are hashed with bcrypt (minimum cost factor 12). |
| FR-AUTH-02 | Users authenticate via JWT. Tokens expire after 24 hours. |
| FR-AUTH-03 | All monitor management endpoints require a valid JWT. |
| FR-AUTH-04 | Users may only read and modify their own monitors. |

### 7.2 Monitor Management

| Req ID | Requirement |
|---|---|
| FR-MON-01 | A monitor has: name, url, interval (seconds), active (boolean), status, createdAt. |
| FR-MON-02 | Supported intervals: 30s, 60s, 120s, 300s, 600s. |
| FR-MON-03 | URL must be a valid HTTP or HTTPS URL. Validated on creation and update. |
| FR-MON-04 | Deleting a monitor cascades to delete all associated checks and incidents. |
| FR-MON-05 | Pausing a monitor (active=false) causes the scheduler to skip it on the next cycle. |
| FR-MON-06 | Monitors have a `slug` field (unique, auto-generated) used for public status page URLs. |

### 7.3 Monitoring Execution

| Req ID | Requirement |
|---|---|
| FR-EXEC-01 | The scheduler runs on a fixed cycle (every 30 seconds) and discovers all active monitors whose next check time has elapsed. |
| FR-EXEC-02 | For each due monitor, the scheduler enqueues one job into the BullMQ check queue. |
| FR-EXEC-03 | The worker makes an HTTP GET request to the monitor URL with a configurable timeout (default: 10 seconds). |
| FR-EXEC-04 | The worker records: HTTP status code, response time (ms), and error message if applicable. |
| FR-EXEC-05 | A check result status is determined as: UP (2xx within timeout), DEGRADED (non-2xx response received), DOWN (timeout or connection error). |
| FR-EXEC-06 | Workers are stateless and horizontally scalable. Multiple worker instances may consume from the same queue concurrently. |

### 7.4 Retry Strategy

| Req ID | Requirement |
|---|---|
| FR-RETRY-01 | Failed checks (DEGRADED or DOWN result) are retried up to a configurable number of times (default: 3) before a result is finalised. |
| FR-RETRY-02 | Retries use exponential backoff with jitter. Base delay: 2 seconds. |
| FR-RETRY-03 | BullMQ job-level retry is used. The job is re-queued by BullMQ on failure with the configured backoff. |
| FR-RETRY-04 | After exhausting all retries, the final failed result is persisted and incident detection runs. |

### 7.5 Incident Detection

| Req ID | Requirement |
|---|---|
| FR-INC-01 | An incident is opened when N consecutive checks return a non-UP status (confirm-down threshold, default: 3). |
| FR-INC-02 | The consecutive failure count is tracked in Redis per monitor (`failures:{monitorId}`). |
| FR-INC-03 | An open incident is resolved when a subsequent check returns UP. |
| FR-INC-04 | On resolution, the incident's `resolvedAt` and `duration` fields are populated. |
| FR-INC-05 | Only one open incident may exist per monitor at a time. |

### 7.6 Metrics

| Req ID | Requirement |
|---|---|
| FR-MET-01 | Uptime percentage is calculated as: (UP check count / total check count) × 100 for a given time window. |
| FR-MET-02 | Supported time windows: last 24 hours, last 7 days, last 30 days. |
| FR-MET-03 | Response time history is stored per check and queryable by monitor and time range. |
| FR-MET-04 | Check records older than 90 days are eligible for archival (not implemented in V1 but schema supports it). |

### 7.7 Public Status Page

| Req ID | Requirement |
|---|---|
| FR-STATUS-01 | Each monitor has a unique public URL: `/status/[slug]`. |
| FR-STATUS-02 | The public status page is unauthenticated and shows: current status, uptime % (last 7 days), last 10 incidents. |
| FR-STATUS-03 | The public status page does not expose the monitor URL or user account details. |

---

## 8. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | API response time < 200ms at p95 for dashboard data endpoints under normal load. |
| **Reliability** | A scheduler or worker crash must not cause permanent job loss. BullMQ persists jobs in Redis until acknowledged. |
| **Scalability** | Adding more worker instances must linearly increase check throughput with no code changes. |
| **Observability** | All services emit structured JSON logs. Log levels: error, warn, info, debug. |
| **Security** | Passwords hashed with bcrypt. JWTs signed with HS256. All user data is scoped to the authenticated user. No sensitive data in logs. |
| **Data Integrity** | Check results and incident records are written in database transactions to avoid partial writes. |
| **Developer Experience** | `docker compose up` starts all services with no manual configuration beyond copying `.env.example`. |
| **Testability** | Core business logic (check execution, incident detection, uptime calculation) is unit-testable without database or queue dependencies. |
| **Type Safety** | Full TypeScript coverage across all packages. No `any` types in production code. |

---

## 9. Monitoring Workflow

```
User creates monitor via dashboard
            │
            ▼
API persists monitor to PostgreSQL (status: PENDING)
            │
            ▼
Scheduler runs every 30 seconds
  └── Queries PostgreSQL for active monitors
      where nextCheckAt <= NOW()
            │
            ▼
For each due monitor:
  └── Scheduler enqueues job to BullMQ
      Job payload: { monitorId, url, timeout, retries }
            │
            ▼
Worker picks up job from BullMQ queue
  └── HTTP GET request to monitor URL
  └── Records: statusCode, responseTime, error
  └── Determines check status: UP | DEGRADED | DOWN
            │
            ▼
Worker persists Check record to PostgreSQL
            │
            ▼
Worker updates monitor.lastCheckedAt and monitor.nextCheckAt
            │
            ▼
Worker runs Incident Detection logic
  └── If non-UP: increment Redis failure counter
  └── If counter >= threshold AND no open incident: open incident
  └── If UP AND open incident exists: resolve incident
            │
            ▼
Worker updates monitor.status in PostgreSQL
            │
            ▼
Worker updates Redis status cache for dashboard reads
```

---

## 10. Incident Lifecycle

```
State: HEALTHY
  Monitor checks return UP consistently
  Redis failure counter: 0

  ↓ Check returns DEGRADED or DOWN

State: DETECTING
  Redis failure counter increments on each failed check
  No incident record created yet
  Counter < confirm-down threshold (default: 3)

  ↓ Failure counter reaches threshold

State: INCIDENT OPEN
  Incident record created in PostgreSQL
    incidentId, monitorId, startedAt, resolvedAt=null
  Redis failure counter reset to 0
  Monitor status updated to DOWN

  ↓ Check returns UP

State: RESOLVING
  Incident resolvedAt set to now()
  Incident duration calculated
  Monitor status updated to UP
  Redis failure counter remains 0

  ↓ Returns to HEALTHY
```

### Incident State Transitions

| From | Event | To | Action |
|---|---|---|---|
| HEALTHY | Check fails | DETECTING | Increment Redis counter |
| DETECTING | Check fails, counter < threshold | DETECTING | Increment Redis counter |
| DETECTING | Check passes | HEALTHY | Reset Redis counter |
| DETECTING | Counter reaches threshold | INCIDENT OPEN | Create incident record |
| INCIDENT OPEN | Check passes | RESOLVING | Set resolvedAt, calculate duration |
| RESOLVING | — | HEALTHY | Update monitor status to UP |

---

## 11. Metrics and Analytics Requirements

### Uptime Calculation

```
uptime_pct = (count of UP checks / total checks) × 100
             for checks within the requested time window
```

The query must filter by `monitorId` and `checkedAt >= window_start`. The `checks` table index on `(monitorId, checkedAt)` makes this efficient.

### Response Time Aggregation

For latency charts, checks are grouped into time buckets:

| Time Window | Bucket Size |
|---|---|
| Last 24 hours | 1 hour |
| Last 7 days | 6 hours |
| Last 30 days | 1 day |

Each bucket returns: `avg`, `min`, `max` response time.

### API Endpoints for Metrics

| Endpoint | Returns |
|---|---|
| `GET /monitors/:id/stats?window=24h` | uptime %, total checks, avg response time |
| `GET /monitors/:id/checks?window=24h` | paginated raw check history |
| `GET /monitors/:id/incidents` | all incidents, paginated |
| `GET /monitors/:id/latency?window=7d` | bucketed latency data for chart |

---

## 12. Dashboard Requirements

### Monitor List View

- Summary card per monitor showing: name, URL (truncated), current status badge (UP/DOWN/DEGRADED), uptime % (last 24h), last checked time.
- Status badge colour: green (UP), red (DOWN), amber (DEGRADED), grey (PENDING/PAUSED).
- Ability to create, pause, and delete a monitor from this view.

### Monitor Detail View

- Monitor name, URL, interval, current status, last checked timestamp.
- Uptime percentage for 24h / 7d / 30d (tab or toggle).
- Latency chart: line chart of avg response time over selected window.
- Recent checks table: last 20 checks showing timestamp, status, response time, HTTP status code.
- Incident history: list of all incidents with start time, resolution time, and duration.

### Public Status Page

- Accessible at `/status/[slug]` without authentication.
- Shows: monitor name (not URL), current status, uptime % (last 7 days), incident history (last 10).

### General Dashboard UX Requirements

| Requirement | Detail |
|---|---|
| Real-time status updates | Dashboard polls API every 30 seconds or uses WebSocket push (V1: polling acceptable) |
| Loading states | All data-fetching components show skeletons, not blank areas |
| Empty states | First-time users see a clear prompt to create their first monitor |
| Error handling | API errors surface as user-readable messages, not raw JSON |
| Responsive layout | Functional on desktop and tablet viewports |

---

## 13. API Overview

All API routes are prefixed with `/api/v1`. All responses follow:

```json
{
  "success": true,
  "data": { },
  "error": null
}
```

### Authentication Routes

| Method | Path | Description | Auth Required |
|---|---|---|---|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login, returns JWT | No |
| GET | `/auth/me` | Get current user | Yes |

### Monitor Routes

| Method | Path | Description | Auth Required |
|---|---|---|---|
| GET | `/monitors` | List all monitors for user | Yes |
| POST | `/monitors` | Create monitor | Yes |
| GET | `/monitors/:id` | Get monitor details | Yes |
| PUT | `/monitors/:id` | Update monitor | Yes |
| DELETE | `/monitors/:id` | Delete monitor | Yes |
| PATCH | `/monitors/:id/pause` | Pause monitor | Yes |
| PATCH | `/monitors/:id/resume` | Resume monitor | Yes |

### Metrics Routes

| Method | Path | Description | Auth Required |
|---|---|---|---|
| GET | `/monitors/:id/stats` | Uptime %, avg latency, total checks | Yes |
| GET | `/monitors/:id/checks` | Paginated check history | Yes |
| GET | `/monitors/:id/incidents` | All incidents | Yes |
| GET | `/monitors/:id/latency` | Bucketed latency for chart | Yes |

### Public Routes

| Method | Path | Description | Auth Required |
|---|---|---|---|
| GET | `/status/:slug` | Public status page data | No |

### Request/Response Examples

**POST /api/v1/monitors**

Request:
```json
{
  "name": "My API",
  "url": "https://api.myapp.com/health",
  "interval": 60
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "clx1234abc",
    "name": "My API",
    "url": "https://api.myapp.com/health",
    "interval": 60,
    "active": true,
    "status": "PENDING",
    "slug": "my-api-abc123",
    "createdAt": "2025-01-15T10:00:00Z"
  }
}
```

**GET /api/v1/monitors/:id/stats?window=24h**

Response:
```json
{
  "success": true,
  "data": {
    "uptimePercent": 99.3,
    "totalChecks": 1440,
    "upChecks": 1430,
    "avgResponseTime": 243,
    "window": "24h"
  }
}
```

---

## 14. Risks and Constraints

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Scheduler fires duplicate jobs for same monitor | Medium | Duplicate check results, inflated metrics | Use monitor ID as BullMQ job ID; BullMQ deduplicates by job ID |
| Worker crashes mid-check, job lost | Low | Missed check result | BullMQ job remains in queue until acknowledged; auto-retry on worker restart |
| Redis outage | Low | Scheduler cannot enqueue; failure counters lost | Scheduler handles Redis connection errors gracefully; failure counters reset on Redis restart (acceptable for V1) |
| PostgreSQL connection pool exhaustion | Low | API and worker failures | Configure Prisma connection pool limits; implement retry on connection error |
| False positives from confirm-down logic | Low | Incidents opened for brief real outages | Threshold is configurable; default of 3 balances sensitivity vs noise |
| Monitor URL is a private/internal endpoint | Medium | Worker cannot reach endpoint from Docker network | Documented as a known limitation; users must ensure URLs are publicly reachable in V1 |
| Check interval drift | Medium | Checks run later than configured interval | Scheduler tracks `nextCheckAt` in PostgreSQL; self-corrects on each cycle |

---

## 15. Future Enhancements

The following are explicitly out of scope for V1 and documented here as planned future work.

| Enhancement | Description |
|---|---|
| Alert integrations | Email, Slack, Discord, webhook notifications on incident open/resolve |
| SSL certificate monitoring | Check SSL expiry, alert before certificate expires |
| DNS monitoring | Detect DNS resolution failures separately from HTTP failures |
| ICMP/Ping monitoring | Layer-3 reachability checks independent of HTTP |
| Multi-region monitoring | Run checks from multiple geographic regions; detect regional outages |
| Team workspaces | Multiple users sharing a set of monitors with role-based access |
| RBAC | Owner, Admin, Viewer roles within a workspace |
| Kubernetes deployment | Helm chart for production Kubernetes deployment |
| Auto-healing | Trigger recovery actions (restart container, invalidate CDN cache) on incident detection |
| Wake-up pings | Keep free-tier services alive by pinging on schedule |
| Machine learning | Anomaly detection on response time trends; predictive incident alerting |
| Billing and subscriptions | Tiered plans with monitor limits and check frequency controls |
| Status page customisation | Custom domain, branding, and maintenance window announcements |
| Metrics retention policy | Automated archival and deletion of old check records |

---

## 16. Milestones

| Milestone | Deliverables | Target Duration |
|---|---|---|
| **M1 — Foundation** | Monorepo setup, Docker Compose, PostgreSQL + Prisma schema, base Express API, JWT auth, environment config | Week 1 |
| **M2 — Core Check Loop** | Scheduler service, BullMQ queue setup, Worker service, HTTP check execution, check result persistence, monitor status update | Week 2 |
| **M3 — Reliability Layer** | Retry logic (BullMQ backoff), confirm-down logic (Redis counters), incident open/resolve, monitor nextCheckAt tracking | Week 3 |
| **M4 — Metrics API** | Uptime calculation endpoint, latency bucketing endpoint, check history endpoint, incident history endpoint | Week 3 |
| **M5 — Dashboard** | Next.js setup, monitor list, monitor detail page, latency chart (recharts), incident timeline, public status page | Week 4 |
| **M6 — Polish and Deploy** | Unit tests for core logic, integration tests for API routes, README with architecture diagram, Docker Compose production config, live deployment | Week 4–5 |
