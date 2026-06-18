# 📡 Beacon
> A Production-Ready, Distributed Uptime Monitoring & Status Analytics Platform.

[![License](https://img.shields.io/github/license/Arjun8242/uptime-monitoring?color=blue&style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?logo=next.js&style=flat-square)](https://nextjs.org)
[![Express](https://img.shields.io/badge/Backend-Express.js-lightgrey?logo=express&style=flat-square)](https://expressjs.com)
[![Prisma ORM](https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma&style=flat-square)](https://prisma.io)
[![BullMQ](https://img.shields.io/badge/Queue-BullMQ%20%2B%20Redis-red?logo=redis&style=flat-square)](https://bullmq.io)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?logo=postgresql&style=flat-square)](https://postgresql.org)

Beacon is a distributed, high-performance uptime monitoring platform designed to track service availability, record granular response-time metrics, calculate real-time uptime percentages, and automatically detect service outages. Engineered with a decouple-first architecture, Beacon leverages a decoupled scheduler-worker design to achieve reliable cron-based task scheduling and concurrent task execution at scale.

---

## 📷 Screenshots

### 1. Main Dashboard Analytics
![Main Dashboard](apps/web/public/screenshots/Screenshot%202026-06-18%20112525.png)

### 2. User Authentication
![Authentication Screen](apps/web/public/screenshots/Screenshot%202026-06-18%20113626.png)

### 3. Monitor Management & Configuration
![Monitor Management](apps/web/public/screenshots/Screenshot%202026-06-18%20112625.png)

---

## 📖 Project Overview

Beacon addresses the challenges of reliable, low-overhead website and API health monitoring. Built inside a Turborepo monorepo with PNPM Workspaces, it features:
* **True Cron-Based Decoupling:** Monitoring jobs are scheduled at custom intervals by an isolated scheduler service and dispatched via a Redis-backed message broker (BullMQ).
* **Fault-Tolerant Workers:** Independent worker nodes consume jobs concurrently, perform non-blocking HTTP status probes, record performance timings, and detect failure patterns.
* **Granular Time-Series Data:** Captures millisecond-level response times and logs HTTP error details to compute historical uptime averages and surface incidents.

---

## ✨ Key Features

* **JWT-Based Authentication:** Secure endpoints using bcrypt for password hashing and stateless JSON Web Tokens for API authorization.
* **Configurable Website Monitoring:** Support for custom HTTP methods (GET, POST, etc.) and variable monitoring intervals (e.g., every 60s).
* **High-Precision Timing:** Records request response time in milliseconds to establish performance baselines.
* **Automated Incident Detection:** Detects failed HTTP checks, registers incidents, calculates downtime duration, and transitions monitors to a `DOWN` or `DEGRADED` state.
* **Real-Time Analytics & Statistics:** Aggregates average response times and computes uptime percentages across user-defined periods.
* **Background Queue Processing:** Utilizes BullMQ's queueing engine to guarantee job delivery and retry logic in case of network fluctuations.
* **Cloud Deployment:** Seamless architecture designed to deploy natively on Neon (PostgreSQL), Upstash (Redis), Render (Backend services), and Vercel (Frontend Next.js app).

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
   git clone https://github.com/Arjun8242/uptime-monitoring.git
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

* **Frontend:** Hosted on **Vercel** with Next.js edge runtime optimizations for static assets and API requests proxying.
* **Express API, Scheduler, and Worker:** Deployed on **Render** as Web Service (API) and Background Workers (Scheduler & Worker).
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
