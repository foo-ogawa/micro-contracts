/**
 * Server Entry Point - Composition Root
 * 
 * This is the ONLY file that knows about:
 * - Framework (Fastify)
 * - Wiring (connecting domains and middleware to routes)
 * 
 * Domain and middleware implementations are framework-agnostic.
 * 
 * @see https://github.com/example/micro-contracts/tree/main/examples
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

// Import domain implementations (framework-agnostic)
import { UserDomain, AdminDomain, TenantDomain, HealthDomain } from './core/domains/index.js';
import { BillingDomain } from './billing/domains/index.js';

// Import overlay implementations (framework-agnostic)
import * as coreOverlays from './core/overlays/index.js';
import * as billingOverlays from './billing/overlays/index.js';

// Import generated routes
import { registerRoutes as registerCoreRoutes } from './core/routes.generated.js';
import { registerRoutes as registerBillingRoutes } from './billing/routes.generated.js';

// Import auto-generated domain registries
import type { DomainRegistry as CoreDomainRegistry } from '@project/contract/core/domains/index.js';
import type { DomainRegistry as BillingDomainRegistry } from '@project/contract/billing/domains/index.js';

// Import auto-generated overlay registries
import type { OverlayRegistry as CoreOverlayRegistry } from '@project/contract/core/overlays/index.js';
import type { OverlayRegistry as BillingOverlayRegistry } from '@project/contract/billing/overlays/index.js';

// =============================================================================
// Type Definitions (using auto-generated types)
// =============================================================================

// All domains type - composed from auto-generated registries
interface AllDomains {
  core: CoreDomainRegistry;
  billing: BillingDomainRegistry;
}

// Combined overlay registry (shared + module-specific)
type CombinedOverlayRegistry = CoreOverlayRegistry & BillingOverlayRegistry;

// =============================================================================
// Fastify Type Augmentation
// =============================================================================

declare module 'fastify' {
  interface FastifyInstance {
    domains: AllDomains;
    overlayHandlers: CombinedOverlayRegistry;
  }
}

// =============================================================================
// Build Server
// =============================================================================

async function buildServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: true,
    ajv: {
      customOptions: {
        removeAdditional: 'all',
        coerceTypes: true,
        useDefaults: true,
      },
    },
  });

  // =========================================================================
  // CORS (for development - allow frontend to call API)
  // =========================================================================
  
  await fastify.register(cors, {
    origin: true, // Allow all origins in development
  });

  // =========================================================================
  // Initialize Domains
  // =========================================================================
  
  // Core module domains (no external dependencies)
  const userDomain = new UserDomain();
  const adminDomain = new AdminDomain();
  const tenantDomain = new TenantDomain();
  const healthDomain = new HealthDomain();
  
  // Billing module domains (depends on core.User)
  // Note: BillingDomain receives CoreUserDomainDeps interface
  const billingDomain = new BillingDomain(userDomain);

  // =========================================================================
  // Composition Root: Wire domains
  // =========================================================================
  
  fastify.decorate('domains', {
    core: {
      user: userDomain,
      admin: adminDomain,
      tenant: tenantDomain,
      health: healthDomain,
    },
    billing: {
      billing: billingDomain,
    },
  });

  // =========================================================================
  // Composition Root: Wire overlay handlers (shared + module-specific)
  // =========================================================================
  
  fastify.decorate('overlayHandlers', {
    // Shared overlays (from core)
    requireAuth: coreOverlays.requireAuth,
    requireAdmin: coreOverlays.requireAdmin,
    tenantIsolation: coreOverlays.tenantIsolation,
    rateLimit: coreOverlays.rateLimit,
    // Module-specific overlays
    validatePaymentMethod: billingOverlays.validatePaymentMethod,
  });

  // =========================================================================
  // Register Generated Routes
  // =========================================================================
  
  await registerCoreRoutes(fastify);
  await registerBillingRoutes(fastify);

  // =========================================================================
  // Error Handler (ProblemDetails format)
  // =========================================================================
  
  fastify.setErrorHandler((error, request, reply) => {
    const err = error as Error & { statusCode?: number };
    const statusCode = err.statusCode ?? 500;
    
    reply.status(statusCode).send({
      type: `/errors/${statusCode === 500 ? 'internal' : 'error'}`,
      title: err.message || 'Internal Server Error',
      status: statusCode,
      detail: err.message,
      traceId: request.id,
    });
  });

  return fastify;
}

// =============================================================================
// Start Server
// =============================================================================

async function main() {
  const server = await buildServer();
  
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`\n🚀 Server running at http://localhost:${port}`);
    console.log(`\nCore module endpoints:`);
    console.log(`  curl http://localhost:${port}/api/health`);
    console.log(`  curl -H "Authorization: Bearer test" http://localhost:${port}/api/users`);
    console.log(`  curl -H "Authorization: Bearer admin" http://localhost:${port}/api/admin/stats`);
    console.log(`\nBilling module endpoints (cross-module dependency demo):`);
    console.log(`  curl -H "Authorization: Bearer test" -H "X-Tenant-Id: tenant-1" http://localhost:${port}/api/billing/invoices`);
    console.log(`  curl -X POST -H "Authorization: Bearer test" -H "X-Tenant-Id: tenant-1" -H "Content-Type: application/json" -d '{"userId":"1","amount":99.99}' http://localhost:${port}/api/billing/invoices`);
  } catch (err: unknown) {
    server.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
