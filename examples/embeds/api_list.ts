/**
 * api_list Embed
 * Extracts API list from OpenAPI spec and displays as a table
 */

import { defineEmbed } from 'embedoc';

interface OpenAPIOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  'x-micro-contracts-domain'?: string;
  'x-micro-contracts-method'?: string;
  'x-micro-contracts-published'?: boolean;
  'x-middleware'?: string[];
  tags?: string[];
}

interface OpenAPISpec {
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, Record<string, OpenAPIOperation>>;
}

export default defineEmbed({
  dependsOn: ['core_spec', 'billing_spec'],

  async render(ctx) {
    const module = ctx.params['module'] || 'all';
    const specs: { name: string; spec: OpenAPISpec }[] = [];

    // Load specs based on module parameter
    if (module === 'all' || module === 'core') {
      const coreData = await ctx.datasources['core_spec']!.getAll();
      if (coreData.length > 0) {
        specs.push({ name: 'core', spec: coreData[0] as unknown as OpenAPISpec });
      }
    }
    if (module === 'all' || module === 'billing') {
      const billingData = await ctx.datasources['billing_spec']!.getAll();
      if (billingData.length > 0) {
        specs.push({ name: 'billing', spec: billingData[0] as unknown as OpenAPISpec });
      }
    }

    if (specs.length === 0) {
      return { content: '⚠️ No specs found' };
    }

    const rows: string[][] = [];
    const httpMethods = ['get', 'post', 'put', 'patch', 'delete'];

    for (const { name: moduleName, spec } of specs) {
      for (const [path, pathItem] of Object.entries(spec.paths || {})) {
        for (const method of httpMethods) {
          const operation = pathItem[method] as OpenAPIOperation | undefined;
          if (!operation) continue;

          const middlewares = operation['x-middleware'] || [];
          const isPublished = operation['x-micro-contracts-published'] ? '✅' : '';
          const domain = operation['x-micro-contracts-domain'] || '';
          const domainMethod = operation['x-micro-contracts-method'] || '';
          
          // Implementation file link
          const implFile = `server/src/${moduleName}/domains/${domain}.ts`;

          rows.push([
            moduleName,
            method.toUpperCase(),
            path,
            operation.summary || '',
            isPublished,
            middlewares.join(', '),
            ctx.markdown.link(`${domain}.${domainMethod}`, implFile),
          ]);
        }
      }
    }

    if (rows.length === 0) {
      return { content: '⚠️ No API endpoints found' };
    }

    const table = ctx.markdown.table(
      ['Module', 'Method', 'Path', 'Summary', 'Public', 'Middleware', 'Implementation'],
      rows
    );

    return { content: table };
  },
});

