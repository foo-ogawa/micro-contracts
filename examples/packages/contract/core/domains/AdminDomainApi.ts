/**
 * AdminDomain Domain API Interface
 * Auto-generated from OpenAPI specification
 * DO NOT EDIT MANUALLY
 */

import type {
  AdminDomain_getStatsInput,
  AdminDomain_suspendUserInput,
  SystemStats,
  User,
} from '../schemas/types.js';

export interface AdminDomainApi {
  /**
   * GET /api/admin/stats
   * @internal Not included in public contract
   */
  getStats(input: AdminDomain_getStatsInput): Promise<SystemStats>;

  /**
   * POST /api/admin/users/{id}/suspend
   * @internal Not included in public contract
   */
  suspendUser(input: AdminDomain_suspendUserInput): Promise<User>;

}