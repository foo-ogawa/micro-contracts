/**
 * HealthDomain implementation
 * Business logic separated from framework concerns
 */

import type { HealthDomainApi } from '@project/contract/core/domains/HealthDomainApi.js';
import type * as types from '@project/contract/core/schemas/types.js';

export class HealthDomain implements HealthDomainApi {
  async check(): Promise<types.HealthStatus> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}

