/**
 * AdminDomain implementation
 * Business logic separated from framework concerns
 */

import type { AdminDomainApi } from '@project/contract/core/domains/AdminDomainApi.js';
import type * as types from '@project/contract/core/schemas/types.js';

export class AdminDomain implements AdminDomainApi {
  async getStats(): Promise<types.SystemStats> {
    return {
      userCount: 100,
      activeUsers: 75,
      tenantCount: 5,
      uptime: 86400,
    };
  }

  async suspendUser(input: types.AdminDomain_suspendUserInput): Promise<types.User> {
    // Input is flattened - id is direct, body is in 'data'
    const { id, data } = input;
    return {
      id,
      name: 'Suspended User',
      email: 'suspended@example.com',
      role: 'user',
      status: 'suspended',
      createdAt: '2024-01-01T00:00:00Z',
    };
  }
}
