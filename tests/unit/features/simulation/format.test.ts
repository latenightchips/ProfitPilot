import { describe, expect, it } from 'vitest';

import { formatCurrency, formatHealthFactor, formatLeverage } from '@/features/simulation';

/**
 * Simulation formatting helpers — 06_TASKS.md M6-009 ("Implement
 * Scenario Summary"). Same behavior as
 * `tests/unit/features/dashboard/format.test.ts` (Milestone 5) exercises
 * for the identical Dashboard formatters — `Infinity`/`NaN` guard
 * branches are checked directly here, not only incidentally through
 * `ScenarioSummary.test.tsx`.
 */
describe('formatCurrency', () => {
  it('formats a finite USD value', () => {
    expect(formatCurrency(80000)).toBe('$80,000.00');
  });

  it('renders non-finite values as an em dash', () => {
    expect(formatCurrency(Infinity)).toBe('—');
    expect(formatCurrency(NaN)).toBe('—');
  });
});

describe('formatHealthFactor', () => {
  it('formats a finite value at 2 decimals', () => {
    expect(formatHealthFactor(4)).toBe('4');
    expect(formatHealthFactor(1.845)).toBe('1.85');
  });

  it('renders Infinity as "∞" (zero-debt Health Factor / Liquidation Distance)', () => {
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

  it('renders non-finite values as an em dash', () => {
    expect(formatLeverage(Infinity)).toBe('—');
    expect(formatLeverage(NaN)).toBe('—');
  });
});
