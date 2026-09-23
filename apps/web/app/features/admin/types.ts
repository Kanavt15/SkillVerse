/** Data carried by errors thrown from admin loaders (see staff-api.server.ts). */
export interface AdminErrorData {
  reason: 'mfa' | 'error';
  message: string;
}

export function isAdminErrorData(value: unknown): value is AdminErrorData {
  return Boolean(value && typeof value === 'object' && 'reason' in value && 'message' in value);
}
