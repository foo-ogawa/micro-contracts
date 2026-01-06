/**
 * code_snippet Embed
 * Extracts and displays code snippets from specified files
 * 
 * Usage: <!--@embedoc:code_snippet file="../examples/path/to/file.ts" start="10" end="20" lang="typescript"-->
 * 
 * Parameters:
 *   - file: File path (relative to the markdown file)
 *   - start: Start line number (default: 1)
 *   - end: End line number (default: end of file)
 *   - lang: Language (default: auto-detected from extension)
 *   - title: Title (default: none)
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
    const title = ctx.params['title'];

    if (!filePath) {
      return { content: '⚠️ `file` parameter is required' };
    }

    // ctx.filePath is the markdown file being processed (e.g., "docs/development-guardrails.md")
    const targetFile = (ctx as any).filePath || '';
    const targetDir = path.dirname(targetFile);
    
    // Resolve file path relative to the markdown file's directory
    const resolvedPath = path.resolve(process.cwd(), targetDir, filePath);

    if (!fs.existsSync(resolvedPath)) {
      return { content: `⚠️ File not found: ${filePath} (resolved: ${resolvedPath})` };
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const lines = content.split('\n');
    
    // Extract specified line range
    const start = Math.max(1, startLine) - 1; // Convert to 0-based index
    const end = endLine ? Math.min(endLine, lines.length) : lines.length;
    const snippet = lines.slice(start, end).join('\n');

    // Generate markdown code block
    const codeBlock = ctx.markdown.codeBlock(snippet, lang);
    
    // Build output with optional title
    const parts: string[] = [];
    
    if (title) {
      parts.push(`**${title}**\n`);
    }
    
    parts.push(codeBlock);
    
    // Add source reference (use the same relative path as specified)
    const lineRange = endLine ? `${startLine}-${end}` : (startLine > 1 ? `${startLine}-${lines.length}` : 'full');
    parts.push(`\n📄 Source: [\`${path.basename(filePath)}\`](${filePath}) (lines ${lineRange})`);

    return { content: parts.join('\n') };
  },
});

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.json': 'json',
    '.md': 'markdown',
    '.sql': 'sql',
    '.sh': 'bash',
    '.bash': 'bash',
    '.hbs': 'handlebars',
  };
  return langMap[ext] || '';
}

