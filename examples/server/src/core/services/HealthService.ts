/**
 * HealthService implementation
 * Business logic separated from framework concerns
 */

import type { HealthServiceApi } from '@project/contract/core/services/HealthServiceApi.js';
import type * as types from '@project/contract/core/schemas/types.js';

export class HealthService implements HealthServiceApi {
  async check(): Promise<types.HealthStatus> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}
