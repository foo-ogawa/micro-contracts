/**
 * Check runner for guardrails
 * 
 * Orchestrates running multiple guardrail checks.
 * Supports both built-in checks and custom checks from guardrails.yaml.
 */

import type { CheckOptions, CheckResult, CheckSummary, CheckDefinition, CheckCommandConfig, GateNumber } from './types.js';
import { runAllowlistCheck } from './allowlist.js';
import { runDriftCheck } from './drift.js';
import { runManifestCheck } from './manifest.js';
import { runLintCheck, runCustomCommandCheck } from './lint.js';
import { runTypecheckCheck } from './typecheck.js';
import { runDocsCheck } from './docs.js';
import { runSecurityCheck } from './security.js';
import { loadGuardrailsConfigWithPath } from './config.js';

/**
 * Gate descriptions for display
 */
export const GATE_DESCRIPTIONS: Record<GateNumber, string> = {
  1: 'Change Allowlist',
  2: 'OpenAPI Contract Validation',
  3: 'Generated Artifact Integrity',
  4: 'Code Quality',
  5: 'Doc Consistency & Static Analysis',
};

/**
 * Built-in checks (always available)
 */
const builtinChecks: CheckDefinition[] = [
  {
    name: 'allowlist',
    description: 'Verify changes are within allowed paths',
    gate: 1,
    run: runAllowlistCheck,
  },
  {
    name: 'drift',
    description: 'Check for uncommitted generated file changes',
    gate: 3,
    run: runDriftCheck,
  },
  {
    name: 'manifest',
    description: 'Verify generated artifact integrity',
    gate: 3,
    run: runManifestCheck,
  },
  {
    name: 'security',
    description: 'Verify security declarations match implementations',
    gate: 5,
    run: runSecurityCheck,
  },
];

/**
 * Legacy built-in checks (deprecated - use guardrails.yaml checks instead)
 * These are only included if no custom checks are defined in guardrails.yaml
 */
const legacyChecks: CheckDefinition[] = [
  // Removed: use spec-lint in guardrails.yaml instead
  // Removed: use code-typecheck in guardrails.yaml instead
  // Removed: use docs-sync, docs-links in guardrails.yaml instead
];

/**
 * Load custom checks from guardrails.yaml
 */
function loadCustomChecks(options: CheckOptions): CheckDefinition[] {
  const { config } = loadGuardrailsConfigWithPath(options.guardrailsPath);
  const customChecks: CheckDefinition[] = [];

  if (config?.checks) {
    for (const [name, checkConfig] of Object.entries(config.checks)) {
      if (!checkConfig || checkConfig.enabled === false) {
        continue;
      }

      customChecks.push({
        name,
        description: `Custom check: ${name}`,
        gate: checkConfig.gate,
        run: (opts) => runCustomCommandCheck(name, checkConfig.command, opts),
      });
    }
  }

  return customChecks;
}

/**
 * Get all available checks (built-in + custom)
 */
function getAllChecks(options: CheckOptions): CheckDefinition[] {
  const customChecks = loadCustomChecks(options);
  const customNames = new Set(customChecks.map(c => c.name));

  // Start with built-in checks
  const allChecks = [...builtinChecks];

  // Add legacy checks only if not overridden by custom checks
  for (const legacyCheck of legacyChecks) {
    if (!customNames.has(legacyCheck.name)) {
      allChecks.push(legacyCheck);
    }
  }

  // Add custom checks
  allChecks.push(...customChecks);

  return allChecks;
}

/**
 * Get list of available checks
 */
export function getAvailableChecks(options: CheckOptions = {}): CheckDefinition[] {
  return getAllChecks(options);
}

/**
 * Filter checks based on options
 */
function filterChecks(allChecks: CheckDefinition[], options: CheckOptions): CheckDefinition[] {
  let filtered = [...allChecks];
  
  // Filter by --gate (highest priority)
  if (options.gates && options.gates.length > 0) {
    filtered = filtered.filter(c => c.gate !== undefined && options.gates!.includes(c.gate));
  }
  
  // Filter by --only
  if (options.only && options.only.length > 0) {
    filtered = filtered.filter(c => options.only!.includes(c.name));
  }
  
  // Filter by --skip
  if (options.skip && options.skip.length > 0) {
    filtered = filtered.filter(c => !options.skip!.includes(c.name));
  }
  
  return filtered;
}

/**
 * Extended check summary with gate info
 */
export interface CheckSummaryWithGates extends CheckSummary {
  /** All checks with their gate assignments */
  checks: CheckDefinition[];
}

/**
 * Run all guardrail checks
 */
export async function runAllChecks(options: CheckOptions = {}): Promise<CheckSummaryWithGates> {
  const results: CheckResult[] = [];
  const allChecks = getAllChecks(options);
  const checksToRun = filterChecks(allChecks, options);
  const skippedChecks = allChecks.filter(c => !checksToRun.includes(c));
  
  // Add skipped results
  for (const check of skippedChecks) {
    results.push({
      name: check.name,
      status: 'skip',
      duration: 0,
      message: 'Skipped by filter',
    });
  }
  
  // Run enabled checks
  for (const check of checksToRun) {
    try {
      const result = await check.run(options);
      results.push(result);
    } catch (error) {
      results.push({
        name: check.name,
        status: 'fail',
        duration: 0,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  // Calculate summary
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  
  return {
    passed,
    failed,
    skipped,
    results,
    checks: allChecks,
  };
}

/**
 * Format check results for CLI output
 */
export function formatCheckResults(
  summary: CheckSummary,
  verbose: boolean = false,
  checksWithGates?: CheckDefinition[]
): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('🔍 AI Guardrail Check Results');
  lines.push('═'.repeat(50));
  lines.push('');
  
  // Build a map of check name -> gate for display
  const gateMap = new Map<string, GateNumber | undefined>();
  if (checksWithGates) {
    for (const check of checksWithGates) {
      gateMap.set(check.name, check.gate);
    }
  }
  
  // Group results by gate if gate info is available
  const hasGateInfo = checksWithGates && checksWithGates.some(c => c.gate !== undefined);
  
  if (hasGateInfo && verbose) {
    // Group by gate for verbose output
    const byGate = new Map<GateNumber | undefined, typeof summary.results>();
    for (const result of summary.results) {
      const gate = gateMap.get(result.name);
      if (!byGate.has(gate)) {
        byGate.set(gate, []);
      }
      byGate.get(gate)!.push(result);
    }
    
    // Output by gate
    const sortedGates = [...byGate.keys()].sort((a, b) => {
      if (a === undefined) return 1;
      if (b === undefined) return -1;
      return a - b;
    });
    
    for (const gate of sortedGates) {
      const results = byGate.get(gate)!;
      if (gate !== undefined) {
        lines.push(`  Gate ${gate}: ${GATE_DESCRIPTIONS[gate]}`);
        lines.push('  ' + '─'.repeat(40));
      } else {
        lines.push(`  Other Checks:`);
        lines.push('  ' + '─'.repeat(40));
      }
      
      for (const result of results) {
        const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '○';
        const status = result.status.toUpperCase().padEnd(4);
        
        lines.push(`    ${icon} ${result.name.padEnd(20)} ${status} (${result.duration}ms)`);
        
        if (result.message && (verbose || result.status !== 'pass')) {
          lines.push(`      ${result.message}`);
        }
        
        if (verbose && result.details) {
          for (const detail of result.details) {
            lines.push(`      ${detail}`);
          }
        }
      }
      lines.push('');
    }
  } else {
    // Flat output
    for (const result of summary.results) {
      const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '○';
      const status = result.status.toUpperCase().padEnd(4);
      const gate = gateMap.get(result.name);
      const gateStr = gate !== undefined ? `[G${gate}] ` : '';
      
      lines.push(`  ${icon} ${gateStr}${result.name.padEnd(20)} ${status} (${result.duration}ms)`);
      
      if (result.message && (verbose || result.status !== 'pass')) {
        lines.push(`    ${result.message}`);
      }
      
      if (verbose && result.details) {
        for (const detail of result.details) {
          lines.push(`    ${detail}`);
        }
      }
    }
  }
  
  // Summary
  lines.push('');
  lines.push('─'.repeat(50));
  lines.push('');
  lines.push(`  Passed:  ${summary.passed}`);
  lines.push(`  Failed:  ${summary.failed}`);
  if (summary.skipped > 0) {
    lines.push(`  Skipped: ${summary.skipped}`);
  }
  lines.push('');
  
  if (summary.failed > 0) {
    lines.push('❌ Some checks failed. Fix issues before committing.');
  } else {
    lines.push('✅ All checks passed!');
  }
  lines.push('');
  
  return lines.join('\n');
}
