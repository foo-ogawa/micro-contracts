/**
 * Auto-generated HTTP Client from OpenAPI specification
 * Generated from: Core API v1.0.0
 * 
 * DO NOT EDIT MANUALLY
 * 
 * This client is generated from a custom template.
 * Customize spec/core/templates/client.hbs to change the output.
 */

import type {
  AdminDomainApi,
  HealthDomainApi,
  TenantDomainApi,
  UserDomainApi,
} from '@project/contract/core/domains';
import type {
  AdminDomain_getStatsInput,
  AdminDomain_suspendUserInput,
  AdminDomain_suspendUserParams,
  CreateTenantDataRequest,
  CreateUserRequest,
  HealthDomain_checkInput,
  HealthStatus,
  ProblemDetails,
  SuspendUserRequest,
  SystemStats,
  TenantData,
  TenantDomain_createDataInput,
  TenantDomain_getDataInput,
  UpdateUserRequest,
  User,
  UserDomain_createUserInput,
  UserDomain_deleteUserInput,
  UserDomain_deleteUserParams,
  UserDomain_getUserByIdInput,
  UserDomain_getUserByIdParams,
  UserDomain_getUsersInput,
  UserDomain_getUsersParams,
  UserDomain_updateUserInput,
  UserDomain_updateUserParams,
  UserListResponse,
} from '@project/contract/core/schemas';
import { ApiError } from '@project/contract/core/errors';

// BASE_URL derived from OpenAPI servers[0].url: 
// Can be overridden via environment variable (Vite: VITE_API_BASE_URL)
const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';

/**
 * Handle HTTP response with typed error handling
 */
async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const problem = await res.json() as ProblemDetails;
    throw new ApiError(
      res.status,
      problem,
      res.headers.get('x-request-id') ?? undefined
    );
  }
  // Handle 204 No Content and empty responses
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return res.json();
}

// ==========================================================================
// AdminDomain API Client
// ==========================================================================
export const adminApi: AdminDomainApi = {
  /**
   * GET /api/admin/stats
   * Get system statistics
   
   */
  async getStats(input: AdminDomain_getStatsInput): Promise<SystemStats> {
    const url = `${BASE_URL}/api/admin/stats`;
    const res = await fetch(url);
    return handleResponse<SystemStats>(res);
  },

  /**
   * POST /api/admin/users/{id}/suspend
   * Suspend user account
   
   */
  async suspendUser(input: AdminDomain_suspendUserInput): Promise<User> {
    const url = `${BASE_URL}/api/admin/users/${input.id}/suspend`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.data),
    });
    return handleResponse<User>(res);
  },

};

// ==========================================================================
// HealthDomain API Client
// ==========================================================================
export const healthApi: HealthDomainApi = {
  /**
   * GET /api/health
   * Health check
   * @published
   */
  async check(input: HealthDomain_checkInput): Promise<HealthStatus> {
    const url = `${BASE_URL}/api/health`;
    const res = await fetch(url);
    return handleResponse<HealthStatus>(res);
  },

};

// ==========================================================================
// TenantDomain API Client
// ==========================================================================
export const tenantApi: TenantDomainApi = {
  /**
   * GET /api/tenant/data
   * Get tenant-scoped data
   
   */
  async getData(input: TenantDomain_getDataInput): Promise<TenantData> {
    const url = `${BASE_URL}/api/tenant/data`;
    const res = await fetch(url);
    return handleResponse<TenantData>(res);
  },

  /**
   * POST /api/tenant/data
   * Create tenant data
   
   */
  async createData(input: TenantDomain_createDataInput): Promise<TenantData> {
    const url = `${BASE_URL}/api/tenant/data`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.data),
    });
    return handleResponse<TenantData>(res);
  },

};

// ==========================================================================
// UserDomain API Client
// ==========================================================================
export const userApi: UserDomainApi = {
  /**
   * GET /api/users
   * Get users list
   * @published
   */
  async getUsers(input: UserDomain_getUsersInput): Promise<UserListResponse> {
    const searchParams = new URLSearchParams();
    if (input.limit !== undefined) searchParams.set('limit', String(input.limit));
    if (input.offset !== undefined) searchParams.set('offset', String(input.offset));
    const url = `${BASE_URL}/api/users` + (searchParams.toString() ? '?' + searchParams : '');
    const res = await fetch(url);
    return handleResponse<UserListResponse>(res);
  },

  /**
   * POST /api/users
   * Create new user
   * @published
   */
  async createUser(input: UserDomain_createUserInput): Promise<User> {
    const url = `${BASE_URL}/api/users`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.data),
    });
    return handleResponse<User>(res);
  },

  /**
   * GET /api/users/{id}
   * Get user by ID
   * @published
   */
  async getUserById(input: UserDomain_getUserByIdInput): Promise<User> {
    const url = `${BASE_URL}/api/users/${input.id}`;
    const res = await fetch(url);
    return handleResponse<User>(res);
  },

  /**
   * PUT /api/users/{id}
   * Update user
   
   */
  async updateUser(input: UserDomain_updateUserInput): Promise<User> {
    const url = `${BASE_URL}/api/users/${input.id}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.data),
    });
    return handleResponse<User>(res);
  },

  /**
   * DELETE /api/users/{id}
   * Delete user
   
   */
  async deleteUser(input: UserDomain_deleteUserInput): Promise<void> {
    const url = `${BASE_URL}/api/users/${input.id}`;
    const res = await fetch(url, { method: 'DELETE' });
    await handleResponse<void>(res);
  },

};

