/**
 * Screen Spec Tests
 * 
 * Tests for screen specification support:
 * - ScreenContext extraction from OpenAPI
 * - Screen lint rules
 * - Screen template rendering
 */

import { describe, it, expect } from 'vitest';
import Handlebars from 'handlebars';
import { buildTemplateContext } from '../src/generator/templateProcessor.js';
import { lintSpec } from '../src/generator/linter.js';
import { resolveModuleConfig } from '../src/types.js';
import type { OpenAPISpec } from '../src/types.js';

// Import template processor to register Handlebars helpers
import '../src/generator/templateProcessor.js';

function createScreenSpec(): OpenAPISpec {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Test Screen Specification',
      version: '1.0.0',
      description: 'Screen contracts for testing',
    },
    servers: [{ url: '/', description: 'Client-side routes' }],
    paths: {
      '/home': {
        get: {
          operationId: 'renderHomePage',
          summary: 'Render home page',
          security: [{ session: [] }],
          'x-screen-const': 'HOME',
          'x-screen-id': 'SCR-001',
          'x-screen-name': 'HomePage',
          'x-back-navigation': false,
          'x-events': [
            { name: 'home_view', type: 'screen_view', method: 'trackView' },
            { name: 'sign_out', type: 'user_action', method: 'trackSignOut' },
            { name: 'item_tap', type: 'user_action', method: 'trackItemTap', params: { item_id: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Home page ViewModel',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HomePageViewModel' },
                },
              },
              links: {
                goToSettings: {
                  operationId: 'renderSettingsPage',
                  description: 'Navigate to settings',
                },
                goToChat: {
                  operationId: 'renderChatPage',
                  description: 'Navigate to chat',
                },
              },
            },
          },
        },
      },
      '/settings': {
        get: {
          operationId: 'renderSettingsPage',
          summary: 'Render settings page',
          security: [{ session: [] }],
          'x-screen-const': 'SETTINGS',
          'x-screen-id': 'SCR-002',
          'x-screen-name': 'SettingsPage',
          'x-back-navigation': true,
          'x-events': [
            { name: 'settings_view', type: 'screen_view', method: 'trackView' },
          ],
          responses: {
            '200': {
              description: 'Settings page ViewModel',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SettingsPageViewModel' },
                },
              },
              links: {
                goToHome: {
                  operationId: 'renderHomePage',
                },
              },
            },
          },
        },
      },
      '/chat': {
        get: {
          operationId: 'renderChatPage',
          summary: 'Render chat page',
          security: [{ session: [] }],
          'x-screen-const': 'CHAT',
          'x-screen-id': 'SCR-003',
          'x-screen-name': 'ChatPage',
          'x-back-navigation': true,
          responses: {
            '200': {
              description: 'Chat page ViewModel',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ChatPageViewModel' },
                },
              },
            },
          },
        },
      },
      '/start': {
        get: {
          operationId: 'renderStartPage',
          summary: 'Render start page',
          security: [],
          'x-screen-const': 'START',
          'x-screen-id': 'SCR-004',
          'x-screen-name': 'StartPage',
          'x-back-navigation': false,
          responses: {
            '200': {
              description: 'Start page ViewModel',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/StartPageViewModel' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        HomePageViewModel: {
          type: 'object',
          required: ['greeting'],
          properties: { greeting: { type: 'string' } },
        },
        SettingsPageViewModel: {
          type: 'object',
          required: ['theme'],
          properties: { theme: { type: 'string' } },
        },
        ChatPageViewModel: {
          type: 'object',
          required: ['messages'],
          properties: { messages: { type: 'array', items: { type: 'string' } } },
        },
        StartPageViewModel: {
          type: 'object',
          required: ['features'],
          properties: { features: { type: 'array', items: { type: 'string' } } },
        },
      },
    },
  };
}

describe('Screen Spec - ScreenContext extraction', () => {
  it('extracts screens from spec when screen mode is enabled', () => {
    const spec = createScreenSpec();
    const ctx = buildTemplateContext(spec, 'testScreens', { screen: true });

    expect(ctx.screens).toHaveLength(4);
  });

  it('returns empty screens when screen mode is disabled', () => {
    const spec = createScreenSpec();
    const ctx = buildTemplateContext(spec, 'testScreens', { screen: false });

    expect(ctx.screens).toHaveLength(0);
  });

  it('extracts correct screen properties', () => {
    const spec = createScreenSpec();
    const ctx = buildTemplateContext(spec, 'testScreens', { screen: true });

    const home = ctx.screens.find(s => s.screenConst === 'HOME')!;
    expect(home).toBeDefined();
    expect(home.route).toBe('/home');
    expect(home.screenId).toBe('SCR-001');
    expect(home.screenName).toBe('HomePage');
    expect(home.operationId).toBe('renderHomePage');
    expect(home.supportsBack).toBe(false);
    expect(home.viewModelSchema).toBe('HomePageViewModel');
    expect(home.requiresAuth).toBe(true);
  });

  it('extracts navigation links from response', () => {
    const spec = createScreenSpec();
    const ctx = buildTemplateContext(spec, 'testScreens', { screen: true });

    const home = ctx.screens.find(s => s.screenConst === 'HOME')!;
    expect(home.links).toHaveLength(2);
    expect(home.links[0]).toEqual({
      name: 'goToSettings',
      targetRoute: '/settings',
      targetOperationId: 'renderSettingsPage',
    });
    expect(home.links[1]).toEqual({
      name: 'goToChat',
      targetRoute: '/chat',
      targetOperationId: 'renderChatPage',
    });
  });

  it('extracts events with params', () => {
    const spec = createScreenSpec();
    const ctx = buildTemplateContext(spec, 'testScreens', { screen: true });

    const home = ctx.screens.find(s => s.screenConst === 'HOME')!;
    expect(home.events).toHaveLength(3);
    expect(home.events[0]).toEqual({
      name: 'home_view',
      type: 'screen_view',
      method: 'trackView',
    });
    expect(home.events[2]).toEqual({
      name: 'item_tap',
      type: 'user_action',
      method: 'trackItemTap',
      params: { item_id: 'string' },
    });
  });

  it('handles back navigation correctly', () => {
    const spec = createScreenSpec();
    const ctx = buildTemplateContext(spec, 'testScreens', { screen: true });

    const home = ctx.screens.find(s => s.screenConst === 'HOME')!;
    const settings = ctx.screens.find(s => s.screenConst === 'SETTINGS')!;
    expect(home.supportsBack).toBe(false);
    expect(settings.supportsBack).toBe(true);
  });

  it('detects auth requirement from security field', () => {
    const spec = createScreenSpec();
    const ctx = buildTemplateContext(spec, 'testScreens', { screen: true });

    const home = ctx.screens.find(s => s.screenConst === 'HOME')!;
    const start = ctx.screens.find(s => s.screenConst === 'START')!;
    expect(home.requiresAuth).toBe(true);
    expect(start.requiresAuth).toBe(false);
  });

  it('handles screens with no links', () => {
    const spec = createScreenSpec();
    const ctx = buildTemplateContext(spec, 'testScreens', { screen: true });

    const chat = ctx.screens.find(s => s.screenConst === 'CHAT')!;
    expect(chat.links).toHaveLength(0);
  });

  it('handles screens with no events', () => {
    const spec = createScreenSpec();
    const ctx = buildTemplateContext(spec, 'testScreens', { screen: true });

    const chat = ctx.screens.find(s => s.screenConst === 'CHAT')!;
    expect(chat.events).toHaveLength(0);
  });
});

describe('Screen Spec - Lint rules', () => {
  it('passes lint for valid screen spec in screen mode', () => {
    const spec = createScreenSpec();
    const result = lintSpec(spec, { screen: true });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('suppresses x-micro-contracts-service/method warnings in screen mode', () => {
    const spec = createScreenSpec();
    const result = lintSpec(spec, { screen: true });

    const serviceWarnings = result.warnings.filter(
      w => w.code === 'MISSING_X_SERVICE' || w.code === 'MISSING_X_METHOD'
    );
    expect(serviceWarnings).toHaveLength(0);
  });

  it('emits x-micro-contracts-service/method warnings for screen spec without screen mode', () => {
    const spec = createScreenSpec();
    const result = lintSpec(spec, { screen: false });

    const serviceWarnings = result.warnings.filter(
      w => w.code === 'MISSING_X_SERVICE' || w.code === 'MISSING_X_METHOD'
    );
    expect(serviceWarnings.length).toBeGreaterThan(0);
  });

  it('errors when x-screen-id present but x-screen-const missing', () => {
    const spec = createScreenSpec();
    delete (spec.paths['/home'].get as Record<string, unknown>)['x-screen-const'];

    const result = lintSpec(spec, { screen: true });

    expect(result.valid).toBe(false);
    const constErrors = result.errors.filter(e => e.code === 'SCREEN_MISSING_CONST');
    expect(constErrors).toHaveLength(1);
  });

  it('errors when x-screen-id present but x-screen-name missing', () => {
    const spec = createScreenSpec();
    delete (spec.paths['/home'].get as Record<string, unknown>)['x-screen-name'];

    const result = lintSpec(spec, { screen: true });

    expect(result.valid).toBe(false);
    const nameErrors = result.errors.filter(e => e.code === 'SCREEN_MISSING_NAME');
    expect(nameErrors).toHaveLength(1);
  });

  it('errors when x-screen-id present but operationId missing', () => {
    const spec = createScreenSpec();
    delete spec.paths['/home'].get!.operationId;

    const result = lintSpec(spec, { screen: true });

    expect(result.valid).toBe(false);
    const opIdErrors = result.errors.filter(e => e.code === 'SCREEN_MISSING_OPERATION_ID');
    expect(opIdErrors).toHaveLength(1);
  });

  it('errors on invalid x-events (not an array)', () => {
    const spec = createScreenSpec();
    (spec.paths['/home'].get as Record<string, unknown>)['x-events'] = 'not-an-array';

    const result = lintSpec(spec, { screen: true });

    expect(result.valid).toBe(false);
    const eventErrors = result.errors.filter(e => e.code === 'SCREEN_INVALID_EVENTS');
    expect(eventErrors).toHaveLength(1);
  });

  it('errors on x-events item missing required fields', () => {
    const spec = createScreenSpec();
    (spec.paths['/home'].get as Record<string, unknown>)['x-events'] = [
      { name: 'test_event' }, // missing type and method
    ];

    const result = lintSpec(spec, { screen: true });

    expect(result.valid).toBe(false);
    const eventErrors = result.errors.filter(e => e.code === 'SCREEN_INVALID_EVENT');
    expect(eventErrors).toHaveLength(1);
  });
});

describe('Screen Spec - Template rendering', () => {
  it('renders navigation template with screens context', () => {
    const spec = createScreenSpec();
    const ctx = buildTemplateContext(spec, 'testScreens', { screen: true });

    const templateSource = `{{#each screens}}
SCREEN: {{screenConst}} -> {{route}} ({{screenId}})
{{#each links}}
  LINK: {{name}} -> {{targetRoute}}
{{/each}}
{{/each}}`;

    const template = Handlebars.compile(templateSource);
    const output = template(ctx);

    expect(output).toContain('SCREEN: HOME -> /home (SCR-001)');
    expect(output).toContain('LINK: goToSettings -> /settings');
    expect(output).toContain('LINK: goToChat -> /chat');
    expect(output).toContain('SCREEN: SETTINGS -> /settings (SCR-002)');
  });

  it('renders events template with screens context', () => {
    const spec = createScreenSpec();
    const ctx = buildTemplateContext(spec, 'testScreens', { screen: true });

    const templateSource = `{{#each screens}}
{{#if events.length}}
{{screenName}} events:
{{#each events}}
  - {{method}}({{name}})
{{/each}}
{{/if}}
{{/each}}`;

    const template = Handlebars.compile(templateSource);
    const output = template(ctx);

    expect(output).toContain('HomePage events:');
    expect(output).toContain('- trackView(home_view)');
    expect(output).toContain('- trackSignOut(sign_out)');
    expect(output).toContain('SettingsPage events:');
  });
});

describe('Screen Spec - Module config', () => {
  it('resolves screen: true in module config', () => {
    const resolved = resolveModuleConfig('myScreens', {
      openapi: 'spec/screens/screens.yaml',
      screen: true,
    });

    expect(resolved.screen).toBe(true);
  });

  it('resolves screen: false by default', () => {
    const resolved = resolveModuleConfig('api', {
      openapi: 'spec/api/openapi.yaml',
    });

    expect(resolved.screen).toBe(false);
  });
});
