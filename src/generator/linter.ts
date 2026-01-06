/**
 * OpenAPI specification linter
 * 
 * Validates x-public/x-private constraints
 */

import type { 
  OpenAPISpec, 
  OperationObject,
  SchemaObject,
  LintError,
} from '../types.js';
import { isReference, getRefName, hasPrivateProperties, collectReferencedSchemas } from '../types.js';

export interface LintOptions {
  /** Treat warnings as errors */
  strict?: boolean;
}

export interface LintResult {
  errors: LintError[];
  warnings: LintError[];
  valid: boolean;
}

/**
 * Lint OpenAPI specification for x-public/x-private violations
 */
export function lintSpec(spec: OpenAPISpec, options: LintOptions = {}): LintResult {
  const errors: LintError[] = [];
  const warnings: LintError[] = [];
  
  // Check each operation
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = pathItem[method];
      if (!operation) continue;
      
      const location = `${method.toUpperCase()} ${path}`;
      
      // Check for x-micro-contracts-domain and x-micro-contracts-method
      if (!operation['x-micro-contracts-domain']) {
        warnings.push({
          type: 'warning',
          code: 'MISSING_X_DOMAIN',
          message: `Missing x-micro-contracts-domain extension`,
          path,
          location,
        });
      }
      
      if (!operation['x-micro-contracts-method']) {
        warnings.push({
          type: 'warning',
          code: 'MISSING_X_METHOD',
          message: `Missing x-micro-contracts-method extension`,
          path,
          location,
        });
      }
      
      // Check public endpoints for private schema references
      if (operation['x-micro-contracts-published'] === true) {
        const privateErrors = checkPublicEndpointForPrivate(path, method, operation, spec);
        errors.push(...privateErrors);
        
        // Check for allOf/oneOf/anyOf in public endpoint schemas
        const compositionWarnings = checkPublicEndpointComposition(path, method, operation, spec);
        warnings.push(...compositionWarnings);
      }
    }
  }
  
  // Check schemas for x-private in required (warning - may indicate design issue)
  if (spec.components?.schemas) {
    for (const [schemaName, schema] of Object.entries(spec.components.schemas)) {
      if (isReference(schema)) continue;
      
      const privateInRequired = checkPrivateInRequired(schemaName, schema);
      warnings.push(...privateInRequired);
    }
  }
  
  const valid = errors.length === 0 && (!options.strict || warnings.length === 0);
  
  return { errors, warnings, valid };
}

/**
 * Check if a public endpoint references schemas with x-private properties
 */
function checkPublicEndpointForPrivate(
  path: string,
  method: string,
  operation: OperationObject,
  spec: OpenAPISpec
): LintError[] {
  const errors: LintError[] = [];
  const location = `${method.toUpperCase()} ${path}`;
  
  // Check request body
  if (operation.requestBody && !isReference(operation.requestBody)) {
    const content = operation.requestBody.content?.['application/json'];
    if (content?.schema) {
      if (hasPrivateProperties(content.schema, spec)) {
        const schemaRef = isReference(content.schema) 
          ? getRefName(content.schema.$ref) 
          : 'inline schema';
        errors.push({
          type: 'error',
          code: 'PUBLIC_ENDPOINT_PRIVATE_REQUEST',
          message: `Public endpoint references request schema "${schemaRef}" with x-private properties`,
          path,
          location,
        });
      }
    }
  }
  
  // Check responses
  for (const [statusCode, response] of Object.entries(operation.responses)) {
    if (!statusCode.startsWith('2')) continue; // Only check success responses
    
    const resp = isReference(response)
      ? spec.components?.responses?.[getRefName(response.$ref)]
      : response;
    
    if (resp?.content?.['application/json']?.schema) {
      const schema = resp.content['application/json'].schema;
      if (hasPrivateProperties(schema, spec)) {
        const schemaRef = isReference(schema) 
          ? getRefName(schema.$ref) 
          : 'inline schema';
        errors.push({
          type: 'error',
          code: 'PUBLIC_ENDPOINT_PRIVATE_RESPONSE',
          message: `Public endpoint references response schema "${schemaRef}" with x-private properties`,
          path,
          location,
        });
      }
    }
  }
  
  return errors;
}

/**
 * Check for allOf/oneOf/anyOf in public endpoint schemas (warning)
 */
function checkPublicEndpointComposition(
  path: string,
  method: string,
  operation: OperationObject,
  spec: OpenAPISpec
): LintError[] {
  const warnings: LintError[] = [];
  const location = `${method.toUpperCase()} ${path}`;
  
  // Collect all referenced schemas
  const referencedSchemas = new Set<string>();
  
  if (operation.requestBody && !isReference(operation.requestBody)) {
    const content = operation.requestBody.content?.['application/json'];
    if (content?.schema) {
      collectReferencedSchemas(content.schema, spec, referencedSchemas);
    }
  }
  
  for (const response of Object.values(operation.responses)) {
    const resp = isReference(response)
      ? spec.components?.responses?.[getRefName(response.$ref)]
      : response;
    
    if (resp?.content?.['application/json']?.schema) {
      collectReferencedSchemas(resp.content['application/json'].schema, spec, referencedSchemas);
    }
  }
  
  // Check each referenced schema for composition
  for (const schemaName of referencedSchemas) {
    const schema = spec.components?.schemas?.[schemaName];
    if (!schema || isReference(schema)) continue;
    
    if (schema.allOf || schema.oneOf || schema.anyOf) {
      warnings.push({
        type: 'warning',
        code: 'PUBLIC_ENDPOINT_COMPOSITION',
        message: `Public endpoint uses schema "${schemaName}" with allOf/oneOf/anyOf (may complicate compatibility)`,
        path,
        location,
      });
    }
  }
  
  return warnings;
}

/**
 * Check if x-private properties are in required array
 * This is a warning because it may indicate a design issue
 * (the schema cannot be promoted to public use without removing the property)
 */
function checkPrivateInRequired(schemaName: string, schema: SchemaObject): LintError[] {
  const warnings: LintError[] = [];
  
  if (!schema.properties || !schema.required) return warnings;
  
  for (const propName of schema.required) {
    const prop = schema.properties[propName];
    if (prop && !isReference(prop) && prop['x-private']) {
      warnings.push({
        type: 'warning',
        code: 'PRIVATE_IN_REQUIRED',
        message: `Schema "${schemaName}" has x-private property "${propName}" in required array (cannot be used in public endpoints)`,
        location: `components/schemas/${schemaName}`,
      });
    }
  }
  
  return warnings;
}

/**
 * Format lint results for console output
 */
export function formatLintResults(result: LintResult): string {
  const lines: string[] = [];
  
  if (result.errors.length > 0) {
    lines.push('Errors:');
    for (const error of result.errors) {
      lines.push(`  ❌ [${error.code}] ${error.message}`);
      if (error.location) lines.push(`     at ${error.location}`);
    }
    lines.push('');
  }
  
  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    for (const warning of result.warnings) {
      lines.push(`  ⚠️  [${warning.code}] ${warning.message}`);
      if (warning.location) lines.push(`     at ${warning.location}`);
    }
    lines.push('');
  }
  
  if (result.valid) {
    lines.push('✅ Lint passed');
  } else {
    lines.push(`❌ Lint failed with ${result.errors.length} error(s)`);
  }
  
  return lines.join('\n');
}

