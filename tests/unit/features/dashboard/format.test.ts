import { describe, expect, it } from 'vitest';

import {
  formatCurrency,
  formatDateTime,
  formatHealthFactor,
  formatLeverage,
  formatNumber,
  formatPercent,
  formatPercentagePoints,
  formatSaveStatus,
} from '@/features/dashboard';

/**
 * Dashboard formatting helpers — part of M5-003's "Formatted values" and
 * M5-004's "Storage status" Display items. `Infinity`/`NaN` guard
 * branches and every `PortfolioSaveStatus` case are exercised directly
 * here rather than only incidentally through component tests, so a
 * future change to any one status's wording fails loudly.
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
  it('formats a finite value at 2 decimals (Conflict #6)', () => {
    expect(formatHealthFactor(4)).toBe('4');
    expect(formatHealthFactor(1.845)).toBe('1.85');
  });

  it('renders Infinity as "∞" (zero-debt Health Factor, M2-009)', () => {
    expect(formatHealthFactor(Infinity)).toBe('∞');
  });
});

describe('formatNumber', () => {
  it('formats a finite ratio at 2 decimals (F-023 Distance to Liquidation)', () => {
    expect(formatNumber(3)).toBe('3');
  });

  it('delegates to formatHealthFactor for Infinity', () => {
    expect(formatNumber(Infinity)).toBe('∞');
  });
});

describe('formatPercent', () => {
  it('formats a 0-1 fraction as a percentage (F-020 LTV)', () => {
    expect(formatPercent(0.2)).toBe('20%');
  });

  it('renders non-finite values as an em dash', () => {
    expect(formatPercent(Infinity)).toBe('—');
  });
});

describe('formatPercentagePoints', () => {
  it('divides an already-×100-scaled value before formatting (F-025 Liquidation Buffer)', () => {
    expect(formatPercentagePoints(75)).toBe('75%');
  });

  it('renders non-finite values as an em dash', () => {
    expect(formatPercentagePoints(Infinity)).toBe('—');
  });
});

describe('formatLeverage', () => {
  it('formats a finite ratio with a trailing "x"', () => {
    expect(formatLeverage(1.25)).toBe('1.25x');
  });

  it('renders non-finite values as an em dash', () => {
    expect(formatLeverage(Infinity)).toBe('—');
  });
});

describe('formatDateTime', () => {
  it('formats an ISO timestamp', () => {
    expect(formatDateTime('2026-01-01T00:00:00.000Z')).toEqual(expect.any(String));
  });
});

describe('formatSaveStatus (M5-004)', () => {
  it('covers every PortfolioSaveStatus value with the same wording app/portfolio/page.tsx uses', () => {
    expect(formatSaveStatus('idle')).toBe('No changes yet');
    expect(formatSaveStatus('saving')).toBe('Saving…');
    expect(formatSaveStatus('saved')).toBe('Saved');
    expect(formatSaveStatus('error')).toBe('Error saving');
    expect(formatSaveStatus('offline')).toBe('Offline');
  });
});
