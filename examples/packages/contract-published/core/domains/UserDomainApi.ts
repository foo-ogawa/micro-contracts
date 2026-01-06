/**
 * UserDomain Domain API Interface
 * Auto-generated from OpenAPI specification
 * DO NOT EDIT MANUALLY
 */

import type {
  User,
  UserDomain_createUserInput,
  UserDomain_getUserByIdInput,
  UserDomain_getUsersInput,
  UserListResponse,
} from '../schemas/types.js';

export interface UserDomainApi {
  /**
   * GET /api/users
   */
  getUsers(input: UserDomain_getUsersInput): Promise<UserListResponse>;

  /**
   * POST /api/users
   */
  createUser(input: UserDomain_createUserInput): Promise<User>;

  /**
   * GET /api/users/{id}
   */
  getUserById(input: UserDomain_getUserByIdInput): Promise<User>;

}