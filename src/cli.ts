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
import { createRequire } from 'module';
import yaml from 'yaml';
import { generate, loadConfig, loadOpenAPISpec, lintSpec, formatLintResults } from './generator/index.js';
import type { GeneratorConfig, MultiModuleConfig } from './types.js';
import { getStarterTemplates } from './cli/templates.js';
import {
  runAllChecks,
  formatCheckResults,
  formatSingleCheckResult,
  formatCheckStart,
  formatCheckSummary,
  getAvailableChecks,
  createGuardrailsConfig,
  generateManifest,
  writeManifest,
  GATE_DESCRIPTIONS,
  loadGuardrailsConfigWithPath,
} from './guardrails/index.js';
import type { GateNumber, CheckResult, CheckDefinition, CheckOptions } from './guardrails/index.js';

// Load package.json for version info
const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const program = new Command();

program
  .name('micro-contracts')
  .description('Contract-first OpenAPI toolchain for TypeScript')
  .version(pkg.version);

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
  .option('--no-manifest', 'Skip manifest generation even if guardrails are configured')
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
      
      // Generate manifest if guardrails config has 'generated' section
      // (unless --no-manifest is specified)
      if (options.manifest !== false) {
        const { config: guardrailsConfig } = loadGuardrailsConfigWithPath();
        
        // Check if guardrails config has generated patterns defined
        if (guardrailsConfig?.generated && guardrailsConfig.generated.length > 0) {
          const manifestDir = options.manifestDir || 'packages/';
          if (fs.existsSync(manifestDir)) {
            const { manifest, changed } = await generateManifest(manifestDir, {
              generatorVersion: pkg.version,
            });
            const fileCount = Object.keys(manifest.files).length;
            
            if (changed) {
              const manifestPath = writeManifest(manifest, manifestDir);
              console.log(`\nManifest updated: ${manifestPath} (${fileCount} files)`);
            } else {
              console.log(`\nManifest unchanged (${fileCount} files)`);
            }
          }
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
  .option('-i, --openapi <path>', 'OpenAPI spec to process (auto-adds x-micro-contracts-service/method)')
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
      path.join(baseDir, 'services'),
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
      [path.join(baseDir, 'services', 'index.ts'), '// Export service classes\n'],
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
      console.log(`  - Added x-micro-contracts-service to ${processed.stats.servicesAdded} operations`);
      console.log(`  - Added x-micro-contracts-method to ${processed.stats.methodsAdded} operations`);
      if (processed.stats.services.length > 0) {
        console.log(`  - Detected services: ${processed.stats.services.join(', ')}`);
      }
    }
    
    console.log(`\nModule "${name}" initialized!`);
    
    if (!options.openapi) {
      console.log(`\nNext steps:`);
      console.log(`  1. Create spec/${name}/openapi/${name}.yaml with your API spec`);
      console.log(`  2. Add x-micro-contracts-service and x-micro-contracts-method to operations`);
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
  .option('--gate <gates>', 'Run checks for specific gates only (comma-separated, 1-5)')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--fix', 'Auto-fix issues where possible')
  .option('-g, --guardrails <path>', 'Path to guardrails.yaml')
  .option('-d, --generated-dir <path>', 'Path to generated files directory', 'packages/')
  .option('--changed-files <path>', 'Path to file containing list of changed files (for CI)')
  .option('--list', 'List available checks')
  .option('--list-gates', 'List available gates')
  .action(async (options) => {
    try {
      // List gates
      if (options.listGates) {
        console.log('\nAvailable gates:\n');
        for (const [gate, description] of Object.entries(GATE_DESCRIPTIONS)) {
          console.log(`  Gate ${gate}: ${description}`);
        }
        console.log('\nUsage: micro-contracts check --gate 1,2,3');
        console.log('');
        return;
      }
      
      // List checks
      if (options.list) {
        console.log('\nAvailable checks:\n');
        for (const check of getAvailableChecks({ guardrailsPath: options.guardrails })) {
          const gateStr = check.gate !== undefined ? `[G${check.gate}]` : '    ';
          console.log(`  ${gateStr} ${check.name.padEnd(20)} - ${check.description}`);
        }
        console.log('');
        return;
      }
      
      // Parse gate option
      let gates: GateNumber[] | undefined;
      if (options.gate) {
        gates = options.gate.split(',').map((s: string) => {
          const num = parseInt(s.trim(), 10);
          if (num < 1 || num > 5 || isNaN(num)) {
            throw new Error(`Invalid gate number: ${s}. Must be 1-5.`);
          }
          return num as GateNumber;
        });
      }
      
      // Print header immediately
      console.log('');
      console.log('🔍 AI Guardrail Check Results');
      console.log('═'.repeat(50));
      console.log('');
      
      // Track whether we're using streaming output (default: yes for TTY)
      const isStreaming = process.stdout.isTTY !== false;
      
      // Parse options with streaming callbacks
      const checkOptions = {
        only: options.only?.split(',').map((s: string) => s.trim()),
        skip: options.skip?.split(',').map((s: string) => s.trim()),
        gates,
        verbose: options.verbose,
        fix: options.fix,
        guardrailsPath: options.guardrails,
        generatedDir: options.generatedDir,
        changedFilesPath: options.changedFiles,
        // Streaming output callbacks
        onCheckStart: isStreaming ? (check: CheckDefinition) => {
          // Clear line and show "running..." message
          if (process.stdout.isTTY) {
            process.stdout.write(formatCheckStart(check) + '\r');
          }
        } : undefined,
        onCheckComplete: isStreaming ? (result: CheckResult, check: CheckDefinition) => {
          // Clear the "running..." line and print result
          if (process.stdout.isTTY) {
            process.stdout.clearLine?.(0);
            process.stdout.cursorTo?.(0);
          }
          console.log(formatSingleCheckResult(result, check, options.verbose));
        } : undefined,
      };
      
      // Run checks
      const summary = await runAllChecks(checkOptions);
      
      // Output results
      if (isStreaming) {
        // Only output summary (individual results already printed)
        console.log(formatCheckSummary(summary, summary.checks));
      } else {
        // Non-streaming: output everything at once
        console.log(formatCheckResults(summary, options.verbose, summary.checks));
      }
      
      // Exit with error if any checks failed
      if (summary.failed > 0) {
        process.exit(1);
      }
      
    } catch (error) {
      console.error('Check failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Pipeline command (Gate 1,2 → Generate → Gate 3,4,5)
program
  .command('pipeline')
  .description('Run full guardrails pipeline: Gate 1,2 → Generate → Gate 3,4,5')
  .option('-v, --verbose', 'Enable verbose output (show detailed logs)')
  .option('--skip <checks>', 'Skip specific checks (comma-separated)')
  .option('--continue-on-error', 'Continue running even if a step fails')
  .option('-g, --guardrails <path>', 'Path to guardrails.yaml')
  .option('-c, --config <path>', 'Path to config file (micro-contracts.config.yaml)')
  .option('-d, --generated-dir <path>', 'Path to generated files directory', 'packages/')
  .option('--no-manifest', 'Skip manifest generation')
  .option('--skip-lint', 'Skip linting before generation')
  .option('--contracts-only', 'Generate contract packages only')
  .option('--server-only', 'Generate server routes only')
  .option('--frontend-only', 'Generate frontend clients only')
  .option('--docs-only', 'Generate documentation only')
  .action(async (options) => {
    try {
      const startTime = Date.now();
      const verbose = options.verbose;
      let hasFailure = false;
      let generatePassed = false;
      let generateDuration = 0;
      let generateSkipped = false;
      let generateError: string | null = null;
      
      // All results for final summary
      const allResults: CheckResult[] = [];
      
      console.log('');
      console.log('🚀 Running AI Guardrails Pipeline');
      console.log('═'.repeat(50));
      console.log('');
      
      // Parse skip option
      const skipChecks = options.skip?.split(',').map((s: string) => s.trim()) || [];
      
      // Common check options
      const isStreaming = process.stdout.isTTY !== false;
      const baseCheckOptions = {
        verbose,
        skip: skipChecks,
        guardrailsPath: options.guardrails,
        generatedDir: options.generatedDir,
        onCheckStart: isStreaming ? (check: CheckDefinition) => {
          if (process.stdout.isTTY) {
            process.stdout.write(formatCheckStart(check) + '\r');
          }
        } : undefined,
        onCheckComplete: isStreaming ? (result: CheckResult, check: CheckDefinition) => {
          if (process.stdout.isTTY) {
            process.stdout.clearLine?.(0);
            process.stdout.cursorTo?.(0);
          }
          console.log(formatSingleCheckResult(result, check, verbose));
        } : undefined,
      };
      
      // ========================================
      // Step 1: Gate 1,2 (Pre-generation checks)
      // ========================================
      if (verbose) {
        console.log('┌─────────────────────────────────────────────────┐');
        console.log('│ Step 1: Pre-generation checks (Gate 1, 2)       │');
        console.log('└─────────────────────────────────────────────────┘');
        console.log('');
      }
      
      const gate12Summary = await runAllChecks({
        ...baseCheckOptions,
        gates: [1, 2],
      });
      
      // Collect results (only non-skipped for display count)
      allResults.push(...gate12Summary.results);
      
      if (verbose) {
        console.log(formatCheckSummary(gate12Summary, gate12Summary.checks));
      }
      
      if (gate12Summary.failed > 0) {
        hasFailure = true;
        if (!options.continueOnError) {
          console.log('');
          console.log('❌ Gate 1,2 failed. Stopping pipeline.');
          console.log('   Use --continue-on-error to continue despite failures.');
          process.exit(1);
        }
        if (verbose) {
          console.log('⚠️  Gate 1,2 had failures. Continuing due to --continue-on-error.');
          console.log('');
        }
      }
      
      // ========================================
      // Step 2: Generate
      // ========================================
      if (verbose) {
        console.log('┌─────────────────────────────────────────────────┐');
        console.log('│ Step 2: Generate contracts                      │');
        console.log('└─────────────────────────────────────────────────┘');
        console.log('');
      }
      
      const generateStartTime = Date.now();
      
      // Show "running..." indicator for generate
      if (isStreaming && process.stdout.isTTY) {
        process.stdout.write('  ⋯ Generate              running...\r');
      }
      
      try {
        // Load config
        const configPath = options.config 
          ? path.resolve(options.config)
          : findConfigFile();
        
        if (!configPath) {
          generateSkipped = true;
          generateDuration = Date.now() - generateStartTime;
          
          // Clear the running indicator
          if (isStreaming && process.stdout.isTTY) {
            process.stdout.clearLine?.(0);
            process.stdout.cursorTo?.(0);
          }
          console.log('  ○ Generate              SKIP (no config file)');
        } else {
          if (verbose) {
            console.log(`  Using config: ${configPath}`);
          }
          const config = loadConfig(configPath);
          
          // Suppress console output during generation (unless verbose)
          const originalLog = console.log;
          if (!verbose) {
            console.log = () => {};
          }
          
          try {
            // Run generation
            await generate(config, {
              skipLint: options.skipLint,
              contractsOnly: options.contractsOnly,
              serverOnly: options.serverOnly,
              frontendOnly: options.frontendOnly,
              docsOnly: options.docsOnly,
            });
            
            // Generate manifest if enabled
            if (options.manifest !== false) {
              const { config: guardrailsConfig } = loadGuardrailsConfigWithPath(options.guardrails);
              
              if (guardrailsConfig?.generated && guardrailsConfig.generated.length > 0) {
                const manifestDir = options.generatedDir || 'packages/';
                if (fs.existsSync(manifestDir)) {
                  const { manifest, changed } = await generateManifest(manifestDir, {
                    generatorVersion: pkg.version,
                  });
                  // Only log in verbose mode
                  if (verbose) {
                    const fileCount = Object.keys(manifest.files).length;
                    if (changed) {
                      const manifestPath = writeManifest(manifest, manifestDir);
                      originalLog(`  Manifest updated: ${manifestPath} (${fileCount} files)`);
                    } else {
                      originalLog(`  Manifest unchanged (${fileCount} files)`);
                    }
                  } else if (changed) {
                    // Still write the manifest even in non-verbose mode
                    writeManifest(manifest, manifestDir);
                  }
                }
              }
            }
            
            generatePassed = true;
          } finally {
            // Restore console.log
            if (!verbose) {
              console.log = originalLog;
            }
          }
          
          generateDuration = Date.now() - generateStartTime;
          
          // Clear the running indicator
          if (isStreaming && process.stdout.isTTY) {
            process.stdout.clearLine?.(0);
            process.stdout.cursorTo?.(0);
          }
          
          console.log(`  ✓ Generate              PASS (${generateDuration}ms)`);
          
          if (verbose) {
            console.log('');
          }
        }
      } catch (error) {
        generateDuration = Date.now() - generateStartTime;
        hasFailure = true;
        generateError = error instanceof Error ? error.message : String(error);
        
        // Clear the running indicator
        if (isStreaming && process.stdout.isTTY) {
          process.stdout.clearLine?.(0);
          process.stdout.cursorTo?.(0);
        }
        
        console.log(`  ✗ Generate              FAIL (${generateDuration}ms)`);
        if (verbose || true) { // Always show error message
          console.log(`    ${generateError}`);
        }
        
        if (!options.continueOnError) {
          console.log('');
          console.log('❌ Generation failed. Stopping pipeline.');
          process.exit(1);
        }
        if (verbose) {
          console.log('⚠️  Continuing due to --continue-on-error.');
        }
      }
      
      // ========================================
      // Step 3: Gate 3,4,5 (Post-generation checks)
      // ========================================
      if (verbose) {
        console.log('');
        console.log('┌─────────────────────────────────────────────────┐');
        console.log('│ Step 3: Post-generation checks (Gate 3, 4, 5)   │');
        console.log('└─────────────────────────────────────────────────┘');
        console.log('');
      }
      
      const gate345Summary = await runAllChecks({
        ...baseCheckOptions,
        gates: [3, 4, 5],
      });
      
      // Collect results
      allResults.push(...gate345Summary.results);
      
      if (verbose) {
        console.log(formatCheckSummary(gate345Summary, gate345Summary.checks));
      }
      
      if (gate345Summary.failed > 0) {
        hasFailure = true;
      }
      
      // ========================================
      // Final Summary
      // ========================================
      const totalDuration = Date.now() - startTime;
      const totalPassed = gate12Summary.passed + gate345Summary.passed + (generatePassed ? 1 : 0);
      const totalFailed = gate12Summary.failed + gate345Summary.failed + (generateError ? 1 : 0);
      const totalSkipped = gate12Summary.skipped + gate345Summary.skipped + (generateSkipped ? 1 : 0);
      
      console.log('');
      console.log('━'.repeat(50));
      console.log('📊 Pipeline Summary');
      console.log('━'.repeat(50));
      console.log('');
      console.log(`  Total Passed:  ${totalPassed}`);
      console.log(`  Total Failed:  ${totalFailed}`);
      if (totalSkipped > 0) {
        console.log(`  Total Skipped: ${totalSkipped}`);
      }
      console.log(`  Duration:      ${totalDuration}ms`);
      console.log('');
      
      if (hasFailure) {
        console.log('❌ Pipeline completed with failures.');
        
        // Show failed check details
        const failedResults = allResults.filter(r => r.status === 'fail' && r.details && r.details.length > 0);
        if (failedResults.length > 0) {
          console.log('');
          console.log('📋 Failed Check Details:');
          for (const result of failedResults) {
            console.log(`  ▶ ${result.name}`);
            for (const detail of result.details!) {
              console.log(`    ${detail}`);
            }
          }
        }
        
        process.exit(1);
      } else {
        console.log('✅ Pipeline completed successfully!');
      }
      console.log('');
      
    } catch (error) {
      console.error('Pipeline failed:', error instanceof Error ? error.message : error);
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
        const { manifest, changed } = await generateManifest(baseDir, {
          generatorVersion: pkg.version,
        });
        
        const fileCount = Object.keys(manifest.files).length;
        
        if (changed) {
          const manifestPath = writeManifest(manifest, baseDir);
          console.log(`Manifest updated: ${manifestPath} (${fileCount} files)`);
        } else {
          console.log(`Manifest unchanged (${fileCount} files)`);
        }
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

// Import service implementations
// import { ExampleService } from './services/ExampleService.js';

// Import service interfaces from contract
// import type { ExampleServiceApi } from '@project/contract/${moduleName}/services';

export interface ${pascalName}Services {
  // example: ExampleServiceApi;
}

export interface ${pascalName}ModuleContainer {
  services: ${pascalName}Services;
  testConnection: () => Promise<boolean>;
  close: () => Promise<void>;
}

export async function initialize${pascalName}Module(): Promise<${pascalName}ModuleContainer> {
  const services: ${pascalName}Services = {
    // example: new ExampleService(),
  };

  return {
    services,
    testConnection,
    close: closeDb,
  };
}
`;
}

/**
 * Process OpenAPI file and auto-add x-micro-contracts-service/method extensions
 */
function processOpenAPIWithExtensions(openapiPath: string): {
  yaml: string;
  stats: {
    servicesAdded: number;
    methodsAdded: number;
    services: string[];
  };
} {
  const content = fs.readFileSync(openapiPath, 'utf-8');
  const spec = yaml.parse(content);
  
  const stats = {
    servicesAdded: 0,
    methodsAdded: 0,
    services: new Set<string>(),
  };
  
  const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
  
  if (spec.paths) {
    for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;
      
      // Infer service from path: /api/users/{id} → User
      const service = inferServiceFromPath(pathKey);
      
      for (const method of httpMethods) {
        const operation = (pathItem as Record<string, unknown>)[method];
        if (!operation || typeof operation !== 'object') continue;
        
        const op = operation as Record<string, unknown>;
        
        // Add x-micro-contracts-service if not present
        if (!op['x-micro-contracts-service'] && service) {
          op['x-micro-contracts-service'] = service;
          stats.servicesAdded++;
          stats.services.add(service);
        }
        
        // Add x-micro-contracts-method if not present
        if (!op['x-micro-contracts-method']) {
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
      servicesAdded: stats.servicesAdded,
      methodsAdded: stats.methodsAdded,
      services: Array.from(stats.services),
    },
  };
}

/**
 * Infer service name from API path
 * /api/users → User
 * /api/users/{id} → User
 * /api/user-profiles → UserProfile
 * /api/v1/accounts → Account
 */
function inferServiceFromPath(pathKey: string): string | null {
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
    '        servicesPath: fastify.services.{module}',
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
  # Require x-micro-contracts-service on all operations
  operation-service:
    description: "Operations must have x-micro-contracts-service"
    severity: error
    given: "$.paths[*][get,post,put,patch,delete]"
    then:
      field: x-micro-contracts-service
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
      - field: x-service
        function: falsy
        description: "Use x-micro-contracts-service instead of x-service"
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
