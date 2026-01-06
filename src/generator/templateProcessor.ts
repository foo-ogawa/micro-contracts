/**
 * Template Processor
 * 
 * Provides Handlebars template loading and processing for code generation.
 * Supports custom templates for server routes, frontend clients, etc.
 */

import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import type { OpenAPISpec, OperationObject, ParameterObject } from '../types.js';
import type { ExtensionInfo } from './overlayProcessor.js';
import { isReference, getRefName } from '../types.js';

// =============================================================================
// Types
// =============================================================================

export interface TemplateConfig {
  /** Path to server route template */
  server?: string;
  /** Path to frontend client template */
  frontend?: string;
  /** Path to domain interface template */
  domains?: string;
  /** Custom templates by name */
  custom?: Record<string, string>;
}

export interface TemplateContext {
  /** Module name */
  moduleName: string;
  /** OpenAPI spec (possibly transformed) */
  spec: OpenAPISpec;
  /** OpenAPI title */
  title: string;
  /** OpenAPI version */
  version: string;
  /** Base URL derived from OpenAPI servers[0].url */
  baseUrl: string;
  /** Extension information from overlays */
  extensionInfo: ExtensionInfo[];
  /** Applied overlays */
  appliedOverlays: string[];
  /** Path to domains object (e.g., 'fastify.domains.core') */
  domainsPath: string;
  /** Contract package import path */
  contractPackage: string;
  /** Routes extracted from spec */
  routes: RouteContext[];
  /** Domains grouped from routes (with methods list) */
  domains: DomainContext[];
  /** Domain API types for import (e.g., ['UserDomainApi', 'OrderDomainApi']) */
  domainTypes: string[];
  /** Schema types needed for import */
  schemaTypes: string[];
  /** All schema names */
  schemaNames: string[];
  /** Unique overlays with their parameters (for overlay adapter generation) */
  uniqueOverlays: UniqueOverlayContext[];
}

export interface UniqueOverlayContext {
  name: string;
  params: ExtensionParameterContext[];
}

export interface RouteContext {
  path: string;
  fastifyPath: string;
  /** URL pattern for client (with ${params.xxx} template syntax) */
  clientUrlPattern: string;
  method: string;
  /** HTTP method in uppercase */
  httpMethod: string;
  operationId: string;
  domain: string;
  domainKey: string;
  domainMethod: string;
  summary?: string;
  tags: string[];
  isPublished: boolean;
  /** Extensions applied to this route */
  extensions: RouteExtension[];
  /** Query parameters */
  queryParams: ParameterContext[];
  /** Path parameters */
  pathParams: ParameterContext[];
  /** Request body info */
  requestBody?: {
    schemaName: string;
    required: boolean;
  };
  /** Response info */
  responses: ResponseContext[];
  /** Type name base for this route (e.g., 'User_getUsers') */
  typeNameBase: string;
  /** Response type (for return type) */
  responseType: string;
  /** Request body type (if exists) */
  requestType?: string;
  /** Params type (path + query combined, if exists) */
  paramsType?: string;
  /** Unified input type (e.g., UserDomain_getUsersInput) */
  inputType: string;
  /** URL pattern for client using input object (with ${input.xxx} template syntax) */
  clientUrlPatternInput: string;
  /** Parameters injected by extensions for this route */
  extensionParams: ExtensionParameterContext[];
}

export interface RouteExtension {
  marker: string;
  value: string;
  registryKey: string;  // e.g., 'middlewareRegistry.requireAuth'
}

export interface ExtensionParameterContext {
  extensionName: string;
  name: string;
  location: 'headers' | 'query' | 'params';
  tsType: string;
  required: boolean;
}

export interface ParameterContext {
  name: string;
  required: boolean;
  schemaName?: string;
}

export interface ResponseContext {
  statusCode: string;
  schemaName?: string;
}

export interface DomainContext {
  name: string;
  key: string;
  methods: string[];
}

// =============================================================================
// Template Processor
// =============================================================================

/**
 * Load and compile a template
 */
export function loadTemplate(templatePath: string): Handlebars.TemplateDelegate {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }
  
  const content = fs.readFileSync(templatePath, 'utf-8');
  return Handlebars.compile(content);
}

/**
 * Template resolution options
 */
export interface TemplateResolveOptions {
  /** Base spec directory (e.g., 'spec/') */
  specDir: string;
  /** Module name */
  moduleName: string;
  /** Template file name (e.g., 'fastify-routes.hbs') */
  templateName: string;
}

/**
 * Resolve template path following priority order:
 * 1. spec/{module}/templates/{templateName}
 * 2. spec/default/templates/{templateName}
 * 
 * Returns null if not found (no built-in fallback)
 */
export function resolveTemplatePath(options: TemplateResolveOptions): string | null {
  const { specDir, moduleName, templateName } = options;
  
  // Priority 1: Module-specific template
  const moduleTemplatePath = path.join(specDir, moduleName, 'templates', templateName);
  if (fs.existsSync(moduleTemplatePath)) {
    return moduleTemplatePath;
  }
  
  // Priority 2: Default templates
  const defaultTemplatePath = path.join(specDir, 'default', 'templates', templateName);
  if (fs.existsSync(defaultTemplatePath)) {
    return defaultTemplatePath;
  }
  
  // No built-in fallback
  return null;
}

/**
 * Load template with automatic resolution
 */
export function loadTemplateWithResolution(options: TemplateResolveOptions): Handlebars.TemplateDelegate {
  const templatePath = resolveTemplatePath(options);
  if (!templatePath) {
    // Try absolute/relative path as fallback
    const absolutePath = path.resolve(options.templateName);
    if (fs.existsSync(absolutePath)) {
      return loadTemplate(absolutePath);
    }
    
    throw new Error(
      `Template not found: ${options.templateName}\n` +
      `Searched in:\n` +
      `  - ${path.join(options.specDir, options.moduleName, 'templates', options.templateName)}\n` +
      `  - ${path.join(options.specDir, 'default', 'templates', options.templateName)}\n` +
      `  - ${absolutePath}\n` +
      `\nRun 'micro-contracts init' to create starter templates.`
    );
  }
  return loadTemplate(templatePath);
}

/**
 * Get default template content (built-in - for backward compatibility only)
 * @deprecated Use loadTemplateWithResolution instead
 */
export function getDefaultTemplate(type: 'server' | 'frontend' | 'domains'): string {
  switch (type) {
    case 'server':
      return DEFAULT_SERVER_TEMPLATE;
    case 'frontend':
      return DEFAULT_FRONTEND_TEMPLATE;
    case 'domains':
      return DEFAULT_DOMAINS_TEMPLATE;
  }
}

/**
 * Build template context from spec and overlay result
 */
export function buildTemplateContext(
  spec: OpenAPISpec,
  moduleName: string,
  options: {
    domainsPath?: string;
    contractPackage?: string;
    extensionInfo?: Map<string, ExtensionInfo>;
    appliedOverlays?: string[];
  } = {}
): TemplateContext {
  const domainsPath = options.domainsPath || `fastify.domains.${moduleName}`;
  const contractPackage = options.contractPackage || `@project/contract/${moduleName}`;
  const extensionInfo = options.extensionInfo 
    ? Array.from(options.extensionInfo.values())
    : [];
  const appliedOverlays = options.appliedOverlays || [];
  
  const routes = extractRoutes(spec, extensionInfo);
  const domains = extractDomains(routes);
  const schemaNames = Object.keys(spec.components?.schemas || {});
  
  // Extract base URL from OpenAPI servers
  const baseUrl = extractBaseUrl(spec);
  
  // Extract domain types for imports (e.g., 'UserDomainApi')
  // Note: domain.name already includes 'Domain' suffix (e.g., 'UserDomain')
  const domainTypes = domains.map(d => `${d.name}Api`);
  
  // Extract schema types needed for imports
  const schemaTypes = extractSchemaTypes(routes);

  // Extract unique overlays with their parameters (deduplicated)
  const uniqueOverlays = extractUniqueOverlays(routes);

  return {
    moduleName,
    spec,
    title: spec.info.title,
    version: spec.info.version,
    baseUrl,
    extensionInfo,
    appliedOverlays,
    domainsPath,
    contractPackage,
    routes,
    domains,
    domainTypes,
    schemaTypes,
    schemaNames,
    uniqueOverlays,
  };
}

/**
 * Extract unique overlays from routes (deduplicated by overlay name)
 */
function extractUniqueOverlays(routes: RouteContext[]): UniqueOverlayContext[] {
  const overlayMap = new Map<string, ExtensionParameterContext[]>();

  for (const route of routes) {
    for (const ext of route.extensions) {
      if (!overlayMap.has(ext.value)) {
        // Find params for this overlay
        const params = route.extensionParams.filter(p => p.extensionName === ext.value);
        overlayMap.set(ext.value, params);
      }
    }
  }

  return Array.from(overlayMap.entries()).map(([name, params]) => ({ name, params }));
}

/**
 * Extract base URL from OpenAPI servers field
 * Returns path portion only (e.g., '/api' from 'http://localhost:3000/api')
 */
function extractBaseUrl(spec: OpenAPISpec): string {
  const servers = spec.servers;
  if (!servers || servers.length === 0) {
    return '';
  }
  
  const serverUrl = servers[0].url;
  try {
    // Try to parse as full URL
    const url = new URL(serverUrl);
    // Return pathname, removing trailing slash
    return url.pathname.replace(/\/$/, '');
  } catch {
    // If not a valid URL, assume it's already a path
    return serverUrl.replace(/\/$/, '');
  }
}

/**
 * Extract all schema types needed for client imports
 */
function extractSchemaTypes(routes: RouteContext[]): string[] {
  const types = new Set<string>();
  types.add('ProblemDetails'); // Always needed for error handling
  
  for (const route of routes) {
    if (route.requestBody?.schemaName) {
      types.add(route.requestBody.schemaName);
    }
    for (const resp of route.responses) {
      if (resp.schemaName) {
        types.add(resp.schemaName);
      }
    }
    // Add params type (path + query parameters) for templates that need it
    if (route.pathParams.length > 0 || route.queryParams.length > 0) {
      types.add(`${route.typeNameBase}Params`);
    }
    // Add unified input type (for domain-aligned templates)
    types.add(`${route.typeNameBase}Input`);
  }
  
  return Array.from(types).sort();
}

/**
 * Process template with context
 */
export function processTemplate(
  template: Handlebars.TemplateDelegate,
  context: TemplateContext
): string {
  return template(context);
}

/**
 * Generate code using template
 */
export function generateWithTemplate(
  templatePath: string | null,
  defaultType: 'server' | 'frontend' | 'domains',
  context: TemplateContext
): string {
  let template: Handlebars.TemplateDelegate;
  
  if (templatePath && fs.existsSync(templatePath)) {
    template = loadTemplate(templatePath);
  } else {
    template = Handlebars.compile(getDefaultTemplate(defaultType));
  }
  
  return processTemplate(template, context);
}

// =============================================================================
// Route Extraction
// =============================================================================

function extractRoutes(
  spec: OpenAPISpec,
  extensionInfo: ExtensionInfo[]
): RouteContext[] {
  const routes: RouteContext[] = [];
  const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;

  for (const [apiPath, pathItem] of Object.entries(spec.paths)) {
    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      // Canonical extension names only
      const domain = operation['x-micro-contracts-domain'];
      const domainMethod = operation['x-micro-contracts-method'];
      
      if (!domain || !domainMethod) continue;

      const operationId = operation.operationId || `${method}${apiPath.replace(/[^a-zA-Z0-9]/g, '')}`;
      const typeNameBase = `${domain}_${domainMethod}`;
      const fastifyPath = apiPath.replace(/\{([^}]+)\}/g, ':$1');
      const domainKey = domain.replace(/Domain$/, '').charAt(0).toLowerCase() + 
                       domain.replace(/Domain$/, '').slice(1);

      // Extract extensions and their parameters
      const extensions: RouteExtension[] = [];
      const extensionParams: ExtensionParameterContext[] = [];
      
      for (const info of extensionInfo) {
        const extValue = (operation as unknown as Record<string, unknown>)[info.marker];
        if (extValue) {
          const matches = Array.isArray(extValue) 
            ? extValue.includes(info.name)
            : extValue === info.name;
            
          if (matches) {
            const registryName = markerToRegistryName(info.marker);
            extensions.push({
              marker: info.marker,
              value: info.name,
              registryKey: `${registryName}.${info.name}`,
            });
            
            // Add parameters injected by this extension
            for (const param of info.injectedParameters) {
              // Map OpenAPI 'in' values to HTTP request property names
              const locationMap: Record<string, 'headers' | 'query' | 'params'> = {
                header: 'headers',
                query: 'query',
                path: 'params',
              };
              extensionParams.push({
                extensionName: info.name,
                name: param.name,
                location: locationMap[param.in] || 'headers',
                tsType: parameterToTsType(param),
                required: param.required || false,
              });
            }
          }
        }
      }

      // Extract parameters
      const allParams = operation.parameters || [];
      const queryParams = allParams
        .filter((p): p is ParameterObject => !isReference(p) && p.in === 'query')
        .map(p => ({ name: p.name, required: p.required || false }));
      const pathParams = allParams
        .filter((p): p is ParameterObject => !isReference(p) && p.in === 'path')
        .map(p => ({ name: p.name, required: true }));

      // Extract request body
      let requestBody: RouteContext['requestBody'];
      if (operation.requestBody) {
        const reqBody = isReference(operation.requestBody)
          ? null  // Simplified - would need to resolve
          : operation.requestBody;
        
        if (reqBody?.content?.['application/json']?.schema) {
          const schema = reqBody.content['application/json'].schema;
          const schemaName = isReference(schema) 
            ? getRefName(schema.$ref)
            : operationId + 'Body';
          requestBody = { schemaName, required: reqBody.required || false };
        }
      }

      // Extract responses
      const responses: ResponseContext[] = [];
      for (const [statusCode, response] of Object.entries(operation.responses)) {
        const resp = isReference(response) ? null : response;
        if (resp?.content?.['application/json']?.schema) {
          const schema = resp.content['application/json'].schema;
          const schemaName = isReference(schema) ? getRefName(schema.$ref) : undefined;
          responses.push({ statusCode, schemaName });
        } else {
          responses.push({ statusCode });
        }
      }

      // Client URL pattern: /users/{id} -> /users/${params.id}
      const clientUrlPattern = apiPath.replace(/\{([^}]+)\}/g, '${params.$1}');
      // Client URL pattern using input object: /users/{id} -> /users/${input.id}
      const clientUrlPatternInput = apiPath.replace(/\{([^}]+)\}/g, '${input.$1}');
      
      // Calculate type names
      const responseType = responses.length > 0 && responses[0].schemaName 
        ? responses[0].schemaName 
        : 'void';
      const requestType = requestBody?.schemaName;
      // Params type combines both path and query parameters
      const paramsType = (pathParams.length > 0 || queryParams.length > 0) ? `${typeNameBase}Params` : undefined;
      // Unified input type name (matches contract domain API)
      const inputType = `${typeNameBase}Input`;
      
      routes.push({
        path: apiPath,
        fastifyPath,
        clientUrlPattern,
        clientUrlPatternInput,
        method,
        httpMethod: method.toUpperCase(),
        operationId,
        domain,
        domainKey,
        domainMethod,
        summary: operation.summary,
        tags: operation.tags || [],
        isPublished: operation['x-micro-contracts-published'] === true,
        extensions,
        extensionParams,
        queryParams,
        pathParams,
        requestBody,
        responses,
        typeNameBase,
        responseType,
        requestType,
        paramsType,
        inputType,
      });
    }
  }

  return routes;
}

function extractDomains(routes: RouteContext[]): DomainContext[] {
  const domainMap = new Map<string, DomainContext>();

  for (const route of routes) {
    if (!domainMap.has(route.domain)) {
      domainMap.set(route.domain, {
        name: route.domain,
        key: route.domainKey,
        methods: [],
      });
    }
    const domain = domainMap.get(route.domain)!;
    if (!domain.methods.includes(route.domainMethod)) {
      domain.methods.push(route.domainMethod);
    }
  }

  return Array.from(domainMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function markerToRegistryName(marker: string): string {
  const name = marker.replace(/^x-/, '');
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + 'Registry';
}

/**
 * Convert OpenAPI parameter to TypeScript type
 */
function parameterToTsType(param: ParameterObject): string {
  if (!param.schema) return 'unknown';
  
  const schema = param.schema as { type?: string; format?: string };
  switch (schema.type) {
    case 'string':
      return 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'unknown[]';
    default:
      return 'unknown';
  }
}

// =============================================================================
// Register Handlebars Helpers
// =============================================================================

// Comparison helpers
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('ne', (a, b) => a !== b);
Handlebars.registerHelper('gt', (a, b) => a > b);
Handlebars.registerHelper('gte', (a, b) => a >= b);
Handlebars.registerHelper('lt', (a, b) => a < b);
Handlebars.registerHelper('lte', (a, b) => a <= b);
Handlebars.registerHelper('and', function(...args) {
  const options = args.pop();
  return args.every(Boolean);
});
Handlebars.registerHelper('or', function(...args) {
  const options = args.pop();
  return args.some(Boolean);
});

// Array/Object helpers
Handlebars.registerHelper('length', (arr) => arr?.length || 0);
Handlebars.registerHelper('first', (arr) => arr?.[0]);
Handlebars.registerHelper('last', (arr) => arr?.[arr?.length - 1]);
Handlebars.registerHelper('join', (arr, sep) => arr?.join(sep) || '');
Handlebars.registerHelper('includes', (arr, val) => arr?.includes(val));
Handlebars.registerHelper('keys', (obj) => Object.keys(obj || {}));
Handlebars.registerHelper('values', (obj) => Object.values(obj || {}));

// String helpers
Handlebars.registerHelper('uppercase', (str) => str?.toUpperCase());
Handlebars.registerHelper('lowercase', (str) => str?.toLowerCase());
Handlebars.registerHelper('capitalize', (str) => str?.charAt(0).toUpperCase() + str?.slice(1));
Handlebars.registerHelper('camelCase', (str: string) => {
  return str?.replace(/-([a-z])/g, (_match: string, c: string) => c.toUpperCase());
});
Handlebars.registerHelper('pascalCase', (str: string) => {
  const camel = str?.replace(/-([a-z])/g, (_match: string, c: string) => c.toUpperCase());
  return camel?.charAt(0).toUpperCase() + camel?.slice(1);
});
Handlebars.registerHelper('kebabCase', (str) => {
  return str?.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
});

// JSON helper
Handlebars.registerHelper('json', (obj) => JSON.stringify(obj, null, 2));

// Conditional block helpers
Handlebars.registerHelper('ifCond', function(this: unknown, v1, operator, v2, options) {
  switch (operator) {
    case '==': return v1 == v2 ? (options as Handlebars.HelperOptions).fn(this) : (options as Handlebars.HelperOptions).inverse(this);
    case '===': return v1 === v2 ? (options as Handlebars.HelperOptions).fn(this) : (options as Handlebars.HelperOptions).inverse(this);
    case '!=': return v1 != v2 ? (options as Handlebars.HelperOptions).fn(this) : (options as Handlebars.HelperOptions).inverse(this);
    case '!==': return v1 !== v2 ? (options as Handlebars.HelperOptions).fn(this) : (options as Handlebars.HelperOptions).inverse(this);
    case '<': return v1 < v2 ? (options as Handlebars.HelperOptions).fn(this) : (options as Handlebars.HelperOptions).inverse(this);
    case '<=': return v1 <= v2 ? (options as Handlebars.HelperOptions).fn(this) : (options as Handlebars.HelperOptions).inverse(this);
    case '>': return v1 > v2 ? (options as Handlebars.HelperOptions).fn(this) : (options as Handlebars.HelperOptions).inverse(this);
    case '>=': return v1 >= v2 ? (options as Handlebars.HelperOptions).fn(this) : (options as Handlebars.HelperOptions).inverse(this);
    default: return (options as Handlebars.HelperOptions).inverse(this);
  }
});

// =============================================================================
// Default Templates
// =============================================================================

const DEFAULT_SERVER_TEMPLATE = `/**
 * Auto-generated Fastify routes from OpenAPI specification
 * Generated from: {{spec.info.title}} v{{spec.info.version}}
 * DO NOT EDIT MANUALLY
 */

import type { FastifyInstance } from 'fastify';
import { allSchemas } from '{{contractPackage}}/schemas';
import * as types from '{{contractPackage}}/schemas';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Register all schemas from contract package
  for (const schema of allSchemas) {
    fastify.addSchema(schema);
  }

  // Domain references from {{domainsPath}}
  const { {{#each domains}}{{key}}{{#unless @last}}, {{/unless}}{{/each}} } = {{domainsPath}};
{{#if extensionInfo.length}}

  // Extension registries
{{#each extensionInfo}}
  const {{camelCase marker}}Registry = fastify.{{camelCase marker}}Registry;
{{/each}}
{{/if}}

{{#each routes}}
  // {{summary}}
  // {{uppercase method}} {{path}}{{#if isPublished}} (published){{/if}}
  fastify.{{method}}('{{fastifyPath}}', {
{{#if queryParams.length}}
    schema: {
      querystring: { $ref: '{{typeNameBase}}Query#' },
{{/if}}
{{#if pathParams.length}}
{{#unless queryParams.length}}
    schema: {
{{/unless}}
      params: { $ref: '{{typeNameBase}}Params#' },
{{/if}}
{{#if requestBody}}
{{#unless (or queryParams.length pathParams.length)}}
    schema: {
{{/unless}}
      body: { $ref: '{{requestBody.schemaName}}#' },
{{/if}}
{{#if responses.length}}
{{#unless (or queryParams.length pathParams.length requestBody)}}
    schema: {
{{/unless}}
      response: {
{{#each responses}}
{{#if schemaName}}
        {{statusCode}}: { $ref: '{{schemaName}}#' },
{{/if}}
{{/each}}
      },
{{/if}}
{{#if (or queryParams.length pathParams.length requestBody responses.length)}}
    },
{{/if}}
{{#if extensions.length}}
    preHandler: [
{{#each extensions}}
      {{registryKey}},
{{/each}}
    ],
{{/if}}
  }, async (req, reply) => {
    return {{domainKey}}.{{domainMethod}}({{#if pathParams.length}}req.params as types.{{typeNameBase}}Params{{/if}}{{#if queryParams.length}}{{#if pathParams.length}}, {{/if}}req.query as types.{{typeNameBase}}Query{{/if}}{{#if requestBody}}{{#if (or pathParams.length queryParams.length)}}, {{/if}}req.body as types.{{requestBody.schemaName}}{{/if}});
  });

{{/each}}
}
`;

const DEFAULT_FRONTEND_TEMPLATE = `/**
 * Auto-generated API client from OpenAPI specification
 * Generated from: {{spec.info.title}} v{{spec.info.version}}
 * DO NOT EDIT MANUALLY
 */

import type * as types from '{{contractPackage}}/schemas';

const BASE_URL = '';

async function fetchApi<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(BASE_URL + url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(\`API error: \${response.status}\`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

{{#each routes}}
/**
 * {{summary}}
 * {{uppercase method}} {{path}}
 */
export async function {{operationId}}(
{{#if pathParams.length}}
  params: types.{{typeNameBase}}Params,
{{/if}}
{{#if queryParams.length}}
  query?: Partial<types.{{typeNameBase}}Query>,
{{/if}}
{{#if requestBody}}
  body: types.{{requestBody.schemaName}},
{{/if}}
): Promise<{{#with (first responses)}}{{#if schemaName}}types.{{schemaName}}{{else}}void{{/if}}{{/with}}> {
{{#if pathParams.length}}
  let url = '{{path}}'.replace(/\\{([^}]+)\\}/g, (_, key) => String((params as Record<string, unknown>)[key]));
{{else}}
  let url = '{{path}}';
{{/if}}
{{#if queryParams.length}}
  if (query) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) url += '?' + qs;
  }
{{/if}}
  return fetchApi<{{#with (first responses)}}{{#if schemaName}}types.{{schemaName}}{{else}}void{{/if}}{{/with}}>(url, {
    method: '{{uppercase method}}',
{{#if requestBody}}
    body: JSON.stringify(body),
{{/if}}
  });
}

{{/each}}
`;

const DEFAULT_DOMAINS_TEMPLATE = `/**
 * Domain interfaces
 * Auto-generated from OpenAPI specification
 * DO NOT EDIT MANUALLY
 */

import type * as types from '../schemas/types.js';

{{#each domains}}
/**
 * {{name}} interface
 */
export interface {{name}}Api {
{{#each methods}}
  {{this}}(...args: unknown[]): Promise<unknown>;
{{/each}}
}

{{/each}}
`;

export { DEFAULT_SERVER_TEMPLATE, DEFAULT_FRONTEND_TEMPLATE, DEFAULT_DOMAINS_TEMPLATE };

