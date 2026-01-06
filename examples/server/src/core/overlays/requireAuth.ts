/**
 * requireAuth middleware implementation
 * Framework-agnostic authentication check
 */

import type { 
  RequireAuthOverlayInput, 
  OverlayResult 
} from '@project/contract/core/overlays/index.js';

/**
 * Validates authorization header and extracts user context
 */
export async function requireAuth(input: RequireAuthOverlayInput): Promise<OverlayResult> {
  const authHeader = input['Authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      error: {
        status: 401,
        message: 'Missing or invalid authorization header',
        code: 'unauthorized',
      },
    };
  }

  // In real app: validate JWT token and extract user info
  const token = authHeader.slice(7);
  
  // Mock: extract role from token for demo
  const isAdmin = token.includes('admin');
  
  return {
    success: true,
    context: {
      userId: 'user-123',
      role: isAdmin ? 'admin' : 'user',
    },
  };
}
