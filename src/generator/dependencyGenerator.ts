/**
 * Dependency Generator
 * 
 * Generates deps/ re-exports from x-micro-contracts-depend-on declarations.
 * Creates minimal-privilege type exports for cross-module dependencies.
 */

import fs from 'fs';
import path from 'path';
import type { OpenAPISpec, DependencyRef, ModuleDependencies } from '../types.js';
import { extractDependencies, parseDependencyRef } from '../types.js';

// =============================================================================
// Types
// =============================================================================

export interface DepsGeneratorOptions {
  /** Module name */
  moduleName: string;
  /** Output directory for deps/ (e.g., packages/contract/billing/deps/) */
  outputDir: string;
  /** Map of module name -> contract-published package path */
  contractPublicPaths: Map<string, string>;
  /** OpenAPI spec with dependencies */
  spec: OpenAPISpec;
  /** All modules' OpenAPI specs (for type resolution) */
  allSpecs?: Map<string, OpenAPISpec>;
}

export interface DepsFile {
  /** Target module name */
  targetModule: string;
  /** File path */
  filePath: string;
  /** Generated content */
  content: string;
}

// =============================================================================
// Generator
// =============================================================================

/**
 * Generate deps/ re-export files for a module
 */
export function generateDepsFiles(options: DepsGeneratorOptions): DepsFile[] {
  const { moduleName, outputDir, contractPublicPaths, spec } = options;
  
  const deps = extractDependencies(spec);
  if (deps.allDeps.length === 0) {
    return [];
  }
  
  // Group dependencies by target module
  const depsByModule = groupDepsByModule(deps.allDeps);
  
  const files: DepsFile[] = [];
  
  for (const [targetModule, moduleDeps] of depsByModule) {
    const contractPublicPath = contractPublicPaths.get(targetModule);
    if (!contractPublicPath) {
      console.warn(`Warning: No contract-published path for module '${targetModule}'`);
      continue;
    }
    
    const content = generateDepsFileContent({
      sourceModule: moduleName,
      targetModule,
      deps: moduleDeps,
      contractPublicPath,
    });
    
    const filePath = path.join(outputDir, `${targetModule}.ts`);
    
    files.push({
      targetModule,
      filePath,
      content,
    });
  }
  
  // Generate index.ts that re-exports all deps files
  if (files.length > 0) {
    const indexContent = generateDepsIndexContent(files);
    files.push({
      targetModule: 'index',
      filePath: path.join(outputDir, 'index.ts'),
      content: indexContent,
    });
  }
  
  return files;
}

/**
 * Write deps files to disk
 */
export function writeDepsFiles(files: DepsFile[]): void {
  for (const file of files) {
    const dir = path.dirname(file.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(file.filePath, file.content);
  }
}

// =============================================================================
// Helpers
// =============================================================================

function groupDepsByModule(deps: DependencyRef[]): Map<string, DependencyRef[]> {
  const grouped = new Map<string, DependencyRef[]>();
  
  for (const dep of deps) {
    if (!grouped.has(dep.module)) {
      grouped.set(dep.module, []);
    }
    grouped.get(dep.module)!.push(dep);
  }
  
  return grouped;
}

interface DepsFileContentOptions {
  sourceModule: string;
  targetModule: string;
  deps: DependencyRef[];
  contractPublicPath: string;
}

function generateDepsFileContent(options: DepsFileContentOptions): string {
  const { sourceModule, targetModule, deps, contractPublicPath } = options;
  
  // Group deps by domain
  const depsByDomain = new Map<string, DependencyRef[]>();
  for (const dep of deps) {
    if (!depsByDomain.has(dep.domain)) {
      depsByDomain.set(dep.domain, []);
    }
    depsByDomain.get(dep.domain)!.push(dep);
  }
  
  // Build type imports and interface
  const typeImports: string[] = [];
  const interfaceLines: string[] = [];
  
  for (const [domain, domainDeps] of depsByDomain) {
    // Add common types for this domain (e.g., User, UserListResponse)
    // This is simplified - in production, we'd analyze the OpenAPI spec
    // to determine exactly which types are used
    typeImports.push(`${domain}_*`);
    
    // Add interface methods
    for (const dep of domainDeps) {
      interfaceLines.push(`  ${dep.method}(...args: unknown[]): Promise<unknown>;`);
    }
  }
  
  const pascalTargetModule = targetModule.charAt(0).toUpperCase() + targetModule.slice(1);
  
  // Generate domain interface names
  const domainInterfaces: string[] = [];
  for (const domain of depsByDomain.keys()) {
    domainInterfaces.push(`${pascalTargetModule}${domain}Deps`);
  }
  
  return `/**
 * Auto-generated from x-micro-contracts-depend-on - DO NOT EDIT
 * Source module: ${sourceModule}
 * Target module: ${targetModule}
 * Dependencies: ${deps.map(d => d.raw).join(', ')}
 */

// Re-exported types from ${targetModule} (contract-published)
export type * from '${contractPublicPath}/schemas';

${Array.from(depsByDomain.entries()).map(([domain, domainDeps]) => {
  const interfaceName = `${pascalTargetModule}${domain}Deps`;
  return `/**
 * ${domain} domain interface (subset)
 * Only methods declared in x-micro-contracts-depend-on are exposed
 */
export interface ${interfaceName} {
${domainDeps.map(dep => `  ${dep.method}(...args: unknown[]): Promise<unknown>;`).join('\n')}
}`;
}).join('\n\n')}
`;
}

function generateDepsIndexContent(files: DepsFile[]): string {
  const exports = files
    .filter(f => f.targetModule !== 'index')
    .map(f => `export * from './${f.targetModule}.js';`)
    .join('\n');
  
  return `/**
 * Auto-generated deps index - DO NOT EDIT
 */

${exports}
`;
}

/**
 * Validate that config dependsOn is subset of OpenAPI x-micro-contracts-depend-on
 */
export function validateDependsOn(
  openApiDeps: string[],
  configDeps: string[],
  moduleName: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const dep of configDeps) {
    if (!openApiDeps.includes(dep)) {
      errors.push(
        `${moduleName}.dependsOn includes '${dep}' ` +
        `but it's not declared in OpenAPI x-micro-contracts-depend-on`
      );
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

