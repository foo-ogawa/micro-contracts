/**
 * Auto-generated Fastify routes
 * Generated from: Core API v1.0.0
 * DO NOT EDIT MANUALLY
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { allSchemas } from '@project/contract/core/schemas/index.js';
import * as types from '@project/contract/core/schemas/types.js';
import { runOverlays, toHttpRequest, sendError } from './overlayAdapter.generated.js';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  for (const schema of allSchemas) {
    fastify.addSchema(schema);
  }

  const { admin, health, tenant, user } = fastify.domains.core;
  const handlers = fastify.overlayHandlers;

  // GET /api/users [PUBLISHED]
  fastify.get('/api/users', {
    schema: {
      querystring: { $ref: 'UserDomain_getUsersParams#' },
      response: { 200: { $ref: 'UserListResponse#' },  },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await runOverlays('getUsers', handlers, toHttpRequest(req));
    if (!result.success) return sendError(reply, result.error);
    // Build input object (always required, even if empty)
    const input: types.UserDomain_getUsersInput = {
      ...(req.query as types.UserDomain_getUsersParams),
    };
    return user.getUsers(input);
  });

  // POST /api/users [PUBLISHED]
  fastify.post('/api/users', {
    schema: {
      body: { $ref: 'CreateUserRequest#' },
      response: { 201: { $ref: 'User#' },  },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await runOverlays('createUser', handlers, toHttpRequest(req));
    if (!result.success) return sendError(reply, result.error);
    // Build input object (always required, even if empty)
    const input: types.UserDomain_createUserInput = {
      data: req.body as types.CreateUserRequest,
    };
    return user.createUser(input);
  });

  // GET /api/users/{id} [PUBLISHED]
  fastify.get('/api/users/:id', {
    schema: {
      params: { $ref: 'UserDomain_getUserByIdParams#' },
      response: { 200: { $ref: 'User#' },  },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await runOverlays('getUserById', handlers, toHttpRequest(req));
    if (!result.success) return sendError(reply, result.error);
    // Build input object (always required, even if empty)
    const input: types.UserDomain_getUserByIdInput = {
      ...(req.params as types.UserDomain_getUserByIdParams),
    };
    return user.getUserById(input);
  });

  // PUT /api/users/{id}
  fastify.put('/api/users/:id', {
    schema: {
      params: { $ref: 'UserDomain_updateUserParams#' },
      body: { $ref: 'UpdateUserRequest#' },
      response: { 200: { $ref: 'User#' },  },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await runOverlays('updateUser', handlers, toHttpRequest(req));
    if (!result.success) return sendError(reply, result.error);
    // Build input object (always required, even if empty)
    const input: types.UserDomain_updateUserInput = {
      ...(req.params as types.UserDomain_updateUserParams),
      data: req.body as types.UpdateUserRequest,
    };
    return user.updateUser(input);
  });

  // DELETE /api/users/{id}
  fastify.delete('/api/users/:id', {
    schema: {
      params: { $ref: 'UserDomain_deleteUserParams#' },
      response: {  },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await runOverlays('deleteUser', handlers, toHttpRequest(req));
    if (!result.success) return sendError(reply, result.error);
    // Build input object (always required, even if empty)
    const input: types.UserDomain_deleteUserInput = {
      ...(req.params as types.UserDomain_deleteUserParams),
    };
    return user.deleteUser(input);
  });

  // GET /api/tenant/data
  fastify.get('/api/tenant/data', {
    schema: {
      response: { 200: { $ref: 'TenantData#' },  },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await runOverlays('getTenantData', handlers, toHttpRequest(req));
    if (!result.success) return sendError(reply, result.error);
    // Build input object (always required, even if empty)
    const input: types.TenantDomain_getDataInput = {
    };
    return tenant.getData(input);
  });

  // POST /api/tenant/data
  fastify.post('/api/tenant/data', {
    schema: {
      body: { $ref: 'CreateTenantDataRequest#' },
      response: { 201: { $ref: 'TenantData#' },  },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await runOverlays('createTenantData', handlers, toHttpRequest(req));
    if (!result.success) return sendError(reply, result.error);
    // Build input object (always required, even if empty)
    const input: types.TenantDomain_createDataInput = {
      data: req.body as types.CreateTenantDataRequest,
    };
    return tenant.createData(input);
  });

  // GET /api/admin/stats
  fastify.get('/api/admin/stats', {
    schema: {
      response: { 200: { $ref: 'SystemStats#' },  },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await runOverlays('getSystemStats', handlers, toHttpRequest(req));
    if (!result.success) return sendError(reply, result.error);
    // Build input object (always required, even if empty)
    const input: types.AdminDomain_getStatsInput = {
    };
    return admin.getStats(input);
  });

  // POST /api/admin/users/{id}/suspend
  fastify.post('/api/admin/users/:id/suspend', {
    schema: {
      params: { $ref: 'AdminDomain_suspendUserParams#' },
      body: { $ref: 'SuspendUserRequest#' },
      response: { 200: { $ref: 'User#' },  },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await runOverlays('suspendUser', handlers, toHttpRequest(req));
    if (!result.success) return sendError(reply, result.error);
    // Build input object (always required, even if empty)
    const input: types.AdminDomain_suspendUserInput = {
      ...(req.params as types.AdminDomain_suspendUserParams),
      data: req.body as types.SuspendUserRequest,
    };
    return admin.suspendUser(input);
  });

  // GET /api/health [PUBLISHED]
  fastify.get('/api/health', {
    schema: {
      response: { 200: { $ref: 'HealthStatus#' } },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    // Build input object (always required, even if empty)
    const input: types.HealthDomain_checkInput = {
    };
    return health.check(input);
  });

}
