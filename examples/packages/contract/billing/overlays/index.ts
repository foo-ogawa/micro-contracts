/**
 * Overlay Interfaces
 * Auto-generated from overlay specifications
 * DO NOT EDIT MANUALLY
 * 
 * These interfaces are HTTP-agnostic. Overlay handlers receive
 * extracted parameters and return success/failure with optional context.
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
// Middleware Overlays
// =============================================================================

export type MiddlewareValue = 'requireAuth' | 'tenantIsolation';

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
 * Registry interface for x-middleware overlay handlers
 */
export interface MiddlewareRegistry {
  requireAuth: RequireAuthOverlay;
  tenantIsolation: TenantIsolationOverlay;
}

// =============================================================================
// PaymentValidation Overlays
// =============================================================================

export type PaymentValidationValue = 'validatePaymentMethod';

/**
 * Input for validatePaymentMethod overlay
 * Parameters extracted from HTTP request by the routes layer
 */
export interface ValidatePaymentMethodOverlayInput {
  /** Payment method token for validation */
  'X-Payment-Token': string;
}

/**
 * Handler for validatePaymentMethod overlay
 * May return errors: 402
 */
export type ValidatePaymentMethodOverlay = (input: ValidatePaymentMethodOverlayInput) => Promise<OverlayResult>;

/**
 * Registry interface for x-payment-validation overlay handlers
 */
export interface PaymentValidationRegistry {
  validatePaymentMethod: ValidatePaymentMethodOverlay;
}

// =============================================================================
// Unified Overlay Registry
// =============================================================================

/**
 * Combined registry interface for all overlay handlers
 * Use this when a single handler registry is needed
 */
export interface OverlayRegistry {
  requireAuth: RequireAuthOverlay;
  tenantIsolation: TenantIsolationOverlay;
  validatePaymentMethod: ValidatePaymentMethodOverlay;
}

// =============================================================================
// Overlay Info (for templates)
// =============================================================================

export interface OverlayInfoMap {
  'x-middleware:requireAuth': {
    name: 'requireAuth';
    marker: 'x-middleware';
    injectedParameters: ["Authorization"];
    injectedResponses: ["401"];
  };
  'x-middleware:tenantIsolation': {
    name: 'tenantIsolation';
    marker: 'x-middleware';
    injectedParameters: ["X-Tenant-Id"];
    injectedResponses: ["400"];
  };
  'x-payment-validation:validatePaymentMethod': {
    name: 'validatePaymentMethod';
    marker: 'x-payment-validation';
    injectedParameters: ["X-Payment-Token"];
    injectedResponses: ["402"];
  };
}
