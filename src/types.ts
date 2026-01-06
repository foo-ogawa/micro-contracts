/**
 * OpenAPI specification types for code generation
 */

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
    'x-micro-contracts-depend-on'?: string[];  // Module-level dependencies
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    responses?: Record<string, ResponseObject>;
    parameters?: Record<string, ParameterObject>;
    requestBodies?: Record<string, RequestBodyObject>;
  };
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

export interface PathItem {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  patch?: OperationObject;
  delete?: OperationObject;
  parameters?: ParameterObject[];
}

export interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject | ReferenceObject;
  responses: Record<string, ResponseObject | ReferenceObject>;
  // Custom extensions (canonical names)
  'x-micro-contracts-domain'?: string;
  'x-micro-contracts-method'?: string;
  'x-micro-contracts-published'?: boolean;  // Include in contract-published (default: false)
  'x-micro-contracts-depend-on'?: string[];  // Operation-level dependencies
  // Security extensions
  'x-auth'?: 'required' | 'optional' | 'none';
  'x-authz'?: string[];
  'x-middleware'?: string[];
}

export interface ParameterObject {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: SchemaObject | ReferenceObject;
}

export interface RequestBodyObject {
  description?: string;
  required?: boolean;
  content: Record<string, MediaTypeObject>;
}

export interface ResponseObject {
  description: string;
  content?: Record<string, MediaTypeObject>;
}

export interface MediaTypeObject {
  schema?: SchemaObject | ReferenceObject;
}

export interface ReferenceObject {
  $ref: string;
}

export interface SchemaObject {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';
  format?: string;
  description?: string;
  enum?: Array<string | number | boolean>;
  items?: SchemaObject | ReferenceObject;
  properties?: Record<string, SchemaObject | ReferenceObject>;
  additionalProperties?: boolean | SchemaObject | ReferenceObject;
  required?: string[];
  nullable?: boolean;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  oneOf?: Array<SchemaObject | ReferenceObject>;
  anyOf?: Array<SchemaObject | ReferenceObject>;
  allOf?: Array<SchemaObject | ReferenceObject>;
  // Custom extensions
  'x-private'?: boolean;  // Mark as private (not allowed in public endpoints)
}

// =============================================================================
// Multi-Module Configuration
// =============================================================================

/**
 * Root configuration file structure
 */
export interface MultiModuleConfig {
  /** Default settings for all modules */
  defaults?: ModuleDefaults;

  /** Module definitions */
  modules: Record<string, ModuleConfig>;

  /** Spec directory structure configuration */
  spec?: SpecConfig;
}

/**
 * Spec directory structure configuration
 */
export interface SpecConfig {
  /** Root directory for spec files */
  root?: string;
  /** Shared resources configuration */
  shared?: {
    /** Path to shared OpenAPI schemas */
    openapi?: string;
    /** Path to shared templates */
    templates?: string;
    /** Path to shared overlays */
    overlays?: string;
    /** Path to shared spectral rules */
    spectral?: string;
  };
  /** Overlays to apply (in order) */
  overlays?: string[];
  /** Path to spectral ruleset */
  spectral?: string;
}

/**
 * Default settings applied to all modules (can be overridden per module)
 */
export interface ModuleDefaults {
  /** Contract package output config */
  contract?: {
    /** Output directory (supports {module} placeholder) */
    output: string;
  };

  /** Public contract extraction config */
  contractPublic?: {
    /** Output directory (supports {module} placeholder) */
    output: string;
  };

  /** Server output config (legacy) */
  server?: ServerConfig;

  /** Frontend output config (legacy) */
  frontend?: FrontendConfig;

  /** Documentation config */
  docs?: DocsConfig;

  /** Overlay configuration */
  overlays?: OverlayConfig;

  /** Template configuration (legacy) */
  templates?: TemplateConfig;

  /** Flexible output configuration */
  outputs?: Record<string, OutputConfig>;

  /** Shared module name for overlays */
  sharedModuleName?: string;
}

/**
 * Overlay configuration
 */
export interface OverlayConfig {
  /** Shared overlays applied to all modules */
  shared?: string[];
  /** Collision policy: error | warn | last-wins */
  collision?: 'error' | 'warn' | 'last-wins';
}

/**
 * Template configuration (legacy)
 */
export interface TemplateConfig {
  /** Path to server routes template */
  server?: string;
  /** Path to frontend client template */
  frontend?: string;
  /** Path to domain interface template */
  domains?: string;
}

/**
 * Output configuration for flexible template-based generation
 */
export interface OutputConfig {
  /** Output file/directory path (supports {module} placeholder) */
  output: string;
  /** Template file path (relative to spec/) */
  template: string;
  /** Don't overwrite if file exists */
  overwrite?: boolean;
  /** Condition for generating this output */
  condition?: 'hasPublicEndpoints' | 'hasOverlays' | 'always';
  /** Enable/disable this output */
  enabled?: boolean;
  /** Template-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * Dependency reference format: {module}.{domain}.{method}
 */
export interface DependencyRef {
  module: string;
  domain: string;
  method: string;
  raw: string;  // Original string
}

/**
 * Parse dependency reference string
 */
export function parseDependencyRef(ref: string): DependencyRef | null {
  const parts = ref.split('.');
  if (parts.length !== 3) return null;
  return {
    module: parts[0],
    domain: parts[1],
    method: parts[2],
    raw: ref,
  };
}

/**
 * Collected dependencies from OpenAPI spec
 */
export interface ModuleDependencies {
  /** Module-level dependencies (from info.x-micro-contracts-depend-on) */
  moduleLevelDeps: DependencyRef[];
  /** Operation-level dependencies */
  operationLevelDeps: Map<string, DependencyRef[]>;  // operationId -> deps
  /** All unique dependencies */
  allDeps: DependencyRef[];
}

/**
 * Per-module configuration
 */
export interface ModuleConfig {
  /** Path to OpenAPI spec file (required) */
  openapi: string;

  /** Override contract output */
  contract?: {
    output?: string;
  };

  /** Override public contract output */
  contractPublic?: {
    output?: string;
  };

  /** Override server config (legacy) */
  server?: ServerConfig & {
    /** Disable server generation for this module */
    enabled?: boolean;
  };

  /** Override frontend config (legacy) */
  frontend?: FrontendConfig & {
    /** Disable frontend generation for this module */
    enabled?: boolean;
  };

  /** Override docs config */
  docs?: DocsConfig;

  /** Module-specific overlays */
  overlays?: string[];

  /** Module-specific templates (legacy) */
  templates?: TemplateConfig;

  /** Module-specific output overrides */
  outputs?: Record<string, Partial<OutputConfig> & { enabled?: boolean }>;

  /** Module-specific Spectral config */
  spectral?: string;

  /** Explicit dependencies (must be subset of OpenAPI x-micro-contracts-depend-on) */
  dependsOn?: string[];
}

/**
 * Server generation config
 */
export interface ServerConfig {
  /** Output directory (supports {module} placeholder) */
  output?: string;
  /** Routes file name */
  routes?: string;
  /** Path to domains object in Fastify (supports {module} placeholder) */
  domainsPath?: string;
}

/**
 * Frontend generation config
 */
export interface FrontendConfig {
  /** Output directory (supports {module} placeholder) */
  output?: string;
  /** Client file name */
  client?: string;
  /** Domain re-exports file name */
  domain?: string;
  /** Shared client config (for contract-published) */
  shared?: {
    /** Output directory */
    output?: string;
    /** Client file name (supports {module} placeholder) */
    client?: string;
  };
}

/**
 * Documentation config
 */
export interface DocsConfig {
  /** Enable documentation generation */
  enabled?: boolean;
  /** Template for redoc */
  template?: string;
}

/**
 * Resolved output configuration
 */
export interface ResolvedOutputConfig {
  /** Output ID */
  id: string;
  /** Output file/directory path (placeholders expanded) */
  output: string;
  /** Template file path (resolved) */
  template: string;
  /** Don't overwrite if file exists */
  overwrite: boolean;
  /** Condition for generation */
  condition: 'hasPublicEndpoints' | 'hasOverlays' | 'always';
  /** Enabled */
  enabled: boolean;
  /** Template-specific configuration */
  config: Record<string, unknown>;
}

/**
 * Resolved configuration for a single module (after applying defaults)
 */
export interface ResolvedModuleConfig {
  /** Module name */
  name: string;
  /** Path to OpenAPI spec file */
  openapi: string;
  /** Contract output directory */
  contractOutput: string;
  /** Public contract output directory */
  contractPublicOutput: string;
  /** Server config (null if disabled) - legacy */
  server: {
    output: string;
    routes: string;
    domainsPath: string;
    template?: string;
  } | null;
  /** Frontend config (null if disabled) - legacy */
  frontend: {
    output: string;
    client: string;
    domain: string;
    template?: string;
    shared: {
      output: string;
      client: string;
    } | null;
  } | null;
  /** Docs config */
  docs: {
    enabled: boolean;
    template: string;
  };
  /** Overlay files to apply (in order) */
  overlays: string[];
  /** Overlay collision policy */
  overlayCollision: 'error' | 'warn' | 'last-wins';
  /** Resolved outputs (new flexible system) */
  outputs: ResolvedOutputConfig[];
  /** Module-specific Spectral config path */
  spectral?: string;
  /** Config-level dependencies (for validation) */
  dependsOn?: string[];
}

// =============================================================================
// Legacy Single-Module Configuration (deprecated)
// =============================================================================

/**
 * Legacy single-module config
 * @deprecated Use MultiModuleConfig instead
 */
export interface GeneratorConfig {
  /** Module name for domain access */
  moduleName?: string;

  /** Contract package output config */
  contract?: {
    /** Output directory for contract package */
    output: string;
    /** Path to OpenAPI spec (relative to module directory) */
    openapi?: string;
  };

  /** Public contract extraction config */
  contractPublic?: {
    /** Output directory for public contract */
    output: string;
  };

  /** Server output config */
  server?: {
    /** Output directory */
    output: string;
    /** Routes file name */
    routes?: string;
  };

  /** Frontend output config */
  frontend?: {
    /** Output directory */
    output: string;
    /** Client file name */
    client?: string;
    /** Shared client path (for contract-published) */
    shared?: string;
  };

  /** Documentation config */
  docs?: {
    /** Enable documentation generation */
    enabled?: boolean;
    /** Template for redoc */
    template?: string;
  };

  // Legacy config (for backward compatibility)
  /** @deprecated Use contract.openapi instead */
  input?: string;
  /** @deprecated Use server.output instead */
  output?: string;
  /** @deprecated */
  generateTypes?: boolean;
  /** @deprecated */
  generateSchemas?: boolean;
  /** @deprecated */
  generateRoutes?: boolean;
}

// =============================================================================
// Config Utilities
// =============================================================================

/**
 * Check if config is multi-module format
 */
export function isMultiModuleConfig(config: unknown): config is MultiModuleConfig {
  return typeof config === 'object' && config !== null && 'modules' in config;
}

/**
 * Expand placeholders in a string
 */
export function expandPlaceholders(template: string, moduleName: string): string {
  const pascalCase = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  const upperSnake = moduleName.toUpperCase().replace(/-/g, '_');
  
  return template
    .replace(/\{module\}/g, moduleName)
    .replace(/\{Module\}/g, pascalCase)
    .replace(/\{MODULE\}/g, upperSnake);
}

/**
 * Resolve outputs configuration
 */
function resolveOutputs(
  moduleName: string,
  moduleConfig: ModuleConfig,
  defaults: ModuleDefaults
): ResolvedOutputConfig[] {
  const expand = (s: string) => expandPlaceholders(s, moduleName);
  const resolvedOutputs: ResolvedOutputConfig[] = [];
  
  // Merge default outputs with module overrides
  const defaultOutputs = defaults.outputs || {};
  const moduleOutputs = moduleConfig.outputs || {};
  
  const allOutputIds = new Set([
    ...Object.keys(defaultOutputs),
    ...Object.keys(moduleOutputs),
  ]);
  
  for (const id of allOutputIds) {
    const defaultConfig = defaultOutputs[id];
    const moduleOverride = moduleOutputs[id];
    
    // Skip if explicitly disabled
    if (moduleOverride?.enabled === false) continue;
    
    // Need at least default config
    if (!defaultConfig && !moduleOverride?.output) continue;
    
    const output = expand(moduleOverride?.output ?? defaultConfig?.output ?? '');
    const template = moduleOverride?.template ?? defaultConfig?.template ?? '';
    
    if (!output || !template) continue;
    
    resolvedOutputs.push({
      id,
      output,
      template,
      overwrite: moduleOverride?.overwrite ?? defaultConfig?.overwrite ?? true,
      condition: moduleOverride?.condition ?? defaultConfig?.condition ?? 'always',
      enabled: moduleOverride?.enabled ?? defaultConfig?.enabled ?? true,
      config: {
        ...(defaultConfig?.config || {}),
        ...(moduleOverride?.config || {}),
      },
    });
  }
  
  return resolvedOutputs;
}

/**
 * Resolve module config by applying defaults and expanding placeholders
 */
export function resolveModuleConfig(
  moduleName: string,
  moduleConfig: ModuleConfig,
  defaults: ModuleDefaults = {}
): ResolvedModuleConfig {
  const expand = (s: string) => expandPlaceholders(s, moduleName);
  
  // Contract output
  const contractOutput = expand(
    moduleConfig.contract?.output ?? 
    defaults.contract?.output ?? 
    `packages/contract/${moduleName}`
  );
  
  // Public contract output
  const contractPublicOutput = expand(
    moduleConfig.contractPublic?.output ?? 
    defaults.contractPublic?.output ?? 
    `packages/contract-published/${moduleName}`
  );
  
  // Server config (legacy)
  const serverEnabled = moduleConfig.server?.enabled !== false;
  const server = serverEnabled ? {
    output: expand(
      moduleConfig.server?.output ?? 
      defaults.server?.output ?? 
      `server/src/${moduleName}`
    ),
    routes: moduleConfig.server?.routes ?? defaults.server?.routes ?? 'routes.generated.ts',
    domainsPath: expand(
      moduleConfig.server?.domainsPath ?? 
      defaults.server?.domainsPath ?? 
      `fastify.domains.${moduleName}`
    ),
  } : null;
  
  // Frontend config (legacy)
  const frontendEnabled = moduleConfig.frontend?.enabled !== false;
  const frontendDefaults = defaults.frontend;
  const frontendOverride = moduleConfig.frontend;
  
  let frontendShared: { output: string; client: string } | null = null;
  if (frontendEnabled) {
    const sharedConfig = frontendOverride?.shared ?? frontendDefaults?.shared;
    if (sharedConfig) {
      frontendShared = {
        output: expand(sharedConfig.output ?? 'frontend/src/shared'),
        client: expand(sharedConfig.client ?? `${moduleName}.api.generated.ts`),
      };
    }
  }
  
  const frontend = frontendEnabled ? {
    output: expand(
      frontendOverride?.output ?? 
      frontendDefaults?.output ?? 
      `frontend/src/${moduleName}`
    ),
    client: frontendOverride?.client ?? frontendDefaults?.client ?? 'api.generated.ts',
    domain: frontendOverride?.domain ?? frontendDefaults?.domain ?? 'domain.generated.ts',
    shared: frontendShared,
  } : null;
  
  // Docs config
  const docs = {
    enabled: moduleConfig.docs?.enabled ?? defaults.docs?.enabled ?? true,
    template: moduleConfig.docs?.template ?? defaults.docs?.template ?? 'default',
  };
  
  // Overlays (shared + module-specific)
  const overlays: string[] = [
    ...(defaults.overlays?.shared || []),
    ...(moduleConfig.overlays || []),
  ];
  
  const overlayCollision = defaults.overlays?.collision || 'error';

  // Templates (module overrides defaults) - legacy
  const serverWithTemplate = server ? {
    ...server,
    template: moduleConfig.templates?.server ?? defaults.templates?.server,
  } : null;
  
  const frontendWithTemplate = frontend ? {
    ...frontend,
    template: moduleConfig.templates?.frontend ?? defaults.templates?.frontend,
  } : null;
  
  // New outputs system
  const outputs = resolveOutputs(moduleName, moduleConfig, defaults);
  
  return {
    name: moduleName,
    openapi: moduleConfig.openapi,
    contractOutput,
    contractPublicOutput,
    server: serverWithTemplate,
    frontend: frontendWithTemplate,
    docs,
    overlays,
    overlayCollision,
    outputs,
    spectral: moduleConfig.spectral,
    dependsOn: moduleConfig.dependsOn,
  };
}

// Route info extracted from OpenAPI
export interface RouteInfo {
  path: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  operationId: string;
  domain: string;
  domainMethod: string;
  isPublished: boolean;
  summary?: string;
  tags?: string[];
  queryParams?: ParameterInfo[];
  pathParams?: ParameterInfo[];
  requestBody?: {
    schemaName: string;
    required: boolean;
  };
  responses: ResponseInfo[];
  /** Middleware/overlay names from x-middleware extension */
  overlays?: string[];
}

export interface ParameterInfo {
  name: string;
  required: boolean;
  schemaName?: string;
}

export interface ResponseInfo {
  statusCode: string;
  schemaName?: string;
}

// Domain info for interface generation
export interface DomainInfo {
  name: string;
  methods: DomainMethodInfo[];
}

export interface DomainMethodInfo {
  name: string;
  operationId: string;
  httpMethod: string;
  path: string;
  isPublished: boolean;
  requestType?: string;
  responseType?: string;
  /** Params type (path + query combined) */
  paramsType?: string;
}

// Lint result
export interface LintError {
  type: 'error' | 'warning';
  code: string;
  message: string;
  path?: string;
  location?: string;
}

// Helper to check if object is a reference
export function isReference(obj: unknown): obj is ReferenceObject {
  return typeof obj === 'object' && obj !== null && '$ref' in obj;
}

// Extract schema name from $ref
export function getRefName(ref: string): string {
  // "#/components/schemas/EntryListResponse" -> "EntryListResponse"
  const parts = ref.split('/');
  return parts[parts.length - 1];
}

/**
 * Extract dependencies from OpenAPI spec
 */
export function extractDependencies(spec: OpenAPISpec): ModuleDependencies {
  const moduleLevelDeps: DependencyRef[] = [];
  const operationLevelDeps = new Map<string, DependencyRef[]>();
  const allDepsSet = new Set<string>();
  
  // Module-level dependencies
  const moduleDepRefs = spec.info['x-micro-contracts-depend-on'] || [];
  for (const ref of moduleDepRefs) {
    const parsed = parseDependencyRef(ref);
    if (parsed) {
      moduleLevelDeps.push(parsed);
      allDepsSet.add(ref);
    }
  }
  
  // Operation-level dependencies
  for (const [, pathItem] of Object.entries(spec.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = pathItem[method];
      if (!operation) continue;
      
      const opId = operation.operationId || '';
      const opDepRefs = operation['x-micro-contracts-depend-on'] || [];
      
      if (opDepRefs.length > 0) {
        const parsedDeps: DependencyRef[] = [];
        for (const ref of opDepRefs) {
          const parsed = parseDependencyRef(ref);
          if (parsed) {
            parsedDeps.push(parsed);
            allDepsSet.add(ref);
          }
        }
        if (parsedDeps.length > 0) {
          operationLevelDeps.set(opId, parsedDeps);
        }
      }
    }
  }
  
  // All unique deps
  const allDeps: DependencyRef[] = [];
  for (const ref of allDepsSet) {
    const parsed = parseDependencyRef(ref);
    if (parsed) allDeps.push(parsed);
  }
  
  return { moduleLevelDeps, operationLevelDeps, allDeps };
}

/**
 * Get canonical extension value (supports both short and long forms)
 */
export function getExtensionValue<T>(
  obj: Record<string, unknown>,
  shortName: string,
  longName: string
): T | undefined {
  return (obj[longName] ?? obj[shortName]) as T | undefined;
}

// Check if a schema contains x-private properties
export function hasPrivateProperties(
  schema: SchemaObject | ReferenceObject,
  spec: OpenAPISpec,
  visited = new Set<string>()
): boolean {
  if (isReference(schema)) {
    const refName = getRefName(schema.$ref);
    if (visited.has(refName)) return false;
    visited.add(refName);
    
    const resolved = spec.components?.schemas?.[refName];
    if (!resolved) return false;
    return hasPrivateProperties(resolved, spec, visited);
  }

  // Check if schema itself is private
  if (schema['x-private']) return true;

  // Check properties
  if (schema.properties) {
    for (const propSchema of Object.values(schema.properties)) {
      if (hasPrivateProperties(propSchema, spec, visited)) return true;
    }
  }

  // Check array items
  if (schema.items) {
    if (hasPrivateProperties(schema.items, spec, visited)) return true;
  }

  // Check allOf/oneOf/anyOf
  for (const composite of [schema.allOf, schema.oneOf, schema.anyOf]) {
    if (composite) {
      for (const s of composite) {
        if (hasPrivateProperties(s, spec, visited)) return true;
      }
    }
  }

  return false;
}

// Collect all schemas referenced by a schema
export function collectReferencedSchemas(
  schema: SchemaObject | ReferenceObject,
  spec: OpenAPISpec,
  result = new Set<string>()
): Set<string> {
  if (isReference(schema)) {
    const refName = getRefName(schema.$ref);
    if (result.has(refName)) return result;
    result.add(refName);
    
    const resolved = spec.components?.schemas?.[refName];
    if (resolved) {
      collectReferencedSchemas(resolved, spec, result);
    }
    return result;
  }

  if (schema.properties) {
    for (const propSchema of Object.values(schema.properties)) {
      collectReferencedSchemas(propSchema, spec, result);
    }
  }

  if (schema.items) {
    collectReferencedSchemas(schema.items, spec, result);
  }

  for (const composite of [schema.allOf, schema.oneOf, schema.anyOf]) {
    if (composite) {
      for (const s of composite) {
        collectReferencedSchemas(s, spec, result);
      }
    }
  }

  if (schema.additionalProperties && typeof schema.additionalProperties !== 'boolean') {
    collectReferencedSchemas(schema.additionalProperties, spec, result);
  }

  return result;
}
