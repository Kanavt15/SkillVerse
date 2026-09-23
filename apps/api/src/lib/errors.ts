/**
 * `AppError`: the ONLY way application code should signal an expected failure.
 *
 *   throw new AppError('NOT_FOUND', 'Course not found');
 *
 * The global error handler (middleware/error-handler.ts) turns it into the
 * standard JSON error body with the right HTTP status. Anything that is not an
 * AppError is treated as a bug: logged in full, and returned to the client as
 * a generic 500 so internals (SQL, stack traces, file paths) never leak.
 */
import { ERROR_CODES, type ErrorCode } from '@skillverse/shared';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string[]>;

  constructor(code: ErrorCode, message: string, fields?: Record<string, string[]>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_CODES[code];
    this.fields = fields;
  }
}
