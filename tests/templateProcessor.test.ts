/**
 * Template Processor Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Handlebars from 'handlebars';
import {
  buildTemplateContext,
  loadTemplate,
  processTemplate,
  getDefaultTemplate,
  DEFAULT_SERVER_TEMPLATE,
  DEFAULT_FRONTEND_TEMPLATE,
} from '../src/generator/templateProcessor.js';
import type { OpenAPISpec } from '../src/types.js';
import type { ExtensionInfo } from '../src/generator/overlayProcessor.js';

describe('templateProcessor', () => {
  let testSpec: OpenAPISpec;

  beforeEach(() => {
    testSpec = {
      openapi: '3.0.3',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
      paths: {
        '/api/users': {
          get: {
            operationId: 'getUsers',
            summary: 'Get users list',
            'x-micro-contracts-domain': 'UserDomain',
            'x-micro-contracts-method': 'getUsers',
            'x-micro-contracts-published': true,
            parameters: [
              { name: 'limit', in: 'query', schema: { type: 'integer' } },
            ],
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/UserList' },
                  },
                },
              },
            },
          },
          post: {
            operationId: 'createUser',
            summary: 'Create user',
            'x-micro-contracts-domain': 'UserDomain',
            'x-micro-contracts-method': 'createUser',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CreateUser' },
                },
              },
            },
            responses: {
              '201': {
                description: 'Created',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
        },
        '/api/users/{id}': {
          get: {
            operationId: 'getUserById',
            summary: 'Get user by ID',
            'x-micro-contracts-domain': 'UserDomain',
            'x-micro-contracts-method': 'getUserById',
            parameters: [
              { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          User: { type: 'object' },
          UserList: { type: 'object' },
          CreateUser: { type: 'object' },
        },
      },
    };
  });

  describe('buildTemplateContext', () => {
    it('should extract routes from spec', () => {
      const context = buildTemplateContext(testSpec, 'core');

      expect(context.routes).toHaveLength(3);
      expect(context.routes[0].path).toBe('/api/users');
      expect(context.routes[0].method).toBe('get');
      expect(context.routes[0].domain).toBe('UserDomain');
      expect(context.routes[0].domainMethod).toBe('getUsers');
    });

    it('should extract domains from routes', () => {
      const context = buildTemplateContext(testSpec, 'core');

      expect(context.domains).toHaveLength(1);
      expect(context.domains[0].name).toBe('UserDomain');
      expect(context.domains[0].key).toBe('user');
      expect(context.domains[0].methods).toContain('getUsers');
      expect(context.domains[0].methods).toContain('createUser');
      expect(context.domains[0].methods).toContain('getUserById');
    });

    it('should convert path params to Fastify format', () => {
      const context = buildTemplateContext(testSpec, 'core');

      const getUserByIdRoute = context.routes.find(r => r.operationId === 'getUserById');
      expect(getUserByIdRoute?.fastifyPath).toBe('/api/users/:id');
    });

    it('should include extension info when provided', () => {
      const extensionInfo = new Map<string, ExtensionInfo>([
        ['x-middleware:requireAuth', {
          name: 'requireAuth',
          marker: 'x-middleware',
          injectedParameters: [],
          injectedResponses: { '401': { description: 'Unauthorized' } },
        }],
      ]);

      const context = buildTemplateContext(testSpec, 'core', { extensionInfo });

      expect(context.extensionInfo).toHaveLength(1);
      expect(context.extensionInfo[0].name).toBe('requireAuth');
    });

    it('should set correct module name and paths', () => {
      const context = buildTemplateContext(testSpec, 'users', {
        domainsPath: 'fastify.domains.users',
        contractPackage: '@myapp/contract/users',
      });

      expect(context.moduleName).toBe('users');
      expect(context.domainsPath).toBe('fastify.domains.users');
      expect(context.contractPackage).toBe('@myapp/contract/users');
    });

    it('should identify public routes', () => {
      const context = buildTemplateContext(testSpec, 'core');

      const getUsersRoute = context.routes.find(r => r.operationId === 'getUsers');
      const createUserRoute = context.routes.find(r => r.operationId === 'createUser');

      expect(getUsersRoute?.isPublished).toBe(true);
      expect(createUserRoute?.isPublished).toBe(false);
    });
  });

  describe('processTemplate', () => {
    it('should render template with context', () => {
      const template = Handlebars.compile('Hello {{moduleName}}!');
      const context = buildTemplateContext(testSpec, 'core');

      const result = processTemplate(template, context);

      expect(result).toBe('Hello core!');
    });

    it('should iterate over routes', () => {
      const template = Handlebars.compile(
        '{{#each routes}}{{operationId}}\\n{{/each}}'
      );
      const context = buildTemplateContext(testSpec, 'core');

      const result = processTemplate(template, context);

      expect(result).toContain('getUsers');
      expect(result).toContain('createUser');
      expect(result).toContain('getUserById');
    });
  });

  describe('getDefaultTemplate', () => {
    it('should return server template', () => {
      const template = getDefaultTemplate('server');
      expect(template).toBe(DEFAULT_SERVER_TEMPLATE);
      expect(template).toContain('registerRoutes');
      expect(template).toContain('FastifyInstance');
    });

    it('should return frontend template', () => {
      const template = getDefaultTemplate('frontend');
      expect(template).toBe(DEFAULT_FRONTEND_TEMPLATE);
      expect(template).toContain('fetchApi');
      expect(template).toContain('BASE_URL');
    });
  });

  describe('Handlebars helpers', () => {
    it('should have eq helper', () => {
      const template = Handlebars.compile('{{#if (eq a b)}}equal{{else}}not equal{{/if}}');
      expect(template({ a: 1, b: 1 })).toBe('equal');
      expect(template({ a: 1, b: 2 })).toBe('not equal');
    });

    it('should have uppercase helper', () => {
      const template = Handlebars.compile('{{uppercase method}}');
      expect(template({ method: 'get' })).toBe('GET');
    });

    it('should have camelCase helper', () => {
      const template = Handlebars.compile('{{camelCase name}}');
      expect(template({ name: 'x-middleware' })).toBe('xMiddleware');
    });

    it('should have join helper', () => {
      const template = Handlebars.compile('{{join items ", "}}');
      expect(template({ items: ['a', 'b', 'c'] })).toBe('a, b, c');
    });

    it('should have first helper', () => {
      const template = Handlebars.compile('{{first items}}');
      expect(template({ items: ['a', 'b', 'c'] })).toBe('a');
    });

    it('should have json helper', () => {
      const template = Handlebars.compile('{{{json obj}}}');
      const result = template({ obj: { a: 1 } });
      expect(JSON.parse(result)).toEqual({ a: 1 });
    });
  });

  describe('loadTemplate', () => {
    it('should load template from file', () => {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-test-'));
      const templatePath = path.join(tmpDir, 'test.hbs');
      fs.writeFileSync(templatePath, 'Hello {{name}}!');

      const template = loadTemplate(templatePath);
      const result = template({ name: 'World' });

      expect(result).toBe('Hello World!');

      // Cleanup
      fs.unlinkSync(templatePath);
      fs.rmdirSync(tmpDir);
    });

    it('should throw if template not found', () => {
      expect(() => loadTemplate('/nonexistent/template.hbs')).toThrow();
    });
  });
});

