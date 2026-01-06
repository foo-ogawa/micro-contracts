/**
 * Domain API Interfaces
 * Auto-generated from OpenAPI specification
 * DO NOT EDIT MANUALLY
 */

import type { HealthDomainApi } from './HealthDomainApi.js';
import type { UserDomainApi } from './UserDomainApi.js';

export type { HealthDomainApi };
export type { UserDomainApi };

/**
 * Domain Registry for Dependency Injection
 * Use this interface for DI container type definitions
 */
export interface DomainRegistry {
  health: HealthDomainApi;
  user: UserDomainApi;
}