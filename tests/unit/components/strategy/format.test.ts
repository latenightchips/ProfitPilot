import { describe, expect, it } from 'vitest';

import {
  formatCurrency,
  formatHealthFactor,
  formatLeverage,
  formatPercent,
} from '@/components/strategy/format';

/**
 * `components/strategy/format.ts` — same values/behavior as
 * `features/dashboard/utils/format.ts`/`features/simulation/utils/format.ts`
 * (see that file's own header comment), so these tests mirror those
 * modules' own `format.test.ts` coverage rather than re-deriving new
 * expectations. V1.1 Batch 4 adds the `formatHealthFactor` NaN guard and
 * the `formatPercent` finite guard this file previously lacked relative to
 * its two siblings.
 */
describe('formatCurrency', () => {
  it('formats a finite value as USD', () => {
    expect(formatCurrency(100000)).toBe('$100,000.00');
  });

  it('renders non-finite values as an em dash', () => {
    expect(formatCurrency(Infinity)).toBe('—');
  });
});

describe('formatHealthFactor', () => {
  it('formats a finite value at 2 decimals', () => {
    expect(formatHealthFactor(4)).toBe('4');
    expect(formatHealthFactor(1.845)).toBe('1.85');
  });

  it('renders Infinity as "∞" (zero-debt Health Factor)', () => {
    expect(formatHealthFactor(Infinity)).toBe('∞');
  });

  it('V1.1 Batch 4: renders NaN as an em dash rather than the literal string "NaN"', () => {
    expect(formatHealthFactor(NaN)).toBe('—');
  });
});

describe('formatLeverage', () => {
  it('formats a finite value with a trailing "x"', () => {
    expect(formatLeverage(1.25)).toBe('1.25x');
  });

  it('V1.1 Batch 4: renders 0 as "0x", not an em dash (a valid full-exit leverage value)', () => {
    expect(formatLeverage(0)).toBe('0x');
  });

  it('renders non-finite values as an em dash', () => {
    expect(formatLeverage(Infinity)).toBe('—');
  });
});

describe('formatPercent', () => {
  it('formats a 0-1 fraction as a percentage', () => {
    expect(formatPercent(0.2)).toBe('20.00%');
  });

  it('V1.1 Batch 4: renders non-finite values as an em dash, matching its sibling modules', () => {
    expect(formatPercent(Infinity)).toBe('—');
    expect(formatPercent(NaN)).toBe('—');
  });
});
