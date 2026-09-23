/**
 * The error contract between the API and its clients.
 *
 * Every error response from the API has the shape `ApiErrorBody`. Clients
 * branch on `code` (stable, machine-readable), never on `message`, which is
 * human text and may change or be translated.
 */

export const ERROR_CODES = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  EMAIL_NOT_VERIFIED: 403,
  MFA_SETUP_REQUIRED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface ApiErrorBody {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    /** Field-level problems for VALIDATION_FAILED. Keys are dotted paths, e.g. "profile.bio". */
    fields?: Record<string, string[]>;
    /** Quote this when reporting a problem; it links to the server log line. */
    requestId?: string;
  };
}

export interface ApiSuccessBody<T> {
  ok: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccessBody<T> | ApiErrorBody;
