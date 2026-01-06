import tsParser from '@typescript-eslint/parser';
import microContracts from 'eslint-plugin-micro-contracts';

export default [
  // Global ignores (only truly non-lintable files)
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
    ],
  },
  // TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      'micro-contracts': microContracts,
    },
    rules: {
      // Prevent re-defining types from packages/contract
      'micro-contracts/no-contract-type-redefinition': 'error',
      
      // Prevent direct imports from contract-published (use deps/ instead)
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@project/contract-published/*'],
          message: 'Import from deps/ instead: @project/contract/{module}/deps/{source}',
        }],
      }],
    },
  },
  // Exceptions: Files allowed to import from contract-published directly
  {
    files: [
      '**/packages/contract/*/deps/*.ts',   // Generated re-exports (deps/ imports from contract-published)
      '**/*.test.ts',                        // Test files
      '**/*.spec.ts',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
