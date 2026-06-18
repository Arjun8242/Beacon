# 📡 Beacon
> A Queue-Driven, Distributed Uptime Monitoring & Status Analytics Platform.

[![License](https://img.shields.io/github/license/Arjun8242/Beacon?color=blue&style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?logo=next.js&style=flat-square)](https://nextjs.org)
[![Express](https://img.shields.io/badge/Backend-Express.js-lightgrey?logo=express&style=flat-square)](https://expressjs.com)
[![Prisma ORM](https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma&style=flat-square)](https://prisma.io)
[![BullMQ](https://img.shields.io/badge/Queue-BullMQ%20%2B%20Redis-red?logo=redis&style=flat-square)](https://bullmq.io)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?logo=postgresql&style=flat-square)](https://postgresql.org)

Beacon is a distributed uptime monitoring platform designed to track service availability, record granular response-time metrics, calculate real-time uptime percentages, and automatically detect service outages. Engineered with a decouple-first architecture, Beacon leverages a decoupled scheduler-worker design to achieve reliable cron-based task scheduling and concurrent task execution.

---

## 💡 Why Beacon?

Beacon was built to explore the design, implementation, and trade-offs of distributed systems, queue-based architectures, incident tracking lifecycles, and time-series analytics. 

### The Problem
Traditional monolithic health-checking applications couple the request/response cycle of HTTP monitoring with the main application thread. This model introduces latency bottlenecks, limits concurrency, and risks system-wide failure if target websites respond slowly or time out. 

### How Modern Uptime Monitors Work
Modern uptime monitoring platforms decouple the cron scheduling layer from the network execution layer:
1. **The Scheduler** periodically polls a registry of active monitors to discover which targets are due for verification.
2. Rather than performing the network handshake itself, it publishes task payloads to a message broker.
3. **Stateless Worker Nodes** consume these jobs asynchronously, execute target HTTP checks concurrently, log response times, and update the global state.

Beacon implements this design to ensure isolation, concurrency, and reliable job execution.


## 📷 Screenshots

Below are the key interfaces of the platform. For local development or deployment checks, ensure your screens cover:

### 1. Main Dashboard Analytics
* **Recommended Focus:** Metric summary panels, active incident banners, latency over time graph, and the list of active/paused monitors.
![Main Dashboard](apps/web/public/screenshots/Screenshot%202026-06-18%20112525.png)

### 2. User Authentication
* **Recommended Focus:** Clean, secure login and registration forms featuring responsive states and client-side credential validation.
![Authentication Screen](apps/web/public/screenshots/Screenshot%202026-06-18%20113626.png)

### 3. Monitor Management & Configuration
* **Recommended Focus:** Form parameters including URL targets, polling intervals, HTTP methods, and status update confirmation indicators.
![Monitor Management](apps/web/public/screenshots/Screenshot%202026-06-18%20112625.png)

### 4. Incident History (Coming Soon / Mockup)
* **Recommended Focus:** Tabular logs showcasing historical incident durations, trigger timestamps, resolved timestamps, and response status codes.
* **Placeholder:** ![Incident History](apps/web/public/screenshots/Screenshot%202026-06-18%20112547.png)

---

## 📖 Project Overview

Beacon addresses the challenges of reliable, low-overhead website and API health monitoring. Built inside a Turborepo monorepo with PNPM Workspaces, it features:
* **True Cron-Based Decoupling:** Monitoring jobs are scheduled at custom intervals by a scheduler service and dispatched via a Redis-backed message broker (BullMQ).
* **Worker Execution Pool:** Worker nodes consume jobs concurrently, perform non-blocking HTTP status probes, record performance timings, and detect failure patterns.
* **Granular Time-Series Data:** Captures millisecond-level response times and logs HTTP error details to compute historical uptime averages and surface incidents.

---

## 🚀 Project Highlights

* **Distributed Architecture:** Clean separation of concerns with a Scheduler → Redis Queue → Worker pipeline.
* **Asynchronous Processing:** Redis & BullMQ handle task queueing, concurrency, and job retries asynchronously.
* **Prisma & Postgres Storage:** Strong consistency and relational modeling for users, monitors, checks, and incidents.
* **Incident Lifecycle Management:** Automatically tracks outage transitions from trigger state to resolution.
* **Stateless REST API:** JWT-based authentication for isolated, stateless user sessions.
* **Production-Grade Tooling:** Turborepo monorepo configuration with strict TypeScript enforcement.

---

## ⚡ Current Capabilities

| Feature | Capability | Implementation / Tech |
|---|---|---|
| **Concurrent Worker Jobs** | Configurable job concurrency limits per worker thread | BullMQ `concurrency` (Default: `10`) |
| **Custom Monitoring Intervals** | Granular check intervals defined per monitor target | Database-driven interval scheduling (`30s` to `600s`) |
| **Historical Check Storage** | Persistent append-only response metrics logs | PostgreSQL transaction tables with composite indexes |
| **Incident Tracking** | State-driven incident creation and resolution | Relational database mapping with active incident tracking |
| **JWT Authentication** | Secure, stateless API user authentication | `jsonwebtoken` + `bcrypt` password hashing |
| **Redis Queue Processing** | Durable message execution and job retry guarantees | BullMQ job status engine backed by Redis structures |
| **Cloud Deployment** | Unified resource deployment and cost-optimized orchestration | Render Web Service using `concurrently` |

---

## ⚙️ System Design Decisions

### Why Redis + BullMQ?
* **Decoupling Net IO:** Running network requests inside API request-response loops leads to poor API responsiveness. Offloading health checks to an asynchronous queue ensures the API remains fast.
* **Reliable Job Delivery:** Redis provides persistent memory structures, ensuring jobs are not lost if a worker process crashes mid-execution.
* **Built-in Retries:** BullMQ handles backoff strategies and automated retries, avoiding false-positives caused by transient network blips.
* **Concurrency Control:** BullMQ lets us configure exact concurrency rates per worker node, protecting target servers and worker memory limits from spike loads.

### Why PostgreSQL?
* **Relational Consistency:** Monitors belong to Users, Checks belong to Monitors, and Incidents are linked directly to Monitors. A relational database enforces schema constraints and foreign key cascading.
* **Transactional Reliability:** Updating monitor status and creating an incident must happen atomically. PostgreSQL's ACID compliance prevents disjointed, orphan state issues.
* **Optimized Indexing:** Indexes on compound columns like `(active, nextCheckAt)` ensure that scheduler polling queries scale cleanly as the number of monitors grows.

### Why Scheduler + Worker Separation?
* **Resource Isolation:** The scheduler is lightweight and database-bound, whereas workers are CPU and network IO-bound. Separating them prevents network congestion on worker machines from delaying scheduling cycles.
* **Independent Scalability:** If the number of targets increases, we can scale out the worker service horizontally without multiplying scheduler processes, preventing duplicate database ticks.

### Why Turborepo?
* **Unified Workspace:** Speeds up monorepo dependency resolution using PNPM workspaces.
* **Code Sharing:** Shared TS types and database connections reside in a single `packages/` directory, avoiding package version mismatches and boilerplate duplicates.
* **Dependency Caching:** Turborepo caches tasks like builds, tests, and lints, optimizing local compilation times.

---

## 🏗️ Architecture Diagram

```
                       +-------------------+
                       |    Next.js Web    |
                       |    (UI/Vercel)    |
                       +---------+---------+
                                 | REST API
                                 v
                       +-------------------+
                       |   Express API     | <---+
                       | (Render/App Node) |     | Read/Write
                       +---------+---------+     | Database
                                 |               |
                                 | Register/     v
                                 | Manage  +-----------+
                                 |         |           |
                                 +-------->|           |
                                           |  Postgres |
                                           |  (Neon)   |
+-------------------+                      |           |
| Scheduler Service |                      |           |
|  (Cron Engine)    |                      |           |
+---------+---------+                      +-----+-----+
          |                                      ^
          | Push Job                             | Write Metrics &
          v                                      | Incidents
  +-------+-------+                              |
  |  Redis Queue  |==============================+
  |   (Upstash)   |
  +-------+-------+
          |
          | Pull Check Job
          v
+---------+---------+      Probes HTTP       +-----------------+
|   Worker Pool     |=======================>| Target Websites |
| (Worker Service)  |                        +-----------------+
+-------------------+
```

---

## 🔄 Monitoring Workflow Explanation

1. **Scheduling (`apps/scheduler`):**
   * The Scheduler service polls the PostgreSQL database at configured intervals (e.g., `SCHEDULER_INTERVAL_MS=30000`).
   * It queries for active monitors whose `nextCheckAt` timestamp is in the past or present.
   * It packages these monitors into jobs and pushes them to the BullMQ Redis queue, updating the `nextCheckAt` timestamp in the database to prevent duplicate scheduling.

2. **Queueing (`packages/queue`):**
   * BullMQ handles job persistence, lifecycle tracking, and delivery guarantees using Redis.
   * Jobs wait in the queue until pulled by an available worker.

3. **Execution (`apps/worker`):**
   * Worker instances pull jobs from the queue with customizable concurrency limits (`WORKER_CONCURRENCY=10`).
   * Each worker executes the HTTP check against the target URL using the configured HTTP method.
   * The worker measures the exact duration from TCP handshake initiation to complete response retrieval.
   * If the status code is outside the successful range (>=400) or if the network request times out, it registers the check as `DOWN`.

4. **Persistence & State Management:**
   * Workers write check logs directly into PostgreSQL via Prisma.
   * If a monitor changes state (e.g., `UP` to `DOWN`), the worker starts a new `Incident` record.
   * Once the target site recovers, the incident is closed, and the duration is calculated.

---

## 🛠️ Tech Stack

### Monorepo & Tooling
* **Turborepo:** Incremental builds, cache sharing, and pipeline management.
* **PNPM Workspaces:** Low-overhead dependency caching and internal package linking.
* **TypeScript:** Strict type-safety across frontend apps, backend microservices, and shared libraries.

### Services & Application Layers
* **Frontend:** [Next.js](https://nextjs.org/) (App Router, Tailwind CSS, TypeScript) for data visualization and configuration dashboard.
* **API Service:** [Node.js](https://nodejs.org/) & [Express.js](https://expressjs.com/) for business logic, authentication, and stats endpoints.
* **Scheduler Service:** Node.js standalone cron daemon query runner.
* **Worker Service:** Standalone task executor consuming queue messages and performing net IO.
* **Database & ORM:** [PostgreSQL](https://www.postgresql.org/) + [Prisma ORM](https://www.prisma.io/) for database schemas, relations, and type-safe client operations.
* **Queue Engine:** [Redis](https://redis.io/) + [BullMQ](https://bullmq.io/) for message broker functionality.

---

## 🗄️ Database Design Overview

The database is built on PostgreSQL and mapped via Prisma ORM.

### Models Details

```mermaid
erDiagram
    User ||--o{ Monitor : owns
    Monitor ||--o{ Check : logs
    Monitor ||--o{ Incident : registers

    User {
        string id PK
        string email UK
        string passwordHash
        datetime createdAt
        datetime updatedAt
    }

    Monitor {
        string id PK
        string userId FK
        string name
        string slug UK
        string url
        string method
        int interval
        boolean active
        MonitorStatus status
        datetime lastCheckedAt
        datetime nextCheckAt
        datetime createdAt
        datetime updatedAt
    }

    Check {
        string id PK
        string monitorId FK
        CheckStatus status
        int statusCode
        int responseTime
        string error
        datetime checkedAt
    }

    Incident {
        string id PK
        string monitorId FK
        datetime startedAt
        datetime resolvedAt
        int durationSeconds
        datetime createdAt
    }
```

### Key Performance Indexes
To support high-frequency querying and polling, the following indices are maintained:
* `@@index([active, nextCheckAt])` on **Monitor**: Optimizes scheduler discovery.
* `@@index([userId, createdAt])` on **Monitor**: Speeds up user dashboard loads.
* `@@index([monitorId, checkedAt])` on **Check**: Optimizes time-series rendering of metric history.
* `@@index([monitorId, startedAt])` on **Incident**: Rapidly aggregates active outages.

---

## ⚙️ Local Development Setup

### Prerequisites
* **Node.js** >= 18.x
* **PNPM** >= 8.x
* **Docker** (optional, for local PostgreSQL/Redis)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Arjun8242/Beacon.git
   cd uptime-monitor
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Spin up local database and Redis services:
   ```bash
   docker-compose up -d
   ```

4. Configure your `.env` variables (copy from `.env.example` to `.env` at root and packages/database):
   ```bash
   cp .env.example .env
   ```

5. Run Prisma migrations and generate types:
   ```bash
   pnpm --filter database db:migrate
   pnpm --filter database db:generate
   ```

6. Start all services in development mode:
   ```bash
   pnpm dev
   ```

---

## 🔒 Environment Variables

Refer to `.env.example` at the root directory:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL Connection String | `postgresql://admin:password@localhost:5432/uptime_monitor?schema=public` |
| `REDIS_URL` | Connection URL for Redis/Upstash | `redis://127.0.0.1:6379` |
| `API_PORT` | Port for Express API | `3001` |
| `JWT_SECRET` | JWT Signing Key | `super_secret_jwt_key_change_in_production` |
| `BCRYPT_COST` | Salt rounds for bcrypt hashing | `10` |
| `WORKER_CONCURRENCY` | Concurrent jobs per worker instance | `10` |
| `SCHEDULER_INTERVAL_MS` | DB Polling frequency for Scheduler | `30000` |

---

## 🔌 API Overview

All routes are versioned and located under `/api/v1`.

### 1. Authentication
* `POST /api/v1/auth/register` - Create new user account.
* `POST /api/v1/auth/login` - Authenticate user and return JWT bearer token.

### 2. Monitor Management
* `GET /api/v1/monitors` - List all monitors for logged-in user.
* `POST /api/v1/monitors` - Create a new monitor target.
* `GET /api/v1/monitors/:id` - Detailed configuration of a single monitor.
* `PUT /api/v1/monitors/:id` - Update check intervals, target url, and parameters.
* `DELETE /api/v1/monitors/:id` - Terminate monitor and purge historic check data.

### 3. Analytics & Metrics
* `GET /api/v1/monitors/:id/metrics` - Fetch timeseries data points (response time, state changes).
* `GET /api/v1/dashboard` - Get aggregated stats (overall uptime %, current active outages, latency graphs).
* `GET /api/v1/status` - Aggregated status summary of public endpoints.

---

## 🚢 Deployment Architecture

### Current Deployment (Render Free-Tier Optimized)
To optimize costs while preserving logical code separation, the three backend processes run inside a **single Render Web Service** container:
* **Express API**
* **Scheduler Service**
* **Worker Service**

These services are orchestrated concurrently inside the container environment using the `concurrently` package. This allows us to run multiple decoupled backend layers under a single Render free-tier compute instance while maintaining strict logical boundaries in our monorepo codebase.

### Global Architecture
* **Frontend:** Hosted on **Vercel** with Next.js edge runtime optimizations for static assets and API requests proxying.
* **Database Layer:** Serverless **Neon PostgreSQL** database with autoscaling connections and automated point-in-time recovery.
* **Queue Broker:** **Upstash serverless Redis** enabling pay-as-you-go latency-sensitive data structures.

---

## 🧠 Engineering Challenges Solved

### 1. Race Conditions & Double Scheduling
* **Problem:** In a multi-replica environment, multiple scheduler instances might pick up the same active monitor targets at the same instant, queueing duplicate checks.
* **Solution:** Used atomic database updates. When the scheduler queries for active monitors, it performs a write lock update:
  ```sql
  UPDATE "Monitor"
  SET "nextCheckAt" = NOW() + INTERVAL '1 second' * "interval", "lastCheckedAt" = NOW()
  WHERE id IN (
      SELECT id FROM "Monitor"
      WHERE "active" = true AND "nextCheckAt" <= NOW()
      FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
  ```
  This ensures that once a scheduler fetches a batch of monitors, no other scheduler can see or enqueue them.

### 2. High Connection Density with Serverless Postgres
* **Problem:** Serverless platforms like Neon have low connection thresholds, which spin up quickly when worker pods scale up.
* **Solution:** Integrated connection pooling limits directly within Prisma, routing read-heavy queries through cached stores and using Prisma Accelerator / connection pooling proxies to limit concurrent DB connections from backend processes.

---

## 📈 Scalability Considerations

* **Queue Partitioning:** As monitor count scales, the Redis server is partition-isolated by prefixing queues or sharding workers across separate BullMQ queue instances.
* **Stateless API:** API node is completely stateless; JWT tokens store authentication claims, allowing Render backend containers to scale out horizontally with CPU load.
* **Aggressive Indexing & Data Archiving:** The `Check` table grows rapidly. Future scaling incorporates weekly partition tables or time-series databases to keep the primary transactional PostgreSQL database lean.

---

## 🗺️ Future Roadmap (V2)

- [ ] **Alerting Integration:** Instant alerts via Email notifications (SES/SendGrid).
- [ ] **ChatOps:** Native integrations for Discord and Slack webhook notifications.
- [ ] **Public Status Pages:** Allow users to build highly-customizable public status dashboards.
- [ ] **SSL Expiry Monitoring:** Proactive monitoring of TLS/SSL certificate status and notification warnings before expiration.
- [ ] **Monitoring Telemetry:** Integrate Prometheus Metrics endpoints to monitor queue depth and API query latencies.
- [ ] **Visual Metrics:** Ready-made Grafana dashboards to monitor service internals.
- [ ] **CI/CD Automation:** Standard GitHub Actions CI/CD workflows for automated workspace linting, testing, and service packaging.
- [ ] **Advanced Analytics:** Dynamic anomaly detection to isolate slow responses from real service degradation.

---

*Beacon is designed and maintained by [Arjun](https://github.com/Arjun8242). Open source contributions and feedback are always welcome!*
