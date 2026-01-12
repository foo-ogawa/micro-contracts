/**
 * TenantService implementation
 * Business logic separated from framework concerns
 */

import type { TenantServiceApi } from '@project/contract/core/services/TenantServiceApi.js';
import type * as types from '@project/contract/core/schemas/types.js';

export class TenantService implements TenantServiceApi {
  async getData(): Promise<types.TenantData> {
    return {
      id: '1',
      tenantId: 'tenant-123',
      data: { name: 'Example Tenant', plan: 'premium' },
      createdAt: new Date().toISOString(),
    };
  }

  async createData(input: types.Tenant_createDataInput): Promise<types.TenantData> {
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
