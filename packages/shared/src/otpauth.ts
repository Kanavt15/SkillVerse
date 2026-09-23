/**
 * Builds the otpauth:// URI that authenticator apps scan from a QR code
 * (Google "Key Uri Format"). Shared so the API and the website produce the same URI.
 */
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;

/** A base32 TOTP secret as issued by the API (20 bytes → 32 characters). */
export const TOTP_SECRET_PATTERN = /^[A-Z2-7]{32}$/;

export function otpauthUri(issuer: string, account: string, secretBase32: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
