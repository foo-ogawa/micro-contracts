/**
 * Service API Interfaces
 * Auto-generated from OpenAPI specification
 * DO NOT EDIT MANUALLY
 */

import type { HealthServiceApi } from './HealthServiceApi.js';
import type { UserServiceApi } from './UserServiceApi.js';

export type { HealthServiceApi };
export type { UserServiceApi };

/**
 * Service Registry for Dependency Injection
 * Use this interface for DI container type definitions
 */
export interface ServiceRegistry {
  health: HealthServiceApi;
  user: UserServiceApi;
}