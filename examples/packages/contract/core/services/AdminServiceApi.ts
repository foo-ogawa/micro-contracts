/**
 * Admin Service API Interface
 * Auto-generated from OpenAPI specification
 * DO NOT EDIT MANUALLY
 */

import type {
  Admin_getStatsInput,
  Admin_suspendUserInput,
  SystemStats,
  User,
} from '../schemas/types.js';

export interface AdminServiceApi {
  /**
   * GET /api/admin/stats
   * @internal Not included in public contract
   */
  getStats(input: Admin_getStatsInput): Promise<SystemStats>;

  /**
   * POST /api/admin/users/{id}/suspend
   * @internal Not included in public contract
   */
  suspendUser(input: Admin_suspendUserInput): Promise<User>;

}