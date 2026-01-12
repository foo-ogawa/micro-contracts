/**
 * Health Service API Interface
 * Auto-generated from OpenAPI specification
 * DO NOT EDIT MANUALLY
 */

import type {
  HealthStatus,
  Health_checkInput,
} from '../schemas/types.js';

export interface HealthServiceApi {
  /**
   * GET /api/health
   */
  check(input: Health_checkInput): Promise<HealthStatus>;

}