/**
 * ESLint rule: no-contract-type-redefinition
 * 
 * Prevents re-defining types that are already defined in packages/contract.
 * These types should be imported from the contract package instead.
 */

import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';
import * as fs from 'fs';
import * as path from 'path';

type Options = [{
  contractDir?: string;
  ignoredTypes?: string[];
}];

type MessageIds = 'noRedefinition';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/micro-contracts/eslint-plugin#${name}`
);

// Cache for contract types (per project)
const contractTypesCache = new Map<string, Set<string>>();

/**
 * Extract type names from TypeScript content
 */
function extractTypeNames(content: string): string[] {
  const types: string[] = [];
  const patterns = [
    /^export\s+interface\s+(\w+)/gm,
    /^export\s+type\s+(\w+)\s*[=<]/gm,
    /^interface\s+(\w+)/gm,
    /^type\s+(\w+)\s*[=<]/gm,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      types.push(match[1]);
    }
  }
  
  return types;
}

/**
 * Find all TypeScript files in a directory
 */
function findTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      files.push(...findTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Load contract types from packages/contract directory
 */
function loadContractTypes(projectRoot: string, contractDir: string): Set<string> {
  const cacheKey = path.join(projectRoot, contractDir);
  
  if (contractTypesCache.has(cacheKey)) {
    return contractTypesCache.get(cacheKey)!;
  }
  
  const types = new Set<string>();
  const contractPath = path.join(projectRoot, contractDir);
  
  if (!fs.existsSync(contractPath)) {
    contractTypesCache.set(cacheKey, types);
    return types;
  }
  
  const files = findTsFiles(contractPath);
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const fileTypes = extractTypeNames(content);
      for (const t of fileTypes) {
        types.add(t);
      }
    } catch {
      // Ignore read errors
    }
  }
  
  contractTypesCache.set(cacheKey, types);
  return types;
}

/**
 * Find project root by looking for micro-contracts.config.yaml
 * Prioritizes micro-contracts config over package.json
 */
function findProjectRoot(startDir: string): string | null {
  let dir = startDir;
  let packageJsonDir: string | null = null;
  
  while (dir !== path.dirname(dir)) {
    // Prioritize micro-contracts config
    if (
      fs.existsSync(path.join(dir, 'micro-contracts.config.yaml')) ||
      fs.existsSync(path.join(dir, 'micro-contracts.config.yml'))
    ) {
      return dir;
    }
    
    // Remember first package.json location as fallback
    if (!packageJsonDir && fs.existsSync(path.join(dir, 'package.json'))) {
      // Check if this package.json has workspaces or is root
      try {
        const pkgJson = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
        if (pkgJson.workspaces || pkgJson.name?.startsWith('@')) {
          // This looks like a monorepo root or scoped package
        } else {
          packageJsonDir = dir;
        }
      } catch {
        packageJsonDir = dir;
      }
    }
    
    dir = path.dirname(dir);
  }
  
  return packageJsonDir;
}

export const noContractTypeRedefinition = createRule<Options, MessageIds>({
  name: 'no-contract-type-redefinition',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow re-defining types that exist in packages/contract',
    },
    messages: {
      noRedefinition:
        'Type "{{typeName}}" is defined in {{contractDir}}. Import it instead of re-defining.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          contractDir: {
            type: 'string',
            description: 'Path to contract directory (default: packages/contract)',
          },
          ignoredTypes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Type names to ignore',
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ contractDir: 'packages/contract', ignoredTypes: [] }],
  
  create(context, [options]) {
    const contractDir = options.contractDir || 'packages/contract';
    const ignoredTypes = new Set(options.ignoredTypes || []);
    
    const filename = context.filename || context.getFilename();
    
    // Skip files in contract directory itself
    if (filename.includes(contractDir)) {
      return {};
    }
    
    // Skip .generated.ts files (these are trusted)
    if (filename.endsWith('.generated.ts')) {
      return {};
    }
    
    const projectRoot = findProjectRoot(path.dirname(filename));
    if (!projectRoot) {
      return {};
    }
    
    const contractTypes = loadContractTypes(projectRoot, contractDir);
    
    function checkTypeDefinition(
      node: TSESTree.TSInterfaceDeclaration | TSESTree.TSTypeAliasDeclaration,
      typeName: string
    ) {
      if (ignoredTypes.has(typeName)) {
        return;
      }
      
      if (contractTypes.has(typeName)) {
        context.report({
          node,
          messageId: 'noRedefinition',
          data: {
            typeName,
            contractDir,
          },
        });
      }
    }
    
    return {
      TSInterfaceDeclaration(node) {
        checkTypeDefinition(node, node.id.name);
      },
      TSTypeAliasDeclaration(node) {
        checkTypeDefinition(node, node.id.name);
      },
    };
  },
});

export default noContractTypeRedefinition;

