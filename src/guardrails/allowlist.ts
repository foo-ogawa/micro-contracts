/**
 * Allowlist verification for guardrails
 * 
 * Verifies that changed files are within allowed boundaries.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import type { GuardrailsConfig, AllowlistResult, AllowlistViolation, CheckResult, CheckOptions } from './types.js';
import { loadGuardrailsConfigWithPath } from './config.js';

/**
 * Simple glob pattern matching with negation support
 * Patterns are evaluated top-to-bottom; last match wins.
 * - "!pattern" → if matched, result becomes false (exclude)
 * - "pattern"  → if matched, result becomes true (include)
 */
export function matchWithNegation(patterns: string[] | undefined, file: string): boolean {
  if (!patterns || patterns.length === 0) return false;
  
  let matched = false;
  
  for (const raw of patterns) {
    const neg = raw.startsWith('!');
    const pattern = neg ? raw.slice(1) : raw;
    if (!pattern) continue;
    
    if (matchGlob(file, pattern)) {
      matched = !neg;
    }
  }
  
  return matched;
}

/**
 * Simple glob pattern matching
 * Supports:
 * - * matches any characters except /
 * - ** matches any characters including / (zero or more path segments)
 * - ? matches single character
 */
export function matchGlob(file: string, pattern: string): boolean {
  // Normalize paths
  const normalizedFile = file.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');
  
  return matchGlobInternal(normalizedFile, normalizedPattern);
}

/**
 * Internal glob matching implementation using regex
 */
function matchGlobInternal(file: string, pattern: string): boolean {
  // Convert glob pattern to regex step by step
  let regex = '';
  let i = 0;
  
  while (i < pattern.length) {
    const char = pattern[i];
    const nextChar = pattern[i + 1];
    
    if (char === '*' && nextChar === '*') {
      // ** - matches any path segments
      const afterStars = pattern[i + 2];
      
      if (afterStars === '/') {
        // **/ at start or middle - matches zero or more path segments including nothing
        regex += '(?:.*/)?';
        i += 3; // skip **/
      } else if (i + 2 === pattern.length || afterStars === undefined) {
        // ** at end - matches everything
        regex += '.*';
        i += 2;
      } else {
        // ** without trailing / - matches any characters
        regex += '.*';
        i += 2;
      }
    } else if (char === '*') {
      // * - matches any characters except /
      regex += '[^/]*';
      i++;
    } else if (char === '?') {
      // ? - matches single character except /
      regex += '[^/]';
      i++;
    } else if (char === '/') {
      regex += '/';
      i++;
    } else if ('.+^${}()|[]\\'.includes(char)) {
      // Escape regex special chars
      regex += '\\' + char;
      i++;
    } else {
      regex += char;
      i++;
    }
  }
  
  // Anchor the pattern
  regex = `^${regex}$`;
  
  try {
    return new RegExp(regex).test(file);
  } catch {
    return false;
  }
}

/**
 * Get list of changed files, filtered to a specific base directory
 */
export function getChangedFiles(options: {
  /** Path to file containing list of changed files */
  changedFilesPath?: string;
  /** Base ref for git diff (default: HEAD) */
  baseRef?: string;
  /** Base directory to filter files (only files under this dir are returned) */
  baseDir?: string;
}): string[] {
  const { changedFilesPath, baseRef, baseDir } = options;
  
  let files: string[];
  
  if (changedFilesPath) {
    // Read from file (CI mode)
    if (!fs.existsSync(changedFilesPath)) {
      throw new Error(`Changed files list not found: ${changedFilesPath}`);
    }
    files = fs.readFileSync(changedFilesPath, 'utf-8')
      .trim()
      .split('\n')
      .filter(Boolean);
  } else {
    // Use git diff (local mode)
    try {
      const ref = baseRef || 'HEAD';
      // Try staged files first
      let out = execSync('git diff --name-only --cached', { encoding: 'utf8' });
      files = out.trim().split('\n').filter(Boolean);
      
      // If no staged files, try unstaged
      if (files.length === 0) {
        out = execSync('git diff --name-only', { encoding: 'utf8' });
        files = out.trim().split('\n').filter(Boolean);
      }
      
      // If still no files, try diff against base ref
      if (files.length === 0 && ref !== 'HEAD') {
        out = execSync(`git diff --name-only ${ref}...HEAD`, { encoding: 'utf8' });
        files = out.trim().split('\n').filter(Boolean);
      }
    } catch (error) {
      // Git not available or not in a git repo
      return [];
    }
  }
  
  // Filter and convert paths relative to baseDir
  if (baseDir) {
    // Get git root to resolve absolute paths
    let gitRoot: string;
    try {
      gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
    } catch {
      gitRoot = process.cwd();
    }
    
    const absoluteBaseDir = path.resolve(baseDir);
    
    // Filter to only files under baseDir and convert to relative paths
    files = files
      .map(f => path.resolve(gitRoot, f))  // Convert to absolute
      .filter(f => f.startsWith(absoluteBaseDir + path.sep) || f === absoluteBaseDir)  // Filter to baseDir
      .map(f => path.relative(absoluteBaseDir, f));  // Convert to relative from baseDir
  }
  
  return files;
}

/**
 * Verify changed files against allowlist
 */
export function verifyAllowlist(
  changedFiles: string[],
  config: GuardrailsConfig
): AllowlistResult {
  const violations: AllowlistViolation[] = [];
  
  for (const file of changedFiles) {
    // 1. Check if protected (not allowed in normal PRs)
    if (matchWithNegation(config.protected, file)) {
      violations.push({ file, reason: 'protected' });
      continue;
    }
    
    // 2. Check if generated (allowed, but must pass drift/manifest checks)
    if (matchWithNegation(config.generated, file)) {
      // Generated files are allowed to change, but we don't add a violation
      // The drift/manifest checks will verify integrity
      continue;
    }
    
    // 3. Must be in allowed list
    if (!matchWithNegation(config.allowed, file)) {
      violations.push({ file, reason: 'not-in-allowlist' });
    }
  }
  
  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Run allowlist check
 */
export async function runAllowlistCheck(options: CheckOptions): Promise<CheckResult> {
  const start = Date.now();
  
  try {
    // Load config with path information
    const { config, baseDir, configPath } = loadGuardrailsConfigWithPath(options.guardrailsPath);
    
    // Get changed files relative to guardrails config directory
    const changedFiles = getChangedFiles({
      changedFilesPath: options.changedFilesPath,
      baseDir,  // Filter to files under guardrails.yaml directory
    });
    
    if (changedFiles.length === 0) {
      return {
        name: 'allowlist',
        status: 'pass',
        duration: Date.now() - start,
        message: configPath 
          ? `No changed files under ${path.basename(path.dirname(configPath))}/`
          : 'No changed files to check',
      };
    }
    
    // Verify allowlist
    const result = verifyAllowlist(changedFiles, config);
    
    if (result.valid) {
      return {
        name: 'allowlist',
        status: 'pass',
        duration: Date.now() - start,
        message: `All ${changedFiles.length} changed files are within allowed boundaries`,
      };
    }
    
    // Build error details
    const details = result.violations.map(v => 
      `  - ${v.file} (${v.reason})`
    );
    
    return {
      name: 'allowlist',
      status: 'fail',
      duration: Date.now() - start,
      message: `${result.violations.length} file(s) are not allowed to be modified`,
      details,
    };
    
  } catch (error) {
    return {
      name: 'allowlist',
      status: 'fail',
      duration: Date.now() - start,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Format allowlist result for CLI output
 */
export function formatAllowlistResult(result: AllowlistResult): string {
  const lines: string[] = [];
  
  if (result.valid) {
    lines.push('✅ All changed files are within allowed boundaries');
  } else {
    lines.push('❌ The following files are not allowed to be modified in a normal PR:\n');
    
    for (const { file, reason } of result.violations) {
      lines.push(`  - ${file} (${reason})`);
    }
    
    lines.push('\n💡 If this is a generated artifact, run the pinned generator and pass drift/manifest checks.');
    lines.push('💡 If this should be editable, update guardrails.yaml (allowed/protected/generated).');
  }
  
  return lines.join('\n');
}

