/**
 * TypeScript type check for guardrails
 * 
 * Runs tsc --noEmit to verify TypeScript compilation.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { CheckResult, CheckOptions } from './types.js';

/**
 * Find tsconfig.json files
 */
export function findTsConfigs(baseDir: string = '.'): string[] {
  const configs: string[] = [];
  
  // Check common locations
  const candidates = [
    'tsconfig.json',
    'packages/contract/tsconfig.json',
    'server/tsconfig.json',
    'frontend/tsconfig.json',
  ];
  
  for (const candidate of candidates) {
    const fullPath = path.join(baseDir, candidate);
    if (fs.existsSync(fullPath)) {
      configs.push(fullPath);
    }
  }
  
  return configs;
}

/**
 * Run TypeScript type check
 */
export async function runTypecheckCheck(options: CheckOptions): Promise<CheckResult> {
  const start = Date.now();
  
  try {
    // Find tsconfig files
    const tsconfigs = findTsConfigs();
    
    if (tsconfigs.length === 0) {
      return {
        name: 'typecheck',
        status: 'skip',
        duration: Date.now() - start,
        message: 'No tsconfig.json found',
      };
    }
    
    const errors: string[] = [];
    let hasErrors = false;
    
    for (const tsconfig of tsconfigs) {
      try {
        // Run tsc --noEmit
        execSync(`npx tsc --noEmit -p "${tsconfig}"`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (error) {
        hasErrors = true;
        if (error && typeof error === 'object' && 'stdout' in error) {
          const output = (error as { stdout: string }).stdout;
          if (output) {
            errors.push(`${tsconfig}:`);
            // Parse tsc output for specific errors
            const lines = output.split('\n').filter(line => line.includes('error TS'));
            for (const line of lines.slice(0, 10)) { // Limit to first 10 errors
              errors.push(`  ${line.trim()}`);
            }
            if (lines.length > 10) {
              errors.push(`  ... and ${lines.length - 10} more errors`);
            }
          }
        } else if (error && typeof error === 'object' && 'stderr' in error) {
          const stderr = (error as { stderr: string }).stderr;
          if (stderr) {
            errors.push(`${tsconfig}: ${stderr.trim()}`);
          }
        }
      }
    }
    
    if (hasErrors) {
      return {
        name: 'typecheck',
        status: 'fail',
        duration: Date.now() - start,
        message: `Type errors in ${errors.length > 0 ? 'config(s)' : 'project'}`,
        details: errors,
      };
    }
    
    return {
      name: 'typecheck',
      status: 'pass',
      duration: Date.now() - start,
      message: `${tsconfigs.length} project(s) passed type check`,
    };
    
  } catch (error) {
    return {
      name: 'typecheck',
      status: 'fail',
      duration: Date.now() - start,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

