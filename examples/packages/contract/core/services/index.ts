/**
 * Service API Interfaces
 * Auto-generated from OpenAPI specification
 * DO NOT EDIT MANUALLY
 */

import type { AdminServiceApi } from './AdminServiceApi.js';
import type { HealthServiceApi } from './HealthServiceApi.js';
import type { TenantServiceApi } from './TenantServiceApi.js';
import type { UserServiceApi } from './UserServiceApi.js';

export type { AdminServiceApi };
export type { HealthServiceApi };
export type { TenantServiceApi };
export type { UserServiceApi };

/**
 * Service Registry for Dependency Injection
 * Use this interface for DI container type definitions
 */
export interface ServiceRegistry {
  admin: AdminServiceApi;
  health: HealthServiceApi;
  tenant: TenantServiceApi;
  user: UserServiceApi;
}