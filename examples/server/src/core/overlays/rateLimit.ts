/**
 * rateLimit middleware implementation
 * Framework-agnostic rate limiting
 */

import type { 
  RateLimitOverlayInput, 
  OverlayResult 
} from '@project/contract/core/overlays/index.js';

// Simple in-memory rate limit store (in real app: Redis)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT = 100;
const WINDOW_MS = 60000; // 1 minute

/**
 * Applies rate limiting
 * Note: Rate limit headers in input are response headers (not used for limiting)
 */
export async function rateLimit(_input: RateLimitOverlayInput): Promise<OverlayResult> {
  const clientId = 'anonymous'; // In real app: extract from context
  const now = Date.now();
  
  let record = requestCounts.get(clientId);
  
  if (!record || record.resetAt < now) {
    record = { count: 0, resetAt: now + WINDOW_MS };
    requestCounts.set(clientId, record);
  }
  
  record.count++;
  
  const remaining = Math.max(0, RATE_LIMIT - record.count);
  
  if (record.count > RATE_LIMIT) {
    return {
      success: false,
      error: {
        status: 429,
        message: 'Rate limit exceeded',
        code: 'rate_limit_exceeded',
      },
    };
  }

  return {
    success: true,
    context: {
      rateLimitHeaders: {
        'X-RateLimit-Limit': String(RATE_LIMIT),
        'X-RateLimit-Remaining': String(remaining),
      },
    },
  };
}
