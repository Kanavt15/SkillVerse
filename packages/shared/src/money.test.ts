import { describe, expect, it } from 'vitest';
import { formatMoney, rupeesToPaise, splitAmount } from './money';

describe('rupeesToPaise', () => {
  it('converts without float error', () => {
    expect(rupeesToPaise('4.35')).toBe(435); // 4.35 * 100 would give 434.99999999999994
    expect(rupeesToPaise('499')).toBe(49900);
    expect(rupeesToPaise('0.5')).toBe(50);
  });

  it('rejects malformed or negative input', () => {
    for (const bad of ['-1', '1.234', 'abc', '', '1e3']) {
      expect(() => rupeesToPaise(bad)).toThrow(RangeError);
    }
  });
});

describe('splitAmount', () => {
  it('never creates or loses a paisa', () => {
    for (const amount of [0, 1, 99, 49_900, 123_457]) {
      for (const bps of [0, 500, 1500, 3000, 10_000]) {
        const { platform, seller } = splitAmount(amount, bps);
        expect(platform + seller).toBe(amount);
        expect(platform).toBeGreaterThanOrEqual(0);
        expect(seller).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('applies the 70/30 default split', () => {
    expect(splitAmount(49_900, 3000)).toEqual({ platform: 14_970, seller: 34_930 });
  });

  it('rounds the platform fee down in favour of the seller', () => {
    expect(splitAmount(101, 3000)).toEqual({ platform: 30, seller: 71 });
  });

  it('rejects invalid inputs', () => {
    expect(() => splitAmount(1.5, 3000)).toThrow(RangeError);
    expect(() => splitAmount(-1, 3000)).toThrow(RangeError);
    expect(() => splitAmount(100, 10_001)).toThrow(RangeError);
  });
});

describe('formatMoney', () => {
  it('formats INR in the Indian style', () => {
    expect(formatMoney(49_900)).toBe('₹499');
    expect(formatMoney(12_345_050)).toBe('₹1,23,450.50');
  });
});
