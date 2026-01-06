/**
 * Guardrails type definitions
 * 
 * These types define the structure for AI-driven development guardrails
 * that protect generated artifacts and enforce change policies.
 */

/**
 * Guardrails configuration file structure (guardrails.yaml)
 */
export interface GuardrailsConfig {
  /**
   * Paths that can be edited in normal development PRs
   * Supports glob patterns and negation (prefix with !)
   */
  allowed?: string[];

  /**
   * Paths that require special approval (e.g., security config, CI)
   * Supports glob patterns and negation (prefix with !)
   */
  protected?: string[];

  /**
   * Paths for generated artifacts (committed but only modified via generate)
   * Supports glob patterns and negation (prefix with !)
   */
  generated?: string[];

  /**
   * Check command configurations
   * Define custom commands for each guardrail check
   */
  checks?: ChecksConfig;
}

/**
 * Configuration for guardrail check commands
 */
export interface ChecksConfig {
  /** Lint check configuration */
  lint?: CheckCommandConfig;
  /** TypeScript type check configuration */
  typecheck?: CheckCommandConfig;
  /** Documentation check configuration */
  docs?: CheckCommandConfig;
  /** Additional custom checks */
  [key: string]: CheckCommandConfig | undefined;
}

/**
 * Configuration for a single check command
 */
export interface CheckCommandConfig {
  /**
   * Command template to run.
   * Supports placeholders:
   * - {files} - space-separated list of target files (auto-detected)
   * - {cwd} - current working directory
   * 
   * @example
   * command: "npx @stoplight/spectral-cli lint {files} --ruleset spec/spectral.yaml"
   */
  command: string;

  /**
   * Whether this check is enabled (default: true)
   */
  enabled?: boolean;
}

/**
 * Result of allowlist verification
 */
export interface AllowlistResult {
  valid: boolean;
  violations: AllowlistViolation[];
}

/**
 * A single allowlist violation
 */
export interface AllowlistViolation {
  file: string;
  reason: 'protected' | 'not-in-allowlist';
}

/**
 * Result of drift check
 */
export interface DriftResult {
  valid: boolean;
  changedFiles: string[];
  error?: string;
}

/**
 * Generated artifact manifest structure
 */
export interface GeneratedManifest {
  /** Manifest format version */
  version: string;
  /** Timestamp when manifest was generated */
  generatedAt: string;
  /** Version of micro-contracts that generated this */
  generatorVersion: string;
  /** Map of relative file paths to their metadata */
  files: Record<string, GeneratedFileInfo>;
}

/**
 * Metadata for a single generated file
 */
export interface GeneratedFileInfo {
  /** SHA-256 hash of file content */
  sha256: string;
  /** Source file that generated this (e.g., OpenAPI spec path) */
  source?: string;
}

/**
 * Result of manifest verification
 */
export interface ManifestResult {
  valid: boolean;
  mismatches: ManifestMismatch[];
  manifestPath?: string;
}

/**
 * A single manifest mismatch
 */
export interface ManifestMismatch {
  file: string;
  reason: 'missing' | 'hash-mismatch' | 'extra';
  expected?: string;
  actual?: string;
}

/**
 * Options for check command
 */
export interface CheckOptions {
  /** Run specific checks only */
  only?: string[];
  /** Skip specific checks */
  skip?: string[];
  /** Enable verbose output */
  verbose?: boolean;
  /** Enable auto-fix where possible */
  fix?: boolean;
  /** Path to guardrails.yaml */
  guardrailsPath?: string;
  /** Path to generated files directory */
  generatedDir?: string;
  /** File containing list of changed files (for CI) */
  changedFilesPath?: string;
}

/**
 * Result of a single check
 */
export interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  message?: string;
  details?: string[];
}

/**
 * Overall check summary
 */
export interface CheckSummary {
  passed: number;
  failed: number;
  skipped: number;
  results: CheckResult[];
}

/**
 * Check definition
 */
export interface CheckDefinition {
  name: string;
  description: string;
  run: (options: CheckOptions) => Promise<CheckResult>;
}

