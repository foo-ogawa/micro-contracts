/**
 * Overlay Processor Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  processOverlays, 
  generateExtensionInterfaces,
  type OverlayConfig 
} from '../src/generator/overlayProcessor.js';
import type { OpenAPISpec } from '../src/types.js';

describe('overlayProcessor', () => {
  let baseSpec: OpenAPISpec;

  beforeEach(() => {
    baseSpec = {
      openapi: '3.0.3',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
      paths: {
        '/api/users': {
          get: {
            operationId: 'getUsers',
            'x-domain': 'UserDomain',
            'x-method': 'getUsers',
            'x-middleware': ['requireAuth'],
            responses: {
              '200': { description: 'Success' },
            },
          },
          post: {
            operationId: 'createUser',
            'x-domain': 'UserDomain',
            'x-method': 'createUser',
            'x-middleware': ['requireAuth', 'tenantIsolation'],
            responses: {
              '201': { description: 'Created' },
            },
          },
        },
        '/api/admin/stats': {
          get: {
            operationId: 'getStats',
            'x-domain': 'AdminDomain',
            'x-method': 'getStats',
            'x-middleware': ['requireAuth', 'requireAdmin'],
            responses: {
              '200': { description: 'Success' },
            },
          },
        },
      },
    };
  });

  describe('processOverlays', () => {
    it('should apply overlay actions to matching operations', () => {
      // Create a mock overlay file content
      const mockOverlay = `
overlay: 1.0.0
info:
  title: Test Overlay
  version: 1.0.0
actions:
  - target: "$.paths[*][*][?(@.x-middleware contains 'requireAuth')]"
    update:
      responses:
        '401':
          description: Unauthorized
`;
      
      // Write mock overlay to temp location
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-test-'));
      const overlayPath = path.join(tmpDir, 'test.overlay.yaml');
      fs.writeFileSync(overlayPath, mockOverlay);

      const config: OverlayConfig = {
        collision: 'error',
        files: [overlayPath],
      };

      const result = processOverlays(baseSpec, config);

      // Check that 401 was added to all operations with requireAuth
      expect(result.spec.paths['/api/users'].get?.responses['401']).toBeDefined();
      expect(result.spec.paths['/api/users'].post?.responses['401']).toBeDefined();
      expect(result.spec.paths['/api/admin/stats'].get?.responses['401']).toBeDefined();

      // Cleanup
      fs.unlinkSync(overlayPath);
      fs.rmdirSync(tmpDir);
    });

    it('should extract extension info from overlays', () => {
      const mockOverlay = `
overlay: 1.0.0
info:
  title: Test Overlay
  version: 1.0.0
actions:
  - target: "$.paths[*][*][?(@.x-middleware contains 'tenantIsolation')]"
    update:
      parameters:
        - name: X-Tenant-Id
          in: header
          required: true
          schema:
            type: string
      responses:
        '400':
          description: Bad Request
`;
      
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-test-'));
      const overlayPath = path.join(tmpDir, 'test.overlay.yaml');
      fs.writeFileSync(overlayPath, mockOverlay);

      const config: OverlayConfig = {
        collision: 'error',
        files: [overlayPath],
      };

      const result = processOverlays(baseSpec, config);

      // Check extension info was extracted
      const tenantInfo = result.extensionInfo.get('x-middleware:tenantIsolation');
      expect(tenantInfo).toBeDefined();
      expect(tenantInfo?.name).toBe('tenantIsolation');
      expect(tenantInfo?.marker).toBe('x-middleware');
      expect(tenantInfo?.injectedParameters).toHaveLength(1);
      expect(tenantInfo?.injectedParameters[0].name).toBe('X-Tenant-Id');
      expect(tenantInfo?.injectedResponses['400']).toBeDefined();

      // Cleanup
      fs.unlinkSync(overlayPath);
      fs.rmdirSync(tmpDir);
    });

    it('should detect collision when same key is injected with different content', () => {
      const overlay1 = `
overlay: 1.0.0
info:
  title: Overlay 1
  version: 1.0.0
actions:
  - target: "$.paths[*][*][?(@.x-middleware contains 'requireAuth')]"
    update:
      responses:
        '401':
          description: Unauthorized - Version 1
`;
      
      const overlay2 = `
overlay: 1.0.0
info:
  title: Overlay 2
  version: 1.0.0
actions:
  - target: "$.paths[*][*][?(@.x-middleware contains 'requireAuth')]"
    update:
      responses:
        '401':
          description: Unauthorized - Version 2
`;
      
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-test-'));
      const overlay1Path = path.join(tmpDir, 'overlay1.yaml');
      const overlay2Path = path.join(tmpDir, 'overlay2.yaml');
      fs.writeFileSync(overlay1Path, overlay1);
      fs.writeFileSync(overlay2Path, overlay2);

      const config: OverlayConfig = {
        collision: 'error',
        files: [overlay1Path, overlay2Path],
      };

      // Should throw on collision
      expect(() => processOverlays(baseSpec, config)).toThrow(/collision/i);

      // Cleanup
      fs.unlinkSync(overlay1Path);
      fs.unlinkSync(overlay2Path);
      fs.rmdirSync(tmpDir);
    });

    it('should allow identical content on collision (idempotent)', () => {
      const overlay1 = `
overlay: 1.0.0
info:
  title: Overlay 1
  version: 1.0.0
actions:
  - target: "$.paths[*][*][?(@.x-middleware contains 'requireAuth')]"
    update:
      responses:
        '401':
          description: Unauthorized
`;
      
      const overlay2 = `
overlay: 1.0.0
info:
  title: Overlay 2
  version: 1.0.0
actions:
  - target: "$.paths[*][*][?(@.x-middleware contains 'requireAuth')]"
    update:
      responses:
        '401':
          description: Unauthorized
`;
      
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-test-'));
      const overlay1Path = path.join(tmpDir, 'overlay1.yaml');
      const overlay2Path = path.join(tmpDir, 'overlay2.yaml');
      fs.writeFileSync(overlay1Path, overlay1);
      fs.writeFileSync(overlay2Path, overlay2);

      const config: OverlayConfig = {
        collision: 'error',
        files: [overlay1Path, overlay2Path],
      };

      // Should NOT throw on identical content
      const result = processOverlays(baseSpec, config);
      expect(result.spec.paths['/api/users'].get?.responses['401']).toBeDefined();

      // Cleanup
      fs.unlinkSync(overlay1Path);
      fs.unlinkSync(overlay2Path);
      fs.rmdirSync(tmpDir);
    });

    it('should log applied overlays', () => {
      const mockOverlay = `
overlay: 1.0.0
info:
  title: Test Overlay
  version: 1.0.0
actions:
  - target: "$.paths[*][*][?(@.x-middleware contains 'requireAuth')]"
    update:
      responses:
        '401':
          description: Unauthorized
`;
      
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-test-'));
      const overlayPath = path.join(tmpDir, 'test.overlay.yaml');
      fs.writeFileSync(overlayPath, mockOverlay);

      const config: OverlayConfig = {
        collision: 'error',
        files: [overlayPath],
      };

      const result = processOverlays(baseSpec, config);

      expect(result.appliedOverlays).toHaveLength(1);
      expect(result.log.length).toBeGreaterThan(0);

      // Cleanup
      fs.unlinkSync(overlayPath);
      fs.rmdirSync(tmpDir);
    });
  });

  describe('generateExtensionInterfaces', () => {
    it('should generate TypeScript interfaces from extension info', () => {
      const extensionInfo = new Map([
        ['x-middleware:requireAuth', {
          name: 'requireAuth',
          marker: 'x-middleware',
          injectedParameters: [],
          injectedResponses: { '401': { description: 'Unauthorized' } },
        }],
        ['x-middleware:tenantIsolation', {
          name: 'tenantIsolation',
          marker: 'x-middleware',
          injectedParameters: [
            { name: 'X-Tenant-Id', in: 'header' as const, required: true },
          ],
          injectedResponses: { '400': { description: 'Bad Request' } },
        }],
      ]);

      const result = generateExtensionInterfaces(extensionInfo);

      // Check that it generates valid TypeScript with new Overlay naming
      expect(result).toContain('export type MiddlewareValue');
      expect(result).toContain("'requireAuth'");
      expect(result).toContain("'tenantIsolation'");
      expect(result).toContain('export interface RequireAuthOverlayInput');
      expect(result).toContain('export type RequireAuthOverlay');
      expect(result).toContain('export interface TenantIsolationOverlayInput');
      expect(result).toContain('export type TenantIsolationOverlay');
      expect(result).toContain('export interface MiddlewareRegistry');
      expect(result).toContain('requireAuth: RequireAuthOverlay');
      expect(result).toContain('tenantIsolation: TenantIsolationOverlay');
    });

    it('should include injected parameters in input type and errors in comment', () => {
      const extensionInfo = new Map([
        ['x-middleware:tenantIsolation', {
          name: 'tenantIsolation',
          marker: 'x-middleware',
          injectedParameters: [
            { name: 'X-Tenant-Id', in: 'header' as const, required: true },
          ],
          injectedResponses: { '400': { description: 'Bad Request' } },
        }],
      ]);

      const result = generateExtensionInterfaces(extensionInfo);

      // Parameters are now in input interface, errors in JSDoc comment
      expect(result).toContain("'X-Tenant-Id'");
      expect(result).toContain('May return errors: 400');
    });
  });
});

