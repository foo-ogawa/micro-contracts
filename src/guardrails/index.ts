/**
 * Guardrails module
 * 
 * Provides AI-driven development guardrails for protecting generated artifacts
 * and enforcing change policies.
 */

// Types
export type {
  GuardrailsConfig,
  ChecksConfig,
  CheckCommandConfig,
  AllowlistResult,
  AllowlistViolation,
  DriftResult,
  GeneratedManifest,
  GeneratedFileInfo,
  ManifestResult,
  ManifestMismatch,
  CheckOptions,
  CheckResult,
  CheckSummary,
  CheckDefinition,
  GateNumber,
} from './types.js';

// Config
export {
  DEFAULT_GUARDRAILS,
  findGuardrailsConfig,
  loadGuardrailsConfig,
  loadGuardrailsConfigWithPath,
  generateGuardrailsTemplate,
  createGuardrailsConfig,
} from './config.js';

export type { LoadedGuardrailsConfig } from './config.js';

// Allowlist
export {
  matchWithNegation,
  matchGlob,
  getChangedFiles,
  verifyAllowlist,
  runAllowlistCheck,
  formatAllowlistResult,
} from './allowlist.js';

// Drift
export {
  checkDrift,
  checkUncommittedChanges,
  runDriftCheck,
  formatDriftResult,
} from './drift.js';

// Manifest
export {
  hashFile,
  getGeneratedFiles,
  generateManifest,
  writeManifest,
  loadManifest,
  verifyManifest,
  runManifestCheck,
  formatManifestResult,
} from './manifest.js';

export type { GenerateManifestResult } from './manifest.js';

// Lint
export {
  findOpenAPISpecs,
  runLintCheck,
} from './lint.js';

// Typecheck
export {
  findTsConfigs,
  runTypecheckCheck,
} from './typecheck.js';

// Docs
export {
  checkMarkdownFile,
  findMarkdownFiles,
  runDocsCheck,
} from './docs.js';

// Security
export {
  getImplementedOverlays,
  checkSecurityConsistency,
  findOverlayDirs,
  runSecurityCheck,
} from './security.js';

// Check runner
export {
  runAllChecks,
  formatCheckResults,
  getAvailableChecks,
  GATE_DESCRIPTIONS,
} from './runner.js';

export type { CheckSummaryWithGates } from './runner.js';

