/**
 * tenantIsolation middleware implementation
 * Framework-agnostic tenant validation
 */

import type { 
  TenantIsolationOverlayInput, 
  OverlayResult 
} from '@project/contract/core/overlays/index.js';

/**
 * Validates X-Tenant-Id header is present
 */
export async function tenantIsolation(input: TenantIsolationOverlayInput): Promise<OverlayResult> {
  const tenantId = input['X-Tenant-Id'];
  
  if (!tenantId) {
    return {
      success: false,
      error: {
        status: 400,
        message: 'X-Tenant-Id header is required',
        code: 'missing_tenant_id',
      },
    };
  }

  return {
    success: true,
    context: {
      tenantId,
    },
  };
}
