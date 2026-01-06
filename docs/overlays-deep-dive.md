# OpenAPI Overlays (Deep Dive)

> **Navigation**: [← Back to README](../README.md) | [Examples](../examples/)

**Overlays** use the standard [OpenAPI Overlay Specification 1.0.0](https://www.openapis.org/blog/2024/10/22/announcing-overlay-specification) to define how `x-*` extensions transform the OpenAPI spec. This enables cross-cutting concerns (middleware, auth, rate limiting) without repeating definitions.

**Why Overlays?**

- **Standard format**: Uses official OpenAPI Overlay Specification — [learn more](https://learn.openapis.org/overlay/)
- **Transparent transformation**: Clear what gets injected where
- **Composable**: Chain multiple overlays (shared + module-specific)
- **Tool compatibility**: Works with other Overlay-aware tools ([Redocly CLI](https://redocly.com/docs/cli/), etc.)

---

## How Overlays Work

1. **Mark operations** with `x-middleware` (or custom extensions) in OpenAPI
2. **Define overlay** that adds params/responses when extension is present
3. **Generator applies overlays** and produces `openapi.generated.yaml`
4. **Generate code** from the generated spec (types, routes, overlay interfaces)

---

## Overlay Scope

| Scope | Overlay Location | Use Case |
|-------|------------------|----------|
| **Cross-module** | `spec/_shared/overlays/` | Auth, rate limiting, tenant isolation |
| **Intra-module** | `spec/{module}/overlays/` | Module-specific validation (e.g., payment validation in billing) |

---

## Writing Overlay Definitions

### 1. Mark Operations in OpenAPI

Add extension markers to operations that need cross-cutting behavior:

```yaml
# spec/core/openapi/core.yaml
paths:
  /api/tenant/data:
    get:
      operationId: getTenantData
      x-micro-contracts-domain: Tenant
      x-micro-contracts-method: getTenantData
      x-middleware:                        # ← Extension marker
        - tenantIsolation
        - requireAuth
        - rateLimit
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TenantData'
        # Note: 400, 401, 429 are NOT defined here
        # They will be injected by the overlay
```

### 2. Define Overlay

Create an overlay file that injects parameters and responses based on markers:

```yaml
# spec/_shared/overlays/middleware.overlay.yaml
overlay: 1.0.0
info:
  title: Middleware Extension Overlay
  version: 1.0.0

actions:
  # requireAuth: Inject Authorization header + 401 response
  - target: "$.paths[*][*][?(@.x-middleware contains 'requireAuth')]"
    x-micro-contracts-overlay-name: requireAuth  # ← Name for type generation
    update:
      parameters:
        - name: Authorization
          in: header
          schema: { type: string }
          description: Bearer token for authentication
      responses:
        '401':
          $ref: '../openapi/problem-details.yaml#/components/responses/Unauthorized'

  # tenantIsolation: Inject X-Tenant-Id header + 400 response
  - target: "$.paths[*][*][?(@.x-middleware contains 'tenantIsolation')]"
    x-micro-contracts-overlay-name: tenantIsolation
    update:
      parameters:
        - name: X-Tenant-Id
          in: header
          required: true
          schema:
            type: string
            format: uuid
          description: Tenant identifier for multi-tenant isolation
      responses:
        '400':
          description: Missing or invalid X-Tenant-Id header
          content:
            application/problem+json:
              schema:
                $ref: '../openapi/problem-details.yaml#/components/schemas/ProblemDetails'

  # rateLimit: Inject 429 response with rate limit headers
  - target: "$.paths[*][*][?(@.x-middleware contains 'rateLimit')]"
    x-micro-contracts-overlay-name: rateLimit
    update:
      responses:
        '429':
          description: Too Many Requests
          headers:
            X-RateLimit-Limit:
              schema: { type: integer }
              description: Rate limit ceiling for this endpoint
            Retry-After:
              schema: { type: integer }
              description: Seconds until rate limit resets
```

> **📦 Full example**: See [`examples/spec/_shared/overlays/middleware.overlay.yaml`](../examples/spec/_shared/overlays/middleware.overlay.yaml)

### $ref Paths in Overlays

Specify `$ref` paths **relative to the overlay file's location**. micro-contracts automatically rebases these paths so that the generated `openapi.generated.yaml` can resolve them correctly.

```yaml
# spec/_shared/overlays/middleware.overlay.yaml
$ref: '../openapi/problem-details.yaml#/components/responses/Unauthorized'
#      ↑ Resolves to spec/_shared/openapi/problem-details.yaml
```

**Rebase example:**

| File | $ref path |
|------|-----------|
| Overlay (source) | `../openapi/problem-details.yaml#/...` |
| Generated spec (`packages/contract/core/docs/openapi.generated.yaml`) | `../../../../spec/_shared/openapi/problem-details.yaml#/...` |

The generated path is relative to `openapi.generated.yaml`'s location, ensuring the reference resolves correctly.

---

## Implementing Overlay Handlers

Overlay handlers **do not directly access HTTP request/response objects** (e.g., Fastify's `req`/`reply`). Parameters are extracted by the generated adapter and passed as typed input. However, they are aware of HTTP concepts (header names, status codes) unlike Domain implementations which are purely business logic:

```typescript
// server/src/core/overlays/requireAuth.ts
import type { 
  RequireAuthOverlayInput, 
  OverlayResult 
} from '@project/contract/core/overlays/index.js';

export async function requireAuth(input: RequireAuthOverlayInput): Promise<OverlayResult> {
  const authHeader = input['Authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      error: { status: 401, message: 'Missing or invalid authorization header' },
    };
  }

  // In real app: validate JWT token and extract user info
  return {
    success: true,
    context: { userId: 'user-123', role: 'user' },
  };
}
```

> **📦 Full examples**: See [`examples/server/src/core/overlays/`](../examples/server/src/core/overlays/)

### Layer Responsibilities

| Layer | Responsibility | Touches HTTP objects | Knows HTTP concepts |
|-------|----------------|---------------------|---------------------|
| **Generated routes** | Extract params, wire handlers | ✅ Yes | ✅ Yes |
| **Overlay impl** | Handle cross-cutting concern | ❌ No | ✅ Yes (headers, status codes) |
| **Domain impl** | Business logic only | ❌ No | ❌ No |

---

## Configuration

Configure overlays in `micro-contracts.config.yaml`:

```yaml
# micro-contracts.config.yaml
defaults:
  overlays:
    # Shared overlays applied to all modules (in order)
    shared:
      - spec/_shared/overlays/middleware.overlay.yaml
    collision: error    # error | warn | last-wins (default: error)

modules:
  core:
    openapi: openapi/core.yaml
    overlays:  # Module-specific overlays (applied after shared)
      - overlays/cache.overlay.yaml

  billing:
    openapi: openapi/billing.yaml
    overlays:
      - overlays/payment.overlay.yaml
```

---

## Overlay Policies

### 1. Collision Policy

When multiple overlays inject the same key (e.g., `401` response):

| Scenario | Policy | Rationale |
|----------|--------|-----------|
| Same key, **identical content** | ✅ Allow | No ambiguity |
| Same key, **different content** | ❌ Error | Ambiguous intent |

Configure in `defaults.overlays.collision`: `error` (default) | `warn` | `last-wins`

### 2. Application Order

Order is **deterministic**:

```
1. defaults.overlays.shared (in array order)
2. modules.{name}.overlays (in array order)
```

Generation logs what was injected:

```bash
npx micro-contracts generate -m core

[overlay] Applying spec/_shared/overlays/middleware.overlay.yaml
  → /api/tenant/data GET: +X-Tenant-Id, +400, +401, +429
[output] packages/contract/core/docs/openapi.generated.yaml
```

### 3. JSONPath Patterns

micro-contracts uses a restricted JSONPath dialect for reliable parsing:

| Pattern | Meaning |
|---------|---------|
| `$.paths[*][*]` | All operations |
| `[?(@.x-ext)]` | Has extension |
| `[?(@.x-ext contains 'value')]` | Array contains value |

**Use `contains` for array membership:**

```yaml
# ✅ Correct - portable
- target: "$.paths[*][*][?(@.x-middleware contains 'requireAuth')]"

# ❌ Avoid - implementation-dependent
- target: "$.paths[*][*][?(@.x-middleware[*] == 'requireAuth')]"
```

### 4. Marker vs Injection Responsibility

| Layer | Responsibility |
|-------|----------------|
| **OpenAPI (source)** | Business responses (200, 201, 204) |
| **OpenAPI (source)** | Extension markers (`x-middleware: [requireAuth]`) |
| **Overlay** | Cross-cutting responses (400, 401, 403, 429) |

**Anti-pattern**: Don't manually add `401` to operations that have `x-middleware: [requireAuth]`. Let the overlay inject it.

---

## Summary

| What | Generated | Notes |
|------|-----------|-------|
| Overlay application | ✅ Yes | Transform OpenAPI (inject params/responses) |
| Overlay interfaces | ✅ Yes | HTTP-agnostic (`OverlayRegistry`, `*OverlayInput`) |
| Contract types | ✅ Yes | Types from OpenAPI schemas |
| Route wiring | ✅ Via template | Template decides how to wire |
| Overlay impl | ❌ Human | Implement generated interface |
| Domain impl | ❌ Human | Business logic |

---

## Related Documentation

| Document | Description |
|----------|-------------|
| **[Examples](../examples/)** | Complete working project with multiple modules and overlays |
| **[Guardrails](development-guardrails.md)** | CI integration, security checks |
| **[README](../README.md)** | Core concepts, configuration |
