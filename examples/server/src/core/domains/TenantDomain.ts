/**
 * TenantDomain implementation
 * Business logic separated from framework concerns
 */

import type { TenantDomainApi } from '@project/contract/core/domains/TenantDomainApi.js';
import type * as types from '@project/contract/core/schemas/types.js';

export class TenantDomain implements TenantDomainApi {
  async getData(): Promise<types.TenantData> {
    return {
      id: '1',
      tenantId: 'tenant-123',
      data: { name: 'Example Tenant', plan: 'premium' },
      createdAt: new Date().toISOString(),
    };
  }

  async createData(input: types.TenantDomain_createDataInput): Promise<types.TenantData> {
    // Request body is in 'data' property
    const { data } = input;
    return {
      id: '1',
      tenantId: 'tenant-123',
      data: data.data,
      createdAt: new Date().toISOString(),
    };
  }
}
