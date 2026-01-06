/**
 * Cross-module Overlay Interfaces
 * Auto-generated from shared overlay specifications
 * DO NOT EDIT MANUALLY
 * 
 * These interfaces are HTTP-agnostic. Overlay handlers receive
 * extracted parameters and return success/failure with optional context.
 * 
 * Use these for cross-module overlays (auth, rate limiting, etc.)
 */

// =============================================================================
// Common Types
// =============================================================================

/**
 * Result returned by overlay handlers
 * - success: true → continue to next handler/domain
 * - success: false → return error response
 */
export interface OverlayResult<TContext = unknown> {
  success: boolean;
  error?: {
    status: number;
    message: string;
    code?: string;
  };
  /** Context passed to subsequent handlers and domain */
  context?: TContext;
}

// =============================================================================
// Shared Middleware Overlays
// =============================================================================

export type SharedMiddlewareValue = 'requireAuth' | 'requireAdmin' | 'tenantIsolation' | 'rateLimit';

/**
 * Input for requireAuth overlay
 * Parameters extracted from HTTP request by the routes layer
 */
export interface RequireAuthOverlayInput {
  /** Bearer token for authentication */
  'Authorization'?: string;
}

/**
 * Handler for requireAuth overlay
 * May return errors: 401
 */
export type RequireAuthOverlay = (input: RequireAuthOverlayInput) => Promise<OverlayResult>;

/**
 * Input for requireAdmin overlay
 * Parameters extracted from HTTP request by the routes layer
 */
export interface RequireAdminOverlayInput {
  // No parameters required
}

/**
 * Handler for requireAdmin overlay
 * May return errors: 401, 403
 */
export type RequireAdminOverlay = (input: RequireAdminOverlayInput) => Promise<OverlayResult>;

/**
 * Input for tenantIsolation overlay
 * Parameters extracted from HTTP request by the routes layer
 */
export interface TenantIsolationOverlayInput {
  /** Tenant identifier for multi-tenant isolation */
  'X-Tenant-Id': string;
}

/**
 * Handler for tenantIsolation overlay
 * May return errors: 400
 */
export type TenantIsolationOverlay = (input: TenantIsolationOverlayInput) => Promise<OverlayResult>;

/**
 * Input for rateLimit overlay
 * Parameters extracted from HTTP request by the routes layer
 */
export interface RateLimitOverlayInput {
  /** Rate limit ceiling for this endpoint (response header) */
  'X-RateLimit-Limit'?: number;
  /** Remaining requests in current window (response header) */
  'X-RateLimit-Remaining'?: number;
}

/**
 * Handler for rateLimit overlay
 * May return errors: 429
 */
export type RateLimitOverlay = (input: RateLimitOverlayInput) => Promise<OverlayResult>;

/**
 * Registry interface for shared x-middleware overlay handlers
 */
export interface SharedOverlayRegistry {
  requireAuth: RequireAuthOverlay;
  requireAdmin: RequireAdminOverlay;
  tenantIsolation: TenantIsolationOverlay;
  rateLimit: RateLimitOverlay;
}

