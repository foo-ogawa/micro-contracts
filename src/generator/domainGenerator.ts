/**
 * Domain interface generator from OpenAPI specification
 * 
 * Generates TypeScript interfaces grouped by x-domain extension
 */

import type { 
  OpenAPISpec, 
  OperationObject,
  ParameterObject,
  DomainInfo,
  DomainMethodInfo,
} from '../types.js';
import { isReference, getRefName } from '../types.js';

export interface DomainGeneratorOptions {
  /** Only include public endpoints (x-public: true) */
  publicOnly?: boolean;
}

/**
 * Generate domain interface files
 * Returns a map of domain name to generated content
 */
export function generateDomainInterfaces(
  spec: OpenAPISpec,
  options: DomainGeneratorOptions = {}
): Map<string, string> {
  const { publicOnly = false } = options;
  
  const domains = extractDomainInfo(spec, publicOnly);
  const result = new Map<string, string>();
  
  for (const domain of domains) {
    const content = generateDomainInterface(domain, spec);
    result.set(domain.name, content);
  }
  
  // Generate index.ts
  const indexContent = generateDomainsIndex(domains);
  result.set('index', indexContent);
  
  return result;
}

/**
 * Extract domain information from OpenAPI spec
 */
function extractDomainInfo(spec: OpenAPISpec, publicOnly: boolean): DomainInfo[] {
  const domainsMap = new Map<string, DomainMethodInfo[]>();
  
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = pathItem[method];
      if (!operation) continue;
      
      // Canonical extension names only
      const domain = operation['x-micro-contracts-domain'];
      const domainMethod = operation['x-micro-contracts-method'];
      const isPublished = operation['x-micro-contracts-published'] === true;
      
      if (!domain || !domainMethod) continue;
      if (publicOnly && !isPublished) continue;
      
      const methodInfo = extractMethodInfo(path, method, operation, spec);
      if (!methodInfo) continue;
      
      if (!domainsMap.has(domain)) {
        domainsMap.set(domain, []);
      }
      domainsMap.get(domain)!.push(methodInfo);
    }
  }
  
  return Array.from(domainsMap.entries())
    .map(([name, methods]) => ({ name, methods }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Extract method information from operation
 */
function extractMethodInfo(
  path: string,
  httpMethod: string,
  operation: OperationObject,
  spec: OpenAPISpec
): DomainMethodInfo | null {
  // Canonical extension names only
  const domainName = operation['x-micro-contracts-domain'];
  const domainMethod = operation['x-micro-contracts-method'];
  if (!domainMethod) return null;
  
  const operationId = operation.operationId || domainMethod;
  // Use domain + _ + method for type names (clearer separation)
  const typeNameBase = domainName && domainMethod 
    ? `${domainName}_${domainMethod}`
    : operationId.replace(/[^a-zA-Z0-9]/g, '_');
  const isPublished = operation['x-micro-contracts-published'] === true;
  
  // Get request body type
  let requestType: string | undefined;
  if (operation.requestBody) {
    const reqBody = isReference(operation.requestBody)
      ? spec.components?.requestBodies?.[getRefName(operation.requestBody.$ref)]
      : operation.requestBody;
    
    if (reqBody) {
      const content = reqBody.content?.['application/json'];
      if (content?.schema) {
        requestType = isReference(content.schema)
          ? getRefName(content.schema.$ref)
          : undefined;
      }
    }
  }
  
  // Get response type
  let responseType: string | undefined;
  const successResponse = operation.responses['200'] || operation.responses['201'];
  if (successResponse) {
    const resp = isReference(successResponse)
      ? spec.components?.responses?.[getRefName(successResponse.$ref)]
      : successResponse;
    
    if (resp?.content?.['application/json']?.schema) {
      const schema = resp.content['application/json'].schema;
      responseType = isReference(schema) ? getRefName(schema.$ref) : undefined;
    }
  }
  
  // Check for 204 (void response)
  if (operation.responses['204'] && !responseType) {
    responseType = 'void';
  }
  
  // Get all params (path + query combined)
  const queryParams = (operation.parameters || []).filter(
    (p): p is ParameterObject => !isReference(p) && p.in === 'query'
  );
  const pathParams = (operation.parameters || []).filter(
    (p): p is ParameterObject => !isReference(p) && p.in === 'path'
  );
  const hasParams = queryParams.length > 0 || pathParams.length > 0;
  const paramsType = hasParams ? `${typeNameBase}Params` : undefined;
  
  return {
    name: domainMethod,
    operationId,
    httpMethod,
    path,
    isPublished,
    requestType,
    responseType,
    paramsType,
  };
}

/**
 * Generate domain interface content
 */
function generateDomainInterface(domain: DomainInfo, spec: OpenAPISpec): string {
  const lines: string[] = [];
  
  lines.push('/**');
  lines.push(` * ${domain.name} Domain API Interface`);
  lines.push(' * Auto-generated from OpenAPI specification');
  lines.push(' * DO NOT EDIT MANUALLY');
  lines.push(' */');
  lines.push('');
  
  // Collect all types needed
  const types = new Set<string>();
  for (const method of domain.methods) {
    // Always use Input type (even for parameterless operations)
    const inputTypeName = `${domain.name}_${method.name}Input`;
    types.add(inputTypeName);
    if (method.responseType && method.responseType !== 'void') types.add(method.responseType);
  }
  
  // Generate imports
  if (types.size > 0) {
    const typeList = Array.from(types).sort().join(',\n  ');
    lines.push('import type {');
    lines.push(`  ${typeList},`);
    lines.push("} from '../schemas/types.js';");
    lines.push('');
  }
  
  // Generate interface
  lines.push(`export interface ${domain.name}Api {`);
  
  for (const method of domain.methods) {
    // JSDoc comment
    lines.push('  /**');
    lines.push(`   * ${method.httpMethod.toUpperCase()} ${method.path}`);
    if (!method.isPublished) {
      lines.push('   * @internal Not included in public contract');
    }
    lines.push('   */');
    
    // Method signature with single Input parameter (always present)
    const inputTypeName = `${domain.name}_${method.name}Input`;
    const returnType = method.responseType || 'void';
    const returnTypeStr = returnType === 'void' ? 'Promise<void>' : `Promise<${returnType}>`;
    
    lines.push(`  ${method.name}(input: ${inputTypeName}): ${returnTypeStr};`);
    lines.push('');
  }
  
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Generate domains index.ts
 */
function generateDomainsIndex(domains: DomainInfo[]): string {
  const lines: string[] = [];
  
  lines.push('/**');
  lines.push(' * Domain API Interfaces');
  lines.push(' * Auto-generated from OpenAPI specification');
  lines.push(' * DO NOT EDIT MANUALLY');
  lines.push(' */');
  lines.push('');
  
  // Import domain APIs for use in DomainRegistry
  for (const domain of domains) {
    lines.push(`import type { ${domain.name}Api } from './${domain.name}Api.js';`);
  }
  lines.push('');
  
  // Re-export individual domain APIs
  for (const domain of domains) {
    lines.push(`export type { ${domain.name}Api };`);
  }
  
  // Generate DomainRegistry interface for DI Container
  lines.push('');
  lines.push('/**');
  lines.push(' * Domain Registry for Dependency Injection');
  lines.push(' * Use this interface for DI container type definitions');
  lines.push(' */');
  lines.push('export interface DomainRegistry {');
  
  for (const domain of domains) {
    const propertyName = domainNameToProperty(domain.name);
    lines.push(`  ${propertyName}: ${domain.name}Api;`);
  }
  
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Convert domain name to property name
 * e.g., "AccountDomain" -> "account", "ExtensionInstanceDomain" -> "extensionInstance"
 */
function domainNameToProperty(domainName: string): string {
  // Remove "Domain" suffix if present
  const baseName = domainName.replace(/Domain$/, '');
  // Convert to camelCase (first letter lowercase)
  return baseName.charAt(0).toLowerCase() + baseName.slice(1);
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

