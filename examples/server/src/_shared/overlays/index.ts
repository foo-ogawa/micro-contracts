/**
 * Cross-module Overlay Implementations
 * Re-exports shared overlay handlers for cross-module use
 * 
 * These implementations are HTTP-agnostic and can be used by any module.
 */

// Re-export shared overlay implementations from core
// In a larger project, these would be implemented here directly
export {
  requireAuth,
  requireAdmin,
  tenantIsolation,
  rateLimit,
} from '../../core/overlays/index.js';

