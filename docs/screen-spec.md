# Screen Spec — Frontend Screen Contracts in OpenAPI

The Screen Spec feature repurposes standard OpenAPI constructs (`paths`, `schemas`, `links`, `security`) to declaratively define **frontend screen contracts** — bridging the API layer and UI components. A single YAML file drives frontend types, test scaffolding, and quality analysis.

```
Screen Spec (OpenAPI YAML)
  ├── micro-contracts generate ──┬── ViewModel Types (type-safe)
  │                              ├── Navigation Map (typed routing)
  │                              └── Event Hooks (typed analytics)
  ├── E2E scaffold ─── Playwright test stubs + coverage
  └── Data lineage ─── ViewModel → API → DB traceability
```

> **Important**: This is NOT "auto-generated UI from schema" but rather **screen-level contract definition**, which aligns with micro-contracts' "Contract-first vertical slices" philosophy.

---

## The HTTP-Screen Analogy

Standard OpenAPI semantics map directly to screen specification concepts:

| OpenAPI Construct      | API Usage              | Screen Spec Usage                                       |
| ---------------------- | ---------------------- | ------------------------------------------------------- |
| `paths: /home`         | Endpoint               | React/Vue route                                         |
| `GET /home`            | Fetch resource         | **Render screen** — what the user sees                  |
| `POST /home`           | Create/modify resource | **User action** — what the user can do                  |
| `parameters`           | Filter/identify        | **Screen init params** — route/query params             |
| `responses.200.schema` | Response shape         | **ViewModel** — typed interface for the screen          |
| `requestBody`          | Submitted data shape   | **Action payload** — typed user action interface        |
| `links`                | HATEOAS related resources | **Forward navigation** — statically known screen targets |
| `security`             | Auth requirement       | **Auth guard** — does the screen require login?         |

All standard OpenAPI tooling works out of the box: linters, documentation generators, and diff tools.

---

## Required Extensions (`x-*`)

Only concerns with **no OpenAPI-native representation** need extensions:

| Extension           | Required | Purpose                                   | Justification                                                   |
| ------------------- | -------- | ----------------------------------------- | --------------------------------------------------------------- |
| `x-screen-const`    | Yes*     | Stable constant name (e.g., `HOME`)       | No OpenAPI equivalent for generated symbol names                |
| `x-screen-id`       | Yes      | Traceability ID (e.g., `SCR-001`)         | Links to requirements and E2E annotations                       |
| `x-screen-name`     | Yes*     | Generated symbol name (e.g., `HomePage`)  | Drives `use{Name}Events()`, `wrap{Name}ViewModel()`            |
| `x-back-navigation` | No       | History-based back navigation support     | `links` only cover forward navigation with known targets        |
| `x-events`          | No       | Analytics event declarations              | No OpenAPI concept for client-side event tracking               |
| `x-view-model`      | No       | Explicit ViewModel schema name            | Alternative to auto-inference from `$ref`                       |
| `x-view-props`      | No       | ViewProps interface name                  | For framework-specific wrapper generation                       |

\* When `x-screen-id` is present, `x-screen-const` and `x-screen-name` are required (enforced by lint).

---

## Quick Start

### 1. Initialize a Screen Module

```bash
npx micro-contracts init myScreens --screens
```

This command generates:
- `spec/myScreens/openapi/myScreens.yaml` — Starter screen spec (2-screen scaffold)
- `spec/default/templates/screen-navigation.hbs` — Navigation map template
- `spec/default/templates/screen-events.hbs` — Event hooks template
- `micro-contracts.config.yaml` — Module config with `screen: true`

### 2. Edit the Screen Spec

Edit `spec/myScreens/openapi/myScreens.yaml` to add your screen definitions.

### 3. Generate Code

```bash
npx micro-contracts generate
```

Generated artifacts:
- `packages/contract/myScreens/schemas/types.ts` — ViewModel TypeScript types
- `frontend/src/screens/navigation.generated.ts` — Navigation map
- `frontend/src/screens/events.generated.ts` — Analytics event hooks

---

## Configuration

### `micro-contracts.config.yaml`

Screen modules are enabled with the `screen: true` flag:

```yaml
modules:
  myScreens:
    openapi: spec/myScreens/openapi/myScreens.yaml
    screen: true
    outputs:
      frontend-api:
        enabled: false      # Not needed for screen modules
      screen-navigation:
        output: frontend/src/screens/navigation.generated.ts
        template: screen-navigation.hbs
      screen-events:
        output: frontend/src/screens/events.generated.ts
        template: screen-events.hbs
```

Effects of `screen: true`:
- Suppresses `x-micro-contracts-service` / `x-micro-contracts-method` lint warnings
- Populates `TemplateContext.screens` with pre-parsed `ScreenContext[]`
- Enables screen-specific lint rules (`x-screen-id` requires `x-screen-const`/`x-screen-name`)

---

## Screen Spec YAML Structure

```yaml
openapi: '3.1.0'
info:
  title: App Screen Specification
  version: '1.0.0'
  description: Screen contracts — not a server API
servers:
  - url: /
    description: Screen routes (client-side)

paths:
  /home:
    get:
      operationId: renderHomePage
      security: [{session: []}]
      x-screen-const: HOME
      x-screen-id: SCR-001
      x-screen-name: HomePage
      x-back-navigation: false
      x-events:
        - name: home_view
          type: screen_view
          method: trackView
        - name: sign_out
          type: user_action
          method: trackSignOut
      summary: Render home page
      responses:
        '200':
          description: Home page ViewModel
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HomePageViewModel'
          links:
            goToSettings:
              operationId: renderSettingsPage
            goToChat:
              operationId: renderChatPage
```

### Field Reference

**`operationId`** — Unique identifier referenced by generated code. The naming convention `render` + screen name + `Page` is recommended.

**`security`** — Auth guard. `[{session: []}]` means authentication is required; `[]` means no authentication needed.

**`x-screen-const`** — SCREAMING_SNAKE_CASE name used for constant access like `SCREENS.HOME`.

**`x-screen-id`** — Unique ID for requirements and test traceability. The format `SCR-{domain}-{number}` is recommended.

**`x-screen-name`** — PascalCase name for generated symbols like `useHomePageEvents()`.

**`x-back-navigation`** — When `true`, declares that the screen supports browser back or UI back button navigation. Unlike forward navigation covered by `links`, the back destination is determined at runtime.

**`x-events`** — Array of analytics event declarations. Each event has `name` (event name), `type` (category), and `method` (generated method name), with an optional `params` map of parameter names to types.

**`responses.200.links`** — Forward navigation targets. References target screens by `operationId`.

**`POST` operations** — A `POST` on the same path defines user actions (form submissions, button taps, etc.). Specify the action payload schema in `requestBody`.

---

## TemplateContext.screens

When `screen: true` is enabled, `TemplateContext` includes a pre-parsed `screens: ScreenContext[]`. This eliminates the need to iterate over deeply nested `spec.paths` in templates.

```typescript
interface ScreenContext {
  route: string;           // '/home'
  screenConst: string;     // 'HOME'
  screenId: string;        // 'SCR-001'
  screenName: string;      // 'HomePage'
  operationId: string;     // 'renderHomePage'
  supportsBack: boolean;   // false
  viewModelSchema: string; // 'HomePageViewModel'
  links: ScreenLink[];     // [{name, targetRoute, targetOperationId}]
  events: ScreenEventDefinition[]; // [{name, type, method, params?}]
  requiresAuth: boolean;   // true
}
```

### Template Usage Comparison

**Using `screens[]` (recommended):**

```handlebars
{{#each screens}}
  {{screenConst}}: { id: '{{screenId}}', route: '{{route}}' },
{{/each}}
```

**Iterating `spec.paths` directly (not recommended):**

```handlebars
{{#each spec.paths}}
{{#each this}}
{{#unless (eq @key "parameters")}}
{{#unless (eq @key "servers")}}
{{#unless (eq @key "summary")}}
{{#unless (eq @key "description")}}
{{#if this.x-screen-id}}
  {{this.x-screen-const}}: { id: '{{this.x-screen-id}}', route: '{{@../key}}' },
{{/if}}
{{/unless}}
{{/unless}}
{{/unless}}
{{/unless}}
{{/each}}
{{/each}}
```

---

## Default Templates

### screen-navigation.hbs

Generates a navigation map. Outputs a `SCREENS` constant and `*_PAGE_LINKS` for each screen.

Example output:

```typescript
const _OP_ROUTES = {
  renderHomePage: '/home',
  renderSettingsPage: '/settings',
  renderChatPage: '/chat',
} as const;

export const SCREENS = {
  HOME: { id: 'SCR-001' as const, route: _OP_ROUTES.renderHomePage, supportsBack: false } as const,
  SETTINGS: { id: 'SCR-002' as const, route: _OP_ROUTES.renderSettingsPage, supportsBack: true } as const,
} as const;

export const HOME_PAGE_LINKS = {
  goToSettings: _OP_ROUTES.renderSettingsPage,
  goToChat: _OP_ROUTES.renderChatPage,
} as const;
```

### screen-events.hbs

Generates analytics event hooks. Outputs a `use{ScreenName}Events()` function for each screen that has `x-events`.

Example output:

```typescript
export function useHomePageEvents() {
  return {
    trackView: () =>
      trackEvent('home_view', 'screen_view', {}),
    trackSignOut: () =>
      trackEvent('sign_out', 'user_action', {}),
  };
}
```

Events with parameters are also supported with type safety:

```typescript
export function useChatPageEvents() {
  return {
    trackMessageSend: (message_length: number) =>
      trackEvent('chat_message_send', 'user_action', { message_length }),
  };
}
```

---

## Lint Rules

`micro-contracts lint` performs the following screen-specific checks:

| Code                          | Level   | Description                                              |
| ----------------------------- | ------- | -------------------------------------------------------- |
| `SCREEN_MISSING_CONST`        | Error   | `x-screen-id` present but `x-screen-const` missing      |
| `SCREEN_MISSING_NAME`         | Error   | `x-screen-id` present but `x-screen-name` missing       |
| `SCREEN_MISSING_OPERATION_ID` | Error   | Screen operation missing `operationId`                   |
| `SCREEN_INVALID_EVENTS`       | Error   | `x-events` is not an array                               |
| `SCREEN_INVALID_EVENT`        | Error   | `x-events` item missing `name`, `type`, or `method`     |

In `screen: true` modules, `MISSING_X_SERVICE` / `MISSING_X_METHOD` warnings are suppressed (screen specs do not need service/method declarations).

---

## Custom Templates

You can extend the default templates or create new ones for additional generated artifacts. All `ScreenContext` fields are available in templates.

### ViewProps Template Example

`spec/default/templates/screen-view-props.hbs`:

```handlebars
{{#each screens}}
export interface {{screenName}}ViewProps {
  // ViewModel: {{viewModelSchema}}
  // Screen ID: {{screenId}}
}
{{/each}}
```

Add to config:

```yaml
outputs:
  screen-view-props:
    output: frontend/src/screens/view-props.generated.ts
    template: screen-view-props.hbs
```

### Available Template Context

| Field             | Type      | Description                                        |
| ----------------- | --------- | -------------------------------------------------- |
| `screens`         | array     | `ScreenContext[]` — array of screen definitions    |
| `spec`            | object    | Raw OpenAPI spec (for direct access when needed)   |
| `title`           | string    | OpenAPI title                                      |
| `version`         | string    | OpenAPI version                                    |
| `moduleName`      | string    | Module name                                        |
| `contractPackage` | string    | Contract package import path                       |
| `schemaNames`     | string[]  | All schema names                                   |

---

## Tiered Integration

### Tier 1 — Core (built into micro-contracts)

- Type definitions: `x-screen-*` fields on `OperationObject`
- Screen context extraction: `TemplateContext.screens`
- Lint rules: Screen spec consistency checks
- `init --screens`: Starter file generation
- Default templates: `screen-navigation.hbs`, `screen-events.hbs`

### Tier 2 — Optional Packages / Official Recipes (future)

| Package                        | Purpose                                                                  |
| ------------------------------ | ------------------------------------------------------------------------ |
| `@micro-contracts/e2e-scaffold`| Parse screen spec to generate Playwright test stubs with coverage         |
| ViewProp / data-testid pattern | Derive stable test IDs from ViewModel fields + `x-screen-const`         |

### Tier 3 — Documentation Only (future)

| Pattern                   | Description                                                          |
| ------------------------- | -------------------------------------------------------------------- |
| Design tool integration   | Link screen IDs to design tool frames via `x-pen-node` or similar   |
| Requirements traceability | Link screens to user stories via `x-satisfies`                      |
| Data lineage declarations | Declare upstream API/DB origins on ViewModel schemas via `x-lineage-source` |
