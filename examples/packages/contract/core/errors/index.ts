/**
 * Error types
 * Auto-generated - DO NOT EDIT
 */

// Re-export ProblemDetails from schemas (RFC 9457)
export type { ProblemDetails, ValidationError } from '../schemas/types.js';
import type { ProblemDetails } from '../schemas/types.js';

/**
 * API Error wrapper
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: ProblemDetails,
    public readonly requestId?: string,
  ) {
    super(problem.title);
    this.name = 'ApiError';
  }

  get isValidationError(): boolean {
    return this.status === 400;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}
