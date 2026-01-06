/**
 * Domain API Interfaces
 * Auto-generated from OpenAPI specification
 * DO NOT EDIT MANUALLY
 */

import type { BillingApi } from './BillingApi.js';

export type { BillingApi };

/**
 * Domain Registry for Dependency Injection
 * Use this interface for DI container type definitions
 */
export interface DomainRegistry {
  billing: BillingApi;
}