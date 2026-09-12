import { describe, expect, it } from 'vitest';

import {
  buildSafetyTargetsStatus,
  formatSafetyTargetStatusLabel,
  isValidSafetyBufferTarget,
  type SafetyTargetComparison,
} from '@/services/portfolio/safetyTargetsStatus';
import { calculatePortfolioSummary } from '@/services/portfolio/summary';
import type { Portfolio } from '@/types/portfolio';

/**
 * Safety Targets Status — v1.23.0 Batch 1 ("Portfolio Page Safety
 * Targets Status Panel"). Canonical comparison logic:
 * `services/portfolio/safetyTargetsStatus.ts`'s own header comment for
 * the full "met iff current >= target" directional-evidence citation
 * (`docs/03_UI.md` C-007/C-008/C-012/C-013 + the Auto Loop Engine
 * section).
 *
 * Fixture portfolio (2 BTC @ $50,000, $20,000 debt, 75%/80%
 * LTV/liquidation-threshold) chosen to match
 * `tests/unit/services/portfolio/summary.test.ts`'s own fixture exactly
 * — `healthFactor: 4`, `liquidation: { price: 12500, buffer: 75, ... }`
 * — so this file's own expectations can be cross-checked against that
 * file's already-asserted values rather than recomputed independently.
 */
function basePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'portfolio-1',
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
    archivedAt: null,
    marketUpdatedAt: '2026-01-01T00:00:00.000Z',
    protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const NOW = new Date('2026-04-11T00:00:00.000Z'); // 100 days after 2026-01-01

describe('buildSafetyTargetsStatus — all targets configured', () => {
  it('reports "met" for every field when current values clear their targets', () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: {
          targetHealthFactor: 2,
          targetBtcPriceUsd: 40000,
          safetyBufferPercent: 50,
          holdingPeriodDays: 30,
        },
      },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.targetHealthFactor).toEqual({ status: 'met', target: 2, current: 4 });
    expect(status.targetBtcPriceUsd).toEqual({ status: 'met', target: 40000, current: 50000 });
    expect(status.safetyBufferPercent).toEqual({ status: 'met', target: 50, current: 75 });
    expect(status.holdingPeriodDays).toEqual({ status: 'met', target: 30, current: 100 });
  });

  it('reports "not_met" for every field when current values fall short of their targets', () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: {
          targetHealthFactor: 5,
          targetBtcPriceUsd: 60000,
          safetyBufferPercent: 90,
          holdingPeriodDays: 365,
        },
      },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.targetHealthFactor).toEqual({ status: 'not_met', target: 5, current: 4 });
    expect(status.targetBtcPriceUsd).toEqual({ status: 'not_met', target: 60000, current: 50000 });
    expect(status.safetyBufferPercent).toEqual({ status: 'not_met', target: 90, current: 75 });
    expect(status.holdingPeriodDays).toEqual({ status: 'not_met', target: 365, current: 100 });
  });
});

describe('buildSafetyTargetsStatus — all targets absent', () => {
  it('reports "not_configured" for every field, while still reporting the real current value', () => {
    const portfolio = basePortfolio({ settings: {} });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.targetHealthFactor).toEqual({
      status: 'not_configured',
      target: null,
      current: 4,
    });
    expect(status.targetBtcPriceUsd).toEqual({
      status: 'not_configured',
      target: null,
      current: 50000,
    });
    expect(status.safetyBufferPercent).toEqual({
      status: 'not_configured',
      target: null,
      current: 75,
    });
    expect(status.holdingPeriodDays).toEqual({
      status: 'not_configured',
      target: null,
      current: 100,
    });
  });
});

describe('buildSafetyTargetsStatus — partial configuration', () => {
  it('treats each of the four fields independently', () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: {
          targetHealthFactor: 2,
          // targetBtcPriceUsd, safetyBufferPercent, holdingPeriodDays left unset
        },
      },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.targetHealthFactor.status).toBe('met');
    expect(status.targetBtcPriceUsd.status).toBe('not_configured');
    expect(status.safetyBufferPercent.status).toBe('not_configured');
    expect(status.holdingPeriodDays.status).toBe('not_configured');
  });
});

describe('buildSafetyTargetsStatus — valid zero preservation', () => {
  it('holdingPeriodDays: target 0 is met immediately (elapsed >= 0 is always true), never treated as absent', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { holdingPeriodDays: 0 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.holdingPeriodDays).toEqual({ status: 'met', target: 0, current: 100 });
  });

  it('holdingPeriodDays: current 0 (established today) against a positive target is not_met, never treated as absent', () => {
    const portfolio = basePortfolio({
      establishedAt: NOW.toISOString(),
      settings: { safetyTargets: { holdingPeriodDays: 30 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.holdingPeriodDays).toEqual({ status: 'not_met', target: 30, current: 0 });
  });

  it('safetyBufferPercent: target 0 is always met (current buffer is always >= 0 when liquidation risk exists), never treated as absent', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { safetyBufferPercent: 0 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.safetyBufferPercent).toEqual({ status: 'met', target: 0, current: 75 });
  });
});

describe('buildSafetyTargetsStatus — Holding Period reference timestamp', () => {
  it('uses establishedAt (Starting-Value Baseline) when present', () => {
    const portfolio = basePortfolio({
      createdAt: '2020-01-01T00:00:00.000Z', // far in the past — must NOT be used
      establishedAt: '2026-04-01T00:00:00.000Z', // 10 days before NOW
      settings: { safetyTargets: { holdingPeriodDays: 5 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.holdingPeriodDays).toEqual({ status: 'met', target: 5, current: 10 });
  });

  it('falls back to createdAt when no baseline is established', () => {
    const portfolio = basePortfolio({
      createdAt: '2026-04-01T00:00:00.000Z', // 10 days before NOW
      settings: { safetyTargets: { holdingPeriodDays: 5 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.holdingPeriodDays).toEqual({ status: 'met', target: 5, current: 10 });
  });
});

describe('buildSafetyTargetsStatus — exact boundary behavior', () => {
  it('current exactly equal to target counts as "met" (inclusive comparator), for every field', () => {
    const portfolio = basePortfolio({
      establishedAt: '2026-03-12T00:00:00.000Z', // exactly 30 days before NOW
      settings: {
        safetyTargets: {
          targetHealthFactor: 4, // equals computed healthFactor
          targetBtcPriceUsd: 50000, // equals market.btcPriceUsd
          safetyBufferPercent: 75, // equals computed buffer
          holdingPeriodDays: 30, // equals elapsed days
        },
      },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.targetHealthFactor.status).toBe('met');
    expect(status.targetBtcPriceUsd.status).toBe('met');
    expect(status.safetyBufferPercent.status).toBe('met');
    expect(status.holdingPeriodDays.status).toBe('met');
  });

  it('current one unit below target is "not_met", for every field', () => {
    const portfolio = basePortfolio({
      establishedAt: '2026-03-13T00:00:00.000Z', // 29 days before NOW
      settings: {
        safetyTargets: {
          targetHealthFactor: 4.01,
          targetBtcPriceUsd: 50001,
          safetyBufferPercent: 75.01,
          holdingPeriodDays: 30,
        },
      },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.targetHealthFactor.status).toBe('not_met');
    expect(status.targetBtcPriceUsd.status).toBe('not_met');
    expect(status.safetyBufferPercent.status).toBe('not_met');
    expect(status.holdingPeriodDays.status).toBe('not_met');
  });
});

describe('buildSafetyTargetsStatus — zero-debt portfolio (no liquidation risk)', () => {
  it('healthFactor Infinity always meets any finite target', () => {
    const portfolio = basePortfolio({
      debt: { asset: 'USDC', balance: 0 },
      settings: { safetyTargets: { targetHealthFactor: 100 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.targetHealthFactor).toEqual({ status: 'met', target: 100, current: Infinity });
  });

  it('safetyBufferPercent is "unavailable" (not a fabricated 0) when a target is configured but there is no liquidation risk to compare against', () => {
    const portfolio = basePortfolio({
      debt: { asset: 'USDC', balance: 0 },
      settings: { safetyTargets: { safetyBufferPercent: 50 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.safetyBufferPercent).toEqual({
      status: 'unavailable',
      target: 50,
      current: null,
    });
  });

  it('safetyBufferPercent is "not_configured" (not "unavailable") when zero-debt AND no target is set', () => {
    const portfolio = basePortfolio({
      debt: { asset: 'USDC', balance: 0 },
      settings: {},
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.safetyBufferPercent).toEqual({
      status: 'not_configured',
      target: null,
      current: null,
    });
  });
});

/**
 * Safety Buffer ≥100% Persistence-Compatibility batch. Precedence:
 * target missing -> not_configured; target >= 100 -> invalid_configuration
 * (checked before current-value availability); target valid but current
 * unavailable -> unavailable; otherwise the existing inclusive
 * current >= target comparison. The persisted-read schema stays
 * permissive (unchanged), so `buildSafetyTargetsStatus` is the one place
 * a `>= 100` target is ever actually encountered.
 */
describe('buildSafetyTargetsStatus — Safety Buffer invalid configuration (target >= 100)', () => {
  it('target=150 is "invalid_configuration" regardless of a valid, computable current buffer', () => {
    const portfolio = basePortfolio({ settings: { safetyTargets: { safetyBufferPercent: 150 } } });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.safetyBufferPercent).toEqual({
      status: 'invalid_configuration',
      target: 150,
      current: 75,
    });
  });

  it('target=100 (the exact boundary) is also "invalid_configuration"', () => {
    const portfolio = basePortfolio({ settings: { safetyTargets: { safetyBufferPercent: 100 } } });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.safetyBufferPercent.status).toBe('invalid_configuration');
  });

  it('target=99.99 uses the ordinary comparison, never invalid_configuration', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { safetyBufferPercent: 99.99 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    // current (75) < target (99.99) -> not_met, not invalid_configuration.
    expect(status.safetyBufferPercent).toEqual({
      status: 'not_met',
      target: 99.99,
      current: 75,
    });
  });

  it('an invalid target takes precedence over a zero-debt/unavailable current buffer — a zero-debt portfolio with a stored target of 150 is "invalid_configuration", not "unavailable"', () => {
    const portfolio = basePortfolio({
      debt: { asset: 'USDC', balance: 0 },
      settings: { safetyTargets: { safetyBufferPercent: 150 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.safetyBufferPercent).toEqual({
      status: 'invalid_configuration',
      target: 150,
      current: null,
    });
  });

  it('an invalid target takes precedence even when the underlying PortfolioSummary itself fails', () => {
    const portfolio = basePortfolio({
      collateral: { asset: 'BTC', quantity: -1 }, // forces calculatePortfolioSummary to fail
      settings: { safetyTargets: { safetyBufferPercent: 150 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    expect(summary.ok).toBe(false);
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.safetyBufferPercent).toEqual({
      status: 'invalid_configuration',
      target: 150,
      current: null,
    });
  });
});

/**
 * `isValidSafetyBufferTarget` — the one write-time domain predicate
 * `stores/portfolioStore.ts`'s `create()`/`update()` call to reject a
 * newly submitted/changed Safety Buffer target. Pure, fixture-free.
 */
describe('isValidSafetyBufferTarget', () => {
  it('accepts every value in the valid range, including both endpoints', () => {
    expect(isValidSafetyBufferTarget(0)).toBe(true);
    expect(isValidSafetyBufferTarget(0.01)).toBe(true);
    expect(isValidSafetyBufferTarget(50)).toBe(true);
    expect(isValidSafetyBufferTarget(99)).toBe(true);
    expect(isValidSafetyBufferTarget(99.99)).toBe(true);
    expect(isValidSafetyBufferTarget(99.999999)).toBe(true);
  });

  it('rejects 100 and anything at or above it', () => {
    expect(isValidSafetyBufferTarget(100)).toBe(false);
    expect(isValidSafetyBufferTarget(100.01)).toBe(false);
    expect(isValidSafetyBufferTarget(150)).toBe(false);
  });

  it('rejects negative values', () => {
    expect(isValidSafetyBufferTarget(-1)).toBe(false);
    expect(isValidSafetyBufferTarget(-0.01)).toBe(false);
  });

  it('rejects non-finite values', () => {
    expect(isValidSafetyBufferTarget(NaN)).toBe(false);
    expect(isValidSafetyBufferTarget(Infinity)).toBe(false);
    expect(isValidSafetyBufferTarget(-Infinity)).toBe(false);
  });
});

describe('buildSafetyTargetsStatus — failed PortfolioSummary', () => {
  it('marks only the two summary-dependent fields "unavailable"; Target BTC Price and Holding Period are unaffected', () => {
    const portfolio = basePortfolio({
      collateral: { asset: 'BTC', quantity: -1 }, // forces calculatePortfolioSummary to fail
      settings: {
        safetyTargets: {
          targetHealthFactor: 2,
          targetBtcPriceUsd: 40000,
          safetyBufferPercent: 50,
          holdingPeriodDays: 30,
        },
      },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    expect(summary.ok).toBe(false);
    const status = buildSafetyTargetsStatus(portfolio, summary, NOW);

    expect(status.targetHealthFactor).toEqual({ status: 'unavailable', target: 2, current: null });
    expect(status.safetyBufferPercent).toEqual({
      status: 'unavailable',
      target: 50,
      current: null,
    });
    // Unaffected — computed directly from `portfolio`, never from `summary`.
    expect(status.targetBtcPriceUsd).toEqual({ status: 'met', target: 40000, current: 50000 });
    expect(status.holdingPeriodDays).toEqual({ status: 'met', target: 30, current: 100 });
  });
});

/**
 * `formatSafetyTargetStatusLabel` — the canonical, target-family-specific
 * presentation mapping (Safety Targets Semantic/Status Cleanup batch)
 * both `app/portfolio/SafetyTargetsStatusPanel.tsx` and
 * `features/dashboard/utils/buildSafetyTargetsStatusSummary.ts` call.
 * Pure unit coverage, independent of any portfolio/summary fixture —
 * the numeric comparator (`compareAtLeast`, exercised throughout this
 * file above) is unchanged by this batch; only the label text a given
 * `status` maps to differs per target.
 */
describe('formatSafetyTargetStatusLabel', () => {
  const met: SafetyTargetComparison = { status: 'met', target: 1, current: 1 };
  const notMet: SafetyTargetComparison = { status: 'not_met', target: 2, current: 1 };
  const notConfigured: SafetyTargetComparison = {
    status: 'not_configured',
    target: null,
    current: 1,
  };
  const unavailable: SafetyTargetComparison = { status: 'unavailable', target: 1, current: null };
  const invalidConfiguration: SafetyTargetComparison = {
    status: 'invalid_configuration',
    target: 150,
    current: 75,
  };

  it('Target Health Factor: "Met" / "Not met"', () => {
    expect(formatSafetyTargetStatusLabel('targetHealthFactor', met, 'Not available')).toBe('Met');
    expect(formatSafetyTargetStatusLabel('targetHealthFactor', notMet, 'Not available')).toBe(
      'Not met',
    );
  });

  it('Target BTC Price: "Target reached" / "Below target", never "Met"/"Not met"', () => {
    expect(formatSafetyTargetStatusLabel('targetBtcPriceUsd', met, 'Not available')).toBe(
      'Target reached',
    );
    expect(formatSafetyTargetStatusLabel('targetBtcPriceUsd', notMet, 'Not available')).toBe(
      'Below target',
    );
  });

  it('Holding Period: "Target reached" / "In progress", never "Met"/"Not met"', () => {
    expect(formatSafetyTargetStatusLabel('holdingPeriodDays', met, 'Not available')).toBe(
      'Target reached',
    );
    expect(formatSafetyTargetStatusLabel('holdingPeriodDays', notMet, 'Not available')).toBe(
      'In progress',
    );
  });

  it('Safety Buffer: "On target" / "Below target", never "Met"/"Not met"', () => {
    expect(formatSafetyTargetStatusLabel('safetyBufferPercent', met, 'Not available')).toBe(
      'On target',
    );
    expect(formatSafetyTargetStatusLabel('safetyBufferPercent', notMet, 'Not available')).toBe(
      'Below target',
    );
  });

  it('"Not configured" is identical across all four targets', () => {
    for (const key of [
      'targetHealthFactor',
      'targetBtcPriceUsd',
      'safetyBufferPercent',
      'holdingPeriodDays',
    ] as const) {
      expect(formatSafetyTargetStatusLabel(key, notConfigured, 'Not available')).toBe(
        'Not configured',
      );
    }
  });

  it('"unavailable" always returns the caller-supplied text verbatim, for every target', () => {
    expect(formatSafetyTargetStatusLabel('targetHealthFactor', unavailable, 'Not available')).toBe(
      'Not available',
    );
    expect(
      formatSafetyTargetStatusLabel(
        'safetyBufferPercent',
        unavailable,
        'No liquidation risk to compare against',
      ),
    ).toBe('No liquidation risk to compare against');
  });

  it('"invalid_configuration" always returns "Invalid target", ignoring the caller-supplied unavailableText', () => {
    expect(
      formatSafetyTargetStatusLabel('safetyBufferPercent', invalidConfiguration, 'Not available'),
    ).toBe('Invalid target');
  });
});
