/**
 * embedoc Embeds Entry Point
 * 
 * Available Embeds:
 * - api_list: Generate API list from OpenAPI spec
 * - overlay_cautions: Extract cautions from middleware.overlay.yaml
 * - code_snippet: Display code snippets from specified files
 */

import api_list from './api_list.ts';
import overlay_cautions from './overlay_cautions.ts';
import code_snippet from './code_snippet.ts';

// embedoc expects `embeds` export
export const embeds = {
  api_list,
  overlay_cautions,
  code_snippet,
};
