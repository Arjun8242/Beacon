# Architecture — Distributed Uptime Monitoring Platform

**Version:** 1.0  
**Status:** Draft  
**Author:** Arjun Jaiswal  
**Last Updated:** 2025

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [System Components](#2-system-components)
3. [Service Responsibilities](#3-service-responsibilities)
4. [Monorepo Structure](#4-monorepo-structure)
5. [Request Flow](#5-request-flow)
6. [Monitoring Job Flow](#6-monitoring-job-flow)
7. [Scheduler Design](#7-scheduler-design)
8. [Queue Design](#8-queue-design)
9. [Worker Design](#9-worker-design)
10. [Incident Detection Flow](#10-incident-detection-flow)
11. [Retry Strategy](#11-retry-strategy)
12. [Database Design](#12-database-design)
13. [Redis Usage](#13-redis-usage)
14. [Scalability Considerations](#14-scalability-considerations)
15. [Failure Handling](#15-failure-handling)
16. [Docker Deployment Architecture](#16-docker-deployment-architecture)
17. [Local Development Architecture](#17-local-development-architecture)
18. [Security Considerations](#18-security-considerations)
19. [Observability Considerations](#19-observability-considerations)
20. [Future Scaling Strategy](#20-future-scaling-strategy)

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│                                                                 │
│   ┌──────────────────────────┐  ┌───────────────────────────┐  │
│   │     Next.js Dashboard    │  │   Public Status Page      │  │
│   │   (authenticated users)  │  │   /status/:slug           │  │
│   └──────────────┬───────────┘  └─────────────┬─────────────┘  │
└──────────────────┼───────────────────────────┼─────────────────┘
                   │ HTTPS                      │ HTTPS
┌──────────────────▼───────────────────────────▼─────────────────┐
│                      APPLICATION LAYER                          │
│                                                                 │
│              ┌─────────────────────────────┐                   │
│              │       Express API (apps/api) │                   │
│              │  Auth · Monitors · Metrics  │                   │
│              └──────┬──────────────────────┘                   │
└─────────────────────┼───────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌───────────────────────────────────────────────────────────────┐
│                    PROCESSING LAYER                           │
│                                                               │
│  ┌────────────────────┐      ┌──────────────────────────────┐│
│  │ Scheduler           │      │ Worker Pool                  ││
│  │ (apps/scheduler)    │─────▶│ (apps/worker)                ││
│  │ node-cron, 30s tick │      │ N stateless instances        ││
│  └────────────────────┘      └──────────────────────────────┘│
└───────────────────────────────────────────────────────────────┘
                      │                   │
                      ▼                   ▼
┌───────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                       │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                  │
│  │    PostgreSQL     │  │      Redis        │                  │
│  │  Persistent data  │  │  Queue · Cache   │                  │
│  └──────────────────┘  └──────────────────┘                  │
└───────────────────────────────────────────────────────────────┘
```

---

## 2. System Components

| Component | Technology | Role |
|---|---|---|
| `apps/web` | Next.js 14, TypeScript | Dashboard frontend, public status pages |
| `apps/api` | Node.js, Express, TypeScript | REST API — auth, monitor CRUD, metrics |
| `apps/scheduler` | Node.js, TypeScript, node-cron | Discovers due monitors, enqueues BullMQ jobs |
| `apps/worker` | Node.js, TypeScript, BullMQ | Executes HTTP checks, persists results, detects incidents |
| `packages/database` | Prisma, PostgreSQL | Shared ORM client and schema |
| `packages/queue` | BullMQ, Redis | Shared queue definitions, job types, producer/consumer base |
| `packages/shared` | TypeScript | Shared types, constants, utility functions |
| PostgreSQL | PostgreSQL 16 | Persistent storage — monitors, checks, incidents, users |
| Redis | Redis 7 | BullMQ job queue, failure counters, status cache |

---

## 3. Service Responsibilities

### 3.1 `apps/api` — Express REST API

**Responsibilities:**
- User registration and JWT-based authentication.
- Monitor CRUD: create, read, update, delete, pause, resume.
- Serving metrics endpoints: uptime stats, check history, latency buckets, incident history.
- Serving public status page data (unauthenticated).
- Input validation with Zod on all request bodies.
- All database writes scoped to authenticated user via Prisma.

**Does NOT:**
- Execute HTTP checks.
- Enqueue or consume BullMQ jobs.
- Run a cron schedule.

### 3.2 `apps/scheduler` — Scheduler Service

**Responsibilities:**
- Run a cron tick every 30 seconds.
- Query PostgreSQL for all active monitors where `nextCheckAt <= NOW()`.
- Enqueue one BullMQ job per due monitor into the `monitor-checks` queue.
- Update `monitor.nextCheckAt = NOW() + interval` after enqueueing.
- Handle Redis and PostgreSQL connection failures gracefully without crashing.

**Does NOT:**
- Execute HTTP checks.
- Read check results.
- Modify monitor status.

**Key Design Decision:** The scheduler is a standalone process (not part of the API) so it can be restarted, scaled, or replaced independently. In a production Kubernetes environment, it would run as a single replica with a leader-election lock. For V1, a single scheduler instance is sufficient.

### 3.3 `apps/worker` — Worker Service

**Responsibilities:**
- Consume jobs from the `monitor-checks` BullMQ queue (using `concurrency: N`, configurable).
- Execute HTTP GET to the monitor URL with a configurable timeout.
- Measure response time and capture HTTP status code.
- Determine check status: `UP | DEGRADED | DOWN`.
- Persist `Check` record to PostgreSQL.
- Update `monitor.status` and `monitor.lastCheckedAt` in PostgreSQL.
- Run incident detection logic.
- Update Redis status cache for the monitor.
- Acknowledge job completion to BullMQ.

**Does NOT:**
- Accept HTTP requests.
- Manage its own schedule.
- Send notifications directly (V1 has no notification service; queued for V2).

### 3.4 `packages/database`

- Exports the Prisma client singleton (`db`).
- Contains `schema.prisma`.
- Contains migration files.
- Both `apps/api` and `apps/worker` import `db` from this package — single Prisma client, no schema duplication.

### 3.5 `packages/queue`

- Exports BullMQ `Queue` and `Worker` constructors pre-configured with the Redis connection.
- Exports TypeScript job payload types (`MonitorCheckJob`).
- Exports queue names as constants.
- Ensures consistent queue configuration (job TTL, removal policies) across producer (scheduler) and consumer (worker).

### 3.6 `packages/shared`

- Shared TypeScript types: `Monitor`, `Check`, `Incident`, `MonitorStatus`, `CheckStatus`.
- Shared constants: `CHECK_STATUS`, `MONITOR_STATUS`, `DEFAULT_TIMEOUT`, `CONFIRM_DOWN_THRESHOLD`.
- Shared utility functions: `calculateUptimePercent`, `getWindowStart`, `slugify`.
- No runtime dependencies on database or queue — pure TypeScript.

---

## 4. Monorepo Structure

```
uptime-monitor/
│
├── apps/
│   ├── api/                          ← Express REST API
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── monitors.ts
│   │   │   │   ├── metrics.ts
│   │   │   │   └── status.ts
│   │   │   ├── middlewares/
│   │   │   │   ├── authenticate.ts   ← JWT verification
│   │   │   │   ├── validate.ts       ← Zod schema validation
│   │   │   │   └── errorHandler.ts   ← global error handler
│   │   │   ├── services/
│   │   │   │   ├── monitorService.ts ← business logic, no HTTP concerns
│   │   │   │   ├── metricsService.ts ← uptime calc, latency buckets
│   │   │   │   └── authService.ts    ← bcrypt, JWT sign/verify
│   │   │   ├── config/
│   │   │   │   └── env.ts            ← validated env vars (zod)
│   │   │   └── index.ts              ← Express app + server start
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── scheduler/                    ← Scheduler service
│   │   ├── src/
│   │   │   ├── scheduler.ts          ← node-cron tick, query, enqueue
│   │   │   ├── config/
│   │   │   │   └── env.ts
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── worker/                       ← Worker service
│   │   ├── src/
│   │   │   ├── worker.ts             ← BullMQ Worker setup
│   │   │   ├── processor/
│   │   │   │   ├── checkRunner.ts    ← HTTP fetch, response time
│   │   │   │   ├── resultPersist.ts  ← write Check record
│   │   │   │   └── incidentDetect.ts ← open/resolve incident logic
│   │   │   ├── cache/
│   │   │   │   ├── failureCounter.ts ← Redis incr/reset/get
│   │   │   │   └── statusCache.ts    ← Redis get/set monitor status
│   │   │   ├── config/
│   │   │   │   └── env.ts
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                          ← Next.js frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── (dashboard)/
│       │   │   │   ├── layout.tsx
│       │   │   │   ├── page.tsx      ← monitor list
│       │   │   │   └── monitors/
│       │   │   │       └── [id]/
│       │   │   │           └── page.tsx ← monitor detail
│       │   │   ├── status/
│       │   │   │   └── [slug]/
│       │   │   │       └── page.tsx  ← public status page
│       │   │   └── auth/
│       │   │       ├── login/page.tsx
│       │   │       └── register/page.tsx
│       │   ├── components/
│       │   │   ├── monitors/
│       │   │   │   ├── MonitorCard.tsx
│       │   │   │   ├── MonitorForm.tsx
│       │   │   │   ├── StatusBadge.tsx
│       │   │   │   └── LatencyChart.tsx
│       │   │   └── incidents/
│       │   │       └── IncidentList.tsx
│       │   ├── hooks/
│       │   │   └── useMonitors.ts    ← SWR data fetching
│       │   └── lib/
│       │       └── api.ts            ← typed fetch client
│       ├── Dockerfile
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── database/                     ← Prisma client + schema
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   └── client.ts             ← export { db } from '@prisma/client'
│   │   └── package.json
│   │
│   ├── queue/                        ← BullMQ shared setup
│   │   ├── src/
│   │   │   ├── queues.ts             ← queue name constants
│   │   │   ├── connection.ts         ← Redis connection for BullMQ
│   │   │   ├── producer.ts           ← addJob helper
│   │   │   └── types.ts              ← MonitorCheckJob type
│   │   └── package.json
│   │
│   └── shared/                       ← types, constants, utils
│       ├── src/
│       │   ├── types/
│       │   │   ├── monitor.ts
│       │   │   ├── check.ts
│       │   │   └── incident.ts
│       │   ├── constants.ts
│       │   └── utils/
│       │       ├── uptime.ts
│       │       └── time.ts
│       └── package.json
│
├── docs/
│   ├── PRD.md
│   └── architecture.md
│
├── docker-compose.yml                ← production-like compose
├── docker-compose.dev.yml            ← dev overrides (hot reload)
├── .env.example
├── turbo.json                        ← Turborepo pipeline config
├── pnpm-workspace.yaml
└── package.json                      ← workspace root
```

### Turborepo Pipeline (`turbo.json`)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {
      "dependsOn": ["^build"]
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

---

## 5. Request Flow

### Authenticated API Request (e.g. GET /monitors)

```
Browser
  │
  │  GET /api/v1/monitors
  │  Authorization: Bearer <jwt>
  │
  ▼
Express API (apps/api)
  │
  ├── authenticate middleware
  │     └── verify JWT → extract userId
  │
  ├── monitorRoutes handler
  │     └── monitorService.listByUser(userId)
  │           └── db.monitor.findMany({ where: { userId } })
  │                 └── PostgreSQL query
  │
  └── JSON response
        { success: true, data: [ ...monitors ] }
  │
  ▼
Browser renders dashboard
```

### Monitor Creation Flow

```
POST /api/v1/monitors
Body: { name, url, interval }
  │
  ▼
validate middleware (Zod)
  └── URL format check
  └── interval whitelist check (30,60,120,300,600)
  │
  ▼
monitorService.create(userId, data)
  └── db.monitor.create({
        userId,
        name,
        url,
        interval,
        slug: slugify(name) + randomSuffix,
        nextCheckAt: NOW(),        ← eligible for immediate first check
        status: 'PENDING'
      })
  │
  ▼
Return created monitor
```

---

## 6. Monitoring Job Flow

```
┌─────────────────┐       enqueue job        ┌──────────────────┐
│   Scheduler      │ ─────────────────────▶  │  BullMQ Queue    │
│  (every 30s)    │                          │  (Redis-backed)  │
└─────────────────┘                          └────────┬─────────┘
                                                      │
                                             job available
                                                      │
                                                      ▼
                                             ┌──────────────────┐
                                             │   Worker Pool    │
                                             │  (N instances)   │
                                             └────────┬─────────┘
                                                      │
                              ┌───────────────────────┼──────────────────────┐
                              │                       │                      │
                              ▼                       ▼                      ▼
                     HTTP GET to URL         Persist Check            Incident Detection
                     (with timeout)          to PostgreSQL            (Redis counters)
                              │                       │                      │
                              └───────────────────────┴──────────────────────┘
                                                      │
                                             Update monitor.status
                                             Update monitor.lastCheckedAt
                                             Update Redis status cache
                                                      │
                                             ACK job to BullMQ
```

### Job Payload Type

```typescript
// packages/queue/src/types.ts
export interface MonitorCheckJob {
  monitorId: string
  url: string
  timeoutMs: number          // default: 10000
  confirmDownThreshold: number  // default: 3
}
```

---

## 7. Scheduler Design

### Core Tick Logic

```typescript
// apps/scheduler/src/scheduler.ts

import cron from 'node-cron'
import { db } from '@uptime/database'
import { addCheckJob } from '@uptime/queue'

cron.schedule('*/30 * * * * *', async () => {
  const now = new Date()

  const dueMonitors = await db.monitor.findMany({
    where: {
      active: true,
      nextCheckAt: { lte: now }
    },
    select: {
      id: true,
      url: true,
      interval: true
    }
  })

  for (const monitor of dueMonitors) {
    await addCheckJob({
      monitorId: monitor.id,
      url: monitor.url,
      timeoutMs: 10_000,
      confirmDownThreshold: 3
    })

    await db.monitor.update({
      where: { id: monitor.id },
      data: {
        nextCheckAt: new Date(now.getTime() + monitor.interval * 1000)
      }
    })
  }
})
```

### Why `nextCheckAt` Instead of Cron Per Monitor?

Storing `nextCheckAt` in PostgreSQL means:

1. The scheduler is stateless — it can restart without losing schedule state.
2. Multiple scheduler instances (future) would need a distributed lock to avoid duplicate jobs; `nextCheckAt` combined with a Postgres `SELECT FOR UPDATE SKIP LOCKED` solves this natively.
3. No in-memory schedule map that disappears on restart.

### Duplicate Job Prevention

BullMQ jobs are enqueued with `jobId: monitor.id`:

```typescript
await queue.add('check', payload, {
  jobId: monitor.id,   // BullMQ deduplicates active/waiting jobs by jobId
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
})
```

If the scheduler ticks twice before the worker finishes a job (e.g. on restart), BullMQ will not enqueue a duplicate because a job with that `jobId` is already active.

---

## 8. Queue Design

### Queue Architecture

```
packages/queue/
  ├── connection.ts    ← single Redis IORedis connection for BullMQ
  ├── queues.ts        ← QUEUE_NAMES constant
  ├── producer.ts      ← addCheckJob() function
  └── types.ts         ← MonitorCheckJob interface
```

### Queue Configuration

```typescript
// packages/queue/src/connection.ts
import { Redis } from 'ioredis'

export const redisConnection = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  maxRetriesPerRequest: null  // required by BullMQ
})
```

```typescript
// packages/queue/src/queues.ts
export const QUEUE_NAMES = {
  MONITOR_CHECKS: 'monitor-checks'
} as const
```

```typescript
// packages/queue/src/producer.ts
import { Queue } from 'bullmq'
import { redisConnection } from './connection'
import { QUEUE_NAMES } from './queues'
import type { MonitorCheckJob } from './types'

const checkQueue = new Queue(QUEUE_NAMES.MONITOR_CHECKS, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },  // keep last 100 completed jobs
    removeOnFail: { count: 50 }        // keep last 50 failed jobs
  }
})

export async function addCheckJob(payload: MonitorCheckJob): Promise<void> {
  await checkQueue.add('check', payload, {
    jobId: payload.monitorId
  })
}
```

### BullMQ Job Lifecycle

```
          addJob()
             │
     ┌───────▼────────┐
     │    WAITING     │  ← job is in queue, no worker has picked it up
     └───────┬────────┘
             │  worker picks up
     ┌───────▼────────┐
     │     ACTIVE     │  ← worker is processing the job
     └───┬────────────┘
         │            │
   success          failure
         │            │
┌────────▼──┐   ┌─────▼──────┐
│ COMPLETED │   │  FAILED    │  ← if attempts exhausted
└───────────┘   │ (retrying) │  ← if attempts remaining → back to WAITING
                └────────────┘
```

---

## 9. Worker Design

### Worker Entry Point

```typescript
// apps/worker/src/worker.ts
import { Worker } from 'bullmq'
import { redisConnection, QUEUE_NAMES } from '@uptime/queue'
import { processCheckJob } from './processor/checkRunner'

const worker = new Worker(
  QUEUE_NAMES.MONITOR_CHECKS,
  processCheckJob,
  {
    connection: redisConnection,
    concurrency: Number(process.env.WORKER_CONCURRENCY) || 5
  }
)

worker.on('failed', (job, err) => {
  console.error({ jobId: job?.id, error: err.message }, 'Job failed')
})
```

### Check Processor

```typescript
// apps/worker/src/processor/checkRunner.ts
import { Job } from 'bullmq'
import type { MonitorCheckJob } from '@uptime/queue'
import { db } from '@uptime/database'
import { determineStatus } from '@uptime/shared'
import { persistResult } from './resultPersist'
import { runIncidentDetection } from './incidentDetect'

export async function processCheckJob(job: Job<MonitorCheckJob>) {
  const { monitorId, url, timeoutMs } = job.data
  const startTime = Date.now()

  let statusCode: number | null = null
  let error: string | null = null
  let responseTime: number | null = null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    statusCode = response.status
    responseTime = Date.now() - startTime
  } catch (err: any) {
    responseTime = Date.now() - startTime
    error = err.name === 'AbortError' ? 'Request timeout' : err.message
  }

  const checkStatus = determineStatus(statusCode, error)

  await persistResult({ monitorId, checkStatus, statusCode, responseTime, error })
  await runIncidentDetection({ monitorId, checkStatus })

  await db.monitor.update({
    where: { id: monitorId },
    data: { status: checkStatus, lastCheckedAt: new Date() }
  })
}
```

### Status Determination Logic

```typescript
// packages/shared/src/utils/check.ts
export function determineStatus(
  statusCode: number | null,
  error: string | null
): 'UP' | 'DEGRADED' | 'DOWN' {
  if (error !== null) return 'DOWN'
  if (statusCode === null) return 'DOWN'
  if (statusCode >= 200 && statusCode < 300) return 'UP'
  return 'DEGRADED'
}
```

### Concurrency Model

```
Worker process (apps/worker)
│
├── BullMQ Worker (concurrency: 5)
│   ├── Processor slot 1 → checking monitor A
│   ├── Processor slot 2 → checking monitor B
│   ├── Processor slot 3 → checking monitor C
│   ├── Processor slot 4 → checking monitor D
│   └── Processor slot 5 → checking monitor E
│
└── Each slot is an independent async function
    (Node.js event loop handles I/O concurrently)
```

Multiple worker Docker containers can run simultaneously. BullMQ handles distribution — each job is processed by exactly one worker.

---

## 10. Incident Detection Flow

```
Worker finishes check → checkStatus = UP | DEGRADED | DOWN
         │
         ▼
runIncidentDetection({ monitorId, checkStatus })
         │
    ┌────▼────┐
    │ UP?     │─── Yes ──▶ openIncident = false
    └────┬────┘           failureCounter = 0 (Redis DEL)
         │ No             resolve open incident if exists
         ▼
  increment Redis failure counter
  key: `failures:${monitorId}`
  TTL: 10 minutes (auto-expires if monitor stops checking)
         │
         ▼
    ┌────▼────────────────────────┐
    │ counter >= threshold (3)?   │─── No ──▶ do nothing, wait for next check
    └────┬────────────────────────┘
         │ Yes
         ▼
  check for open incident
  db.incident.findFirst({ where: { monitorId, resolvedAt: null } })
         │
    ┌────▼───────────────┐
    │ open incident       │─── Yes ──▶ already have one, skip creation
    │ already exists?     │
    └────┬───────────────┘
         │ No
         ▼
  db.incident.create({ monitorId, startedAt: now })
  Redis DEL `failures:${monitorId}`
```

### Incident Resolution

```typescript
// apps/worker/src/processor/incidentDetect.ts (resolve path)

if (checkStatus === 'UP') {
  await redis.del(`failures:${monitorId}`)

  const openIncident = await db.incident.findFirst({
    where: { monitorId, resolvedAt: null }
  })

  if (openIncident) {
    const now = new Date()
    const durationSeconds = Math.floor(
      (now.getTime() - openIncident.startedAt.getTime()) / 1000
    )

    await db.incident.update({
      where: { id: openIncident.id },
      data: { resolvedAt: now, duration: durationSeconds }
    })
  }
}
```

---

## 11. Retry Strategy

### Retry Philosophy

Monitoring reliability and job reliability are treated as separate concerns.

Monitoring failures are determined by scheduled checks over time.

Example:

Check #1 -> DOWN
Check #2 -> DOWN
Check #3 -> DOWN

This represents three consecutive monitoring failures and may open an incident.

BullMQ retries are NOT used to determine service health.

BullMQ retries exist only to recover from infrastructure failures such as:

- Worker crash
- Redis connectivity issue
- Database write failure
- Unexpected application exception

A monitor check itself executes exactly one HTTP request.

The result of that request is persisted immediately and contributes to incident detection.

### BullMQ Retry Usage

BullMQ retries only occur when the monitoring job itself cannot complete due to infrastructure problems.

Examples:

- PostgreSQL unavailable while persisting result
- Worker process crashes
- Unhandled exception during execution

Configuration:

attempts: 3

backoff:
  type: exponential
  delay: 2000



### Exponential Backoff with Jitter

BullMQ `exponential` backoff uses: `delay × 2^(attemptNumber - 1)`.

With base delay = 2000ms:
- Attempt 2: ~2s
- Attempt 3: ~4s

Jitter is inherent because BullMQ processes jobs from a queue, not on a guaranteed timer — queue processing delay adds natural jitter.

### Why BullMQ Retry Instead of Application-Level Retry?

| Approach | Pros | Cons |
|---|---|---|
| Application-level (retry in same execution) | Simple to implement | Holds the worker concurrency slot during backoff |
| BullMQ job-level retry | Worker slot freed immediately; backoff is durable across restarts | Slightly more complex to reason about |

BullMQ retry is the correct choice because it does not block the worker from processing other jobs during the backoff window.

---

## 12. Database Design

### Entity Relationship Overview

```
User ──< Monitor ──< Check
              │
              └──< Incident
```

### Prisma Schema

```prisma
// packages/database/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum MonitorStatus {
  PENDING
  UP
  DOWN
  DEGRADED
  PAUSED
}

enum CheckStatus {
  UP
  DOWN
  DEGRADED
}

model User {
  id        String    @id @default(cuid())
  email     String    @unique
  password  String
  monitors  Monitor[]
  createdAt DateTime  @default(now())

  @@map("users")
}

model Monitor {
  id            String     @id @default(cuid())
  userId        String
  user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  name          String
  url           String
  interval      Int        @default(60)
  active        Boolean    @default(true)
  status        MonitorStatus     @default(PENDING)
  slug          String     @unique
  lastCheckedAt DateTime?
  nextCheckAt   DateTime   @default(now())
  checks        Check[]
  incidents     Incident[]
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  @@index([active, nextCheckAt])   ← scheduler query index
  @@index([userId])
  @@index([userId, createdAt])
  @@map("monitors")
}

model Check {
  id           String   @id @default(cuid())
  monitorId    String
  monitor      Monitor  @relation(fields: [monitorId], references: [id], onDelete: Cascade)
  status       CheckStatus
  responseTime Int?
  statusCode   Int?
  error        String?
  checkedAt    DateTime @default(now())

  @@index([monitorId, checkedAt])  ← metrics query index (critical)
  @@map("checks")
}

model Incident {
  id          String    @id @default(cuid())
  monitorId   String
  monitor     Monitor   @relation(fields: [monitorId], references: [id], onDelete: Cascade)
  startedAt   DateTime  @default(now())
  resolvedAt  DateTime?
  duration    Int?

  @@index([monitorId, startedAt])
  @@map("incidents")
}
```

### Index Rationale

| Index | Query it serves |
|---|---|
| `monitors(active, nextCheckAt)` | Scheduler: `WHERE active=true AND nextCheckAt <= NOW()` |
| `checks(monitorId, checkedAt)` | Metrics: `WHERE monitorId=X AND checkedAt >= window_start` — used on every dashboard load |
| `incidents(monitorId, startedAt)` | Incident history sorted by time |

The `checks(monitorId, checkedAt)` composite index is the most important one. Without it, uptime percentage calculations and latency chart queries become full table scans as check history grows.

---

## 13. Redis Usage

Redis serves two distinct purposes. They share one Redis instance in V1 but use separate key namespaces.

### Purpose 1 — BullMQ Job Queue

BullMQ manages its own key namespace (`bull:*`). No manual interaction required. The BullMQ `Queue` and `Worker` classes handle all Redis operations for job persistence, locking, and state transitions.

### Purpose 2 — Application State

| Key Pattern | Type | TTL | Value | Purpose |
|---|---|---|---|---|
| `failures:{monitorId}` | String (integer) | 10 minutes | Consecutive failure count | Confirm-down threshold tracking |
| `status:{monitorId}` | String | 2 minutes | `UP \| DOWN \| DEGRADED \| PENDING` | Dashboard status cache (avoid DB query per card) |

### Redis Operation Examples

```typescript
// apps/worker/src/cache/failureCounter.ts

export async function incrementFailure(monitorId: string): Promise<number> {
  const key = `failures:${monitorId}`
  const count = await redis.incr(key)
  await redis.expire(key, 600)  // reset TTL on each failure
  return count
}

export async function resetFailure(monitorId: string): Promise<void> {
  await redis.del(`failures:${monitorId}`)
}

export async function getFailureCount(monitorId: string): Promise<number> {
  const val = await redis.get(`failures:${monitorId}`)
  return val ? parseInt(val, 10) : 0
}
```

```typescript
// apps/worker/src/cache/statusCache.ts

export async function setMonitorStatus(
  monitorId: string,
  status: string
): Promise<void> {
  await redis.setex(`status:${monitorId}`, 120, status)
}
```

### Why Redis for Failure Counters Instead of PostgreSQL?

| Approach | Read/Write overhead | Survives restart | Correct for V1? |
|---|---|---|---|
| Redis `INCR` | O(1), in-memory | No (counter resets) | Yes |
| PostgreSQL column | Disk write per check | Yes | Overkill for V1 |

Resetting counters on Redis restart is acceptable in V1: at worst, a monitor that was at 2/3 failures resets to 0, delaying an incident by one check cycle. For V2, persist failure state to PostgreSQL.

---

## 14. Scalability Considerations

### Horizontal Worker Scaling

```
Redis (BullMQ queue)
      │
      ├── Worker instance 1 (concurrency: 5)  → 5 concurrent checks
      ├── Worker instance 2 (concurrency: 5)  → 5 concurrent checks
      └── Worker instance 3 (concurrency: 5)  → 5 concurrent checks
                                                 15 total concurrent checks
```

Adding a worker container requires no code change. BullMQ distributes jobs automatically using Redis-backed distributed locking (each job is locked to one worker during processing).

### Check Throughput Calculation

```
checks_per_minute = worker_instances × concurrency × (60 / avg_check_duration_seconds)

Example: 2 workers × 5 concurrency × (60 / 2s avg) = 300 checks/minute

For 1000 monitors all checking at 60s interval:
Required throughput = 1000 checks/minute
Required: 7 workers × 5 concurrency (assuming 2s avg check duration)
```

### Scheduler Scaling

The scheduler is intentionally a single-instance service in V1. It does not execute checks — it only enqueues jobs. A single scheduler can enqueue thousands of jobs per tick without becoming a bottleneck.

For V2 multi-scheduler support: use `SELECT FOR UPDATE SKIP LOCKED` on the monitors table to allow multiple scheduler instances without duplicate job enqueuing.

### Database Scaling

For V1 (single PostgreSQL instance), the critical optimization is the composite index on `checks(monitorId, checkedAt)`. As check volume grows:

- Partition `checks` table by `checkedAt` month (V2).
- Move check history older than 30 days to cold storage (V2).
- Add read replica for dashboard metric queries (V2).

---

## 15. Failure Handling

### Scenario Matrix

| Failure | Impact | Handling |
|---|---|---|
| Worker crashes during job processing | Job remains ACTIVE in BullMQ until lock expires (~30s), then returns to WAITING and is reprocessed | BullMQ stall detection; no action needed |
| Scheduler crashes | No new jobs enqueued until restart; missed checks do not create data loss since `nextCheckAt` is in PostgreSQL | Restart scheduler; it self-corrects on next tick |
| PostgreSQL unavailable | API returns 503; worker cannot persist results; scheduler cannot query due monitors | Services emit errors and retry connections; jobs accumulate in Redis queue until DB recovers |
| Redis unavailable | BullMQ cannot enqueue or consume; failure counters unavailable | Scheduler and worker log errors; no checks execute until Redis recovers |
| Monitor URL is unreachable | Worker records `status: DOWN`, `error: 'Request timeout'` | Normal check result; incident detection proceeds |
| Worker job exhausts all retries | Job moves to FAILED state | Final result persisted; incident detection runs on final status |
| Duplicate scheduler tick | Scheduler enqueues job with `jobId: monitorId`; BullMQ deduplicates | No action needed |

### Graceful Shutdown

All services implement graceful shutdown on `SIGTERM` (Docker stop signal):

```typescript
process.on('SIGTERM', async () => {
  await worker.close()        // finish active jobs, reject new ones
  await redisConnection.quit()
  await db.$disconnect()
  process.exit(0)
})
```

BullMQ `worker.close()` waits for in-progress jobs to complete before closing, preventing partial result writes.

---

## 16. Docker Deployment Architecture

### Service Topology

```
docker-compose.yml
│
├── postgres          (postgres:16-alpine)
│     port: 5432
│     volume: postgres_data
│
├── redis             (redis:7-alpine)
│     port: 6379
│
├── api               (apps/api Dockerfile)
│     port: 4000
│     depends_on: postgres, redis
│     env: DATABASE_URL, REDIS_URL, JWT_SECRET
│
├── scheduler         (apps/scheduler Dockerfile)
│     no exposed port
│     depends_on: postgres, redis, api
│     env: DATABASE_URL, REDIS_URL
│
└── worker            (apps/worker Dockerfile)
      no exposed port
      depends_on: postgres, redis
      env: DATABASE_URL, REDIS_URL, WORKER_CONCURRENCY
      scale: 2         ← run 2 worker replicas by default
```

### `docker-compose.yml`

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: uptime
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d uptime"]
      interval: 10s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      retries: 5

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    env_file: apps/api/.env
    ports:
      - "4000:4000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  scheduler:
    build:
      context: .
      dockerfile: apps/scheduler/Dockerfile
    env_file: apps/scheduler/.env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    env_file: apps/worker/.env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      replicas: 2

volumes:
  postgres_data:
```

### Dockerfile Pattern (all services)

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS base
RUN npm install -g pnpm turbo

FROM base AS builder
WORKDIR /app
COPY pnpm-workspace.yaml package.json turbo.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=api...

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

---

## 17. Local Development Architecture

### Dev Compose Override

```yaml
# docker-compose.dev.yml
services:
  api:
    volumes:
      - ./apps/api/src:/app/apps/api/src   ← hot reload
    command: pnpm dev
    environment:
      NODE_ENV: development

  scheduler:
    volumes:
      - ./apps/scheduler/src:/app/apps/scheduler/src
    command: pnpm dev

  worker:
    volumes:
      - ./apps/worker/src:/app/apps/worker/src
    command: pnpm dev
```

### Running Locally

```bash
# 1. Copy environment files
cp .env.example .env

# 2. Start infrastructure only (postgres + redis)
docker compose up postgres redis -d

# 3. Run database migrations
pnpm --filter database db:migrate

# 4. Start all services in dev mode (hot reload)
pnpm dev     # runs turbo dev across all apps

# OR start everything with Docker
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Useful Local URLs

| Service | URL |
|---|---|
| Next.js dashboard | http://localhost:3000 |
| Express API | http://localhost:4000 |
| RabbitMQ management UI | N/A (BullMQ uses Redis; no management UI in V1) |
| BullMQ Board (optional) | http://localhost:4000/queues (add `@bull-board/express`) |

---

## 18. Security Considerations

| Area | Implementation |
|---|---|
| Password hashing | bcrypt with cost factor 12 |
| JWT signing | HS256, signed with `JWT_SECRET` env var (minimum 32 chars) |
| JWT expiry | 24 hours |
| Data scoping | All monitor queries include `userId` filter — users cannot access other users' data |
| Input validation | Zod schemas on all request bodies; URL validated as valid HTTP/HTTPS before persistence |
| SQL injection | Prisma parameterised queries — no raw SQL in V1 |
| Sensitive data in logs | No passwords, JWTs, or full URLs logged |
| Monitor URL execution | Worker executes HTTP GET only; no redirect following to internal IPs (add SSRF protection in V2) |
| CORS | API configured to accept requests only from `ALLOWED_ORIGIN` env var |
| Rate limiting | Not implemented in V1; add `express-rate-limit` in V2 |
| Environment secrets | All secrets in `.env` files; `.env` in `.gitignore`; `.env.example` committed with placeholder values |

### V2 Security Additions (noted, not implemented)

- SSRF protection: block monitor URLs resolving to private IP ranges (10.x, 172.16.x, 192.168.x, localhost).
- Rate limiting on auth and monitor creation endpoints.
- Refresh token rotation.
- Audit log for monitor changes.

---

## 19. Observability Considerations

### Structured Logging

All services use `pino` for structured JSON logging:

```typescript
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: process.env.SERVICE_NAME  // 'api' | 'scheduler' | 'worker'
  }
})
```

Every check result is logged:

```json
{
  "level": "info",
  "service": "worker",
  "monitorId": "clx1234",
  "url": "https://api.myapp.com/health",
  "status": "UP",
  "responseTime": 243,
  "statusCode": 200,
  "time": "2025-01-15T10:00:01.234Z"
}
```

### Metrics (V1 — application level only)

No Prometheus/Grafana in V1. Observability comes from:

- Structured logs parseable by any log aggregator.
- BullMQ job failure events logged with `job.id` and error.
- PostgreSQL check history queryable directly.

### BullMQ Board (recommended addition)

Add `@bull-board/express` to the API for a visual queue inspector:

```typescript
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'

const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/queues')

createBullBoard({
  queues: [new BullMQAdapter(checkQueue)],
  serverAdapter
})

app.use('/queues', serverAdapter.getRouter())
```

This gives a live view of waiting, active, completed, and failed jobs — useful for demonstrating the queue in an interview.

---

## 20. Future Scaling Strategy

### From V1 (Single Server) to V2 (Multi-Instance)

```
V1 Architecture (Docker Compose, single server)
┌──────────────────────────────────────────────┐
│  1× API   1× Scheduler   2× Worker          │
│  1× PostgreSQL   1× Redis                   │
└──────────────────────────────────────────────┘

↓ Scale to: 10k monitors, 50 users

V2 Architecture (multi-instance, managed services)
┌──────────────────────────────────────────────┐
│  Nginx load balancer                         │
│  3× API instances                            │
│  1× Scheduler (+ leader election via Redis) │
│  5× Worker instances                         │
│  RDS PostgreSQL (managed, with read replica) │
│  ElastiCache Redis (managed)                 │
│  S3 for check result archival                │
└──────────────────────────────────────────────┘
```

### Scheduler Leader Election (V2)

When running multiple scheduler instances, only one should enqueue jobs to prevent duplicates. Redis-based leader election:

```typescript
const isLeader = await redis.set(
  'scheduler:leader',
  instanceId,
  'EX', 60,    // TTL: 60 seconds
  'NX'         // only set if not exists
)

if (isLeader) {
  // run the tick
  await redis.expire('scheduler:leader', 60)  // refresh TTL
}
```

### Check History Partitioning (V2)

As checks accumulate (1 monitor × 1 check/min × 30 days = 43,200 rows per monitor), the `checks` table grows large. PostgreSQL range partitioning by month:

```sql
CREATE TABLE checks (
  id text, monitor_id text, checked_at timestamptz, ...
) PARTITION BY RANGE (checked_at);

CREATE TABLE checks_2025_01 PARTITION OF checks
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### Notification Service (V2)

V2 adds a dedicated notification service consuming from an `alert-notifications` BullMQ queue:

```
Worker detects status change
         │
         ▼
Publish to alert-notifications queue
{ monitorId, userId, prevStatus, newStatus }
         │
         ▼
Notification service consumer
  ├── Check alert cooldown in Redis
  ├── Fetch user alert preferences
  └── Send: Email | Slack | Webhook
        with retry and dead-letter queue
```

This keeps the worker fast (fire-and-forget) and the notification logic independently deployable and scalable.
