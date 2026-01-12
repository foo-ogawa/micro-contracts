/**
 * User Service API Interface
 * Auto-generated from OpenAPI specification
 * DO NOT EDIT MANUALLY
 */

import type {
  User,
  UserListResponse,
  User_createUserInput,
  User_getUserByIdInput,
  User_getUsersInput,
} from '../schemas/types.js';

export interface UserServiceApi {
  /**
   * GET /api/users
   */
  getUsers(input: User_getUsersInput): Promise<UserListResponse>;

  /**
   * POST /api/users
   */
  createUser(input: User_createUserInput): Promise<User>;

  /**
   * GET /api/users/{id}
   */
  getUserById(input: User_getUserByIdInput): Promise<User>;

}