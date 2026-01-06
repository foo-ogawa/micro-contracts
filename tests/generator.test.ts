/**
 * Generator Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  loadOpenAPISpec,
  loadConfig,
  generate,
} from '../src/generator/index.js';
import type { MultiModuleConfig } from '../src/types.js';

describe('generator', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generator-test-'));
  });

  afterEach(() => {
    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('loadOpenAPISpec', () => {
    it('should load YAML spec', () => {
      const specPath = path.join(tmpDir, 'spec.yaml');
      fs.writeFileSync(specPath, `
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
paths: {}
`);

      const spec = loadOpenAPISpec(specPath);
      expect(spec.info.title).toBe('Test API');
      expect(spec.info.version).toBe('1.0.0');
    });

    it('should load JSON spec', () => {
      const specPath = path.join(tmpDir, 'spec.json');
      fs.writeFileSync(specPath, JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      }));

      const spec = loadOpenAPISpec(specPath);
      expect(spec.info.title).toBe('Test API');
    });

    it('should throw on unsupported format', () => {
      const specPath = path.join(tmpDir, 'spec.txt');
      fs.writeFileSync(specPath, 'not a spec');

      expect(() => loadOpenAPISpec(specPath)).toThrow(/unsupported/i);
    });
  });

  describe('loadConfig', () => {
    it('should load multi-module config', () => {
      const configPath = path.join(tmpDir, 'config.yaml');
      fs.writeFileSync(configPath, `
defaults:
  contract:
    output: packages/contract/{module}
modules:
  core:
    openapi: docs/openapi.yaml
`);

      const config = loadConfig(configPath) as MultiModuleConfig;
      expect(config.modules.core).toBeDefined();
      expect(config.modules.core.openapi).toBe('docs/openapi.yaml');
    });
  });

  describe('generate', () => {
    it('should generate contract package', async () => {
      // Create spec
      const specPath = path.join(tmpDir, 'spec.yaml');
      fs.writeFileSync(specPath, `
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
paths:
  /api/users:
    get:
      operationId: getUsers
      x-micro-contracts-domain: UserDomain
      x-micro-contracts-method: getUsers
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserList'
components:
  schemas:
    UserList:
      type: object
      properties:
        users:
          type: array
          items:
            type: object
`);

      // Create config
      const config: MultiModuleConfig = {
        defaults: {
          contract: { output: path.join(tmpDir, 'packages/contract/{module}') },
          contractPublic: { output: path.join(tmpDir, 'packages/contract-published/{module}') },
        },
        modules: {
          core: {
            openapi: specPath,
          },
        },
      };

      // Generate
      await generate(config, { skipLint: true, contractsOnly: true });

      // Check outputs
      const contractDir = path.join(tmpDir, 'packages/contract/core');
      expect(fs.existsSync(path.join(contractDir, 'index.ts'))).toBe(true);
      expect(fs.existsSync(path.join(contractDir, 'schemas', 'types.ts'))).toBe(true);
      expect(fs.existsSync(path.join(contractDir, 'schemas', 'validators.ts'))).toBe(true);
      expect(fs.existsSync(path.join(contractDir, 'domains', 'index.ts'))).toBe(true);
    });

    it('should generate server routes', async () => {
      // Create spec
      const specPath = path.join(tmpDir, 'spec.yaml');
      fs.writeFileSync(specPath, `
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
paths:
  /api/users:
    get:
      operationId: getUsers
      x-micro-contracts-domain: UserDomain
      x-micro-contracts-method: getUsers
      responses:
        '200':
          description: Success
components:
  schemas: {}
`);

      // Create template
      const templatePath = path.join(tmpDir, 'fastify-routes.hbs');
      fs.writeFileSync(templatePath, `
// Auto-generated routes
import type { FastifyInstance } from 'fastify';

export async function registerRoutes(fastify: FastifyInstance, domains: any) {
{{#each routes}}
  fastify.{{lowercase method}}('{{path}}', async (request, reply) => {
    return domains.{{domainKey}}.{{handler}}(request.body);
  });
{{/each}}
}
`);

      // Create config
      const config: MultiModuleConfig = {
        defaults: {
          contract: { output: path.join(tmpDir, 'packages/contract/{module}') },
          contractPublic: { output: path.join(tmpDir, 'packages/contract-published/{module}') },
          server: { 
            output: path.join(tmpDir, 'server/src/{module}'),
            routes: 'routes.generated.ts',
          },
          templates: {
            server: templatePath,
          },
        },
        modules: {
          core: {
            openapi: specPath,
          },
        },
      };

      // Generate
      await generate(config, { skipLint: true, serverOnly: true });

      // Check outputs
      const routesPath = path.join(tmpDir, 'server/src/core/routes.generated.ts');
      expect(fs.existsSync(routesPath)).toBe(true);
      
      const routesContent = fs.readFileSync(routesPath, 'utf-8');
      expect(routesContent).toContain('registerRoutes');
      // Check basic structure from our test template
      expect(routesContent).toContain('fastify.get');
      expect(routesContent).toContain('/api/users');
    });

    it('should generate frontend client', async () => {
      // Create spec
      const specPath = path.join(tmpDir, 'spec.yaml');
      fs.writeFileSync(specPath, `
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
paths:
  /api/users:
    get:
      operationId: getUsers
      x-micro-contracts-domain: UserDomain
      x-micro-contracts-method: getUsers
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserList'
components:
  schemas:
    UserList:
      type: object
`);

      // Create template
      const templatePath = path.join(tmpDir, 'fetch-client.hbs');
      fs.writeFileSync(templatePath, `
// Auto-generated API client
const BASE_URL = '';

{{#each domains}}
export const {{camelCase name}}DomainApi = {
{{#each operations}}
  async {{name}}(): Promise<any> {
    const response = await fetch(BASE_URL + '{{../path}}');
    return response.json();
  },
{{/each}}
};
{{/each}}

export function getUsers() { return userDomainApi.getUsers(); }
`);

      // Create config
      const config: MultiModuleConfig = {
        defaults: {
          contract: { output: path.join(tmpDir, 'packages/contract/{module}') },
          contractPublic: { output: path.join(tmpDir, 'packages/contract-published/{module}') },
          frontend: {
            output: path.join(tmpDir, 'frontend/src/{module}'),
            client: 'api.generated.ts',
            domain: 'domain.generated.ts',
          },
          templates: {
            frontend: templatePath,
          },
        },
        modules: {
          core: {
            openapi: specPath,
          },
        },
      };

      // Generate
      await generate(config, { skipLint: true, frontendOnly: true });

      // Check outputs
      const clientPath = path.join(tmpDir, 'frontend/src/core/api.generated.ts');
      expect(fs.existsSync(clientPath)).toBe(true);
      
      const clientContent = fs.readFileSync(clientPath, 'utf-8');
      expect(clientContent).toContain('getUsers');
      // Check for domain API export
      expect(clientContent).toContain('userDomainApi');
    });

    it('should apply overlays and generate extension interfaces', async () => {
      // Create spec
      const specPath = path.join(tmpDir, 'spec.yaml');
      fs.writeFileSync(specPath, `
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
paths:
  /api/users:
    get:
      operationId: getUsers
      x-micro-contracts-domain: UserDomain
      x-micro-contracts-method: getUsers
      x-middleware:
        - requireAuth
      responses:
        '200':
          description: Success
components:
  schemas: {}
`);

      // Create overlay
      const overlayPath = path.join(tmpDir, 'auth.overlay.yaml');
      fs.writeFileSync(overlayPath, `
overlay: 1.0.0
info:
  title: Auth Overlay
  version: 1.0.0
actions:
  - target: "$.paths[*][*][?(@.x-middleware contains 'requireAuth')]"
    update:
      responses:
        '401':
          description: Unauthorized
`);

      // Create config
      const config: MultiModuleConfig = {
        defaults: {
          contract: { output: path.join(tmpDir, 'packages/contract/{module}') },
          contractPublic: { output: path.join(tmpDir, 'packages/contract-published/{module}') },
          overlays: {
            shared: [overlayPath],
            collision: 'error',
          },
        },
        modules: {
          core: {
            openapi: specPath,
          },
        },
      };

      // Generate
      await generate(config, { skipLint: true, contractsOnly: true });

      // Check that overlay interfaces were generated
      const overlaysPath = path.join(tmpDir, 'packages/contract/core/overlays/index.ts');
      expect(fs.existsSync(overlaysPath)).toBe(true);
      
      const overlayContent = fs.readFileSync(overlaysPath, 'utf-8');
      expect(overlayContent).toContain('MiddlewareValue');
      expect(overlayContent).toContain('requireAuth');
      expect(overlayContent).toContain('MiddlewareRegistry');

      // Check that generated OpenAPI spec was written (with overlays applied)
      const generatedSpecPath = path.join(tmpDir, 'packages/contract/core/docs/openapi.generated.yaml');
      expect(fs.existsSync(generatedSpecPath)).toBe(true);
    });

    it('should filter to specific modules', async () => {
      // Create specs
      const coreSpecPath = path.join(tmpDir, 'core.yaml');
      fs.writeFileSync(coreSpecPath, `
openapi: 3.0.3
info:
  title: Core API
  version: 1.0.0
paths:
  /api/core:
    get:
      operationId: getCoreData
      x-micro-contracts-domain: CoreDomain
      x-micro-contracts-method: getData
      responses:
        '200':
          description: Success
components:
  schemas: {}
`);

      const usersSpecPath = path.join(tmpDir, 'users.yaml');
      fs.writeFileSync(usersSpecPath, `
openapi: 3.0.3
info:
  title: Users API
  version: 1.0.0
paths:
  /api/users:
    get:
      operationId: getUsers
      x-micro-contracts-domain: UserDomain
      x-micro-contracts-method: getUsers
      responses:
        '200':
          description: Success
components:
  schemas: {}
`);

      // Create config
      const config: MultiModuleConfig = {
        defaults: {
          contract: { output: path.join(tmpDir, 'packages/contract/{module}') },
          contractPublic: { output: path.join(tmpDir, 'packages/contract-published/{module}') },
        },
        modules: {
          core: { openapi: coreSpecPath },
          users: { openapi: usersSpecPath },
        },
      };

      // Generate only core module
      await generate(config, { skipLint: true, modules: 'core', contractsOnly: true });

      // Check that only core was generated
      expect(fs.existsSync(path.join(tmpDir, 'packages/contract/core/index.ts'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'packages/contract/users/index.ts'))).toBe(false);
    });
  });
});

