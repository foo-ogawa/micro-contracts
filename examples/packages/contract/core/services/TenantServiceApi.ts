/**
 * Tenant Service API Interface
 * Auto-generated from OpenAPI specification
 * DO NOT EDIT MANUALLY
 */

import type {
  TenantData,
  Tenant_createDataInput,
  Tenant_getDataInput,
} from '../schemas/types.js';

export interface TenantServiceApi {
  /**
   * GET /api/tenant/data
   * @internal Not included in public contract
   */
  getData(input: Tenant_getDataInput): Promise<TenantData>;

  /**
   * POST /api/tenant/data
   * @internal Not included in public contract
   */
  createData(input: Tenant_createDataInput): Promise<TenantData>;

}