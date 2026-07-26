import { beforeEach, describe, expect, it } from 'vitest';

import { buildHealthFactorStatus } from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Health Factor Status builder — 06_TASKS.md M5-007. "Risk
 * classification" is deliberately not covered here — it is not built at
 * all (Conflict #1); see `../types/healthFactorStatus.ts`.
 */
beforeEach(() => {
  usePortfolioStore.setState({
    portfolios: {},
    activePortfolioId: null,
    loadStatus: 'idle',
    saveStatus: 'idle',
    errors: [],
    lastSynchronizedAt: null,
  });
});

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    settings: {},
    ...overrides,
  };
}

function createAndGetSummary(overrides: Record<string, unknown> = {}) {
  const created = usePortfolioStore.getState().create(validInput(overrides));
  if (!created.ok) throw new Error('setup failed');
  const record = usePortfolioStore.getState().portfolios[created.data.id];
  if (!record.summary.ok) throw new Error('expected a successful summary');
  return { portfolio: record.portfolio, summary: record.summary.data };
}

describe('buildHealthFactorStatus — no target configured', () => {
  it('reports the current Health Factor with a null target, distance, and required actions', () => {
    const { portfolio, summary } = createAndGetSummary();

    const status = buildHealthFactorStatus(portfolio, summary);

    expect(status.currentHealthFactor).toBe(4);
    expect(status.formattedCurrentHealthFactor).toBe('4');
    expect(status.configuredTarget).toBeNull();
    expect(status.distanceFromTarget).toBeNull();
    expect(status.requiredActions).toBeNull();
    expect(status.explanation).toBe('No target Health Factor is configured for this portfolio.');
  });
});

describe('buildHealthFactorStatus — target configured, below target', () => {
  it('computes distance from target and both real, non-invented required actions', () => {
    const { portfolio, summary } = createAndGetSummary({
      settings: { safetyTargets: { targetHealthFactor: 5 } },
    });

    const status = buildHealthFactorStatus(portfolio, summary);

    expect(status.configuredTarget).toBe(5);
    expect(status.distanceFromTarget).toBe(-1); // 4 - 5
    expect(status.explanation).toBe('Health Factor is below your configured target.');
    expect(status.requiredActions).not.toBeNull();
    expect(status.requiredActions?.repayment).not.toBe('No repayment needed.');
    expect(status.requiredActions?.additionalCollateral).not.toBe(
      'No additional collateral needed.',
    );
  });
});

describe('buildHealthFactorStatus — target configured, already met', () => {
  it('reports "no action needed" for both restoration paths', () => {
    const { portfolio, summary } = createAndGetSummary({
      settings: { safetyTargets: { targetHealthFactor: 1 } },
    });

    const status = buildHealthFactorStatus(portfolio, summary);

    expect(status.explanation).toBe('Health Factor is above your configured target.');
    expect(status.requiredActions?.repayment).toBe('No repayment needed.');
    expect(status.requiredActions?.additionalCollateral).toBe('No additional collateral needed.');
  });
});

describe('buildHealthFactorStatus — zero-debt portfolio (Conflict #20)', () => {
  it('handles an Infinity Health Factor without crashing, and reports it as above any finite target', () => {
    const { portfolio, summary } = createAndGetSummary({
      debt: { asset: 'USDC', balance: 0 },
      settings: { safetyTargets: { targetHealthFactor: 2 } },
    });

    const status = buildHealthFactorStatus(portfolio, summary);

    expect(status.currentHealthFactor).toBe(Infinity);
    expect(status.formattedCurrentHealthFactor).toBe('∞');
    expect(status.explanation).toBe('Health Factor is above your configured target.');
  });
});
