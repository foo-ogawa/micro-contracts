/**
 * UserDomain Domain API Interface
 * Auto-generated from OpenAPI specification
 * DO NOT EDIT MANUALLY
 */

import type {
  User,
  UserDomain_createUserInput,
  UserDomain_deleteUserInput,
  UserDomain_getUserByIdInput,
  UserDomain_getUsersInput,
  UserDomain_updateUserInput,
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

  /**
   * PUT /api/users/{id}
   * @internal Not included in public contract
   */
  updateUser(input: UserDomain_updateUserInput): Promise<User>;

  /**
   * DELETE /api/users/{id}
   * @internal Not included in public contract
   */
  deleteUser(input: UserDomain_deleteUserInput): Promise<void>;

}