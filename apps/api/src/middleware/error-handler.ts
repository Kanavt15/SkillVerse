/**
 * Converts anything thrown in a handler into the standard error body
 * (`ApiErrorBody` in @skillverse/shared), and handles unknown routes.
 */
import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ApiErrorBody, ErrorCode } from '@skillverse/shared';
import type { AppEnv } from '../env';
import { AppError } from '../lib/errors';

function body(
  c: Context<AppEnv>,
  code: ErrorCode,
  message: string,
  fields?: Record<string, string[]>,
): ApiErrorBody {
  return {
    ok: false,
    error: { code, message, ...(fields ? { fields } : {}), requestId: c.get('requestId') },
  };
}

/** Maps an HTTP status from Hono's own exceptions (e.g. body-limit's 413) to our codes. */
const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
};

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  let cause: unknown = err;
  for (let depth = 0; depth < 5 && cause instanceof Error; depth++) {
    if (cause.message.includes('TEACHER_VERIFICATION'))
      return c.json(
        body(
          c,
          'FORBIDDEN',
          'Complete or renew your DigiLocker teacher verification in Settings before teaching.',
        ),
        403,
      );
    if (cause.message.includes('PRIVACY_ELIGIBILITY'))
      return c.json(
        body(
          c,
          'FORBIDDEN',
          'Account eligibility or guardian permission changed. Confirm consent in Privacy settings.',
        ),
        403,
      );
    if (cause.message.includes('PRIVACY_BIRTH_IMMUTABLE'))
      return c.json(body(c, 'CONFLICT', 'Use Contact for a verified birth date correction.'), 409);
    if (cause.message.includes('COURSE_REVIEW_LOCK'))
      return c.json(
        body(c, 'CONFLICT', 'This course entered review. Withdraw it before editing.'),
        409,
      );
    cause = cause.cause;
  }
  if (err instanceof AppError) {
    return c.json(body(c, err.code, err.message, err.fields), err.status as ContentfulStatusCode);
  }
  if (err instanceof HTTPException && STATUS_TO_CODE[err.status]) {
    return c.json(
      body(c, STATUS_TO_CODE[err.status]!, err.message || 'Request rejected'),
      err.status,
    );
  }

  // Unexpected: a bug or an outage. Log everything, reveal nothing.
  c.get('log')?.error('unhandled_error', {
    name: err.name,
    message: 'Unexpected request failure; inspect server code using the request ID.',
  });
  return c.json(body(c, 'INTERNAL', 'Something went wrong. Please try again.'), 500);
};

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) =>
  c.json(body(c, 'NOT_FOUND', 'Route not found.'), 404);
