/**
 * eslint-plugin-micro-contracts
 * 
 * ESLint rules for micro-contracts projects.
 */

import { noContractTypeRedefinition } from './rules/no-contract-type-redefinition.js';

export const rules = {
  'no-contract-type-redefinition': noContractTypeRedefinition,
};

export const configs = {
  recommended: {
    plugins: ['micro-contracts'],
    rules: {
      'micro-contracts/no-contract-type-redefinition': 'error',
    },
  },
};

