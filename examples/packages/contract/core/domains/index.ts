/**
 * Domain API Interfaces
 * Auto-generated from OpenAPI specification
 * DO NOT EDIT MANUALLY
 */

import type { AdminDomainApi } from './AdminDomainApi.js';
import type { HealthDomainApi } from './HealthDomainApi.js';
import type { TenantDomainApi } from './TenantDomainApi.js';
import type { UserDomainApi } from './UserDomainApi.js';

export type { AdminDomainApi };
export type { HealthDomainApi };
export type { TenantDomainApi };
export type { UserDomainApi };

/**
 * Domain Registry for Dependency Injection
 * Use this interface for DI container type definitions
 */
export interface DomainRegistry {
  admin: AdminDomainApi;
  health: HealthDomainApi;
  tenant: TenantDomainApi;
  user: UserDomainApi;
}