/**
 * HealthDomain Domain API Interface
 * Auto-generated from OpenAPI specification
 * DO NOT EDIT MANUALLY
 */

import type {
  HealthDomain_checkInput,
  HealthStatus,
} from '../schemas/types.js';

export interface HealthDomainApi {
  /**
   * GET /api/health
   */
  check(input: HealthDomain_checkInput): Promise<HealthStatus>;

}