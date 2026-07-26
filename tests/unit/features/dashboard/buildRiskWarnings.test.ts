import { describe, expect, it } from 'vitest';

import {
  buildRiskWarnings,
  type DashboardFreshness,
  type HealthFactorStatus,
} from '@/features/dashboard';

/**
 * Risk Warning builder — 06_TASKS.md M5-010. Only 3 of the 6 documented
 * "Warning cases" are covered — see `../types/riskWarnings.ts` for why
 * the other 3 (near-liquidation proximity, invalid protocol parameters,
 * high interest burden) remain blocked or structurally unreachable.
 */
function baseHealthFactorStatus(overrides: Partial<HealthFactorStatus> = {}): HealthFactorStatus {
  return {
    currentHealthFactor: 4,
    formattedCurrentHealthFactor: '4',
    configuredTarget: null,
    formattedConfiguredTarget: null,
    distanceFromTarget: null,
    formattedDistanceFromTarget: null,
    explanation: 'No target Health Factor is configured for this portfolio.',
    requiredActions: null,
    ...overrides,
  };
}

function freshMarket(): DashboardFreshness {
  return {
    market: {
      price: 50000,
      formattedPrice: '$50,000.00',
      origin: 'manual',
      freshness: 'fresh',
      updatedAt: '2026-01-01T00:00:00.000Z',
      formattedUpdatedAt: 'Jan 1, 2026, 12:00 AM',
    },
    protocol: null,
  };
}

describe('buildRiskWarnings — no conditions active', () => {
  it('returns an empty array', () => {
    const warnings = buildRiskWarnings(baseHealthFactorStatus(), freshMarket(), []);
    expect(warnings).toEqual([]);
  });
});

describe('buildRiskWarnings — Health Factor below configured target', () => {
  it('adds HEALTH_FACTOR_BELOW_TARGET only when distance is negative', () => {
    const status = baseHealthFactorStatus({
      configuredTarget: 5,
      formattedConfiguredTarget: '5',
      distanceFromTarget: -1,
    });
    const warnings = buildRiskWarnings(status, freshMarket(), []);
    expect(warnings.map((w) => w.code)).toContain('HEALTH_FACTOR_BELOW_TARGET');
  });

  it('does not add it when the target is already met', () => {
    const status = baseHealthFactorStatus({
      configuredTarget: 1,
      formattedConfiguredTarget: '1',
      distanceFromTarget: 3,
    });
    const warnings = buildRiskWarnings(status, freshMarket(), []);
    expect(warnings.map((w) => w.code)).not.toContain('HEALTH_FACTOR_BELOW_TARGET');
  });
});

describe('buildRiskWarnings — missing or stale price data', () => {
  it('adds PRICE_DATA_MISSING when market freshness is null', () => {
    const warnings = buildRiskWarnings(
      baseHealthFactorStatus(),
      { market: null, protocol: null },
      [],
    );
    expect(warnings.map((w) => w.code)).toContain('PRICE_DATA_MISSING');
  });

  it('adds PRICE_DATA_STALE when the market quote is stale', () => {
    const freshness = freshMarket();
    if (freshness.market !== null) freshness.market.freshness = 'stale';
    const warnings = buildRiskWarnings(baseHealthFactorStatus(), freshness, []);
    expect(warnings.map((w) => w.code)).toContain('PRICE_DATA_STALE');
  });

  it('adds neither when the price is fresh', () => {
    const warnings = buildRiskWarnings(baseHealthFactorStatus(), freshMarket(), []);
    expect(warnings.map((w) => w.code)).not.toContain('PRICE_DATA_MISSING');
    expect(warnings.map((w) => w.code)).not.toContain('PRICE_DATA_STALE');
  });
});

describe('buildRiskWarnings — calculation warnings pass through', () => {
  it('adds one RiskWarning per ServiceWarning, using the warning’s own code and message', () => {
    const warnings = buildRiskWarnings(baseHealthFactorStatus(), freshMarket(), [
      { code: 'NO_DEBT', message: 'This portfolio has no debt.' },
    ]);
    expect(warnings).toContainEqual(
      expect.objectContaining({ code: 'NO_DEBT', reason: 'This portfolio has no debt.' }),
    );
  });
});

describe('buildRiskWarnings — every warning has a reason and a recommended action (M5-010 DoD)', () => {
  it('never returns a warning missing either field', () => {
    const status = baseHealthFactorStatus({
      configuredTarget: 5,
      formattedConfiguredTarget: '5',
      distanceFromTarget: -1,
    });
    const warnings = buildRiskWarnings(status, { market: null, protocol: null }, [
      { code: 'NO_DEBT', message: 'This portfolio has no debt.' },
    ]);
    expect(warnings.length).toBeGreaterThan(0);
    for (const warning of warnings) {
      expect(warning.reason.length).toBeGreaterThan(0);
      expect(warning.recommendedAction.length).toBeGreaterThan(0);
    }
  });
});
