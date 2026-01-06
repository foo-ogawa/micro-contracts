/**
 * requireAdmin middleware implementation
 * Framework-agnostic admin role check
 */

import type { 
  RequireAdminOverlayInput, 
  OverlayResult 
} from '@project/contract/core/overlays/index.js';

/**
 * Requires admin role (should be called after requireAuth)
 * Note: In real app, this would check context set by previous overlay (requireAuth)
 * For now, we always return success since admin check happens in context
 */
export async function requireAdmin(_input: RequireAdminOverlayInput): Promise<OverlayResult> {
  // In real app: check role from auth context set by requireAuth
  // The admin check would typically look at the context from previous overlay
  // For demo purposes, we return success - actual role check happens elsewhere
  return {
    success: true,
  };
}
