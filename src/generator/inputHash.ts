/**
 * Input hash computation for generation skip logic.
 *
 * Computes a deterministic SHA-256 hash over all files that affect
 * generation output (config, OpenAPI specs, templates, overlays)
 * plus the package version.  When the hash matches the value stored
 * in the manifest, generation can safely be skipped.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { MultiModuleConfig } from '../types.js';
import { resolveModuleConfig } from '../types.js';
import { resolveTemplatePath } from './templateProcessor.js';

/**
 * Collect every input file path that can affect generation output.
 *
 * Returns absolute paths, sorted and deduplicated.
 */
export function collectInputFiles(
  config: MultiModuleConfig,
  configPath: string,
): string[] {
  const files = new Set<string>();

  files.add(path.resolve(configPath));

  for (const [moduleName, moduleConfig] of Object.entries(config.modules)) {
    const resolved = resolveModuleConfig(moduleName, moduleConfig, config.defaults);

    // OpenAPI spec
    const openapiPath = path.resolve(resolved.openapi);
    if (fs.existsSync(openapiPath)) {
      files.add(openapiPath);
    }

    // Overlays (shared + module-specific, already merged by resolveModuleConfig)
    for (const overlay of resolved.overlays) {
      const overlayPath = path.resolve(overlay);
      if (fs.existsSync(overlayPath)) {
        files.add(overlayPath);
      }
    }

    // Templates from outputs (new system)
    for (const output of resolved.outputs) {
      if (!output.enabled) continue;

      const specDir = path.dirname(resolved.openapi)
        .replace(/\/openapi$/, '')
        .replace(`/${moduleName}`, '');
      const templatePath = resolveTemplatePath({
        specDir,
        moduleName,
        templateName: path.basename(output.template),
      }) || output.template;

      const absTemplate = path.resolve(templatePath);
      if (fs.existsSync(absTemplate)) {
        files.add(absTemplate);
      }
    }

    // Legacy server/frontend templates
    if (resolved.server?.template) {
      const t = path.resolve(resolved.server.template);
      if (fs.existsSync(t)) files.add(t);
    }
    if (resolved.frontend?.template) {
      const t = path.resolve(resolved.frontend.template);
      if (fs.existsSync(t)) files.add(t);
    }
  }

  return [...files].sort();
}

/**
 * Compute a deterministic SHA-256 hash from input files + package version.
 *
 * The hash is stable across machines because file paths are expressed
 * relative to the config file's directory.
 */
export function computeInputHash(
  config: MultiModuleConfig,
  configPath: string,
  packageVersion: string,
): string {
  const inputFiles = collectInputFiles(config, configPath);
  const configDir = path.dirname(path.resolve(configPath));
  const hash = crypto.createHash('sha256');

  for (const filePath of inputFiles) {
    const relativePath = path.relative(configDir, filePath);
    hash.update(relativePath + '\0');
    hash.update(fs.readFileSync(filePath));
    hash.update('\0');
  }

  hash.update('version:' + packageVersion);

  return hash.digest('hex');
}
