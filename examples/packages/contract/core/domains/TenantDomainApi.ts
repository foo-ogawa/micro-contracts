/**
 * TenantDomain Domain API Interface
 * Auto-generated from OpenAPI specification
 * DO NOT EDIT MANUALLY
 */

import type {
  TenantData,
  TenantDomain_createDataInput,
  TenantDomain_getDataInput,
} from '../schemas/types.js';

export interface TenantDomainApi {
  /**
   * GET /api/tenant/data
   * @internal Not included in public contract
   */
  getData(input: TenantDomain_getDataInput): Promise<TenantData>;

  /**
   * POST /api/tenant/data
   * @internal Not included in public contract
   */
  createData(input: TenantDomain_createDataInput): Promise<TenantData>;

}