/**
 * Service API Interfaces
 * Auto-generated from OpenAPI specification
 * DO NOT EDIT MANUALLY
 */

import type { BillingServiceApi } from './BillingServiceApi.js';

export type { BillingServiceApi };

/**
 * Service Registry for Dependency Injection
 * Use this interface for DI container type definitions
 */
export interface ServiceRegistry {
  billing: BillingServiceApi;
}