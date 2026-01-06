/**
 * embedoc Embeds Entry Point
 * 
 * Available Embeds:
 * - code_snippet: Display code snippets from specified files
 */

import code_snippet from './code_snippet.ts';

// embedoc expects `embeds` export
export const embeds = {
  code_snippet,
};

