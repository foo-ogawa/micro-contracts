#!/usr/bin/env node
/**
 * micro-contracts CLI
 * 
 * A contract-first OpenAPI toolchain that keeps TypeScript UI
 * and microservices aligned via code generation.
 */

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { generate, loadConfig, loadOpenAPISpec, lintSpec, formatLintResults } from './generator/index.js';
import type { GeneratorConfig, MultiModuleConfig } from './types.js';
import { getStarterTemplates } from './cli/templates.js';
import {
  runAllChecks,
  formatCheckResults,
  getAvailableChecks,
  createGuardrailsConfig,
  generateManifest,
  writeManifest,
} from './guardrails/index.js';

const program = new Command();

program
  .name('micro-contracts')
  .description('Contract-first OpenAPI toolchain for TypeScript')
  .version('1.0.0');

// Generate command
program
  .command('generate')
  .description('Generate code from OpenAPI specification')
  .option('-c, --config <path>', 'Path to config file (micro-contracts.config.yaml)')
  .option('-m, --module <names>', 'Module names, comma-separated (default: all)')
  .option('--contracts-only', 'Generate contract packages only')
  .option('--server-only', 'Generate server routes only')
  .option('--frontend-only', 'Generate frontend clients only')
  .option('--docs-only', 'Generate documentation only')
  .option('--skip-lint', 'Skip linting before generation')
  .option('--manifest', 'Generate manifest for guardrails')
  .option('--manifest-dir <path>', 'Directory for manifest (default: packages/)')
  .action(async (options) => {
    try {
      let config: MultiModuleConfig | GeneratorConfig;

      // Load from config file
      const configPath = options.config 
        ? path.resolve(options.config)
        : findConfigFile();
      
      if (!configPath) {
        console.error('Error: No config file found.');
        console.error('Create micro-contracts.config.yaml or use --config <path>');
        process.exit(1);
      }
      
        if (!fs.existsSync(configPath)) {
          console.error(`Config file not found: ${configPath}`);
          process.exit(1);
        }
      
      console.log(`Using config: ${configPath}`);
        config = loadConfig(configPath);

      // Run generation
      await generate(config, {
        contractsOnly: options.contractsOnly,
        serverOnly: options.serverOnly,
        frontendOnly: options.frontendOnly,
        docsOnly: options.docsOnly,
        skipLint: options.skipLint,
        modules: options.module,
      });
      
      // Generate manifest if requested
      if (options.manifest) {
        const manifestDir = options.manifestDir || 'packages/';
        if (fs.existsSync(manifestDir)) {
          console.log(`\nGenerating manifest for: ${manifestDir}`);
          const manifest = await generateManifest(manifestDir, {
            generatorVersion: '1.0.0',
          });
          const manifestPath = writeManifest(manifest, manifestDir);
          const fileCount = Object.keys(manifest.files).length;
          console.log(`Written: ${manifestPath} (${fileCount} files)`);
        }
      }
      
    } catch (error) {
      console.error('Generation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Lint command
program
  .command('lint')
  .description('Lint OpenAPI specification for x-public/x-private violations')
  .argument('<input>', 'Path to OpenAPI spec file')
  .option('--strict', 'Treat warnings as errors')
  .action(async (input, options) => {
    try {
      const specPath = path.resolve(input);
      if (!fs.existsSync(specPath)) {
        console.error(`OpenAPI spec not found: ${specPath}`);
        process.exit(1);
      }
      
      console.log(`Linting: ${specPath}\n`);
      const spec = loadOpenAPISpec(specPath);
      const result = lintSpec(spec, { strict: options.strict });
      
      console.log(formatLintResults(result));
      
      if (!result.valid) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Lint failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Init command
program
  .command('init')
  .description('Initialize a new module structure with starter templates')
  .argument('<name>', 'Module name (e.g., core, users)')
  .option('-d, --dir <path>', 'Base directory', 'src')
  .option('-i, --openapi <path>', 'OpenAPI spec to process (auto-adds x-micro-contracts-domain/method)')
  .option('-o, --output <path>', 'Output path for processed OpenAPI')
  .option('--skip-templates', 'Skip creating starter templates')
  .action(async (name, options) => {
    console.log(`Initializing module "${name}"...\n`);
    
    // Create spec directory structure
    const specDirs = [
      'spec',
      'spec/default/templates',
      'spec/_shared/openapi',
      'spec/_shared/overlays',
      `spec/${name}/openapi`,
    ];
    
    for (const dir of specDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created: ${dir}/`);
      }
    }
    
    // Create starter templates (unless skipped)
    if (!options.skipTemplates) {
      const starterTemplates = getStarterTemplates();
      for (const [filename, content] of Object.entries(starterTemplates)) {
        const templatePath = path.join('spec/default/templates', filename);
        if (!fs.existsSync(templatePath)) {
          fs.writeFileSync(templatePath, content);
          console.log(`Created: ${templatePath}`);
        }
      }
    }
    
    // Create shared schemas
    const problemDetailsPath = 'spec/_shared/openapi/problem-details.yaml';
    if (!fs.existsSync(problemDetailsPath)) {
      fs.writeFileSync(problemDetailsPath, generateProblemDetailsSchema());
      console.log(`Created: ${problemDetailsPath}`);
    }
    
    // Create Spectral rules
    const spectralPath = 'spec/spectral.yaml';
    if (!fs.existsSync(spectralPath)) {
      fs.writeFileSync(spectralPath, generateSpectralRules());
      console.log(`Created: ${spectralPath}`);
    }
    
    // Create server/frontend directories
    const baseDir = path.resolve(options.dir, name);
    const dirs = [
      baseDir,
      path.join(baseDir, 'domains'),
      path.join(baseDir, 'models'),
    ];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
        console.log(`Created: ${dir}/`);
      }
    }
    
    // Create placeholder files
    const files: [string, string][] = [
      [path.join(baseDir, 'db.ts'), generateDbTemplate()],
      [path.join(baseDir, 'container.ts'), generateContainerTemplate(name)],
      [path.join(baseDir, 'domains', 'index.ts'), '// Export domain classes\n'],
      [path.join(baseDir, 'models', 'index.ts'), '// Export models\n'],
    ];
    
    for (const [filePath, content] of files) {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content);
        console.log(`Created: ${filePath}`);
      }
    }
    
    // Create config template if not exists
    const configPath = path.resolve('micro-contracts.config.yaml');
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, generateConfigTemplate(name));
      console.log(`Created: ${configPath}`);
    }
    
    // Process OpenAPI file if provided
    if (options.openapi) {
      const openapiPath = path.resolve(options.openapi);
      if (!fs.existsSync(openapiPath)) {
        console.error(`OpenAPI file not found: ${openapiPath}`);
        process.exit(1);
      }
      
      const outputPath = options.output 
        ? path.resolve(options.output)
        : path.resolve(`spec/${name}/openapi/${name}.yaml`);
      
      // Ensure output directory exists
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      
      console.log(`\nProcessing OpenAPI: ${openapiPath}`);
      const processed = processOpenAPIWithExtensions(openapiPath);
      fs.writeFileSync(outputPath, processed.yaml);
      console.log(`Created: ${outputPath}`);
      console.log(`  - Added x-micro-contracts-domain to ${processed.stats.domainsAdded} operations`);
      console.log(`  - Added x-micro-contracts-method to ${processed.stats.methodsAdded} operations`);
      if (processed.stats.domains.length > 0) {
        console.log(`  - Detected domains: ${processed.stats.domains.join(', ')}`);
      }
    }
    
    console.log(`\nModule "${name}" initialized!`);
    
    if (!options.openapi) {
      console.log(`\nNext steps:`);
      console.log(`  1. Create spec/${name}/openapi/${name}.yaml with your API spec`);
      console.log(`  2. Add x-micro-contracts-domain and x-micro-contracts-method to operations`);
      console.log(`  3. Run: npx micro-contracts generate`);
      console.log(`\nTip: Use --openapi to auto-add extensions:`);
      console.log(`  npx micro-contracts init ${name} --openapi path/to/spec.yaml`);
    } else {
    console.log(`\nNext steps:`);
      console.log(`  1. Review the generated extensions in spec/${name}/openapi/${name}.yaml`);
      console.log(`  2. Run: npx micro-contracts generate`);
    }
  });

// Deps command (dependency analysis)
program
  .command('deps')
  .description('Analyze module dependencies')
  .option('-c, --config <path>', 'Path to config file')
  .option('-m, --module <name>', 'Module to analyze')
  .option('--graph', 'Output dependency graph in Mermaid format')
  .option('--impact <ref>', 'Analyze impact of changing a specific API (e.g., core.User.getUsers)')
  .option('--who-depends-on <ref>', 'Find modules that depend on a specific API')
  .option('--validate', 'Validate dependencies against OpenAPI declarations')
  .action(async (options) => {
    try {
      const configPath = options.config 
        ? path.resolve(options.config)
        : findConfigFile();
      
      if (!configPath) {
        console.error('Error: No config file found.');
        process.exit(1);
      }
      
      const config = loadConfig(configPath) as MultiModuleConfig;
      
      if (!config.modules) {
        console.error('Error: Config must have modules defined.');
        process.exit(1);
      }
      
      // Collect dependencies from all modules
      const moduleDeps = new Map<string, {
        deps: string[];
        openApiDeps: string[];
        configDeps: string[];
      }>();
      
      for (const [moduleName, moduleConfig] of Object.entries(config.modules)) {
        if (options.module && moduleName !== options.module) continue;
        
        const openapiPath = path.resolve(path.dirname(configPath), moduleConfig.openapi);
        if (!fs.existsSync(openapiPath)) {
          console.warn(`Warning: OpenAPI spec not found: ${openapiPath}`);
          continue;
        }
        
        const spec = loadOpenAPISpec(openapiPath);
        const openApiDeps = spec.info['x-micro-contracts-depend-on'] || [];
        const configDeps = moduleConfig.dependsOn || [];
        
        moduleDeps.set(moduleName, {
          deps: openApiDeps,
          openApiDeps,
          configDeps,
        });
      }
      
      // Handle different options
      if (options.graph) {
        outputDependencyGraph(moduleDeps);
      } else if (options.impact) {
        outputImpactAnalysis(moduleDeps, options.impact);
      } else if (options.whoDependsOn) {
        outputWhoDependsOn(moduleDeps, options.whoDependsOn);
      } else if (options.validate) {
        validateDependencies(moduleDeps);
      } else {
        // Default: show all dependencies
        outputAllDependencies(moduleDeps);
      }
      
    } catch (error) {
      console.error('Deps analysis failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Check command (guardrails)
program
  .command('check')
  .description('Run AI guardrail checks')
  .option('--only <checks>', 'Run only specific checks (comma-separated)')
  .option('--skip <checks>', 'Skip specific checks (comma-separated)')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--fix', 'Auto-fix issues where possible')
  .option('-g, --guardrails <path>', 'Path to guardrails.yaml')
  .option('-d, --generated-dir <path>', 'Path to generated files directory', 'packages/')
  .option('--changed-files <path>', 'Path to file containing list of changed files (for CI)')
  .option('--list', 'List available checks')
  .action(async (options) => {
    try {
      // List checks
      if (options.list) {
        console.log('\nAvailable checks:\n');
        for (const check of getAvailableChecks()) {
          console.log(`  ${check.name.padEnd(12)} - ${check.description}`);
        }
        console.log('');
        return;
      }
      
      // Parse options
      const checkOptions = {
        only: options.only?.split(',').map((s: string) => s.trim()),
        skip: options.skip?.split(',').map((s: string) => s.trim()),
        verbose: options.verbose,
        fix: options.fix,
        guardrailsPath: options.guardrails,
        generatedDir: options.generatedDir,
        changedFilesPath: options.changedFiles,
      };
      
      // Run checks
      const summary = await runAllChecks(checkOptions);
      
      // Output results
      console.log(formatCheckResults(summary, options.verbose));
      
      // Exit with error if any checks failed
      if (summary.failed > 0) {
        process.exit(1);
      }
      
    } catch (error) {
      console.error('Check failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Guardrails init command
program
  .command('guardrails-init')
  .description('Create a guardrails.yaml configuration file')
  .option('-o, --output <path>', 'Output path', 'guardrails.yaml')
  .action((options) => {
    try {
      const outputPath = options.output;
      
      if (fs.existsSync(outputPath)) {
        console.error(`File already exists: ${outputPath}`);
        console.error('Use --output to specify a different path.');
        process.exit(1);
      }
      
      createGuardrailsConfig(outputPath);
      console.log(`Created: ${outputPath}`);
      console.log('\nNext steps:');
      console.log('  1. Review and customize the guardrails configuration');
      console.log('  2. Run: micro-contracts check');
      
    } catch (error) {
      console.error('Failed to create guardrails config:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Manifest command
program
  .command('manifest')
  .description('Generate or verify manifest for generated artifacts')
  .option('-d, --dir <path>', 'Directory to scan', 'packages/')
  .option('--verify', 'Verify existing manifest')
  .option('-o, --output <path>', 'Output manifest path (default: {dir}/.generated-manifest.json)')
  .action(async (options) => {
    try {
      const baseDir = options.dir;
      
      if (!fs.existsSync(baseDir)) {
        console.error(`Directory not found: ${baseDir}`);
        process.exit(1);
      }
      
      if (options.verify) {
        // Verify mode
        const { verifyManifest, formatManifestResult } = await import('./guardrails/index.js');
        const result = await verifyManifest(baseDir);
        console.log(formatManifestResult(result));
        if (!result.valid) {
          process.exit(1);
        }
      } else {
        // Generate mode
        console.log(`Generating manifest for: ${baseDir}`);
        const manifest = await generateManifest(baseDir, {
          generatorVersion: '1.0.0',
        });
        
        const manifestPath = writeManifest(manifest, baseDir);
        const fileCount = Object.keys(manifest.files).length;
        console.log(`Written: ${manifestPath} (${fileCount} files)`);
      }
      
    } catch (error) {
      console.error('Manifest operation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();

/**
 * Find config file in current directory
 */
function findConfigFile(): string | null {
  const candidates = [
    'micro-contracts.config.yaml',
    'micro-contracts.config.yml',
    'api-framework.config.yaml',  // Legacy name
    'api-framework.config.yml',
  ];
  
  for (const candidate of candidates) {
    const configPath = path.resolve(candidate);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }
  
  return null;
}

function generateDbTemplate(): string {
  return `/**
 * Database connection for this module
 */

import pg from 'pg';
import { DBModel, PostgresDriver } from 'litedbmodel';

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Get database connection pool
 */
export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

/**
 * Initialize database connection
 */
export async function initializeDb(): Promise<void> {
  const p = getPool();
  
  // Set litedbmodel driver
  DBModel.setDriver(new PostgresDriver(p));
  
  // Test connection
  const client = await p.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

/**
 * Close database connection
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const p = getPool();
    const client = await p.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}
`;
}

function generateContainerTemplate(moduleName: string): string {
  const pascalName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  return `/**
 * Module container (Dependency Injection)
 */

import { testConnection, closeDb } from './db.js';

// Import domain implementations
// import { ExampleDomain } from './domains/ExampleDomain.js';

// Import domain interfaces from contract
// import type { ExampleDomainApi } from '@project/contract/${moduleName}/domains';

export interface ${pascalName}Domains {
  // example: ExampleDomainApi;
}

export interface ${pascalName}ModuleContainer {
  domains: ${pascalName}Domains;
  testConnection: () => Promise<boolean>;
  close: () => Promise<void>;
}

export async function initialize${pascalName}Module(): Promise<${pascalName}ModuleContainer> {
  const domains: ${pascalName}Domains = {
    // example: new ExampleDomain(),
  };

  return {
    domains,
    testConnection,
    close: closeDb,
  };
}
`;
}

/**
 * Process OpenAPI file and auto-add x-micro-contracts-domain/method extensions
 */
function processOpenAPIWithExtensions(openapiPath: string): {
  yaml: string;
  stats: {
    domainsAdded: number;
    methodsAdded: number;
    domains: string[];
  };
} {
  const content = fs.readFileSync(openapiPath, 'utf-8');
  const spec = yaml.parse(content);
  
  const stats = {
    domainsAdded: 0,
    methodsAdded: 0,
    domains: new Set<string>(),
  };
  
  const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
  
  if (spec.paths) {
    for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;
      
      // Infer domain from path: /api/users/{id} → User
      const domain = inferDomainFromPath(pathKey);
      
      for (const method of httpMethods) {
        const operation = (pathItem as Record<string, unknown>)[method];
        if (!operation || typeof operation !== 'object') continue;
        
        const op = operation as Record<string, unknown>;
        
        // Add x-micro-contracts-domain if not present (check both forms)
        if (!op['x-micro-contracts-domain'] && !op['x-domain'] && domain) {
          op['x-micro-contracts-domain'] = domain;
          stats.domainsAdded++;
          stats.domains.add(domain);
        }
        
        // Add x-micro-contracts-method if not present (check both forms)
        if (!op['x-micro-contracts-method'] && !op['x-method']) {
          // Use operationId if available, otherwise generate
          const methodName = op.operationId 
            ? String(op.operationId)
            : inferMethodName(method, pathKey);
          op['x-micro-contracts-method'] = methodName;
          stats.methodsAdded++;
        }
      }
    }
  }
  
  // Convert back to YAML with proper formatting
  const output = yaml.stringify(spec, {
    indent: 2,
  });
  
  return {
    yaml: output,
    stats: {
      domainsAdded: stats.domainsAdded,
      methodsAdded: stats.methodsAdded,
      domains: Array.from(stats.domains),
    },
  };
}

/**
 * Infer domain name from API path
 * /api/users → User
 * /api/users/{id} → User
 * /api/user-profiles → UserProfile
 * /api/v1/accounts → Account
 */
function inferDomainFromPath(pathKey: string): string | null {
  // Remove /api prefix and version prefix
  const normalized = pathKey
    .replace(/^\/api\//, '/')
    .replace(/^\/v\d+\//, '/');
  
  // Get first path segment
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  
  const firstSegment = segments[0];
  
  // Skip path parameters
  if (firstSegment.startsWith('{')) return null;
  
  // Convert to PascalCase singular
  // users → User
  // user-profiles → UserProfile
  // accounts → Account
  const words = firstSegment
    .replace(/-/g, '_')
    .split('_');
  
  const pascalCase = words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
  
  // Remove trailing 's' for plural (simple heuristic)
  if (pascalCase.endsWith('s') && !pascalCase.endsWith('ss')) {
    return pascalCase.slice(0, -1);
  }
  
  return pascalCase;
}

/**
 * Infer method name from HTTP method and path
 * GET /users → getUsers
 * GET /users/{id} → getUserById
 * POST /users → createUser
 * PUT /users/{id} → updateUser
 * DELETE /users/{id} → deleteUser
 */
function inferMethodName(httpMethod: string, pathKey: string): string {
  // Get path segments without parameters
  const segments = pathKey
    .replace(/^\/api\//, '/')
    .replace(/^\/v\d+\//, '/')
    .split('/')
    .filter(Boolean);
  
  const hasIdParam = segments.some(s => s.startsWith('{'));
  const resourceSegments = segments.filter(s => !s.startsWith('{'));
  
  // Build resource name from segments
  const resourceName = resourceSegments
    .map((seg, i) => {
      const words = seg.replace(/-/g, '_').split('_');
      return words
        .map((word, j) => {
          // First word of first segment: lowercase for method prefix
          if (i === 0 && j === 0) {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
          }
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join('');
    })
    .join('');
  
  // Make singular for single-resource operations
  const singularName = resourceName.endsWith('s') && !resourceName.endsWith('ss')
    ? resourceName.slice(0, -1)
    : resourceName;
  
  // Map HTTP method to action
  switch (httpMethod.toLowerCase()) {
    case 'get':
      return hasIdParam 
        ? `get${singularName}ById`
        : `get${resourceName}`;
    case 'post':
      return `create${singularName}`;
    case 'put':
      return `update${singularName}`;
    case 'patch':
      return `patch${singularName}`;
    case 'delete':
      return `delete${singularName}`;
    default:
      return `${httpMethod.toLowerCase()}${resourceName}`;
  }
}

function generateConfigTemplate(moduleName: string): string {
  // Note: Using explicit string concatenation to ensure correct YAML indentation
  const yaml = [
    '# micro-contracts Configuration',
    '',
    '# Common settings (defaults for all modules)',
    'defaults:',
    '  contract:',
    '    output: packages/contract/{module}',
    '',
    '  contractPublic:',
    '    output: packages/contract-published/{module}',
    '',
    '  # Template-based outputs',
    '  outputs:',
    '    server-routes:',
    '      output: server/src/{module}/routes.generated.ts',
    '      template: fastify-routes.hbs',
    '      config:',
    '        domainsPath: fastify.domains.{module}',
    '',
    '    frontend-api:',
    '      output: frontend/src/{module}/api.generated.ts',
    '      template: fetch-client.hbs',
    '',
    '    shared-client:',
    '      output: frontend/src/shared/{module}.api.generated.ts',
    '      template: fetch-client.hbs',
    '      condition: hasPublicEndpoints',
    '      config:',
    '        contractPackage: "@project/contract-published/{module}"',
    '',
    '  # Overlay configuration',
    '  overlays:',
    '    shared:',
    '      - spec/_shared/overlays/middleware.overlay.yaml',
    '    collision: error',
    '',
    '  docs:',
    '    enabled: true',
    '',
    '# Module definitions',
    'modules:',
    `  ${moduleName}:`,
    `    openapi: spec/${moduleName}/openapi/${moduleName}.yaml`,
    '',
  ].join('\n');
  return yaml;
}

/**
 * Generate ProblemDetails schema
 */
function generateProblemDetailsSchema(): string {
  return `# RFC 9457 Problem Details
# https://www.rfc-editor.org/rfc/rfc9457.html

components:
  schemas:
    ProblemDetails:
      type: object
      required: [type, title, status]
      properties:
        type:
          type: string
          format: uri
          description: "Error type URI (e.g., /errors/validation)"
        title:
          type: string
          description: "Short human-readable summary"
        status:
          type: integer
          description: "HTTP status code"
        detail:
          type: string
          description: "Detailed explanation"
        instance:
          type: string
          format: uri
          description: "URI of the specific occurrence"
        code:
          type: string
          description: "Machine-readable error code (SCREAMING_SNAKE)"
        traceId:
          type: string
          description: "Correlation ID for tracing"
        errors:
          type: array
          description: "Validation errors (field-level)"
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string

  responses:
    BadRequest:
      description: Bad Request
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ProblemDetails'
    
    Unauthorized:
      description: Unauthorized
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ProblemDetails'
    
    Forbidden:
      description: Forbidden
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ProblemDetails'
    
    NotFound:
      description: Not Found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ProblemDetails'
    
    InternalError:
      description: Internal Server Error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ProblemDetails'
`;
}

/**
 * Generate Spectral lint rules
 */
function generateSpectralRules(): string {
  return `# micro-contracts Spectral Rules

extends: ["spectral:oas"]

rules:
  # Require x-micro-contracts-domain on all operations
  operation-domain:
    description: "Operations must have x-micro-contracts-domain"
    severity: error
    given: "$.paths[*][get,post,put,patch,delete]"
    then:
      field: x-micro-contracts-domain
      function: truthy

  # Require x-micro-contracts-method on all operations  
  operation-method:
    description: "Operations must have x-micro-contracts-method"
    severity: error
    given: "$.paths[*][get,post,put,patch,delete]"
    then:
      field: x-micro-contracts-method
      function: truthy

  # Require error responses
  operation-error-responses:
    description: "Operations should have 5XX or default error response"
    severity: warn
    given: "$.paths[*][get,post,put,patch,delete].responses"
    then:
      function: schema
      functionOptions:
        schema:
          anyOf:
            - required: ["500"]
            - required: ["5XX"]
            - required: ["default"]

  # Enforce canonical extension names
  canonical-extension-prefix:
    description: "Use canonical x-micro-contracts-* extensions"
    severity: warn
    given: "$.paths[*][get,post,put,patch,delete]"
    then:
      - field: x-domain
        function: falsy
        description: "Use x-micro-contracts-domain instead of x-domain"
      - field: x-method
        function: falsy
        description: "Use x-micro-contracts-method instead of x-method"
      - field: x-public
        function: falsy
        description: "Use x-micro-contracts-published instead of x-public"
`;
}

// =============================================================================
// Dependency Analysis Helpers
// =============================================================================

function outputDependencyGraph(moduleDeps: Map<string, { deps: string[] }>): void {
  console.log('```mermaid');
  console.log('graph LR');
  
  for (const [moduleName, { deps }] of moduleDeps) {
    // Group deps by target module
    const moduleTargets = new Set<string>();
    for (const dep of deps) {
      const parts = dep.split('.');
      if (parts.length >= 1) {
        moduleTargets.add(parts[0]);
      }
    }
    
    for (const target of moduleTargets) {
      console.log(`  ${moduleName} --> ${target}`);
    }
  }
  
  console.log('```');
}

function outputImpactAnalysis(
  moduleDeps: Map<string, { deps: string[] }>,
  ref: string
): void {
  console.log(`Impacted by changes to ${ref}:\n`);
  
  const impacted: string[] = [];
  for (const [moduleName, { deps }] of moduleDeps) {
    if (deps.includes(ref)) {
      impacted.push(moduleName);
    }
  }
  
  if (impacted.length === 0) {
    console.log('  No modules depend on this API.');
  } else {
    for (const m of impacted) {
      console.log(`  - ${m}`);
    }
  }
}

function outputWhoDependsOn(
  moduleDeps: Map<string, { deps: string[] }>,
  ref: string
): void {
  console.log(`Modules that depend on ${ref}:\n`);
  
  const dependent: string[] = [];
  for (const [moduleName, { deps }] of moduleDeps) {
    if (deps.some(d => d.startsWith(ref))) {
      dependent.push(moduleName);
    }
  }
  
  if (dependent.length === 0) {
    console.log('  None found.');
  } else {
    for (const m of dependent) {
      console.log(`  - ${m}`);
    }
  }
}

function validateDependencies(
  moduleDeps: Map<string, { openApiDeps: string[]; configDeps: string[] }>
): void {
  let hasErrors = false;
  
  for (const [moduleName, { openApiDeps, configDeps }] of moduleDeps) {
    // Check that configDeps is subset of openApiDeps
    for (const dep of configDeps) {
      if (!openApiDeps.includes(dep)) {
        console.error(`ERROR: ${moduleName}.dependsOn includes '${dep}'`);
        console.error(`       but it's not declared in OpenAPI x-micro-contracts-depend-on`);
        hasErrors = true;
      }
    }
  }
  
  if (!hasErrors) {
    console.log('✓ All dependencies are valid');
  } else {
    process.exit(1);
  }
}

function outputAllDependencies(moduleDeps: Map<string, { deps: string[] }>): void {
  console.log('Module Dependencies:\n');
  
  for (const [moduleName, { deps }] of moduleDeps) {
    console.log(`${moduleName}:`);
    if (deps.length === 0) {
      console.log('  (no dependencies)');
    } else {
      for (const dep of deps) {
        console.log(`  - ${dep}`);
      }
    }
    console.log();
  }
}

// Starter templates are imported from ./cli/templates.js
