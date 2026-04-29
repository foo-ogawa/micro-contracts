# micro-contracts 仕様変更案: inline `x-event` 対応

**対象パッケージ**: `micro-contracts` (現行 v0.13.0)
**提案バージョン**: v0.14.0
**作成日**: 2026-04-29
**ステータス**: Draft

---

## 1. 背景

現行の `micro-contracts` は画面仕様 OpenAPI の `x-events`（GET 操作直下のフラットリスト）を解析し、`ScreenContext.events` として Handlebars テンプレートに渡している。この設計には以下の問題がある。

- **トリガーとの紐づけがない**: イベントがどの UI 要素（link 遷移・アクション送信・画面表示）で発火するか YAML 上で表現できない
- **手動呼び出し依存**: 生成される `useXxxEvents()` hook は関数を返すだけで、発火タイミングは実装者任せ
- **method フィールドの冗長性**: `method` から関数名を生成するが、トリガーが自明な場合は不要

複数の利用プロジェクトで YAML スキーマを **inline `x-event`** 形式に移行済み。`micro-contracts` がこの新スキーマを解析・テンプレートに渡せるようにする。

さらに、`x-interactions`（画面内インタラクションの宣言）は現在利用プロジェクト側が独自に使用しているカスタム拡張であり、`micro-contracts` v0.13.0 には **型定義・パーサー・linter ルールのいずれも存在しない**。inline `x-event` が `x-interactions` の子要素に配置されるため、本提案では `x-interactions` 自体の正式サポートも併せて提案する。

---

## 2. 変更概要

| 項目 | 旧 (v0.13) | 新 (v0.14) |
|------|------------|------------|
| YAML フィールド | `get.x-events` (配列) | `get.x-event`, `links.*.x-event`, `post/put/patch/delete.x-event`, `x-interactions.*.x-event` (単値) |
| テンプレートデータ | `ScreenContext.events: ScreenEventDefinition[]` | `ScreenContext.screenEvent?`, `ScreenLink.event?`, `ScreenContext.actions[].event?`, `ScreenContext.interactions[].event?` |
| `method` フィールド | 必須 | **廃止** |
| `$ref` 解決 | なし | `components.x-event-defs` を解決（ローカル参照のみ） |
| params 自動導出 | なし | get→path params, links→遷移先 path params のみ。それ以外は明示指定 |
| linter ルール | `x-events` の配列構造チェック | `x-event` の3形式バリデーション |
| `x-interactions` | **未認識** (プロジェクト独自拡張) | `ScreenContext.interactions[]` として正式サポート |

---

## 3. 新 YAML スキーマ

### 3.1 配置場所と `type` の自動推論

```yaml
/home:
  get:
    x-event: home_view          # → type: "screen_view" (自動推論)
    responses:
      '200':
        links:
          goToDetail:
            operationId: renderDetailPage
            x-event:                          # → type: "user_action" (自動推論)
              $ref: '#/components/x-event-defs/itemTap'
  post:
    operationId: actionHomePage
    x-event: mode_switch        # → type: "user_action" (自動推論)
  delete:
    operationId: deleteHomeItem
    x-event: item_delete        # post 以外の変更系メソッドも対象
```

| 配置場所 | 推論される `type` |
|----------|------------------|
| `get` 直下 | `screen_view` |
| `links.*` 直下 | `user_action` |
| `post` / `put` / `patch` / `delete` 直下 | `user_action` |
| `x-interactions.*` 直下 | `user_action` |

`type` はオブジェクト形式で明示オーバーライド可能（例: `type: system`）。

#### `type` の値

| 値 | 意味 |
|----|------|
| `screen_view` | 画面表示時に自動発火 |
| `user_action` | ユーザー操作に起因するイベント |
| `system` | システム起因のイベント（OAuth コールバック等） |

上記は推奨値。自由文字列も許容するが、ツールやテンプレートが認識する値は上記3種とする。

### 3.2 `x-event` の3形式

```yaml
# 文字列形式（大半のケース）
x-event: home_view

# オブジェクト形式（type オーバーライド / 追加 params）
x-event:
  name: oauth_callback_result
  type: system
  params:
    success: boolean

# $ref 形式（複数箇所で再利用）
x-event:
  $ref: '#/components/x-event-defs/itemTap'
```

`$ref` は `#/components/x-event-defs/*` のローカル参照のみサポートする。外部ファイル参照は対象外。

### 3.3 再利用可能な定義

```yaml
components:
  x-event-defs:
    itemTap:
      name: item_tap
      params:
        itemId: string
```

### 3.4 params の導出ルール

| トリガー | params 導出 | 例 |
|----------|-------------|-----|
| `get` 直下 | 画面の path params から**自動導出** | `/calendar/{yearMonth}` → `{ yearMonth: string }` |
| `links.*` | 遷移先の path params から**自動導出** | `renderDetailPage` → `/item/{itemId}` → `{ itemId: string }` |
| `post` / `put` / `patch` / `delete` | 自動導出**なし**。必要なら `params` で明示指定 | `x-event: { name: mode_switch, params: { mode: string } }` |
| `x-interactions.*` | 自動導出**なし**。必要なら `params` で明示指定 | 同上 |

自動導出される params は、明示 `params` が指定されている場合は上書きされない（明示指定が優先）。

---

## 3.A `x-interactions` の正式サポート（新規拡張）

> **注意**: `x-interactions` は現在 `micro-contracts` に型定義・パーサー・linter ルールが **一切存在しない**。
> 利用プロジェクト側がカスタム拡張として YAML に記載し、プロジェクト固有のツールが独自に解析している状態である。

### 現状の問題

- `micro-contracts` の `extractScreens()` は `x-interactions` を完全に無視するため、テンプレートに渡される `ScreenContext` にインタラクション情報が含まれない
- 結果としてテンプレートでインタラクション起因のイベント生成ができない
- プロジェクト側が独自パーサーを重複実装している

### YAML 上の形式

```yaml
/home:
  get:
    x-interactions:
      - name: daySwipe
        description: Horizontal day-by-day swipe navigation
        x-event:                 # ← inline event（任意）
          name: day_swipe
          params:
            direction: string

      - name: itemSelect
        description: Select an item from choices
        x-event:
          name: item_select
          params:
            itemId: string
```

必須フィールドは `name` のみ。`description` は推奨。その他のプロジェクト固有のプロパティ（UI ライブラリバインディング等）は `x-interactions` エントリのカスタムフィールドとして自由に追加でき、テンプレートへパススルーされる。

### 提案する型定義

```typescript
/**
 * Raw x-interactions entry as it appears in OpenAPI YAML.
 * Placed on `paths.<path>.get['x-interactions']`.
 *
 * `name` is required. All other fields are optional.
 * Projects may add custom fields (e.g., module, factory) which
 * are passed through to templates as-is.
 */
export interface InteractionDefinitionRaw {
  name: string;
  description?: string;
  'x-event'?: string | InlineEventRaw;
  [key: string]: unknown;    // プロジェクト固有フィールドのパススルー
}
```

`OperationObject` への追加:

```typescript
export interface OperationObject {
  // ... 既存フィールド ...
  'x-interactions'?: InteractionDefinitionRaw[];   // ★ 新規
}
```

### パーサーでの処理

`extractScreens()` 内で `operation['x-interactions']` を読み取り、各エントリを `ScreenInteraction` に変換する。子要素の `x-event` は `resolveInlineEvent()` で解決する（セクション 5.1 参照）。`name`, `description`, `x-event` 以外のフィールドは `extras` にまとめてパススルーする。

### linter ルール

```typescript
if (operation['x-interactions']) {
  const interactions = operation['x-interactions'];
  if (!Array.isArray(interactions)) {
    errors.push({
      type: 'error',
      code: 'SCREEN_INVALID_INTERACTIONS',
      message: 'x-interactions must be an array',
      path, location,
    });
  } else {
    for (let i = 0; i < interactions.length; i++) {
      if (!interactions[i].name) {
        errors.push({
          type: 'error',
          code: 'SCREEN_INVALID_INTERACTION',
          message: `x-interactions[${i}] must have a name`,
          path, location,
        });
      }
      // 子 x-event があれば x-event バリデーションを再利用
    }
  }
}
```

---

## 4. TypeScript 型定義の変更

### 4.1 `types.ts` — 旧型の廃止と新型の追加

```typescript
// ── 廃止 ──
// 以下を @deprecated にし、次メジャーで削除
export interface ScreenEventDefinition {
  name: string;
  type: string;
  method: string;                // ← 廃止
  params?: Record<string, string>;
}

// ── 追加 ──
/**
 * Inline event declaration (placed on get, links, actions, interactions).
 * `type` is auto-inferred from placement if omitted.
 */
export interface InlineEventDefinition {
  name: string;
  type: string;                   // resolved (inferred or explicit)
  params?: Record<string, string>; // auto-derived (get/links) or explicit
}

// OperationObject に追加
export interface OperationObject {
  // ... 既存フィールド ...
  'x-events'?: ScreenEventDefinition[];       // @deprecated — 後方互換用
  'x-event'?: string | InlineEventRaw;        // ★ 新規
  'x-interactions'?: InteractionDefinitionRaw[]; // ★ 新規 (セクション 3.A 参照)
}

// YAML 上の生値（$ref 解決前）
type InlineEventRaw =
  | string                                  // name のみ
  | { name: string; type?: string; params?: Record<string, string> }
  | { $ref: string };
```

### 4.2 `templateProcessor.d.ts` — ScreenContext の拡張

```typescript
export interface ScreenContext {
  route: string;
  screenConst: string;
  screenId: string;
  screenName: string;
  operationId: string;
  supportsBack: boolean;
  viewModelSchema: string;
  links: ScreenLink[];
  requiresAuth: boolean;

  // ── 廃止（後方互換用に残す） ──
  /** @deprecated Use screenEvent / links[].event / actions[].event instead */
  events: ScreenEventDefinition[];

  // ── 追加 ──
  /** Inline event on the GET operation (screen_view) */
  screenEvent?: InlineEventDefinition;
  /** Mutation operations (post/put/patch/delete) with optional inline events */
  actions: ScreenAction[];
  /** Interaction bindings with optional inline events */
  interactions: ScreenInteraction[];
  /** Path parameters of this screen's route */
  pathParams: string[];
}

export interface ScreenLink {
  name: string;
  targetRoute: string;
  targetOperationId: string;
  // ── 追加 ──
  /** Inline event fired on navigation via this link */
  event?: InlineEventDefinition;
}

/** NEW — mutation operation (post/put/patch/delete) on this screen */
export interface ScreenAction {
  /** HTTP method (post, put, patch, delete) */
  method: string;
  operationId: string;
  summary: string;
  schemaRef: string;
  event?: InlineEventDefinition;
}

/** NEW — in-page interaction binding */
export interface ScreenInteraction {
  name: string;
  description: string;
  event?: InlineEventDefinition;
  /** Project-specific fields passed through from YAML */
  extras: Record<string, unknown>;
}
```

---

## 5. パーサーの変更 (`templateProcessor.js` — `extractScreens`)

### 5.1 `x-event` 解決関数の追加

```typescript
function resolveInlineEvent(
  raw: string | Record<string, unknown> | undefined,
  eventDefs: Record<string, unknown>,
  defaultType: string,
): InlineEventDefinition | undefined {
  if (raw == null) return undefined;

  // 文字列形式
  if (typeof raw === 'string') {
    return { name: raw, type: defaultType };
  }

  // $ref 形式（ローカル参照のみ: #/components/x-event-defs/*）
  if (raw.$ref) {
    const ref = raw.$ref as string;
    if (!ref.startsWith('#/components/x-event-defs/')) {
      return { name: ref, type: defaultType };  // 解決不能 — name にフォールバック
    }
    const defName = ref.split('/').pop()!;
    const resolved = eventDefs[defName] as Record<string, unknown> | undefined;
    if (!resolved) return { name: defName, type: defaultType };
    return {
      name: (resolved.name as string) ?? defName,
      type: (resolved.type as string) ?? defaultType,
      params: resolved.params as Record<string, string> | undefined,
    };
  }

  // オブジェクト形式
  return {
    name: (raw.name as string) ?? '',
    type: (raw.type as string) ?? defaultType,
    params: raw.params as Record<string, string> | undefined,
  };
}
```

### 5.2 params 自動導出

params の自動導出は **path parameters のみ** を対象とする。requestBody や query parameters からの自動導出は行わない。アクションやインタラクションで params が必要な場合は `x-event` オブジェクト内で明示指定する。

```typescript
function deriveEventParams(
  event: InlineEventDefinition,
  placement: 'get' | 'link',
  context: { routePath: string; targetRoute?: string },
): InlineEventDefinition {
  // 明示 params がある場合はそのまま返す
  if (event.params) return event;

  switch (placement) {
    case 'get': {
      const params = extractPathParams(context.routePath);
      if (params.length > 0) {
        event.params = Object.fromEntries(params.map(p => [p, 'string']));
      }
      break;
    }
    case 'link': {
      if (context.targetRoute) {
        const params = extractPathParams(context.targetRoute);
        if (params.length > 0) {
          event.params = Object.fromEntries(params.map(p => [p, 'string']));
        }
      }
      break;
    }
  }
  return event;
}

function extractPathParams(route: string): string[] {
  const matches = route.matchAll(/\{(\w+)\}/g);
  return [...matches].map(m => m[1]);
}
```

### 5.3 `extractScreens` 関数の変更

```diff
 function extractScreens(spec) {
   const screens = [];
   const operationRouteMap = buildOperationRouteMap(spec);
+  const components = spec.components ?? {};
+  const eventDefs = components['x-event-defs'] ?? {};

   for (const [apiPath, pathItem] of Object.entries(spec.paths)) {
     const operation = pathItem.get;
     if (!operation) continue;
     const screenId = operation['x-screen-id'];
     if (!screenId) continue;

     // ... (既存の screenConst, screenName 等の抽出) ...

-    const events = operation['x-events'] || [];
+    // ── 新: inline x-event (get 直下) ──
+    const screenEvent = resolveInlineEvent(
+      operation['x-event'], eventDefs, 'screen_view'
+    );
+    if (screenEvent) {
+      deriveEventParams(screenEvent, 'get', { routePath: apiPath });
+    }
+
+    // ── 後方互換: 旧 x-events が残っていれば読む ──
+    const legacyEvents = operation['x-events'] || [];

-    // Extract navigation links from 200 response
+    // Extract navigation links from 200 response only
     const links = [];
-    // ... (既存の link 抽出ループ) ...
-          links.push({ name: linkName, targetRoute, targetOperationId: linkObj.operationId });
+    const response200 = operation.responses?.['200'];
+    if (response200 && !isReference(response200) && response200.links) {
+      for (const [linkName, linkObj] of Object.entries(response200.links)) {
+        if (linkObj.operationId) {
+          const targetRoute = operationRouteMap.get(linkObj.operationId) || '';
+          const linkEvent = resolveInlineEvent(
+            linkObj['x-event'], eventDefs, 'user_action'
+          );
+          if (linkEvent) {
+            deriveEventParams(linkEvent, 'link',
+              { routePath: apiPath, targetRoute });
+          }
+          links.push({
+            name: linkName, targetRoute,
+            targetOperationId: linkObj.operationId,
+            event: linkEvent,
+          });
+        }
+      }
+    }

+    // ── 新: 変更系メソッド (post/put/patch/delete) の解析 ──
+    const actions = [];
+    const mutationMethods = ['post', 'put', 'patch', 'delete'];
+    for (const method of mutationMethods) {
+      const mutationOp = pathItem[method];
+      if (!mutationOp) continue;
+      const actionEvent = resolveInlineEvent(
+        mutationOp['x-event'], eventDefs, 'user_action'
+      );
+      // schemaRef 抽出 ...
+      actions.push({
+        method,
+        operationId: mutationOp.operationId ?? '',
+        summary: mutationOp.summary ?? '',
+        schemaRef,
+        event: actionEvent,
+      });
+    }
+
+    // ── 新: x-interactions の解析 ──
+    const rawInteractions = operation['x-interactions'] ?? [];
+    const interactions = rawInteractions.map(i => {
+      const { name, description, 'x-event': rawEvent, ...extras } = i;
+      return {
+        name: name ?? '',
+        description: description ?? '',
+        event: resolveInlineEvent(rawEvent, eventDefs, 'user_action'),
+        extras,
+      };
+    });

     screens.push({
       route: apiPath, screenConst, screenId, screenName,
       operationId, supportsBack, viewModelSchema,
-      links, events, requiresAuth,
+      links,
+      events: legacyEvents,   // 後方互換
+      screenEvent,
+      actions,
+      interactions,
+      pathParams: extractPathParams(apiPath),
+      requiresAuth,
     });
   }
 }
```

---

## 6. linter の変更 (`linter.js`)

### 6.1 旧ルールの deprecation

```diff
-// Validate x-events structure
-if (operation['x-events']) {
+// Deprecated: x-events (flat list) — warn but don't error
+if (operation['x-events']) {
+  warnings.push({
+    type: 'warning',
+    code: 'SCREEN_DEPRECATED_X_EVENTS',
+    message: 'x-events (flat list) is deprecated. Use inline x-event instead.',
+    path, location,
+  });
```

### 6.2 新ルールの追加

```typescript
// Validate inline x-event on GET
if (operation['x-event'] != null) {
  validateInlineEvent(operation['x-event'], path, location, errors);
}

// Validate x-event on links (200 response only)
if (response200?.links) {
  for (const [linkName, linkObj] of Object.entries(response200.links)) {
    if (linkObj['x-event'] != null) {
      validateInlineEvent(linkObj['x-event'],
        `${path}.responses.200.links.${linkName}`, location, errors);
    }
  }
}

// Validate x-event on mutation methods (post/put/patch/delete)
for (const method of ['post', 'put', 'patch', 'delete']) {
  const mutationOp = pathItem[method];
  if (mutationOp?.['x-event'] != null) {
    validateInlineEvent(mutationOp['x-event'],
      `${path}.${method}`, location, errors);
  }
}

// Validate $ref targets exist in components.x-event-defs
// ($ref は #/components/x-event-defs/* のローカル参照のみサポート)

// Validate x-events と x-event の同時使用は禁止
if (operation['x-events'] && operation['x-event'] != null) {
  errors.push({
    type: 'error',
    code: 'SCREEN_CONFLICTING_EVENT_DEFS',
    message: 'x-events and x-event cannot coexist on the same operation',
    path, location,
  });
}

// Validate x-interactions structure (★ 新規 — セクション 3.A 参照)
if (operation['x-interactions']) {
  const interactions = operation['x-interactions'];
  if (!Array.isArray(interactions)) {
    errors.push({
      type: 'error',
      code: 'SCREEN_INVALID_INTERACTIONS',
      message: 'x-interactions must be an array',
      path, location,
    });
  } else {
    for (let i = 0; i < interactions.length; i++) {
      if (!interactions[i].name) {
        errors.push({
          type: 'error',
          code: 'SCREEN_INVALID_INTERACTION',
          message: `x-interactions[${i}] must have a name`,
          path, location,
        });
      }
      // 子 x-event のバリデーション
      if (interactions[i]['x-event'] != null) {
        validateInlineEvent(interactions[i]['x-event'],
          `${path}.x-interactions[${i}]`, location, errors);
      }
    }
  }
}

// ── 共通バリデーション関数 ──
function validateInlineEvent(raw, path, location, errors) {
  if (typeof raw !== 'string' && typeof raw !== 'object') {
    errors.push({
      type: 'error',
      code: 'SCREEN_INVALID_X_EVENT',
      message: 'x-event must be a string, object with {name}, or {$ref}',
      path, location,
    });
  }
  if (typeof raw === 'object' && !raw.$ref && !raw.name) {
    errors.push({
      type: 'error',
      code: 'SCREEN_INVALID_X_EVENT',
      message: 'x-event object must have either $ref or name',
      path, location,
    });
  }
}
```

---

## 7. Handlebars ヘルパーの追加（任意）

テンプレートで使える追加ヘルパー（必要に応じて）:

```typescript
// event の有無チェック
Handlebars.registerHelper('hasEvent', (ctx) =>
  !!(ctx?.screenEvent || ctx?.links?.some(l => l.event) ||
     ctx?.actions?.some(a => a.event) ||
     ctx?.interactions?.some(i => i.event))
);

// params を TypeScript 引数リストに展開
Handlebars.registerHelper('eventParamsSignature', (params) => {
  if (!params) return '';
  return Object.entries(params)
    .map(([k, v]) => `${k}: ${v === 'integer' ? 'number' : v}`)
    .join(', ');
});
```

---

## 8. 後方互換性

| 項目 | 方針 |
|------|------|
| `x-events` (旧形式) | v0.14 では **warn + 引き続き読み込み**。`ScreenContext.events` に格納される。v0.15 で削除予定 |
| `ScreenEventDefinition.method` | v0.14 では型定義に残す（optional に変更）。テンプレートからの参照は `events[].method` で引き続き動作 |
| 旧テンプレートの `{{#each events}}` | `events` (legacy) が空でも `screenEvent` / `links[].event` から全イベントを収集する `allEvents` ヘルパーは提供しない。テンプレート側で新構造を使う |
| `x-events` と `x-event` の共存 | 同一 GET 操作に両方ある場合はエラー |
| `x-interactions` (既存 YAML) | v0.13 では無視されていたため、v0.14 で読み込み開始しても既存の生成結果に影響なし。破壊的変更にはあたらない |

---

## 9. テスト要件

| テスト | 内容 |
|--------|------|
| パーサーユニット | 文字列形式、オブジェクト形式、`$ref` 形式の3パターンを解決できること |
| パーサーユニット | `components.x-event-defs` が未定義の場合に安全にフォールバックすること |
| パーサーユニット | `get.x-event` → `screenEvent`、`links.*.x-event` → `ScreenLink.event`、`post.x-event` → `ScreenAction.event` に正しくマッピングされること |
| パーサーユニット | `put` / `patch` / `delete` の `x-event` も `ScreenAction` として収集されること |
| params 自動導出 | `get` 直下: path params が params として導出されること |
| params 自動導出 | `links.*`: 遷移先 route の path params が導出されること |
| params 自動導出 | `actions` の `x-event`: params が自動導出**されない**こと（明示指定のみ） |
| params 自動導出 | `x-interactions` の `x-event`: params が自動導出**されない**こと（明示指定のみ） |
| params 自動導出 | 明示 params がある場合、自動導出が上書きされないこと |
| linter | `x-events` 使用時に deprecation warning が出ること |
| linter | `x-event` の不正値（数値、空オブジェクト等）でエラーになること |
| linter | `$ref` 先が `components.x-event-defs` に存在しない場合に warning が出ること |
| linter | `$ref` が `#/components/x-event-defs/` 以外を指す場合のハンドリング |
| linter | `x-events` と `x-event` の同時使用でエラーになること |
| x-interactions パーサー | `x-interactions` 配列が `ScreenContext.interactions[]` に正しくマッピングされること |
| x-interactions パーサー | `x-interactions[].x-event` が `ScreenInteraction.event` として解決されること |
| x-interactions パーサー | `x-interactions` が省略された画面で `interactions` が空配列になること |
| x-interactions パーサー | `name` が欠落したエントリで linter エラーが出ること |
| x-interactions パーサー | `name`, `description`, `x-event` 以外のフィールドが `extras` にパススルーされること |
| x-interactions linter | `x-interactions` が配列以外の値の場合にエラーになること |
| E2E | 変換済みの画面仕様 YAML を食わせてテンプレート出力が期待通りになること |
| 後方互換 | 旧 `x-events` 形式の YAML を食わせて `ScreenContext.events` が従来通り埋まること |

---

## 10. テンプレートへの影響

`micro-contracts` 自体にはデフォルトの `screen-events.hbs` テンプレートは含まれていない（プロジェクト側で配置）。しかし、テンプレートに渡されるデータ構造が変わるため、プロジェクト側のテンプレート更新は必須。

以下は **React プロジェクトでの利用例**。テンプレートはプロジェクト側が自由に定義できるため、フレームワークに依存しない形式で記述することも可能。

```handlebars
{{#each screens}}
{{#if screenEvent}}
export function use{{screenName}}ScreenView() {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackEvent('{{screenEvent.name}}', '{{screenEvent.type}}', {});
  }, []);
}
{{/if}}

{{#each links}}
{{#if this.event}}
export function navigateVia{{capitalize this.name}}(
  {{eventParamsSignature this.event.params}}
) {
  trackEvent('{{this.event.name}}', '{{this.event.type}}',
    { {{#each this.event.params}}{{@key}}{{#unless @last}}, {{/unless}}{{/each}} });
  return '{{this.targetRoute}}';
}
{{/if}}
{{/each}}

{{#each actions}}
{{#if this.event}}
export function track{{capitalize this.operationId}}Event(
  {{eventParamsSignature this.event.params}}
) {
  trackEvent('{{this.event.name}}', '{{this.event.type}}',
    { {{#each this.event.params}}{{@key}}{{#unless @last}}, {{/unless}}{{/each}} });
}
{{/if}}
{{/each}}
{{/each}}
```

---

## 11. リリース手順

1. `micro-contracts` v0.14.0-beta.0 をリリース
2. 利用プロジェクト A で `npm install micro-contracts@0.14.0-beta.0` → `npx micro-contracts generate` で動作確認
3. 利用プロジェクト B で同様に確認
4. 問題なければ v0.14.0 を正式リリース
5. 各プロジェクトの `events.generated.ts` を再生成（手書き版を自動生成に置換）
