# micro-contracts

[![npm version](https://img.shields.io/npm/v/micro-contracts.svg)](https://www.npmjs.com/package/micro-contracts) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT) [![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![OpenAPI](https://img.shields.io/badge/OpenAPI-3.x-6BA539?logo=openapiinitiative&logoColor=white)](https://www.openapis.org/)

**Contract-first vertical slices for TypeScript Web/API systems.**

micro-contracts is a contract-first toolchain for TypeScript Web/API development. It tackles common failure modes—**frontend/backend contract drift**, **duplicated "common" rules**, and **accidental breaking changes in public APIs**—by treating **OpenAPI as the Single Source of Truth (SSoT)**.

Contracts alone aren't enough—they must be **enforceable**. micro-contracts includes **[Enforceable Guardrails](docs/development-guardrails.md)** that prevent both humans and AI from bypassing the contract-first workflow: blocking direct edits to generated files, detecting drift, and verifying security declarations match implementations.

## Design Philosophy

![Architecture](docs/architecture.svg)

The core architecture is organized along two axes:

| Axis | Description | Example |
|------|-------------|---------|
| **Vertical (feature-aligned slices)** | A *module* is a feature-aligned contract boundary. The same contract spans UI (frontend) and API (backend). | `core`, `billing`, `users` |
| **Horizontal (cross-cutting concerns)** | Auth, tenancy, rate limiting, and shared error behavior are applied consistently via **OpenAPI Overlays**. | `x-middleware: [requireAuth, tenantIsolation]` |

### Key Differentiators

| # | Differentiator | What it means |
|---|----------------|---------------|
| 1 | **Vertical Modules + Horizontal Overlays** | Feature-aligned modules as contract boundaries; cross-cutting concerns (auth, rate-limit) injected via [OpenAPI Overlays](https://www.openapis.org/blog/2024/10/22/announcing-overlay-specification). |
| 2 | **OpenAPI as SSoT → Multi-artifact generation** | Single spec generates contract packages, server routes, and frontend clients. No manual sync required. |
| 3 | **Enforceable Guardrails** | Built-in checks prevent bypassing contract-first workflow—blocks direct edits to generated files, detects drift, verifies security declarations. See **[Guardrails](docs/development-guardrails.md)**. |
| 4 | **Public Surface Governance** | `contract-published` is extracted (not duplicated) from the master contract. `x-micro-contracts-non-exportable` fails generation if internal data leaks. |
| 5 | **Explicit Module Dependencies** | `x-micro-contracts-depend-on` declares cross-module dependencies. `deps/` re-exports only declared types; enables impact analysis. |
| 6 | **Screen Spec** | Declare frontend screen contracts (ViewModel, navigation, analytics events) in OpenAPI. One YAML drives typed navigation maps and event hooks. See **[Screen Spec](docs/screen-spec.md)**. |

---

## Who is this for?

| Scenario | Why micro-contracts helps |
|----------|---------------------------|
| **Modular monolith → microservices** | Same contracts work in monolith or split services; dependency tracking prevents hidden coupling |
| **Multiple teams sharing OpenAPI** | Explicit module dependencies make cross-team impact visible |
| **Published API with compatibility SLA** | `contract-published` extraction + `x-micro-contracts-non-exportable` fail-fast prevents accidental exposure |
| **Cross-cutting concerns at scale** | OpenAPI Overlays inject auth/rate-limit/tenancy and extension properties without copy-paste |

**Not the best fit for:** Single-developer projects, auto-generated UI from schema, multi-language SDK generation (use OpenAPI Generator instead).

---

## Quick Start

> **Prerequisites**: Node.js 18+, TypeScript 5.0+, ESM (`"type": "module"`).

```bash
# 1. Install
npm install --save-dev micro-contracts

# 2. Initialize module structure
npx micro-contracts init core --openapi path/to/your/spec.yaml

# 3. Generate all code
npx micro-contracts generate
```

```typescript
// 4. Use in your server
import { registerRoutes } from './core/routes.generated.js';
await registerRoutes(fastify);
```

> **What `init` creates**: The `init` command creates starter templates for **Fastify** (server) and **fetch API** (client).
> These are scaffolds to get you started — modify them for your framework (Express, Hono, Axios, etc.) or add new output types.
>
> **📦 Full working example**: See [`examples/`](./examples/) for a complete project with multiple modules, overlays, and cross-module dependencies.

---

## Core Concepts

### OpenAPI as Single Source of Truth (SSoT)

```
OpenAPI spec (spec/{module}/openapi/*.yaml)
    ↓ micro-contracts generate
Contract packages (packages/contract/{module}/)
    ├── schemas/types.ts       # Request/Response types
    ├── services/              # Service interfaces
    └── overlays/              # Overlay handler interfaces
    ↓
Server routes + Frontend clients (generated via templates)
```

### Modules vs Services

| Concept | Definition | Example |
|---------|------------|---------|
| **Module** | Logical contract boundary (OpenAPI + Service) | `core`, `billing`, `users` |
| **Service** | Deployment unit (can contain 1+ modules) | `api-server` |

A monolith may have multiple modules in one service. Start with multiple modules in one service and split later as needed.

### Contract Packages

| Package | Description | Compatibility Policy |
|---------|-------------|---------------------|
| `contract` | Master contract (all APIs) | Internal APIs can change freely |
| `contract-published` | Public APIs only (`x-micro-contracts-published: true`) | Must maintain backward compatibility |

**Key insight**: `contract-published` is **extracted from** `contract` (not generated separately). This ensures a single SSoT.

### Cross-cutting Concerns with Overlays

1. Mark operations with `x-middleware` (or custom extensions) in OpenAPI
2. Define overlay that adds params/responses when extension is present
3. Generator applies overlays and produces `openapi.generated.yaml`
4. Generate code from the result

> **📖 Deep Dive**: See **[OpenAPI Overlays (Deep Dive)](docs/overlays-deep-dive.md)** for complete examples and configuration.

### Screen Spec — Frontend Screen Contracts

Standard OpenAPI constructs can also define **frontend screen contracts** — bridging the API layer and UI components. A single YAML file drives ViewModel types, typed navigation maps, and analytics event hooks.

```
Screen Spec (OpenAPI YAML)
  ├── ViewModel Types       (from schemas — zero new template work)
  ├── Navigation Map        (from response links → typed routing)
  └── Event Hooks           (from x-events → typed analytics)
```

Enable with `screen: true` in module config:

```yaml
modules:
  myScreens:
    openapi: spec/screens/screens.yaml
    screen: true
    outputs:
      screen-navigation:
        output: frontend/src/screens/navigation.generated.ts
        template: screen-navigation.hbs
      screen-events:
        output: frontend/src/screens/events.generated.ts
        template: screen-events.hbs
```

Initialize a screen module with starter files:

```bash
npx micro-contracts init myScreens --screens
```

> **📖 Deep Dive**: See **[Screen Spec](docs/screen-spec.md)** for the full guide — YAML structure, `x-screen-*` extensions, `TemplateContext.screens`, lint rules, and custom template examples.

---

## Directory Structure

```
project/
├── spec/                              # ✅ Human-edited (contract source of truth)
│   ├── spectral.yaml                  #    Global lint rules
│   ├── default/templates/             #    Handlebars templates (customizable)
│   ├── _shared/
│   │   ├── openapi/                   #    Shared schemas (ProblemDetails, etc.)
│   │   └── overlays/                  #    Cross-module overlays
│   └── {module}/
│       ├── openapi/{module}.yaml      #    OpenAPI spec
│       └── overlays/                  #    Module-specific overlays
│
├── packages/                          # ❌ Auto-generated (DO NOT EDIT)
│   ├── contract/{module}/
│   │   ├── schemas/                   #    Types, validators
│   │   ├── services/                  #    Service interfaces
│   │   ├── overlays/                  #    Overlay handler interfaces
│   │   └── deps/                      #    Re-exports from dependencies
│   └── contract-published/{module}/   #    Public API subset
│
├── server/src/{module}/
│   ├── routes.generated.ts            # ❌ Auto-generated (template: fastify-routes.hbs)
│   ├── services/                      # ✅ Human-edited (service implementations)
│   └── overlays/                      # ✅ Human-edited (overlay implementations)
│
└── frontend/src/{module}/
    └── api.generated.ts               # ❌ Auto-generated (template: fetch-client.hbs)
```

> **Note**: `*.generated.ts` files are generated from Handlebars templates in `spec/default/templates/`.
> You can customize or replace templates for different frameworks (Express, Hono, Axios, etc.).
>
> **Why commit generated files?** Generated artifacts are committed to enable code review of contract changes and CI drift detection. If spec changes but generated code doesn't match, CI fails.

---

## OpenAPI Extensions

### Required Extensions

| Extension | Type | Description |
|-----------|------|-------------|
| `x-micro-contracts-service` | string | Service class name (e.g., `User`, `Order`) |
| `x-micro-contracts-method` | string | Method name to call (should match `operationId`) |

### Optional Extensions

| Extension | Type | Description |
|-----------|------|-------------|
| `x-micro-contracts-published` | boolean | Include in `contract-published` (compatibility SLA) |
| `x-micro-contracts-non-exportable` | boolean | Mark as non-exportable (fails if used in published endpoints) |
| `x-micro-contracts-depend-on` | string[] | Explicit dependencies on other modules' published APIs |

### Screen Spec Extensions

Used in modules with `screen: true`. See **[Screen Spec](docs/screen-spec.md)** for details.

| Extension | Type | Description |
|-----------|------|-------------|
| `x-screen-const` | string | Stable constant name (e.g., `HOME`) |
| `x-screen-id` | string | Traceability ID (e.g., `SCR-001`) |
| `x-screen-name` | string | Generated symbol name (e.g., `HomePage`) |
| `x-back-navigation` | boolean | Supports history-based back navigation |
| `x-events` | array | Analytics event declarations (`{name, type, method, params?}`) |

### Example

```yaml
paths:
  /api/users:
    get:
      operationId: getUsers
      x-micro-contracts-service: User
      x-micro-contracts-method: getUsers
      x-micro-contracts-published: true
      x-middleware: [requireAuth]            # Custom extension for overlays
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserListResponse'
```

### Module Dependencies

Declare dependencies with `x-micro-contracts-depend-on`:

```yaml
# spec/billing/openapi/billing.yaml
info:
  x-micro-contracts-depend-on:
    - core.User.getUsers
    - core.User.getUserById
```

Import via generated `deps/`:

```typescript
// ✅ Recommended: Import from deps/
import type { User } from '@project/contract/billing/deps/core';

// ❌ Avoid: Direct contract-published import
import type { User } from '@project/contract-published/core/schemas';
```

---

## Configuration

Create `micro-contracts.config.yaml`. All paths support `{module}` placeholder.

### defaults

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `contract.output` | string | yes | Output directory for contract packages |
| `contract.serviceTemplate` | string | no | Custom Handlebars template for service interface generation |
| `contractPublic.output` | string | yes | Output directory for public contract packages |
| `outputs.<id>.output` | string | yes | Output file path |
| `outputs.<id>.template` | string | yes | Handlebars template file path |
| `outputs.<id>.overwrite` | boolean | no | Overwrite existing files (default: `true`) |
| `outputs.<id>.condition` | string | no | `hasPublicEndpoints` \| `hasOverlays` \| `always` (default: `always`) |
| `outputs.<id>.enabled` | boolean | no | Enable/disable this output (default: `true`) |
| `outputs.<id>.config` | object | no | Template-specific configuration passed to context |
| `overlays.shared` | string[] | no | Overlay files applied to all modules |
| `overlays.collision` | string | no | `error` \| `warn` \| `last-wins` (default: `error`) |
| `docs.enabled` | boolean | no | Enable documentation generation (default: `true`) |
| `docs.template` | string | no | Documentation template |
| `sharedModuleName` | string | no | Shared module name for overlays |

### modules.\<name\>

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `openapi` | string | yes | Path to OpenAPI spec file |
| `screen` | boolean | no | Enable screen spec mode (`x-screen-*` extensions, `TemplateContext.screens`) |
| `contract.output` | string | no | Override contract output directory |
| `contract.serviceTemplate` | string | no | Override custom service interface template |
| `contractPublic.output` | string | no | Override public contract output directory |
| `outputs.<id>.enabled` | boolean | no | Enable/disable specific output for this module |
| `outputs.<id>.*` | — | no | Override any output config field |
| `overlays` | string[] | no | Module-specific overlay files |
| `dependsOn` | string[] | no | Dependencies (`{module}.{service}.{method}`) |
| `spectral` | string | no | Module-specific Spectral config path |
| `docs.enabled` | boolean | no | Override documentation generation |

### Example

```yaml
defaults:
  contract:
    output: packages/contract/{module}
  contractPublic:
    output: packages/contract-published/{module}
  outputs:
    server-routes:
      output: server/src/{module}/routes.generated.ts
      template: spec/default/templates/fastify-routes.hbs
    frontend-api:
      output: frontend/src/{module}/api.generated.ts
      template: spec/default/templates/fetch-client.hbs
  overlays:
    shared:
      - spec/_shared/overlays/middleware.overlay.yaml

modules:
  core:
    openapi: openapi/core.yaml
  billing:
    openapi: openapi/billing.yaml
    dependsOn:
      - core.User.getUsers
    outputs:
      frontend-api:
        enabled: false
```

---

## CLI Reference

### generate

Generate code from OpenAPI specifications.

| Option | Description |
|--------|-------------|
| `-c, --config <path>` | Path to config file |
| `-m, --module <names>` | Module names, comma-separated (default: all) |
| `--contracts-only` | Generate contract packages only |
| `--server-only` | Generate server routes only |
| `--frontend-only` | Generate frontend clients only |
| `--docs-only` | Generate documentation only |
| `--skip-lint` | Skip linting before generation |
| `--no-manifest` | Skip manifest generation |
| `--manifest-dir <path>` | Directory for manifest (default: `packages/`) |
| `--force` | Bypass input hash cache and always regenerate |
| `--no-cache` | Run without reading or writing input hash cache |

### init \<module\>

Initialize a new module structure with starter templates.

| Option | Description |
|--------|-------------|
| `-d, --dir <path>` | Base directory (default: `src`) |
| `-i, --openapi <path>` | OpenAPI spec to process (auto-adds extensions) |
| `-o, --output <path>` | Output path for processed OpenAPI |
| `--skip-templates` | Skip creating starter templates |
| `--screens` | Initialize as screen spec module (generates screen templates and starter spec) |

### lint \<input\>

Lint OpenAPI specification.

| Option | Description |
|--------|-------------|
| `--strict` | Treat warnings as errors |

### check

Run guardrail checks.

| Option | Description |
|--------|-------------|
| `--only <checks>` | Run only specific checks (comma-separated) |
| `--skip <checks>` | Skip specific checks (comma-separated) |
| `--gate <gates>` | Run checks for specific gates only (1-5) |
| `-v, --verbose` | Enable verbose output |
| `--fix` | Auto-fix issues where possible |
| `-g, --guardrails <path>` | Path to `guardrails.yaml` |
| `-d, --generated-dir <path>` | Path to generated files directory (default: `packages/`) |
| `--changed-files <path>` | Path to file containing changed files (for CI) |
| `--list` | List available checks |
| `--list-gates` | List available gates |

### pipeline

Run full guardrails pipeline: **Gate 1,2 → Generate → Gate 3,4,5**.

| Option | Description |
|--------|-------------|
| `-c, --config <path>` | Path to config file |
| `-v, --verbose` | Enable verbose output |
| `--skip <checks>` | Skip specific checks (comma-separated) |
| `--continue-on-error` | Continue running even if a step fails |
| `-g, --guardrails <path>` | Path to `guardrails.yaml` |
| `-d, --generated-dir <path>` | Path to generated files directory (default: `packages/`) |
| `--no-manifest` | Skip manifest generation |
| `--skip-lint` | Skip linting before generation |
| `--contracts-only` | Generate contract packages only |
| `--server-only` | Generate server routes only |
| `--frontend-only` | Generate frontend clients only |
| `--docs-only` | Generate documentation only |
| `--force` | Bypass input hash cache and always regenerate |
| `--no-cache` | Run without reading or writing input hash cache |

> See **[Enforceable Guardrails](docs/development-guardrails.md)** for gate details and CI configuration.

### deps

Analyze module dependencies.

| Option | Description |
|--------|-------------|
| `-c, --config <path>` | Path to config file |
| `-m, --module <name>` | Module to analyze |
| `--graph` | Output dependency graph (Mermaid) |
| `--impact <ref>` | Analyze impact of changing a specific API |
| `--who-depends-on <ref>` | Find modules that depend on a specific API |
| `--validate` | Validate dependencies against OpenAPI declarations |

### guardrails-init

Create a `guardrails.yaml` configuration file.

| Option | Description |
|--------|-------------|
| `-o, --output <path>` | Output path (default: `guardrails.yaml`) |

### manifest

Generate or verify manifest for generated artifacts.

| Option | Description |
|--------|-------------|
| `-d, --dir <path>` | Directory to scan (default: `packages/`) |
| `--verify` | Verify existing manifest |
| `-o, --output <path>` | Output manifest path |

---

## Generated Code

### Service Interface

```typescript
// packages/contract/core/services/UserServiceApi.ts
export interface UserServiceApi {
  getUsers(input: UserService_getUsersInput): Promise<UserListResponse>;
  getUserById(input: UserService_getUserByIdInput): Promise<User>;
}
```

### Service Implementation

```typescript
// server/src/core/services/UserService.ts
import type { UserServiceApi } from '@project/contract/core/services/UserServiceApi.js';

export class UserService implements UserServiceApi {
  async getUsers(input) {
    // Input is HTTP-agnostic: { limit?: number, offset?: number }
    return { users: [...], total: 100 };
  }
}
```

---

## Related Documentation

| Document | Description |
|----------|-------------|
| **[Examples](./examples/)** | Complete working project with multiple modules, overlays, and cross-module dependencies |
| **[Screen Spec](docs/screen-spec.md)** | Frontend screen contracts — ViewModel, navigation, analytics events in OpenAPI |
| **[OpenAPI Overlays (Deep Dive)](docs/overlays-deep-dive.md)** | Complete overlay examples, JSONPath patterns, template context |
| **[Enforceable Guardrails (AI-ready)](docs/development-guardrails.md)** | CI integration, security checks, allowlist configuration |

---

## Comparison with Similar Tools

| Aspect | micro-contracts | OpenAPI Generator | ts-rest |
|--------|-----------------|-------------------|---------|
| **Primary focus** | Contract governance (server + frontend + CI) | Multi-language SDK generation | TypeScript-first contract |
| **SSoT** | OpenAPI | OpenAPI | TypeScript |
| **Multi-artifact generation** | ✅ contract + routes + clients | △ SDK-focused (different goal) | ✅ Strong client/server alignment |
| **Enforceable guardrails** | ✅ Built-in (drift, no direct edit, CI gates) | ❌ Requires separate design | ❌ Requires separate design |
| **Public API governance** | ✅ `contract-published` + fail-fast | ❌ Manual | ❌ N/A |
| **Module dependencies** | ✅ `x-micro-contracts-depend-on` + `deps/` | ❌ Manual | ❌ Manual |
| **Cross-cutting concerns** | ✅ OpenAPI Overlays | ❌ Manual | △ Code-level implementation |


---

## License

MIT
