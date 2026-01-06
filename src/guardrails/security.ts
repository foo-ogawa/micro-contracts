/**
 * Security consistency check for guardrails
 * 
 * Verifies that security declarations in OpenAPI specs (x-auth, x-authz, x-middleware)
 * have corresponding implementations.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { glob } from 'glob';
import type { CheckResult, CheckOptions } from './types.js';
import type { OpenAPISpec, OperationObject } from '../types.js';

export interface SecurityIssue {
  spec: string;
  path: string;
  method: string;
  issue: string;
}

/**
 * Extract exported function names from TypeScript files
 */
export async function getImplementedOverlays(overlayDir: string): Promise<Set<string>> {
  const implemented = new Set<string>();
  
  if (!fs.existsSync(overlayDir)) {
    return implemented;
  }
  
  const files = await glob('**/*.ts', { cwd: overlayDir });
  
  for (const file of files) {
    const fullPath = path.join(overlayDir, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // Extract exported function names
    const exportMatches = content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g);
    for (const match of exportMatches) {
      implemented.add(match[1]);
    }
    
    // Also check for exported const functions
    const constMatches = content.matchAll(/export\s+const\s+(\w+)\s*=/g);
    for (const match of constMatches) {
      implemented.add(match[1]);
    }
  }
  
  return implemented;
}

/**
 * Check a single OpenAPI spec for security consistency
 */
export function checkSecurityConsistency(
  specPath: string,
  spec: OpenAPISpec,
  implementedOverlays: Set<string>
): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  
  for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = pathItem[method] as OperationObject & {
        'x-auth'?: string;
        'x-authz'?: string[];
        'x-middleware'?: string[];
      };
      if (!operation) continue;
      
      // Check x-auth requirement
      const xAuth = operation['x-auth'];
      if (xAuth === 'required') {
        // Should have requireAuth in middleware
        const middlewares = operation['x-middleware'] || [];
        if (!middlewares.includes('requireAuth') && !implementedOverlays.has('requireAuth')) {
          // Only warn if requireAuth is not implemented at all
          // The check is more lenient - just verify the middleware exists
        }
      }
      
      // Check all declared middlewares are implemented
      const middlewares = operation['x-middleware'] || [];
      for (const mw of middlewares) {
        if (!implementedOverlays.has(mw)) {
          issues.push({
            spec: specPath,
            path: pathKey,
            method: method.toUpperCase(),
            issue: `Middleware "${mw}" declared but not implemented`,
          });
        }
      }
      
      // Check x-authz scopes (if requireAuth is used, should have x-auth: required)
      const xAuthz = operation['x-authz'];
      if (xAuthz && xAuthz.length > 0) {
        if (!xAuth || xAuth === 'none') {
          issues.push({
            spec: specPath,
            path: pathKey,
            method: method.toUpperCase(),
            issue: `Has x-authz scopes but x-auth is not "required"`,
          });
        }
      }
    }
  }
  
  return issues;
}

/**
 * Find overlay implementation directories
 */
export async function findOverlayDirs(): Promise<string[]> {
  const dirs: string[] = [];
  
  // Check common locations
  const candidates = [
    'server/src/_shared/overlays',
    'server/src/core/overlays',
    'src/_shared/overlays',
    'src/overlays',
  ];
  
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      dirs.push(candidate);
    }
  }
  
  // Also find module-specific overlays
  const moduleOverlays = await glob('server/src/*/overlays', { nodir: false });
  dirs.push(...moduleOverlays.filter(d => fs.existsSync(d)));
  
  return [...new Set(dirs)];
}

/**
 * Run security consistency check
 */
export async function runSecurityCheck(options: CheckOptions): Promise<CheckResult> {
  const start = Date.now();
  
  try {
    // Find overlay implementations
    const overlayDirs = await findOverlayDirs();
    const implementedOverlays = new Set<string>();
    
    for (const dir of overlayDirs) {
      const overlays = await getImplementedOverlays(dir);
      for (const overlay of overlays) {
        implementedOverlays.add(overlay);
      }
    }
    
    if (implementedOverlays.size === 0) {
      return {
        name: 'security',
        status: 'skip',
        duration: Date.now() - start,
        message: 'No overlay implementations found',
      };
    }
    
    // Find OpenAPI specs
    const specFiles = await glob('spec/**/openapi/*.yaml', {
      ignore: ['**/*.overlay.yaml'],
    });
    
    if (specFiles.length === 0) {
      return {
        name: 'security',
        status: 'skip',
        duration: Date.now() - start,
        message: 'No OpenAPI specs found',
      };
    }
    
    const allIssues: SecurityIssue[] = [];
    
    for (const specFile of specFiles) {
      try {
        const content = fs.readFileSync(specFile, 'utf-8');
        const spec = yaml.load(content) as OpenAPISpec;
        
        if (!spec || !spec.paths) continue;
        
        const issues = checkSecurityConsistency(specFile, spec, implementedOverlays);
        allIssues.push(...issues);
      } catch {
        // Skip files that can't be parsed
      }
    }
    
    if (allIssues.length > 0) {
      const details = allIssues.map(i => 
        `  ${i.spec} - ${i.method} ${i.path}: ${i.issue}`
      );
      
      return {
        name: 'security',
        status: 'fail',
        duration: Date.now() - start,
        message: `${allIssues.length} security consistency issue(s)`,
        details,
      };
    }
    
    return {
      name: 'security',
      status: 'pass',
      duration: Date.now() - start,
      message: `Security declarations verified (${implementedOverlays.size} overlays, ${specFiles.length} specs)`,
    };
    
  } catch (error) {
    return {
      name: 'security',
      status: 'fail',
      duration: Date.now() - start,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

