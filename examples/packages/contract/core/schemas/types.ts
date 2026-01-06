/**
 * Auto-generated TypeScript types from OpenAPI specification
 * Generated from: Core API v1.0.0
 * DO NOT EDIT MANUALLY
 */

/**
 * RFC 9457 Problem Details for HTTP APIs
 * @see https://www.rfc-editor.org/rfc/rfc9457.html
 */
export interface ProblemDetails {
  /** A URI reference that identifies the problem type */
  type: string;
  /** A short, human-readable summary */
  title: string;
  /** The HTTP status code */
  status: number;
  /** A human-readable explanation specific to this occurrence */
  detail?: string;
  /** A URI reference to the specific occurrence */
  instance?: string;
  /** Application-specific error code (SCREAMING_SNAKE_CASE) */
  code?: string;
  /** Request trace ID for debugging */
  traceId?: string;
  /** Detailed validation errors */
  errors?: ValidationError[];
  /** Additional properties */
  [key: string]: unknown;
}

/**
 * Validation error detail
 */
export interface ValidationError {
  /** JSON Pointer to the invalid field */
  pointer: string;
  /** Error message for this field */
  detail: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: ('user' | 'admin');
  status?: ('active' | 'suspended');
  createdAt: string;
  updatedAt?: string;
  internalNotes?: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
  hasMore?: boolean;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  role?: ('user' | 'admin');
}

export interface UpdateUserRequest {
  name?: string;
  role?: ('user' | 'admin');
}

export interface TenantData {
  id: string;
  tenantId: string;
  data: Record<string, unknown>;
  createdAt?: string;
}

export interface CreateTenantDataRequest {
  data: Record<string, unknown>;
}

export interface SystemStats {
  userCount: number;
  activeUsers: number;
  tenantCount: number;
  /** Uptime in seconds */
  uptime?: number;
}

export interface SuspendUserRequest {
  reason: string;
}

export interface HealthStatus {
  status: ('healthy' | 'degraded' | 'unhealthy');
  version?: string;
  timestamp?: string;
}

// Operation-specific types
export interface UserDomain_getUsersParams {
  'limit'?: number;
  'offset'?: number;
}

export type UserDomain_getUsersInput = UserDomain_getUsersParams;

export type UserDomain_createUserInput = { data: CreateUserRequest };

export interface UserDomain_getUserByIdParams {
  'id': string;
}

export type UserDomain_getUserByIdInput = UserDomain_getUserByIdParams;

export interface UserDomain_updateUserParams {
  'id': string;
}

export type UserDomain_updateUserInput = UserDomain_updateUserParams & { data: UpdateUserRequest };

export interface UserDomain_deleteUserParams {
  'id': string;
}

export type UserDomain_deleteUserInput = UserDomain_deleteUserParams;

export type TenantDomain_getDataInput = Record<string, never>;

export type TenantDomain_createDataInput = { data: CreateTenantDataRequest };

export type AdminDomain_getStatsInput = Record<string, never>;

export interface AdminDomain_suspendUserParams {
  'id': string;
}

export type AdminDomain_suspendUserInput = AdminDomain_suspendUserParams & { data: SuspendUserRequest };

export type HealthDomain_checkInput = Record<string, never>;
