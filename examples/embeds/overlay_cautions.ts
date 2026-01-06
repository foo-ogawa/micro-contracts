/**
 * overlay_cautions Embed
 * Extracts and displays cautions from middleware.overlay.yaml
 */

import { defineEmbed } from 'embedoc';

interface Caution {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

interface MiddlewareOverlay {
  'x-micro-contracts-cautions'?: Caution[];
}

const severityEmoji: Record<string, string> = {
  error: '🚨',
  warning: '⚠️',
  info: 'ℹ️',
};

const severityBadge: Record<string, string> = {
  error: '**[CRITICAL]**',
  warning: '**[WARNING]**',
  info: '**[INFO]**',
};

export default defineEmbed({
  dependsOn: ['middleware_overlay'],

  async render(ctx) {
    const data = await ctx.datasources['middleware_overlay']!.getAll();
    
    if (data.length === 0) {
      return { content: '⚠️ Overlay file not found' };
    }

    const overlay = data[0] as unknown as MiddlewareOverlay;
    const cautions = overlay['x-micro-contracts-cautions'];

    if (!cautions || cautions.length === 0) {
      return { content: 'No cautions defined.' };
    }

    const lines: string[] = [];

    for (const caution of cautions) {
      const emoji = severityEmoji[caution.severity] || 'ℹ️';
      const badge = severityBadge[caution.severity] || '';
      
      lines.push(`### ${emoji} ${caution.title}`);
      lines.push('');
      lines.push(`${badge}`);
      lines.push('');
      // Output each line of the message as-is (preserve indentation)
      lines.push(caution.message.trim());
      lines.push('');
    }

    return { content: lines.join('\n') };
  },
});

