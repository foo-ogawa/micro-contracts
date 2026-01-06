/**
 * Documentation consistency check for guardrails
 * 
 * Verifies that documentation references (links, file paths, images) are valid.
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import type { CheckResult, CheckOptions } from './types.js';

export interface DocIssue {
  file: string;
  line: number;
  issue: string;
}

/**
 * Check if a path exists relative to a document file
 */
function existsRelativeToDoc(docFile: string, refPath: string): boolean {
  // Skip empty, anchor-only, or URL
  if (!refPath || refPath.startsWith('#') || refPath.includes('://')) {
    return true;
  }
  
  // Root-relative (starts with /) → resolve from cwd (repo root)
  // Relative (including ./) → resolve from doc's directory
  const resolved = refPath.startsWith('/')
    ? path.resolve(process.cwd(), refPath.slice(1))
    : path.resolve(path.dirname(docFile), refPath);
  
  return fs.existsSync(resolved);
}

/**
 * Check a single markdown file for broken references
 */
export function checkMarkdownFile(docFile: string): DocIssue[] {
  const issues: DocIssue[] = [];
  
  if (!fs.existsSync(docFile)) {
    return issues;
  }
  
  const lines = fs.readFileSync(docFile, 'utf-8').split('\n');
  
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    
    // 1. Check file path references like [examples/...] or `examples/...`
    const pathRefs = line.matchAll(/(?:\[|`)([a-zA-Z0-9_\-./]+\/[a-zA-Z0-9_\-./]+\.[a-zA-Z]+)(?:\]|`)/g);
    for (const match of pathRefs) {
      const refPath = match[1];
      if (!existsRelativeToDoc(docFile, refPath)) {
        issues.push({
          file: docFile,
          line: lineNum,
          issue: `Referenced file does not exist: ${refPath}`,
        });
      }
    }
    
    // 2. Check markdown link targets like ](path#anchor)
    const linkRefs = line.matchAll(/\]\((?!http)([^)]+)\)/g);
    for (const match of linkRefs) {
      const raw = match[1];
      const linkPath = raw.split('#')[0]; // Remove anchor
      if (linkPath && !existsRelativeToDoc(docFile, linkPath)) {
        issues.push({
          file: docFile,
          line: lineNum,
          issue: `Broken link: ${linkPath}`,
        });
      }
    }
    
    // 3. Check image references like ![alt](./image.png)
    const imgRefs = line.matchAll(/!\[[^\]]*\]\((?!http)([^)]+)\)/g);
    for (const match of imgRefs) {
      const imgPath = match[1].split('#')[0];
      if (imgPath && !existsRelativeToDoc(docFile, imgPath)) {
        issues.push({
          file: docFile,
          line: lineNum,
          issue: `Image not found: ${imgPath}`,
        });
      }
    }
  });
  
  return issues;
}

/**
 * Find all markdown files to check
 */
export async function findMarkdownFiles(): Promise<string[]> {
  const files: string[] = [];
  
  // Check README.md at root
  if (fs.existsSync('README.md')) {
    files.push('README.md');
  }
  
  // Check docs directory
  const docsFiles = await glob('docs/**/*.md', {
    ignore: ['**/node_modules/**'],
  });
  files.push(...docsFiles);
  
  return files;
}

/**
 * Run docs consistency check
 */
export async function runDocsCheck(options: CheckOptions): Promise<CheckResult> {
  const start = Date.now();
  
  try {
    // Find all markdown files
    const docFiles = await findMarkdownFiles();
    
    if (docFiles.length === 0) {
      return {
        name: 'docs',
        status: 'skip',
        duration: Date.now() - start,
        message: 'No documentation files found',
      };
    }
    
    const allIssues: DocIssue[] = [];
    
    for (const docFile of docFiles) {
      const issues = checkMarkdownFile(docFile);
      allIssues.push(...issues);
    }
    
    if (allIssues.length > 0) {
      const details = allIssues.map(i => `  ${i.file}:${i.line}: ${i.issue}`);
      
      return {
        name: 'docs',
        status: 'fail',
        duration: Date.now() - start,
        message: `${allIssues.length} broken reference(s) in ${docFiles.length} file(s)`,
        details,
      };
    }
    
    return {
      name: 'docs',
      status: 'pass',
      duration: Date.now() - start,
      message: `${docFiles.length} documentation file(s) verified`,
    };
    
  } catch (error) {
    return {
      name: 'docs',
      status: 'fail',
      duration: Date.now() - start,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

