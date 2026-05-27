# Database Design — Distributed Uptime Monitoring Platform

**Version:** 1.0  
**Status:** Draft  
**Author:** Arjun Jaiswal  
**Last Updated:** 2026  

---

## Table of Contents

1. [Overview](#1-overview)
2. [Design Principles](#2-design-principles)
3. [Entity Relationship Diagram](#3-entity-relationship-diagram)
4. [Enums](#4-enums)
5. [Entity Specifications](#5-entity-specifications)
6. [Constraints](#6-constraints)
7. [Index Strategy](#7-index-strategy)
8. [Query Patterns](#8-query-patterns)
9. [Cascade Behaviour](#9-cascade-behaviour)
10. [Future Expansion](#10-future-expansion)
11. [Prisma Mapping Notes](#11-prisma-mapping-notes)

---

## 1. Overview

The database is the single source of truth for the Distributed Uptime Monitoring Platform. It persists four categories of data that are produced and consumed across three separate services — the Express API, the Scheduler, and the Worker.

**What the database stores:**

- **User accounts** — credentials and identity for authenticated access to the platform.
- **Monitor configurations** — the user-defined set of HTTP/HTTPS endpoints to check, along with their intervals, current operational status, and scheduling metadata.
- **Check records** — an immutable, append-only history of every HTTP probe result ever executed: status, HTTP status code, response time, and any error.
- **Incident records** — structured outage events that are opened automatically when consecutive failures exceed a threshold, and resolved automatically when the endpoint recovers.

**Who reads and writes the database:**

| Service | Reads | Writes |
|---|---|---|
| `apps/api` | Monitors, Checks, Incidents (for dashboard and metrics endpoints) | Users (registration), Monitors (CRUD) |
| `apps/scheduler` | Monitors (`active=true AND nextCheckAt <= NOW()`) | Monitors (`nextCheckAt` update after enqueue) |
| `apps/worker` | Monitors (by ID), Incidents (open incident lookup) | Checks (append), Monitors (`status`, `lastCheckedAt`), Incidents (create, resolve) |

The database technology is **PostgreSQL 16**, accessed exclusively through the **Prisma ORM** via the shared `packages/database` package. No service issues raw SQL; all queries are parameterised through Prisma, which eliminates SQL injection risk and provides type-safe query construction across the monorepo.

---

## 2. Design Principles

### Normalization

Schema follows 3NF principles.
Each entity represents a single business concept.

### Auditability

Checks are immutable and append-only.
Incidents preserve outage history.

### Consistency

Foreign keys and unique constraints enforce integrity.

### Scalability

Indexes support scheduler queries and historical metrics queries.

## 3. Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA                         │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐          ┌──────────────────────────────────────┐
│    users     │          │              monitors                │
├──────────────┤          ├──────────────────────────────────────┤
│ PK id        │──── 1 ───│ PK id                                │
│    email     │          │ FK userId  ──────────────────────────│
│    username  │          │    name                              │
│    password  │          │    url                               │
│    createdAt │          │    slug (UNIQUE)                     │
│    updatedAt │          │    interval                          │
└──────────────┘          │    active                            │
                          │    status (MonitorStatus)            │
                          │    nextCheckAt                       │
                          │    lastCheckedAt                     │
                          │    createdAt                         │
                          │    updatedAt                         │
                          └───────────────┬──────────────────────┘
                                          │
                            ┌─────────────┴──────────────┐
                            │ 1                          │ 1
                            │ N                          │ N
               ┌────────────▼──────────┐   ┌────────────▼──────────┐
               │        checks         │   │       incidents        │
               ├───────────────────────┤   ├───────────────────────┤
               │ PK id                 │   │ PK id                 │
               │ FK monitorId          │   │ FK monitorId          │
               │    status (CheckStat) │   │    startedAt          │
               │    statusCode         │   │    resolvedAt         │
               │    responseTime       │   │    durationSeconds    │
               │    error              │   └───────────────────────┘
               │    checkedAt          │
               └───────────────────────┘
```

### Cardinality Summary

| Relationship | Type | Description |
|---|---|---|
| `User` → `Monitor` | One-to-Many | A user owns zero or more monitors; each monitor belongs to exactly one user |
| `Monitor` → `Check` | One-to-Many | A monitor has zero or more check records; each check belongs to exactly one monitor |
| `Monitor` → `Incident` | One-to-Many | A monitor has zero or more incident records; each incident belongs to exactly one monitor |

---

## 4. Enums

### 4.1 `MonitorStatus`

Represents the current operational state of a monitor. This value is maintained by the worker after each check execution and stored on the `Monitor` entity for fast dashboard reads without aggregating check history.

| Value | Description | Transitions From | Transitions To |
|---|---|---|---|
| `PENDING` | Monitor has been created but has not been checked yet. Default state on creation. | — | `UP`, `DOWN`, `DEGRADED` |
| `UP` | The most recent check returned a 2xx HTTP response within the timeout window. | `PENDING`, `DOWN`, `DEGRADED` | `DOWN`, `DEGRADED` |
| `DOWN` | The most recent check timed out or encountered a connection error (no HTTP response received). | `PENDING`, `UP`, `DEGRADED` | `UP`, `DEGRADED` |
| `DEGRADED` | The most recent check returned a non-2xx HTTP response (e.g., 4xx, 5xx) within the timeout window. | `PENDING`, `UP`, `DOWN` | `UP`, `DOWN` |
| `PAUSED` | The monitor has been paused by the user. The scheduler skips paused monitors. No checks are executed. | `UP`, `DOWN`, `DEGRADED`, `PENDING` | `UP`, `DOWN`, `DEGRADED`, `PENDING` (on resume) |

**Design note:** `MonitorStatus` encodes the *most recent observed state* — not an aggregate. It is a denormalised read cache of the last check result. The canonical check history is in the `checks` table.

### 4.2 `CheckStatus`

Represents the outcome of a single probe execution. This enum is narrower than `MonitorStatus` — it excludes `PENDING` (which is a monitor lifecycle state, not a check result) and `PAUSED` (which means no check was executed).

| Value | Condition | HTTP Status Code | Error |
|---|---|---|---|
| `UP` | Request succeeded with a 2xx response within the configured timeout | 200–299 | null |
| `DEGRADED` | Request received a non-2xx HTTP response | ≥ 300 or < 200 | null |
| `DOWN` | Request timed out, DNS resolution failed, or connection was refused | null | Non-null (e.g., `"Request timeout"`, `"ECONNREFUSED"`) |

**Design note:** `CheckStatus` is determined by the `determineStatus(statusCode, error)` function in `packages/shared`. This function is the single authoritative source of status classification and is independently unit-testable without database or queue dependencies.

---

## 5. Entity Specifications

### 5.1 `User`

#### Purpose

Represents a registered account on the platform. Users are the top-level ownership boundary — every monitor belongs to exactly one user, and all API operations are scoped to the authenticated user's identity.

#### Business Role

- Provides identity and authentication context.
- Serves as the root ownership node for the entire monitor hierarchy.
- Enables multi-tenancy: two users' monitors, checks, and incidents are completely isolated from each other at the query layer.

#### Field Definitions

| Field | Data Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `String` (CUID) | No | `cuid()` | Primary key. Globally unique, lexicographically sortable identifier generated by the CUID algorithm. |
| `email` | `String` | No | — | The user's email address. Used as the login identifier. Must be unique across all users. |
| `username` | `String` | No | — | A display name for the user. Shown in the dashboard UI. Does not need to be unique in V1 but carries a unique constraint for clean future extensibility. |
| `passwordHash` | `String` | No | — | The bcrypt hash of the user's password. The plaintext password is never stored. Cost factor: minimum 12. |
| `createdAt` | `DateTime` | No | `now()` | The timestamp at which the user account was created. Set once on insert; never updated. |
| `updatedAt` | `DateTime` | No | `updatedAt` (auto) | The timestamp of the most recent modification to the user record. Managed automatically by Prisma's `@updatedAt` decorator. |

#### Validation Rules

- `email` must match a valid email format (validated by Zod at the API layer before reaching the database).
- `email` must be unique (enforced by database unique constraint).
- `passwordHash` is never exposed in API responses — the API layer strips it before serialising the user object.
- `id` is immutable after creation.

#### Relationships

| Relationship | Target Entity | Type | Description |
|---|---|---|---|
| `monitors` | `Monitor` | One-to-Many | The collection of monitors owned by this user. Cascades delete to all child monitors on user deletion. |

---

### 5.2 `Monitor`

#### Purpose

Represents a single HTTP/HTTPS endpoint that the system checks on a recurring schedule. It holds both the user-defined configuration (URL, interval, name) and the runtime state (current status, scheduling timestamps).

#### Business Role

- The central entity of the platform — every scheduling decision, check execution, and incident is anchored to a monitor.
- Provides the scheduler with the data it needs to determine *when* to enqueue the next check job (`active`, `nextCheckAt`).
- Provides the worker with the data it needs to execute a check (`url`, `interval`).
- Provides the dashboard with the current visible status without requiring an aggregation query over check history (`status`, `lastCheckedAt`).

#### Field Definitions

| Field | Data Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `String` (CUID) | No | `cuid()` | Primary key. Globally unique identifier. |
| `userId` | `String` (CUID) | No | — | Foreign key referencing `users.id`. The owning user. |
| `name` | `String` | No | — | A human-readable label for the monitor. Displayed on the dashboard. Max 100 characters (enforced at API layer). |
| `url` | `String` | No | — | The full HTTP/HTTPS URL to check. Must be a valid URL (validated by Zod). Not displayed on the public status page. |
| `slug` | `String` | No | — | A URL-safe identifier auto-generated from the monitor name with a random suffix (e.g., `my-api-abc123`). Used as the path segment for the public status page (`/status/[slug]`). Unique across all monitors. |
| `interval` | `Int` | No | `60` | The check interval in seconds. Allowed values: 30, 60, 120, 300, 600. Validated at the API layer; only whitelisted values accepted. |
| `active` | `Boolean` | No | `true` | Whether the monitor is actively scheduled for checks. `false` when the user pauses the monitor. The scheduler filters on this field. |
| `status` | `MonitorStatus` | No | `PENDING` | The current operational status of the monitor. Denormalised from the most recent check result. Updated by the worker after each check. |
| `nextCheckAt` | `DateTime` | No | `now()` | The timestamp at which the next check should be executed. Set to `now()` on creation (eligible for immediate first check). Updated by the scheduler to `now() + interval` after each enqueue. |
| `lastCheckedAt` | `DateTime` | Yes | `null` | The timestamp of the most recently completed check. `null` for newly created monitors that have not yet been checked. Updated by the worker after each check. |
| `createdAt` | `DateTime` | No | `now()` | The timestamp at which the monitor was created. Set once on insert. |
| `updatedAt` | `DateTime` | No | `updatedAt` (auto) | The timestamp of the most recent modification to the monitor record. Managed automatically by Prisma. |

#### Validation Rules

- `url` must be a valid HTTP or HTTPS URL (not a private IP in V2; SSRF protection deferred).
- `interval` must be one of the whitelisted values: 30, 60, 120, 300, 600.
- `name` must be non-empty and ≤ 100 characters.
- `slug` must match the pattern `[a-z0-9-]+` and be globally unique.
- `userId` must reference an existing user (enforced by foreign key).
- A monitor in `PAUSED` status must have `active = false`.

#### Relationships

| Relationship | Target Entity | Type | Description |
|---|---|---|---|
| `user` | `User` | Many-to-One | The owning user. Foreign key: `userId → users.id`. |
| `checks` | `Check[]` | One-to-Many | All check results for this monitor. Ordered by `checkedAt DESC` in queries. |
| `incidents` | `Incident[]` | One-to-Many | All incident records for this monitor. At most one record has `resolvedAt = null` at any time. |

---

### 5.3 `Check`

#### Purpose

An immutable record of a single probe execution. Every time the worker executes an HTTP request to a monitor's URL, exactly one `Check` row is inserted. Checks are never updated or deleted (except via monitor cascade deletion).

#### Business Role

- Provides the raw data for all metrics computations: uptime percentage, latency charts, check history tables.
- Serves as the authoritative, append-only audit trail of a monitor's historical health.
- Is the input to incident detection logic: consecutive non-UP check results trigger incident creation.

#### Field Definitions

| Field | Data Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `String` (CUID) | No | `cuid()` | Primary key. Globally unique identifier. |
| `monitorId` | `String` (CUID) | No | — | Foreign key referencing `monitors.id`. The monitor this check belongs to. |
| `status` | `CheckStatus` | No | — | The outcome of this check: `UP`, `DEGRADED`, or `DOWN`. Determined by the `determineStatus()` function before insert. |
| `statusCode` | `Int` | Yes | `null` | The HTTP response status code returned by the endpoint (e.g., 200, 404, 500). `null` if the request timed out or failed before an HTTP response was received. |
| `responseTime` | `Int` | Yes | `null` | The time in milliseconds from the start of the HTTP request to receipt of the final response. Recorded even on failure (measures time until timeout or error). |
| `error` | `String` | Yes | `null` | A human-readable error message if the request failed (e.g., `"Request timeout"`, `"ECONNREFUSED"`). `null` on successful requests. |
| `checkedAt` | `DateTime` | No | `now()` | The timestamp at which this check was executed. Set by the worker at job processing time. |

#### Nullable Rules Summary

The nullable fields on `Check` represent a deliberate design: an HTTP probe can fail in two fundamentally different ways:

1. **Response received but non-2xx** (`DEGRADED`): `statusCode` is non-null, `error` is null, `responseTime` is non-null.
2. **No response received** (`DOWN`): `statusCode` is null, `error` is non-null, `responseTime` is non-null (records time-to-failure).

`responseTime` is always non-null in practice since the worker records elapsed time even on failure. It is nullable in the schema to handle future edge cases where timing cannot be determined.

#### Validation Rules

- `monitorId` must reference an existing monitor (enforced by foreign key).
- `status` must be a valid `CheckStatus` enum value.
- `statusCode` must be a positive integer if non-null.
- `responseTime` must be a non-negative integer if non-null.
- Once inserted, a `Check` record is never modified (immutability enforced at the application layer).

#### Relationships

| Relationship | Target Entity | Type | Description |
|---|---|---|---|
| `monitor` | `Monitor` | Many-to-One | The monitor this check belongs to. Foreign key: `monitorId → monitors.id`. |

---

### 5.4 `Incident`

#### Purpose

A structured record of an outage event. An incident is opened automatically when consecutive failed checks exceed the confirm-down threshold, and resolved automatically when a subsequent check returns `UP`. It encodes both the start and resolution timestamps of a detected outage.

#### Business Role

- Provides the incident history displayed on the monitor detail page and public status page.
- Enables calculation of MTTR (Mean Time To Recovery), MTBF (Mean Time Between Failures), and downtime SLA metrics.
- Prevents alert fatigue by enforcing "only one open incident per monitor" — a monitor that stays DOWN does not create new incidents.
- Acts as the application-level state machine that bridges per-check failure counters (ephemeral, in Redis) with persistent outage records (durable, in PostgreSQL).

#### Field Definitions

| Field | Data Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `String` (CUID) | No | `cuid()` | Primary key. Globally unique identifier. |
| `monitorId` | `String` (CUID) | No | — | Foreign key referencing `monitors.id`. The monitor this incident belongs to. |
| `startedAt` | `DateTime` | No | `now()` | The timestamp at which the incident was created (i.e., when the consecutive failure threshold was crossed). |
| `resolvedAt` | `DateTime` | Yes | `null` | The timestamp at which the incident was resolved (i.e., when the first UP check arrived after the outage). `null` indicates the incident is still open. |
| `durationSeconds` | `Int` | Yes | `null` | The duration of the incident in seconds, computed at resolution time as `floor((resolvedAt - startedAt) / 1000)`. `null` while the incident is open. |

#### Nullable Rules Summary

- `resolvedAt = null` is the canonical indicator of an **open (active) incident**.
- `resolvedAt != null` indicates a **resolved incident**.
- `durationSeconds` is derived from `resolvedAt - startedAt` and pre-computed for read performance. It is always set simultaneously with `resolvedAt`.

#### Validation Rules

- `monitorId` must reference an existing monitor (enforced by foreign key).
- `resolvedAt`, if set, must be greater than or equal to `startedAt`.
- `durationSeconds`, if set, must be a non-negative integer.
- At most one incident per monitor may have `resolvedAt = null` at any point in time (enforced at the application layer in the worker's incident detection logic).

#### Relationships

| Relationship | Target Entity | Type | Description |
|---|---|---|---|
| `monitor` | `Monitor` | Many-to-One | The monitor this incident belongs to. Foreign key: `monitorId → monitors.id`. |

---

## 6. Constraints

### 6.1 Unique Constraints

| Table | Column(s) | Constraint Name | Reason |
|---|---|---|---|
| `users` | `email` | `users_email_key` | Each email address may only be registered once. Prevents duplicate accounts and ensures email can safely serve as a login identifier. |
| `users` | `username` | `users_username_key` | Each username is unique. Prevents display-name ambiguity and supports future @mention features. |
| `monitors` | `slug` | `monitors_slug_key` | Each public status page URL (`/status/[slug]`) must be globally unique. Two monitors cannot share a slug. |

### 6.2 Foreign Key Constraints

| Referencing Table | Column | Referenced Table | Column | On Delete |
|---|---|---|---|---|
| `monitors` | `userId` | `users` | `id` | `CASCADE` |
| `checks` | `monitorId` | `monitors` | `id` | `CASCADE` |
| `incidents` | `monitorId` | `monitors` | `id` | `CASCADE` |

### 6.3 Ownership Rules

Ownership is a business-layer concern enforced at the API level, not a database-level constraint. However, the data model makes ownership violations structurally difficult:

1. **User → Monitor ownership:** Every monitor row has a non-nullable `userId`. The API authenticate middleware extracts `userId` from the verified JWT, and all monitor queries are filtered by `WHERE userId = :userId`. A user cannot read or modify another user's monitors because the `userId` filter excludes foreign monitors from all query results.

2. **Monitor → Check/Incident ownership:** Checks and incidents are linked to monitors, which are already scoped to a user. There is no direct `userId` on `checks` or `incidents` — access is controlled through the parent monitor's `userId`. The API resolves the monitor first (verifying ownership) before returning its checks or incidents.

### 6.4 Referential Integrity Rules

- A `Monitor` cannot exist without a corresponding `User` (non-nullable `userId` + foreign key).
- A `Check` cannot exist without a corresponding `Monitor` (non-nullable `monitorId` + foreign key).
- An `Incident` cannot exist without a corresponding `Monitor` (non-nullable `monitorId` + foreign key).
- All foreign keys use `ON DELETE CASCADE`, ensuring that removing a parent record removes all dependent child records atomically. This prevents orphaned check or incident rows.
- Prisma enforces referential integrity within its transaction boundaries. For PostgreSQL, the database also enforces FK constraints at the storage level.

### 6.5 Application-Layer Invariants

The following business rules are enforced in application code, not DDL, because they involve conditional logic:

| Rule | Location | Description |
|---|---|---|
| At most one open incident per monitor | `apps/worker/src/processor/incidentDetect.ts` | Before creating a new incident, the worker queries for an existing open incident (`WHERE monitorId = :id AND resolvedAt IS NULL`). A new incident is only created if none exists. |
| Paused monitors have `active = false` | `apps/api/src/services/monitorService.ts` | The `pause` service method sets `status = PAUSED` and `active = false` atomically. The `resume` method sets `active = true` and `status = PENDING`. |
| `durationSeconds` is set simultaneously with `resolvedAt` | `apps/worker/src/processor/incidentDetect.ts` | Both fields are included in the same Prisma `update` call to prevent a state where `resolvedAt` is set but `durationSeconds` is null on a resolved incident. |

---

## 7. Index Strategy

The platform has two dominant query profiles that drive index design:

1. **Scheduler queries** — infrequent (every 30 seconds), low-cardinality result sets, but must be fast to avoid scheduler tick overrun.
2. **Dashboard queries** — frequent (on every dashboard load and polling interval), time-windowed aggregations over the `checks` table, which is the largest and fastest-growing table in the schema.

### 7.1 Index on `monitors(active, nextCheckAt)`

**Type:** Composite B-tree index  
**Columns:** `active` (Boolean), `nextCheckAt` (DateTime)  
**Query optimised:**

```sql
SELECT id, url, interval
FROM monitors
WHERE active = TRUE
  AND nextCheckAt <= NOW()
```

**Rationale:** This is the scheduler's core query, executed every 30 seconds. Without this index, PostgreSQL would scan the entire `monitors` table on every scheduler tick to find due monitors. With the index, PostgreSQL can perform an efficient index range scan: it filters on the equality predicate `active = TRUE` first (eliminating paused monitors), then applies the range predicate `nextCheckAt <= NOW()` within the matching rows. As the number of monitors grows, this index ensures the scheduler tick remains sub-millisecond regardless of total monitor count.

**Column order rationale:** `active` is placed first because it is an equality filter (higher selectivity for active/inactive split), while `nextCheckAt` is a range predicate. PostgreSQL uses equality filters first in a composite B-tree index, making this ordering optimal for the scheduler's access pattern.

### 7.2 Index on `monitors(userId)`

**Type:** Single-column B-tree index  
**Column:** `userId`  
**Query optimised:**

```sql
SELECT * FROM monitors WHERE userId = :userId
```

**Rationale:** This index serves the dashboard's monitor list query — the most common query issued by the API. Every time a user loads their dashboard, the API fetches all monitors belonging to that user. Without this index, PostgreSQL would scan all monitor rows. With this index, it directly locates all rows matching `userId` in O(log n) time. Given that monitors are shared across all users in a single table, the index is essential as total monitor count grows.

### 7.3 Index on `monitors(userId, createdAt)`

**Type:** Composite B-tree index  
**Columns:** `userId`, `createdAt`  
**Query optimised:**

```sql
SELECT * FROM monitors
WHERE userId = :userId
ORDER BY createdAt DESC
LIMIT :limit OFFSET :offset
```

**Rationale:** When monitors are listed in creation order (the default dashboard sort), PostgreSQL needs to both filter by user and sort by creation time. Without a composite index covering both columns, PostgreSQL would use the `(userId)` index to fetch matching rows, then perform an in-memory sort by `createdAt`. With the `(userId, createdAt)` composite index, PostgreSQL can retrieve rows in the correct sort order directly from the index, avoiding a filesort operation. This is critical for pagination correctness and performance.

### 7.4 Index on `checks(monitorId, checkedAt)`

**Type:** Composite B-tree index  
**Columns:** `monitorId`, `checkedAt`  
**Query optimised:**

```sql
-- Uptime percentage calculation
SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'UP')
FROM checks
WHERE monitorId = :monitorId
  AND checkedAt >= :windowStart

-- Latency chart data
SELECT DATE_TRUNC('hour', checkedAt) AS bucket, AVG(responseTime)
FROM checks
WHERE monitorId = :monitorId
  AND checkedAt >= :windowStart
GROUP BY bucket

-- Paginated check history
SELECT * FROM checks
WHERE monitorId = :monitorId
  AND checkedAt >= :windowStart
ORDER BY checkedAt DESC
LIMIT 20
```

**Rationale:** This is the most critical index in the schema. Without it, every uptime calculation, latency chart render, and check history load becomes a full table scan on the `checks` table — which grows at ~1.44 million rows/day at 1,000 monitors with 60-second intervals. With this index, all three query patterns above become efficient index range scans that read only the rows within the requested time window for the specified monitor. The `monitorId` equality predicate eliminates all other monitors' data, and the `checkedAt` range predicate further narrows to the time window, resulting in reads proportional to the time window size rather than total table size.

### 7.5 Index on `incidents(monitorId, startedAt)`

**Type:** Composite B-tree index  
**Columns:** `monitorId`, `startedAt`  
**Query optimised:**

```sql
-- Incident history for a monitor
SELECT * FROM incidents
WHERE monitorId = :monitorId
ORDER BY startedAt DESC
LIMIT :limit OFFSET :offset

-- Open incident lookup (incident detection)
SELECT * FROM incidents
WHERE monitorId = :monitorId
  AND resolvedAt IS NULL
```

**Rationale:** Incident history is queried on every monitor detail page load. The `(monitorId, startedAt)` index enables PostgreSQL to efficiently retrieve incidents for a specific monitor ordered by time without a full-table scan or in-memory sort. The open incident lookup (run after every non-UP check result) also benefits from this index because `monitorId` filters the result set down to one monitor's incidents, making the subsequent `resolvedAt IS NULL` filter over a small number of rows.

**Index summary table:**

| Index | Table | Columns | Primary Beneficiary |
|---|---|---|---|
| `idx_monitors_active_nextcheckat` | `monitors` | `(active, nextCheckAt)` | Scheduler tick query |
| `idx_monitors_userid` | `monitors` | `(userId)` | Dashboard monitor list |
| `idx_monitors_userid_createdat` | `monitors` | `(userId, createdAt)` | Dashboard monitor list with sort/pagination |
| `idx_checks_monitorid_checkedat` | `checks` | `(monitorId, checkedAt)` | All metrics queries — uptime %, latency charts, check history |
| `idx_incidents_monitorid_startedat` | `incidents` | `(monitorId, startedAt)` | Incident history, open incident lookup |

---

## 8. Query Patterns

### Scheduler

Query:

active = true
AND nextCheckAt <= NOW()

Index:
(active, nextCheckAt)

### Dashboard

Query:

monitors by user

Index:
(userId, createdAt)

### Check History

Query:

checks by monitor ordered by checkedAt

Index:
(monitorId, checkedAt)

### Incident History

Query:

incidents by monitor ordered by startedAt

Index:
(monitorId, startedAt)

## 9. Cascade Behaviour

### 9.1 User Deleted

When a `User` record is deleted, the following cascade chain executes atomically within a single database transaction:

```
DELETE users WHERE id = :userId
  └── CASCADE → DELETE monitors WHERE userId = :userId
        ├── CASCADE → DELETE checks WHERE monitorId IN (affected monitor IDs)
        └── CASCADE → DELETE incidents WHERE monitorId IN (affected monitor IDs)
```

**Effects:**
- All monitors belonging to the user are deleted.
- All check history for every deleted monitor is permanently removed.
- All incident records for every deleted monitor are permanently removed.
- No orphaned rows remain in any table.

**Application-layer consideration:** Before deleting a user, the API should cancel any in-flight BullMQ jobs for the user's monitors to prevent worker writes to deleted monitor rows. In V1, job-level cancellation is not implemented; if a worker writes a check for a deleted monitor, the insert will fail with a foreign key violation, which BullMQ will handle as a job failure.

**Redis cleanup:** The failure counter keys (`failures:{monitorId}`) and status cache keys (`status:{monitorId}`) in Redis are not explicitly deleted on user/monitor deletion in V1. They expire naturally via their TTLs (10 minutes for failure counters, 2 minutes for status cache). This is acceptable in V1 — stale Redis keys do not cause correctness issues after the monitor is deleted.

---

### 9.2 Monitor Deleted

When a `Monitor` record is deleted, the following cascade executes:

```
DELETE monitors WHERE id = :monitorId
  ├── CASCADE → DELETE checks WHERE monitorId = :monitorId
  └── CASCADE → DELETE incidents WHERE monitorId = :monitorId
```

**Effects:**
- All check history for the monitor is permanently deleted. This is intentional — check history has no meaning without its parent monitor.
- All incident records are permanently deleted. Historical incident data is tied to the monitor's context; without the monitor, the incidents cannot be presented meaningfully.
- The monitor's `slug` is freed and can be reused (though slug generation includes a random suffix to make collision unlikely).

**Application-layer consideration:** The `DELETE /api/v1/monitors/:id` endpoint should confirm monitor ownership (`WHERE id = :id AND userId = :userId`) before executing the delete. The API never issues `DELETE FROM monitors WHERE id = :id` without the ownership filter.

---

## 10. Future Expansion

Potential future features:

- Alert notifications (email, Slack, Discord, webhooks)
- SSL certificate monitoring
- Team workspaces
- Custom public status pages
- Advanced analytics
