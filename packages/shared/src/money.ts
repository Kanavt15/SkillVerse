/**
 * Money helpers.
 *
 * RULE: money is ALWAYS an integer number of the smallest currency unit
 * (paise for INR, cents for USD). Never use floats for money: 0.1 + 0.2 !== 0.3.
 * Percentages are expressed in basis points (1 bp = 0.01%, 10_000 bp = 100%)
 * so that every calculation stays in integers.
 *
 * Exports: Currency, assertMinorUnits, rupeesToPaise, formatMoney, splitAmount.
 */

export const CURRENCIES = ['INR', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** 100% expressed in basis points. */
export const BPS_DENOMINATOR = 10_000;

/**
 * Throws if `value` is not a safe, non-negative integer amount.
 * Call this at trust boundaries (webhooks, admin input) before doing arithmetic.
 */
export function assertMinorUnits(value: number, label = 'amount'): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer in minor units, got ${value}`);
  }
}

/**
 * Converts a rupee amount typed by a human (e.g. "499.50") into paise.
 * String parsing avoids float error: 4.35 * 100 === 434.99999999999994 in JS.
 */
export function rupeesToPaise(rupees: string | number): number {
  const text = String(rupees).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new RangeError(`Invalid rupee amount: "${text}"`);
  }
  const [whole, fraction = ''] = text.split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  assertMinorUnits(paise);
  return paise;
}

/** Formats minor units for display, e.g. 49900 INR → "₹499". Paise are shown only when non-zero. */
export function formatMoney(minor: number, currency: Currency = 'INR', locale = 'en-IN'): string {
  const major = minor / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}

export interface Split {
  /** What the platform keeps. */
  platform: number;
  /** What the seller (instructor/mentor) earns. */
  seller: number;
}

/**
 * Splits an amount between the platform and the seller.
 *
 * The platform fee is rounded DOWN and the seller receives the remainder, so
 * `platform + seller === amount` always holds. No paisa is created or lost,
 * which the double-entry ledger depends on.
 *
 * @param amount          total in minor units
 * @param platformFeeBps  platform commission in basis points (3000 = 30%)
 */
export function splitAmount(amount: number, platformFeeBps: number): Split {
  assertMinorUnits(amount);
  if (!Number.isInteger(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > BPS_DENOMINATOR) {
    throw new RangeError(`platformFeeBps must be an integer 0..${BPS_DENOMINATOR}`);
  }
  const platform = Math.floor((amount * platformFeeBps) / BPS_DENOMINATOR);
  return { platform, seller: amount - platform };
}
