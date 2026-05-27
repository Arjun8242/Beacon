# API Design — Distributed Uptime Monitoring Platform

**Version:** 1.0  
**Status:** Draft  
**Author:** Arjun Jaiswal  
**Last Updated:** 2025  
**Consumed by:** `apps/web` (Next.js dashboard) only

---

## Table of Contents

1. [API Overview](#1-api-overview)
2. [Base URL](#2-base-url)
3. [Authentication Model](#3-authentication-model)
4. [Versioning Strategy](#4-versioning-strategy)
5. [Request / Response Standards](#5-request--response-standards)
6. [Error Handling Strategy](#6-error-handling-strategy)
7. [Pagination Strategy](#7-pagination-strategy)
8. [Filtering and Sorting Strategy](#8-filtering-and-sorting-strategy)
9. [Ownership and Authorization Rules](#9-ownership-and-authorization-rules)
10. [Rate Limiting Considerations](#10-rate-limiting-considerations)
11. [Endpoint Specifications — Auth](#11-endpoint-specifications--auth)
12. [Endpoint Specifications — Dashboard](#12-endpoint-specifications--dashboard)
13. [Endpoint Specifications — Monitors](#13-endpoint-specifications--monitors)
14. [Endpoint Specifications — Monitor Metrics](#14-endpoint-specifications--monitor-metrics)
15. [Endpoint Specifications — Public Status Page](#15-endpoint-specifications--public-status-page)
16. [Validation Rules Reference](#16-validation-rules-reference)
17. [Error Codes Reference](#17-error-codes-reference)
18. [Future API Extensions](#18-future-api-extensions)

---

## 1. API Overview

The Uptime Monitor API is a RESTful HTTP API that serves the Next.js dashboard (`apps/web`). It handles user authentication, monitor lifecycle management, metrics retrieval, and public status page data.

### Design Principles

| Principle | Implementation |
|---|---|
| RESTful | Resource-oriented URLs, correct HTTP verbs, stateless |
| Consistent responses | Every response — success or error — follows the same envelope shape |
| Correct HTTP status codes | 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable Entity, 500 Internal Server Error |
| Input validation | All request bodies validated with Zod before any business logic runs |
| Ownership enforcement | Every authenticated resource operation verifies `userId` ownership before processing |
| Pagination | All list endpoints are paginated; no unbounded queries |
| Type safety | Request and response shapes are defined as TypeScript types in `packages/shared` |

### Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express 4 |
| Language | TypeScript |
| ORM | Prisma (PostgreSQL) |
| Auth | JWT (HS256, 24h expiry) |
| Validation | Zod |
| Queue | BullMQ (not exposed via API directly) |

---

## 2. Base URL

| Environment | Base URL |
|---|---|
| Local development | `http://localhost:4000/api/v1` |
| Production | `https://api.yourdomain.com/api/v1` |

All endpoint paths in this document are relative to the base URL. The version prefix `/v1` is part of the URL path (see Versioning Strategy).

---

## 3. Authentication Model

### Mechanism

JWT Bearer token authentication. Tokens are issued on login and must be attached to every authenticated request.

### Token Specification

| Property | Value |
|---|---|
| Algorithm | HS256 |
| Expiry | 24 hours (`exp` claim) |
| Signing secret | `JWT_SECRET` environment variable (minimum 32 characters) |
| Payload | `{ sub: userId, email: userEmail, iat, exp }` |

### How to Authenticate

Include the token in the `Authorization` header on every protected request:

```
Authorization: Bearer <token>
```

### Token Lifecycle

```
POST /auth/register  →  account created, token returned
POST /auth/login     →  token issued (24h validity)
                     →  client stores token in memory or httpOnly cookie
                     →  token attached to every subsequent request
                     →  after 24h, client must re-login
```

V1 has no refresh token mechanism. Expired tokens return `401 TOKEN_EXPIRED`. The client redirects to login.

### Middleware Implementation

```typescript
// apps/api/src/middlewares/authenticate.ts

export async function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json(error('AUTH_MISSING_TOKEN', 'Authorization token required'))
  }

  const token = header.split(' ')[1]
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = payload.sub
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json(error('TOKEN_EXPIRED', 'Token has expired'))
    }
    return res.status(401).json(error('TOKEN_INVALID', 'Invalid token'))
  }
}
```

---

## 4. Versioning Strategy

The API uses **URL path versioning** (`/api/v1/...`).

### Rationale

| Option | Decision |
|---|---|
| URL versioning (`/api/v1`) | ✅ Chosen — explicit, cacheable, visible in logs |
| Header versioning (`API-Version: 1`) | ❌ Implicit, harder to route in reverse proxies |
| Query param versioning (`?version=1`) | ❌ Non-standard, pollutes query params |

### Breaking Change Policy

A breaking change requires a new version prefix (`/api/v2`). Breaking changes include:

- Removing or renaming a field from a response.
- Changing a field's type.
- Changing validation rules that would reject previously valid input.
- Removing an endpoint.

Non-breaking changes (adding optional fields, adding new endpoints) may be deployed to `/api/v1` without a version bump.

---

## 5. Request / Response Standards

### Request Format

- `Content-Type: application/json` required on all requests with a body.
- Request bodies must be valid JSON.
- Boolean fields must be actual JSON booleans (`true`/`false`), not strings.
- Date strings must be ISO 8601 format (`2025-01-15T10:00:00Z`).

### Success Response Envelope

```typescript
type SuccessResponse<T> = {
  success: true
  data: T
}
```

```json
{
  "success": true,
  "data": { }
}
```

For paginated responses, `data` is always an object containing the array plus pagination metadata:

```json
{
  "success": true,
  "data": {
    "items": [ ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Error Response Envelope

```typescript
type ErrorResponse = {
  success: false
  error: {
    code: string      // machine-readable constant, e.g. "MONITOR_NOT_FOUND"
    message: string   // human-readable description for UI display
    details?: Record<string, string[]>  // field-level validation errors (422 only)
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "MONITOR_NOT_FOUND",
    "message": "Monitor not found"
  }
}
```

For validation errors (422), field-level details are included:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "url": ["Must be a valid HTTP or HTTPS URL"],
      "interval": ["Must be one of: 30, 60, 120, 300, 600"]
    }
  }
}
```

### HTTP Status Code Usage

| Code | Meaning | When used |
|---|---|---|
| 200 | OK | Successful GET, PATCH, DELETE |
| 201 | Created | Successful POST that creates a resource |
| 400 | Bad Request | Malformed JSON, invalid query params |
| 401 | Unauthorized | Missing, expired, or invalid JWT |
| 403 | Forbidden | Valid JWT but user does not own the resource |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate resource (e.g. email already registered) |
| 422 | Unprocessable Entity | Valid JSON but fails business validation (Zod) |
| 500 | Internal Server Error | Unhandled exception — never expose stack traces |

---

## 6. Error Handling Strategy

### Global Error Handler

All Express routes are wrapped in `asyncHandler` to catch unhandled promise rejections. A global error handler middleware formats all errors into the standard envelope before sending:

```typescript
// apps/api/src/middlewares/errorHandler.ts

export function errorHandler(err, req, res, next) {
  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: formatZodErrors(err)
      }
    })
  }

  // Prisma known errors
  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {  // record not found
      return res.status(404).json(error('RESOURCE_NOT_FOUND', 'Resource not found'))
    }
    if (err.code === 'P2002') {  // unique constraint
      return res.status(409).json(error('DUPLICATE_RESOURCE', 'Resource already exists'))
    }
  }

  // Default: 500
  logger.error({ err }, 'Unhandled error')
  return res.status(500).json(error('INTERNAL_ERROR', 'An unexpected error occurred'))
}
```

### Rule: Never Leak Internals

- Stack traces must never appear in API responses.
- Database error messages must never appear in API responses.
- Log the full error server-side; return only a generic message to the client.

---

## 7. Pagination Strategy

All list endpoints use **offset-based pagination** via `page` and `limit` query parameters.

### Query Parameters

| Parameter | Type | Default | Max | Description |
|---|---|---|---|---|
| `page` | integer | `1` | — | Page number (1-indexed) |
| `limit` | integer | `20` | `100` | Items per page |

### Pagination Metadata

Every paginated response includes:

```typescript
type PaginationMeta = {
  page: number       // current page
  limit: number      // items per page
  total: number      // total matching records
  totalPages: number // Math.ceil(total / limit)
  hasNext: boolean   // page < totalPages
  hasPrev: boolean   // page > 1
}
```

### Prisma Implementation Pattern

```typescript
const page = Number(req.query.page) || 1
const limit = Math.min(Number(req.query.limit) || 20, 100)
const skip = (page - 1) * limit

const [items, total] = await Promise.all([
  db.monitor.findMany({ where, skip, take: limit, orderBy }),
  db.monitor.count({ where })
])

return {
  items,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page < Math.ceil(total / limit),
    hasPrev: page > 1
  }
}
```

---

## 8. Filtering and Sorting Strategy

### Filtering

Filters are passed as query parameters. Multiple filters are combined with AND logic. All filter parameters are optional.

### Sorting

| Parameter | Type | Default | Description |
|---|---|---|---|
| `sortBy` | string | endpoint-specific | Field to sort by |
| `sortOrder` | `asc` \| `desc` | `desc` | Sort direction |

Unsupported `sortBy` values return a `400 INVALID_SORT_FIELD` error. Each endpoint documents its supported sort fields.

### Filter Validation

All filter and sort parameters are validated with Zod in the route handler before being passed to the service layer. Invalid filter values return `400 INVALID_FILTER`.

---

## 9. Ownership and Authorization Rules

These rules apply to **every** authenticated endpoint that operates on a monitor or its child resources (checks, incidents).

### Rules

| Rule | Implementation |
|---|---|
| A user can only access their own monitors | Every monitor query includes `WHERE userId = req.userId` |
| A user can only access checks belonging to their monitors | Join through monitor with ownership check |
| A user can only access incidents belonging to their monitors | Join through monitor with ownership check |
| Ownership is verified before any mutation | Check ownership before update or delete, return `403` if mismatch |

### Ownership Check Pattern

```typescript
// apps/api/src/services/monitorService.ts

async function assertOwnership(monitorId: string, userId: string): Promise<Monitor> {
  const monitor = await db.monitor.findUnique({ where: { id: monitorId } })

  if (!monitor) {
    throw new ApiError(404, 'MONITOR_NOT_FOUND', 'Monitor not found')
  }
  if (monitor.userId !== userId) {
    throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this monitor')
  }

  return monitor
}
```

This function is called at the start of every service method that operates on a specific monitor.

---

## 10. Rate Limiting Considerations

Rate limiting is **not implemented in V1**. It is documented here for V2 implementation.

### Planned V2 Limits

| Endpoint Group | Limit | Window |
|---|---|---|
| `POST /auth/login` | 10 requests | 15 minutes per IP |
| `POST /auth/register` | 5 requests | 1 hour per IP |
| `POST /monitors` | 30 requests | 1 hour per user |
| All other authenticated routes | 300 requests | 1 minute per user |

### V2 Implementation

Use `express-rate-limit` with a Redis store (`rate-limit-redis`) so limits are shared across multiple API instances:

```typescript
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  store: new RedisStore({ client: redis }),
  standardHeaders: true,
  legacyHeaders: false
})
```

When rate limited, the API returns:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later."
  }
}
```

HTTP status: `429 Too Many Requests`. Response includes `Retry-After` header.

---

## 11. Endpoint Specifications — Auth

---

### POST /api/v1/auth/register

**Purpose:** Create a new user account.  
**Authentication Required:** No  

#### Request Body

```typescript
type RegisterRequest = {
  email: string     // valid email format
  password: string  // minimum 8 characters
}
```

```json
{
  "email": "arjun@example.com",
  "password": "mysecurepassword"
}
```

#### Validation Rules

| Field | Rules |
|---|---|
| `email` | Required. Valid email format. Normalized to lowercase before storage. |
| `password` | Required. Minimum 8 characters. Maximum 72 characters (bcrypt limit). |

#### Success Response — 201 Created

```typescript
type RegisterResponse = {
  user: {
    id: string
    email: string
    createdAt: string
  }
  token: string   // JWT, 24h expiry
}
```

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx1abc123",
      "email": "arjun@example.com",
      "createdAt": "2025-01-15T10:00:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Error Responses

| HTTP | Code | Trigger |
|---|---|---|
| 422 | `VALIDATION_ERROR` | Missing fields or invalid format |
| 409 | `EMAIL_ALREADY_EXISTS` | Email is already registered |
| 500 | `INTERNAL_ERROR` | Unexpected failure |

#### Business Logic Notes

- Password is hashed with bcrypt (cost factor 12) before storage.
- Plain-text password is never logged or returned.
- Email is lowercased and trimmed before uniqueness check and storage.
- JWT is signed immediately and returned — user does not need to login after register.

---

### POST /api/v1/auth/login

**Purpose:** Authenticate an existing user and receive a JWT.  
**Authentication Required:** No  

#### Request Body

```typescript
type LoginRequest = {
  email: string
  password: string
}
```

```json
{
  "email": "arjun@example.com",
  "password": "mysecurepassword"
}
```

#### Validation Rules

| Field | Rules |
|---|---|
| `email` | Required. Valid email format. |
| `password` | Required. Non-empty string. |

#### Success Response — 200 OK

```typescript
type LoginResponse = {
  user: {
    id: string
    email: string
    createdAt: string
  }
  token: string
}
```

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx1abc123",
      "email": "arjun@example.com",
      "createdAt": "2025-01-15T10:00:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Error Responses

| HTTP | Code | Trigger |
|---|---|---|
| 422 | `VALIDATION_ERROR` | Missing or malformed fields |
| 401 | `INVALID_CREDENTIALS` | Email not found or password mismatch |
| 500 | `INTERNAL_ERROR` | Unexpected failure |

#### Business Logic Notes

- Always return `401 INVALID_CREDENTIALS` for both "email not found" and "wrong password" — never distinguish between the two. This prevents email enumeration attacks.
- Use `bcrypt.compare()` for password verification. Never compare plain text.
- Even if the email is not found, still run a dummy `bcrypt.compare()` to prevent timing-based email enumeration.

---

### GET /api/v1/auth/me

**Purpose:** Return the currently authenticated user's profile.  
**Authentication Required:** Yes  

#### Request

No body. No query parameters. Token provided in `Authorization` header.

#### Success Response — 200 OK

```typescript
type MeResponse = {
  id: string
  email: string
  createdAt: string
  monitorCount: number   // total monitors owned by this user
}
```

```json
{
  "success": true,
  "data": {
    "id": "clx1abc123",
    "email": "arjun@example.com",
    "createdAt": "2025-01-15T10:00:00Z",
    "monitorCount": 5
  }
}
```

#### Error Responses

| HTTP | Code | Trigger |
|---|---|---|
| 401 | `AUTH_MISSING_TOKEN` | No Authorization header |
| 401 | `TOKEN_EXPIRED` | Token past expiry |
| 401 | `TOKEN_INVALID` | Malformed or tampered token |

---

## 12. Endpoint Specifications — Dashboard

---

### GET /api/v1/dashboard

**Purpose:** Return aggregated stats for the authenticated user's dashboard overview — total monitors, health summary, recent incidents, and per-monitor status cards.  
**Authentication Required:** Yes  

#### Request

No body. No query parameters.

#### Success Response — 200 OK

```typescript
type DashboardResponse = {
  summary: {
    totalMonitors: number
    activeMonitors: number
    pausedMonitors: number
    upMonitors: number
    downMonitors: number
    degradedMonitors: number
    avgUptimePercent: number   // average uptime across all monitors (last 24h)
  }
  recentIncidents: Array<{
    id: string
    monitorId: string
    monitorName: string
    startedAt: string
    resolvedAt: string | null
    duration: number | null    // seconds; null if unresolved
    isOpen: boolean
  }>
  monitors: Array<{
    id: string
    name: string
    url: string
    status: 'PENDING' | 'UP' | 'DOWN' | 'DEGRADED' | 'PAUSED'
    active: boolean
    lastCheckedAt: string | null
    uptimePercent24h: number | null   // null if no checks yet
    avgResponseTime24h: number | null // ms; null if no checks yet
  }>
}
```

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalMonitors": 5,
      "activeMonitors": 4,
      "pausedMonitors": 1,
      "upMonitors": 3,
      "downMonitors": 1,
      "degradedMonitors": 0,
      "avgUptimePercent": 98.4
    },
    "recentIncidents": [
      {
        "id": "clx9incident1",
        "monitorId": "clx1monitor1",
        "monitorName": "Production API",
        "startedAt": "2025-01-15T08:30:00Z",
        "resolvedAt": "2025-01-15T08:45:00Z",
        "duration": 900,
        "isOpen": false
      }
    ],
    "monitors": [
      {
        "id": "clx1monitor1",
        "name": "Production API",
        "url": "https://api.myapp.com/health",
        "status": "UP",
        "active": true,
        "lastCheckedAt": "2025-01-15T10:00:00Z",
        "uptimePercent24h": 99.3,
        "avgResponseTime24h": 243
      }
    ]
  }
}
```

#### Error Responses

| HTTP | Code | Trigger |
|---|---|---|
| 401 | `AUTH_MISSING_TOKEN` | No valid JWT |
| 500 | `INTERNAL_ERROR` | Unexpected failure |

#### Business Logic Notes

- `recentIncidents` returns the **5 most recent incidents** across all user monitors, ordered by `startedAt DESC`.
- `monitors` returns **all monitors** for the user (no pagination on dashboard — full list for status cards). The dashboard query is lightweight (no check history, just the most recent cached status).
- `uptimePercent24h` and `avgResponseTime24h` are calculated from the `checks` table for the last 24 hours. Use the `@@index([monitorId, checkedAt])` index for efficiency.
- If a monitor has no checks yet (just created), `uptimePercent24h` and `avgResponseTime24h` are `null`.
- `avgUptimePercent` in summary is the mean of all monitors' 24h uptime values (excluding nulls). If no monitors have checks, it is `null`.

---

## 13. Endpoint Specifications — Monitors

---

### POST /api/v1/monitors

**Purpose:** Create a new monitor for the authenticated user.  
**Authentication Required:** Yes  

#### Request Body

```typescript
type CreateMonitorRequest = {
  name: string     // 1–100 characters
  url: string      // valid HTTP or HTTPS URL
  interval: number // seconds: must be one of [30, 60, 120, 300, 600]
}
```

```json
{
  "name": "Production API",
  "url": "https://api.myapp.com/health",
  "interval": 60
}
```

#### Validation Rules

| Field | Rules |
|---|---|
| `name` | Required. String. Minimum 1 character, maximum 100 characters. Trimmed. |
| `url` | Required. Must match `^https?://`. Must be a valid URL parseable by `new URL()`. |
| `interval` | Required. Integer. Must be exactly one of: `30, 60, 120, 300, 600`. |

#### Success Response — 201 Created

```typescript
type MonitorResponse = {
  id: string
  userId: string
  name: string
  url: string
  interval: number
  active: boolean
  status: 'PENDING' | 'UP' | 'DOWN' | 'DEGRADED' | 'PAUSED'
  slug: string
  lastCheckedAt: string | null
  nextCheckAt: string
  createdAt: string
  updatedAt: string
}
```

```json
{
  "success": true,
  "data": {
    "id": "clx1monitor1",
    "userId": "clx1abc123",
    "name": "Production API",
    "url": "https://api.myapp.com/health",
    "interval": 60,
    "active": true,
    "status": "PENDING",
    "slug": "production-api-x7k2",
    "lastCheckedAt": null,
    "nextCheckAt": "2025-01-15T10:00:00Z",
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-15T10:00:00Z"
  }
}
```

#### Error Responses

| HTTP | Code | Trigger |
|---|---|---|
| 401 | `AUTH_MISSING_TOKEN` | No valid JWT |
| 422 | `VALIDATION_ERROR` | Invalid fields |
| 500 | `INTERNAL_ERROR` | Unexpected failure |

#### Business Logic Notes

- `slug` is auto-generated: `slugify(name) + '-' + nanoid(4)` (e.g. `production-api-x7k2`). Must be unique. Regenerate if collision.
- `status` defaults to `PENDING` on creation.
- `active` defaults to `true` on creation.
- `nextCheckAt` is set to `NOW()` on creation so the scheduler picks it up on the next tick.
- `userId` is taken from `req.userId` (JWT payload) — never from the request body.

---

### GET /api/v1/monitors

**Purpose:** List all monitors owned by the authenticated user with optional filtering and pagination.  
**Authentication Required:** Yes  

#### Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Items per page (max 100) |
| `status` | string | — | Filter by status: `UP`, `DOWN`, `DEGRADED`, `PENDING`, `PAUSED` |
| `active` | boolean | — | Filter by active state: `true` or `false` |
| `sortBy` | string | `createdAt` | Sort field: `createdAt`, `name`, `status`, `lastCheckedAt` |
| `sortOrder` | string | `desc` | `asc` or `desc` |

#### Success Response — 200 OK

```typescript
type ListMonitorsResponse = {
  items: MonitorResponse[]
  pagination: PaginationMeta
}
```

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "clx1monitor1",
        "userId": "clx1abc123",
        "name": "Production API",
        "url": "https://api.myapp.com/health",
        "interval": 60,
        "active": true,
        "status": "UP",
        "slug": "production-api-x7k2",
        "lastCheckedAt": "2025-01-15T10:00:00Z",
        "nextCheckAt": "2025-01-15T10:01:00Z",
        "createdAt": "2025-01-15T09:00:00Z",
        "updatedAt": "2025-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

#### Error Responses

| HTTP | Code | Trigger |
|---|---|---|
| 400 | `INVALID_FILTER` | Unrecognised status value |
| 400 | `INVALID_SORT_FIELD` | Unsupported `sortBy` value |
| 401 | `AUTH_MISSING_TOKEN` | No valid JWT |

#### Business Logic Notes

- The query always includes `WHERE userId = req.userId`. Users can never see other users' monitors.
- All filter parameters are optional. Omitting them returns all monitors for the user.
- `active` filter: `?active=true` maps to `WHERE active = true`. String `"true"` and `"false"` are coerced to boolean.

---

### GET /api/v1/monitors/:id

**Purpose:** Retrieve full details of a single monitor.  
**Authentication Required:** Yes  

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Monitor ID (cuid) |

#### Success Response — 200 OK

Returns a single `MonitorResponse` object (same shape as the create response).

#### Error Responses

| HTTP | Code | Trigger |
|---|---|---|
| 401 | `AUTH_MISSING_TOKEN` | No valid JWT |
| 403 | `FORBIDDEN` | Monitor exists but belongs to another user |
| 404 | `MONITOR_NOT_FOUND` | No monitor with this ID |

---

### PATCH /api/v1/monitors/:id

**Purpose:** Update one or more fields on an existing monitor.  
**Authentication Required:** Yes  

All fields are **optional**. Only provided fields are updated (partial update semantics).

#### Request Body

```typescript
type UpdateMonitorRequest = {
  name?: string     // 1–100 characters
  url?: string      // valid HTTP or HTTPS URL
  interval?: number // one of [30, 60, 120, 300, 600]
  active?: boolean  // pause/resume (use dedicated endpoints preferred)
}
```

```json
{
  "name": "Production API v2",
  "interval": 120
}
```

#### Validation Rules

Same as create, but all fields optional. At least one field must be provided.

| Field | Rules |
|---|---|
| `name` | Optional. String. 1–100 characters. Trimmed. |
| `url` | Optional. Valid HTTP/HTTPS URL. |
| `interval` | Optional. One of: `30, 60, 120, 300, 600`. |
| `active` | Optional. Boolean. |

#### Success Response — 200 OK

Returns the updated `MonitorResponse` object.

#### Error Responses

| HTTP | Code | Trigger |
|---|---|---|
| 400 | `EMPTY_UPDATE` | Request body has no recognised fields |
| 401 | `AUTH_MISSING_TOKEN` | No valid JWT |
| 403 | `FORBIDDEN` | Monitor belongs to another user |
| 404 | `MONITOR_NOT_FOUND` | No monitor with this ID |
| 422 | `VALIDATION_ERROR` | Field present but invalid value |

#### Business Logic Notes

- If `interval` changes, `nextCheckAt` is recalculated: `nextCheckAt = NOW() + newInterval`.
- If `active` is set to `false`, `status` is updated to `PAUSED`.
- If `active` is set to `true` (resume), `status` is reset to `PENDING` and `nextCheckAt` is set to `NOW()`.
- Ownership is verified before any update is applied.

---

### DELETE /api/v1/monitors/:id

**Purpose:** Permanently delete a monitor and all its associated data.  
**Authentication Required:** Yes  

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Monitor ID (cuid) |

#### Success Response — 200 OK

```json
{
  "success": true,
  "data": {
    "id": "clx1monitor1",
    "deleted": true
  }
}
```

#### Error Responses

| HTTP | Code | Trigger |
|---|---|---|
| 401 | `AUTH_MISSING_TOKEN` | No valid JWT |
| 403 | `FORBIDDEN` | Monitor belongs to another user |
| 404 | `MONITOR_NOT_FOUND` | No monitor with this ID |

#### Business Logic Notes

- Deletion cascades to all associated `Check` and `Incident` records via Prisma `onDelete: Cascade`.
- Any BullMQ jobs in the queue for this monitor will still execute, but `resultPersist` will fail to find the monitor and discard the result gracefully (no error propagated).
- This operation is irreversible. No soft-delete in V1.

---

### PATCH /api/v1/monitors/:id/pause

**Purpose:** Pause a monitor (stop executing checks).  
**Authentication Required:** Yes  

#### Request Body

None.

#### Success Response — 200 OK

```json
{
  "success": true,
  "data": {
    "id": "clx1monitor1",
    "active": false,
    "status": "PAUSED"
  }
}
```

#### Error Responses

| HTTP | Code | Trigger |
|---|---|---|
| 400 | `ALREADY_PAUSED` | Monitor is already paused |
| 401 | `AUTH_MISSING_TOKEN` | No valid JWT |
| 403 | `FORBIDDEN` | Monitor belongs to another user |
| 404 | `MONITOR_NOT_FOUND` | No monitor with this ID |

#### Business Logic Notes

- Sets `active = false` and `status = PAUSED`.
- The scheduler's next tick will not enqueue a job for this monitor because the query filters `active = true`.
- In-flight BullMQ jobs already enqueued before this call will still complete — their results are persisted normally, but the monitor status will be overwritten to `PAUSED` after they complete.

---

### PATCH /api/v1/monitors/:id/resume

**Purpose:** Resume a paused monitor.  
**Authentication Required:** Yes  

#### Request Body

None.

#### Success Response — 200 OK

```json
{
  "success": true,
  "data": {
    "id": "clx1monitor1",
    "active": true,
    "status": "PENDING",
    "nextCheckAt": "2025-01-15T10:00:00Z"
  }
}
```

#### Error Responses

| HTTP | Code | Trigger |
|---|---|---|
| 400 | `ALREADY_ACTIVE` | Monitor is already active |
| 401 | `AUTH_MISSING_TOKEN` | No valid JWT |
| 403 | `FORBIDDEN` | Monitor belongs to another user |
| 404 | `MONITOR_NOT_FOUND` | No monitor with this ID |

#### Business Logic Notes

- Sets `active = true`, `status = PENDING`, and `nextCheckAt = NOW()`.
- Setting `nextCheckAt = NOW()` ensures the scheduler picks it up on the very next tick rather than waiting for the original scheduled time.

---

## 14. Endpoint Specifications — Monitor Metrics

---

### GET /api/v1/monitors/:id/stats

**Purpose:** Return aggregated statistics for a monitor over a configurable time window.  
**Authentication Required:** Yes  

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Monitor ID (cuid) |

#### Query Parameters

| Parameter | Type | Default | Options | Description |
|---|---|---|---|---|
| `window` | string | `24h` | `24h`, `7d`, `30d` | Time window for aggregation |

#### Success Response — 200 OK

```typescript
type MonitorStatsResponse = {
  monitorId: string
  window: '24h' | '7d' | '30d'
  windowStart: string      // ISO 8601 — start of the window
  windowEnd: string        // ISO 8601 — now
  totalChecks: number
  upChecks: number
  downChecks: number
  degradedChecks: number
  uptimePercent: number    // (upChecks / totalChecks) * 100; 2 decimal places
  avgResponseTime: number  // ms; average across UP checks only
  minResponseTime: number  // ms
  maxResponseTime: number  // ms
  openIncidents: number    // currently open (unresolved) incidents
  totalIncidents: number   // all incidents within the window
}
```

```json
{
  "success": true,
  "data": {
    "monitorId": "clx1monitor1",
    "window": "24h",
    "windowStart": "2025-01-14T10:00:00Z",
    "windowEnd": "2025-01-15T10:00:00Z",
    "totalChecks": 1440,
    "upChecks": 1430,
    "downChecks": 8,
    "degradedChecks": 2,
    "uptimePercent": 99.31,
    "avgResponseTime": 243,
    "minResponseTime": 98,
    "maxResponseTime": 1240,
    "openIncidents": 0,
    "totalIncidents": 1
  }
}
```

#### Error Responses

| HTTP | Code | Trigger |
|---|---|---|
| 400 | `INVALID_WINDOW` | `window` value not in `[24h, 7d, 30d]` |
| 401 | `AUTH_MISSING_TOKEN` | No valid JWT |
| 403 | `FORBIDDEN` | Monitor belongs to another user |
| 404 | `MONITOR_NOT_FOUND` | No monitor with this ID |

#### Business Logic Notes

- If `totalChecks = 0` (new monitor with no history), `uptimePercent`, `avgResponseTime`, `minResponseTime`, `maxResponseTime` are all `0`.
- `avgResponseTime` is computed only over `UP` checks (ignores checks where `responseTime IS NULL`).
- Window start times: `24h` = `NOW() - 24 hours`, `7d` = `NOW() - 7 days`, `30d` = `NOW() - 30 days`.
- The `checks` table `@@index([monitorId, checkedAt])` makes this query fast.

---

### GET /api/v1/monitors/:id/checks

**Purpose:** Retrieve paginated raw check history for a monitor.  
**Authentication Required:** Yes  

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Monitor ID (cuid) |

#### Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Items per page (max 100) |
| `status` | string | — | Filter by check status: `UP`, `DOWN`, `DEGRADED` |
| `from` | string | — | ISO 8601 date — filter checks after this time |
| `to` | string | — | ISO 8601 date — filter checks before this time |
| `sortOrder` | string | `desc` | `asc` or `desc` (sorted by `checkedAt`) |

#### Success Response — 200 OK

```typescript
type CheckResponse = {
  id: string
  monitorId: string
  status: 'UP' | 'DOWN' | 'DEGRADED'
  responseTime: number | null  // ms; null if request never completed
  statusCode: number | null    // HTTP status code; null if connection error
  error: string | null         // error message; null if successful
  checkedAt: string            // ISO 8601
}

type ListChecksResponse = {
  items: CheckResponse[]
  pagination: PaginationMeta
}
```

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "clxcheck1",
        "monitorId": "clx1monitor1",
        "status": "UP",
        "responseTime": 243,
        "statusCode": 200,
        "error": null,
        "checkedAt": "2025-01-15T10:00:00Z"
      },
      {
        "id": "clxcheck2",
        "monitorId": "clx1monitor1",
        "status": "DOWN",
        "responseTime": 10001,
        "statusCode": null,
        "error": "Request timeout",
        "checkedAt": "2025-01-15T09:59:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1440,
      "totalPages": 72,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

#### Error Responses

| HTTP | Code | Trigger |
|---|---|---|
| 400 | `INVALID_DATE_RANGE` | `from` is after `to`, or invalid ISO 8601 |
| 400 | `INVALID_FILTER` | Unrecognised status value |
| 401 | `AUTH_MISSING_TOKEN` | No valid JWT |
| 403 | `FORBIDDEN` | Monitor belongs to another user |
| 404 | `MONITOR_NOT_FOUND` | No monitor with this ID |

---

### GET /api/v1/monitors/:id/latency

**Purpose:** Return bucketed latency data for rendering the response-time chart on the monitor detail page.  
**Authentication Required:** Yes  

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Monitor ID (cuid) |

#### Query Parameters

| Parameter | Type | Default | Options | Description |
|---|---|---|---|---|
| `window` | string | `24h` | `24h`, `7d`, `30d` | Time window and implied bucket size |

#### Bucket Sizes

| Window | Bucket Size | Max Buckets |
|---|---|---|
| `24h` | 1 hour | 24 |
| `7d` | 6 hours | 28 |
| `30d` | 1 day | 30 |

#### Success Response — 200 OK

```typescript
type LatencyBucket = {
  bucketStart: string   // ISO 8601 — start of this bucket
  bucketEnd: string     // ISO 8601 — end of this bucket
  avgResponseTime: number | null  // ms; null if no UP checks in bucket
  minResponseTime: number | null
  maxResponseTime: number | null
  checkCount: number    // total checks in this bucket (any status)
  upCount: number       // UP checks in this bucket
}

type LatencyResponse = {
  monitorId: string
  window: '24h' | '7d' | '30d'
  bucketSize: '1h' | '6h' | '1d'
  buckets: LatencyBucket[]
}
```

```json
{
  "success": true,
  "data": {
    "monitorId": "clx1monitor1",
    "window": "24h",
    "bucketSize": "1h",
    "buckets": [
      {
        "bucketStart": "2025-01-15T09:00:00Z",
        "bucketEnd": "2025-01-15T10:00:00Z",
        "avgResponseTime": 243,
        "minResponseTime": 180,
        "maxResponseTime": 410,
        "checkCount": 60,
        "upCount": 60
      },
      {
        "bucketStart": "2025-01-15T08:00:00Z",
        "bucketEnd": "2025-01-15T09:00:00Z",
        "avgResponseTime": null,
        "minResponseTime": null,
        "maxResponseTime": null,
        "checkCount": 60,
        "upCount": 0
      }
    ]
  }
}
```

#### Error Responses

| HTTP | Code | Trigger |
|---|---|---|
| 400 | `INVALID_WINDOW` | Window value not in allowed list |
| 401 | `AUTH_MISSING_TOKEN` | No valid JWT |
| 403 | `FORBIDDEN` | Monitor belongs to another user |
| 404 | `MONITOR_NOT_FOUND` | No monitor with this ID |

#### Business Logic Notes

- Buckets are always returned for the full window, even if empty (no checks in that bucket). This avoids the frontend needing to handle missing time slots in the chart.
- `avgResponseTime` and related fields are `null` for buckets with zero UP checks.
- Implementation uses PostgreSQL `date_trunc` for bucketing:

```sql
SELECT
  date_trunc('hour', "checkedAt") AS bucket,
  AVG("responseTime") FILTER (WHERE status = 'UP') AS avg_rt,
  MIN("responseTime") FILTER (WHERE status = 'UP') AS min_rt,
  MAX("responseTime") FILTER (WHERE status = 'UP') AS max_rt,
  COUNT(*) AS check_count,
  COUNT(*) FILTER (WHERE status = 'UP') AS up_count
FROM checks
WHERE "monitorId" = $1
  AND "checkedAt" >= $2
GROUP BY bucket
ORDER BY bucket DESC
```

---

### GET /api/v1/monitors/:id/incidents

**Purpose:** Return paginated incident history for a monitor.  
**Authentication Required:** Yes  

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Monitor ID (cuid) |

#### Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Items per page (max 100) |
| `from` | string | — | ISO 8601 — filter incidents starting after this time |
| `to` | string | — | ISO 8601 — filter incidents starting before this time |
| `open` | boolean | — | `true` = open only, `false` = resolved only |

#### Success Response — 200 OK

```typescript
type IncidentResponse = {
  id: string
  monitorId: string
  startedAt: string
  resolvedAt: string | null
  duration: number | null   // seconds; null if still open
  isOpen: boolean           // resolvedAt === null
}

type ListIncidentsResponse = {
  items: IncidentResponse[]
  pagination: PaginationMeta
}
```

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "clxincident1",
        "monitorId": "clx1monitor1",
        "startedAt": "2025-01-15T08:30:00Z",
        "resolvedAt": "2025-01-15T08:45:00Z",
        "duration": 900,
        "isOpen": false
      },
      {
        "id": "clxincident2",
        "monitorId": "clx1monitor1",
        "startedAt": "2025-01-14T20:00:00Z",
        "resolvedAt": null,
        "duration": null,
        "isOpen": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

#### Error Responses

| HTTP | Code | Trigger |
|---|---|---|
| 400 | `INVALID_DATE_RANGE` | `from` is after `to` |
| 401 | `AUTH_MISSING_TOKEN` | No valid JWT |
| 403 | `FORBIDDEN` | Monitor belongs to another user |
| 404 | `MONITOR_NOT_FOUND` | No monitor with this ID |

---

## 15. Endpoint Specifications — Public Status Page

The public status page is implemented in V1.

---

### GET /api/v1/status/:slug

**Purpose:** Return public-facing status data for a monitor. Requires no authentication. Safe to share with external stakeholders.  
**Authentication Required:** No  

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `slug` | string | Monitor slug (auto-generated on creation, e.g. `production-api-x7k2`) |

#### Success Response — 200 OK

```typescript
type PublicStatusResponse = {
  name: string                              // monitor name; NOT the URL
  status: 'PENDING' | 'UP' | 'DOWN' | 'DEGRADED' | 'PAUSED'
  lastCheckedAt: string | null
  uptimePercent7d: number | null            // last 7 days; null if no history
  avgResponseTime7d: number | null          // ms; null if no history
  incidents: Array<{
    startedAt: string
    resolvedAt: string | null
    duration: number | null
    isOpen: boolean
  }>
}
```

```json
{
  "success": true,
  "data": {
    "name": "Production API",
    "status": "UP",
    "lastCheckedAt": "2025-01-15T10:00:00Z",
    "uptimePercent7d": 99.8,
    "avgResponseTime7d": 231,
    "incidents": [
      {
        "startedAt": "2025-01-15T08:30:00Z",
        "resolvedAt": "2025-01-15T08:45:00Z",
        "duration": 900,
        "isOpen": false
      }
    ]
  }
}
```

#### Error Responses

| HTTP | Code | Trigger |
|---|---|---|
| 404 | `MONITOR_NOT_FOUND` | No monitor with this slug |

#### Business Logic Notes

- The monitor URL is **never returned** in this response.
- The user ID and user email are **never returned** in this response.
- `incidents` returns the **10 most recent incidents** ordered by `startedAt DESC`.
- This endpoint is publicly cacheable (no user-specific data). In V2, add `Cache-Control: public, max-age=30` header.
- If the monitor is found but `active = false` (paused), the status `PAUSED` is returned — the page still loads.

---

## 16. Validation Rules Reference

### Reusable Zod Schemas

```typescript
// packages/shared/src/validation/schemas.ts

import { z } from 'zod'

export const SUPPORTED_INTERVALS = [30, 60, 120, 300, 600] as const

export const urlSchema = z
  .string()
  .url('Must be a valid URL')
  .refine(
    (val) => val.startsWith('http://') || val.startsWith('https://'),
    'Must be an HTTP or HTTPS URL'
  )

export const intervalSchema = z
  .number()
  .int()
  .refine(
    (val) => SUPPORTED_INTERVALS.includes(val as any),
    `Must be one of: ${SUPPORTED_INTERVALS.join(', ')}`
  )

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

export const windowSchema = z
  .enum(['24h', '7d', '30d'])
  .default('24h')

export const createMonitorSchema = z.object({
  name: z.string().trim().min(1).max(100),
  url: urlSchema,
  interval: intervalSchema
})

export const updateMonitorSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  url: urlSchema.optional(),
  interval: intervalSchema.optional(),
  active: z.boolean().optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
)

export const registerSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(72)
})

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1)
})
```

### Field Validation Summary

| Field | Min | Max | Format | Notes |
|---|---|---|---|---|
| `email` | — | — | RFC 5322 email | Lowercased before storage |
| `password` (register) | 8 chars | 72 chars | Any | bcrypt max is 72 bytes |
| `name` | 1 char | 100 chars | String | Trimmed whitespace |
| `url` | — | — | Valid URL | Must start with `http://` or `https://` |
| `interval` | — | — | Integer | Must be in `[30, 60, 120, 300, 600]` |
| `page` | 1 | — | Integer | Coerced from string query param |
| `limit` | 1 | 100 | Integer | Coerced from string query param |
| `window` | — | — | Enum | `24h`, `7d`, or `30d` |
| `from` / `to` | — | — | ISO 8601 | Parsed with `new Date()`; invalid format → 400 |

---

## 17. Error Codes Reference

All error codes are `SCREAMING_SNAKE_CASE` strings returned in the `error.code` field.

### Auth Errors

| Code | HTTP | Meaning |
|---|---|---|
| `AUTH_MISSING_TOKEN` | 401 | No `Authorization` header or not `Bearer` format |
| `TOKEN_EXPIRED` | 401 | JWT `exp` claim is in the past |
| `TOKEN_INVALID` | 401 | Malformed token or invalid signature |
| `INVALID_CREDENTIALS` | 401 | Email not found or password incorrect |
| `EMAIL_ALREADY_EXISTS` | 409 | Attempted to register with an already-registered email |

### Resource Errors

| Code | HTTP | Meaning |
|---|---|---|
| `MONITOR_NOT_FOUND` | 404 | No monitor exists with the given ID or slug |
| `FORBIDDEN` | 403 | Authenticated user does not own the requested resource |
| `RESOURCE_NOT_FOUND` | 404 | Generic not found (non-monitor resources) |
| `DUPLICATE_RESOURCE` | 409 | Unique constraint violation |

### Validation Errors

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Zod validation failed; `details` field contains field-level errors |
| `INVALID_FILTER` | 400 | Query param filter value not in allowed set |
| `INVALID_SORT_FIELD` | 400 | `sortBy` value not supported for this endpoint |
| `INVALID_WINDOW` | 400 | `window` param not in `[24h, 7d, 30d]` |
| `INVALID_DATE_RANGE` | 400 | `from` is after `to`, or non-parseable date string |
| `EMPTY_UPDATE` | 400 | PATCH request body has no recognised fields |

### Business Logic Errors

| Code | HTTP | Meaning |
|---|---|---|
| `ALREADY_PAUSED` | 400 | Pause called on an already-paused monitor |
| `ALREADY_ACTIVE` | 400 | Resume called on an already-active monitor |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests (V2) |

### System Errors

| Code | HTTP | Meaning |
|---|---|---|
| `INTERNAL_ERROR` | 500 | Unhandled server-side exception |

---

## 18. Future API Extensions

The following endpoints are explicitly out of scope for V1 and listed here for V2 planning.

### Notification / Alert APIs (V2)

| Method | Path | Description |
|---|---|---|
| GET | `/monitors/:id/alert-config` | Get alert configuration for a monitor |
| PUT | `/monitors/:id/alert-config` | Set email/webhook alert settings |
| POST | `/monitors/:id/test-alert` | Send a test alert notification |

### Team and Workspace APIs (V2)

| Method | Path | Description |
|---|---|---|
| POST | `/workspaces` | Create a team workspace |
| POST | `/workspaces/:id/invite` | Invite a user to a workspace |
| GET | `/workspaces/:id/members` | List workspace members |
| PATCH | `/workspaces/:id/members/:userId` | Change a member's role |

### Additional Monitor Check Types (V2)

| Method | Path | Description |
|---|---|---|
| POST | `/monitors` with `type: 'ssl'` | SSL certificate expiry monitoring |
| POST | `/monitors` with `type: 'dns'` | DNS resolution monitoring |

### Metrics Export (V2)

| Method | Path | Description |
|---|---|---|
| GET | `/monitors/:id/export` | Export check history as CSV |
| GET | `/monitors/export` | Export all monitors' data |

### Maintenance Windows (V2)

| Method | Path | Description |
|---|---|---|
| POST | `/monitors/:id/maintenance` | Schedule a maintenance window (suppress alerts) |
| DELETE | `/monitors/:id/maintenance/:windowId` | Cancel a maintenance window |

### Admin / Internal APIs (V2)

These are never exposed to the Next.js frontend and would be internal-only:

| Method | Path | Description |
|---|---|---|
| GET | `/internal/queue/stats` | BullMQ queue stats (job counts by state) |
| POST | `/internal/monitors/:id/force-check` | Manually trigger an immediate check |
| DELETE | `/internal/checks/prune` | Delete check records older than N days |
