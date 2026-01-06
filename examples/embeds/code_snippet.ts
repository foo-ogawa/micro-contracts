/**
 * code_snippet Embed
 * Extracts and displays code snippets from specified files
 * 
 * Usage: <!--@embedoc:code_snippet file="path/to/file.ts" start="10" end="20" lang="typescript"-->
 */

import { defineEmbed } from 'embedoc';
import fs from 'fs';
import path from 'path';

export default defineEmbed({
  async render(ctx) {
    const filePath = ctx.params['file'];
    const startLine = parseInt(ctx.params['start'] || '1', 10);
    const endLine = ctx.params['end'] ? parseInt(ctx.params['end'], 10) : undefined;
    const lang = ctx.params['lang'] || detectLanguage(filePath);

    if (!filePath) {
      return { content: '⚠️ `file` parameter is required' };
    }

    // Resolve file path relative to the markdown file's directory
    const resolvedPath = path.resolve(path.dirname(ctx.filePath), filePath);

    if (!fs.existsSync(resolvedPath)) {
      return { content: `⚠️ File not found: ${filePath}` };
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const lines = content.split('\n');
    
    // Extract specified line range
    const start = Math.max(1, startLine) - 1; // Convert to 0-based index
    const end = endLine ? Math.min(endLine, lines.length) : lines.length;
    const snippet = lines.slice(start, end).join('\n');

    // Generate markdown code block
    const codeBlock = ctx.markdown.codeBlock(snippet, lang);
    
    // Add source reference
    const sourceRef = `📄 Source: \`${filePath}\` (lines ${startLine}-${end})`;

    return { content: `${codeBlock}\n\n${sourceRef}` };
  },
});

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.json': 'json',
    '.md': 'markdown',
    '.sql': 'sql',
    '.sh': 'bash',
    '.bash': 'bash',
  };
  return langMap[ext] || '';
}

