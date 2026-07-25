import { describe, expect, it } from 'vitest';

import { resolveScenarioPrice } from '@/engine/simulation/resolveScenarioPrice';

describe('resolveScenarioPrice (F-051)', () => {
  it('matches the documented example: BTC $60,000, +25% -> $75,000', () => {
    const result = resolveScenarioPrice(60000, {
      type: 'percentageChange',
      percentageChange: 0.25,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(75000);
      expect(result.metadata.formulaId).toBe('F-051');
    }
  });

  it('matches the documented example: BTC $60,000, -20% -> $48,000', () => {
    const result = resolveScenarioPrice(60000, {
      type: 'percentageChange',
      percentageChange: -0.2,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(48000);
  });

  it('passes through an absolute price scenario unchanged', () => {
    const result = resolveScenarioPrice(60000, { type: 'absolute', btcPriceUsd: 90000 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(90000);
  });

  it('rejects a percentage change that would drop the price to zero or below', () => {
    const result = resolveScenarioPrice(60000, { type: 'percentageChange', percentageChange: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_PERCENTAGE_CHANGE');
  });

  it('rejects a non-positive absolute scenario price', () => {
    const result = resolveScenarioPrice(60000, { type: 'absolute', btcPriceUsd: 0 });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-positive current price', () => {
    const result = resolveScenarioPrice(0, { type: 'absolute', btcPriceUsd: 90000 });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-finite percentage change', () => {
    const result = resolveScenarioPrice(60000, {
      type: 'percentageChange',
      percentageChange: NaN,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_FINITE');
  });
});
