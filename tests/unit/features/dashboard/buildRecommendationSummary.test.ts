import { beforeEach, describe, expect, it } from 'vitest';

import { buildRecommendationSummary } from '@/features/dashboard';
import { presentationTextFor } from '@/features/recommendations/utils/recommendationTaxonomy';
import { calculateRecommendationActions } from '@/services';
import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Recommendation Summary builder — 06_TASKS.md M5-015.
 *
 * **v1.19.0 Batch 1** (Dashboard Recommendation Summary Parity, Service
 * Integration) — the builder now calls `calculateRecommendationActions`
 * (v1.18.0 Batch 2), the same canonical Service the Recommendation Center
 * itself calls, instead of `calculateTargetHealthFactorActions`. See
 * `features/dashboard/utils/buildRecommendationSummary.ts`'s own header
 * comment for the full reasoning. The first three describe blocks below
 * (no target / target met / target below current Health Factor) are
 * unchanged from before this batch and continue to exercise the
 * `usePortfolioStore.create()` path; the Borrow/Loop-focused blocks below
 * them use a hand-built `Portfolio` fixture (matching
 * `recommendationTaxonomy.test.ts`'s own `portfolioFixture` pattern) for
 * direct control over `settings.recommendationPreferences`.
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

function createPortfolio(overrides: Record<string, unknown> = {}) {
  const created = usePortfolioStore.getState().create(validInput(overrides));
  if (!created.ok) throw new Error('setup failed');
  return created.data;
}

describe('buildRecommendationSummary — no target configured', () => {
  it('returns an empty list with emptyReason "no_target" (M5-020, Batch 9)', () => {
    const portfolio = createPortfolio();
    const summary = buildRecommendationSummary(portfolio);
    expect(summary.items).toEqual([]);
    expect(summary.emptyReason).toBe('no_target');
  });
});

describe('buildRecommendationSummary — target already met', () => {
  it('returns an empty list with emptyReason "target_met" rather than "no action needed" entries (M5-020, Batch 9)', () => {
    // Current HF = 4; target of 1 is already exceeded.
    const portfolio = createPortfolio({ settings: { safetyTargets: { targetHealthFactor: 1 } } });
    const summary = buildRecommendationSummary(portfolio);
    expect(summary.items).toEqual([]);
    expect(summary.emptyReason).toBe('target_met');
  });
});

describe('buildRecommendationSummary — target below current Health Factor, no Borrow/Loop configured', () => {
  it('returns both recommendations, ranked 1 and 2, with the full Display field set and a null emptyReason (also covers "no Borrow/Loop configuration")', () => {
    const portfolio = createPortfolio({
      settings: { safetyTargets: { targetHealthFactor: 5 } },
    });
    const summary = buildRecommendationSummary(portfolio);

    expect(summary.items).toHaveLength(2);
    expect(summary.emptyReason).toBeNull();
    expect(summary.items[0].priority).toBe(1);
    expect(summary.items[1].priority).toBe(2);
    expect(summary.items[0].category).toBe('debtManagement');
    expect(summary.items[1].category).toBe('collateralManagement');
    for (const item of summary.items) {
      expect(item.riskLevel).toBe('Maintain Target Health Factor');
      expect(item.explanation.length).toBeGreaterThan(0);
      expect(item.suggestedAction.length).toBeGreaterThan(0);
      expect(item.expectedEffect.length).toBeGreaterThan(0);
    }
  });
});

/**
 * v1.19.0 Batch 1 — Borrow/Loop participation. Matches
 * `recommendationTaxonomy.test.ts`'s own `portfolioFixture` fixture shape
 * exactly (same collateral/debt/protocol numbers), so the accept/reject
 * math below is the same, already-verified math that file's own Q/R
 * tests exercise.
 */
function portfolioFixture(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'portfolio-1',
    name: 'Test Portfolio',
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
    settings: { safetyTargets: { targetHealthFactor: 5 } },
    archivedAt: null,
    marketUpdatedAt: '2026-01-01T00:00:00.000Z',
    protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Current Health Factor = 4 (2 BTC * $50,000 * 0.8 / $20,000 debt). Set
// above the current HF so `calculateBorrowRecommendation`'s own
// `healthFactor > userMinHealthFactor` condition is false — genuinely
// actionable, not the "acceptable" case.
const ACTIONABLE_BORROW_PREFS = { userMinHealthFactor: 5, targetDebtRatio: 0.5 };
// `targetDebtRatio`/`userMinHealthFactor` both easily satisfied at these
// portfolio numbers (debtRatio 0.2, HF 4) — the "acceptable" case.
const ACCEPTABLE_BORROW_PREFS = { userMinHealthFactor: 1, targetDebtRatio: 0.9 };
// `maxAcceptableAnnualInterestCost` must be strictly positive
// (`calculateLoopRecommendation`'s own `validatePositive` check) — `0.01`
// is far below the real interest cost a 0.5 `loopBorrowPercentage` at a
// 5% `borrowApr` produces at these portfolio numbers, forcing
// `annualInterestCost <= maxAcceptableAnnualInterestCost` false
// regardless of the other two conditions — genuinely actionable, not the
// "loop recommended" case.
const ACTIONABLE_LOOP_PREFS = { loopBorrowPercentage: 0.5, maxAcceptableAnnualInterestCost: 0.01 };

describe('buildRecommendationSummary — Borrow complete configuration', () => {
  it('includes an actionable Borrow item alongside Repayment/Additional Collateral', () => {
    const portfolio = portfolioFixture({
      settings: {
        safetyTargets: { targetHealthFactor: 5 },
        recommendationPreferences: { borrow: ACTIONABLE_BORROW_PREFS },
      },
    });
    const summary = buildRecommendationSummary(portfolio);

    expect(summary.items).toHaveLength(3);
    expect(summary.emptyReason).toBeNull();
    expect(summary.items.map((item) => item.category)).toEqual([
      'debtManagement',
      'collateralManagement',
      'debtManagement',
    ]);
    expect(summary.items[2].priority).toBe(3);
    expect(summary.items[2].riskLevel).toBe('Improve Capital Efficiency');
  });

  it('excludes a non-actionable ("acceptable") Borrow item — the same filtering already applied to Repayment/Additional Collateral', () => {
    const portfolio = portfolioFixture({
      settings: {
        safetyTargets: { targetHealthFactor: 5 },
        recommendationPreferences: { borrow: ACCEPTABLE_BORROW_PREFS },
      },
    });
    const summary = buildRecommendationSummary(portfolio);

    expect(summary.items).toHaveLength(2);
    // Only Repayment's debtManagement entry remains — Borrow's own is filtered out.
    expect(summary.items.filter((item) => item.riskLevel === 'Improve Capital Efficiency')).toEqual(
      [],
    );
  });
});

describe('buildRecommendationSummary — Loop complete configuration', () => {
  it('includes an actionable Loop item alongside Repayment/Additional Collateral', () => {
    const portfolio = portfolioFixture({
      settings: {
        safetyTargets: { targetHealthFactor: 5 },
        recommendationPreferences: { loop: ACTIONABLE_LOOP_PREFS },
      },
    });
    const summary = buildRecommendationSummary(portfolio);

    expect(summary.items).toHaveLength(3);
    expect(summary.items[2].category).toBe('leverage');
    expect(summary.items[2].priority).toBe(3);
    expect(summary.items[2].riskLevel).toBe('Improve Capital Efficiency');
  });
});

describe('buildRecommendationSummary — both Borrow and Loop complete (maximum item count)', () => {
  it('proves the real maximum is 4, not 2 — repayment, additionalCollateral, borrow, loop, in that canonical order', () => {
    const portfolio = portfolioFixture({
      settings: {
        safetyTargets: { targetHealthFactor: 5 },
        recommendationPreferences: {
          borrow: ACTIONABLE_BORROW_PREFS,
          loop: ACTIONABLE_LOOP_PREFS,
        },
      },
    });
    const summary = buildRecommendationSummary(portfolio);

    expect(summary.items).toHaveLength(4);
    expect(summary.items.map((item) => item.priority)).toEqual([1, 2, 3, 4]);
    expect(summary.items.map((item) => item.category)).toEqual([
      'debtManagement',
      'collateralManagement',
      'debtManagement',
      'leverage',
    ]);
    expect(summary.items.map((item) => item.riskLevel)).toEqual([
      'Maintain Target Health Factor',
      'Maintain Target Health Factor',
      'Improve Capital Efficiency',
      'Improve Capital Efficiency',
    ]);
  });
});

describe('buildRecommendationSummary — partial preference groups', () => {
  it('partial Borrow (missing targetDebtRatio) never appears — no partial substitution', () => {
    const portfolio = portfolioFixture({
      settings: {
        safetyTargets: { targetHealthFactor: 5 },
        recommendationPreferences: { borrow: { userMinHealthFactor: 5 } },
      },
    });
    const summary = buildRecommendationSummary(portfolio);

    expect(summary.items).toHaveLength(2);
    expect(summary.items.every((item) => item.riskLevel !== 'Improve Capital Efficiency')).toBe(
      true,
    );
  });

  it('partial Loop (missing loopBorrowPercentage) never appears — no partial substitution', () => {
    const portfolio = portfolioFixture({
      settings: {
        safetyTargets: { targetHealthFactor: 5 },
        recommendationPreferences: { loop: { maxAcceptableAnnualInterestCost: 0 } },
      },
    });
    const summary = buildRecommendationSummary(portfolio);

    expect(summary.items).toHaveLength(2);
    expect(summary.items.every((item) => item.category !== 'leverage')).toBe(true);
  });

  it('one complete group (Borrow) + one partial group (Loop) — only the complete one appears', () => {
    const portfolio = portfolioFixture({
      settings: {
        safetyTargets: { targetHealthFactor: 5 },
        recommendationPreferences: {
          borrow: ACTIONABLE_BORROW_PREFS,
          loop: { loopBorrowPercentage: 0.5 },
        },
      },
    });
    const summary = buildRecommendationSummary(portfolio);

    expect(summary.items).toHaveLength(3);
    expect(summary.items[2].category).toBe('debtManagement');
    expect(summary.items[2].riskLevel).toBe('Improve Capital Efficiency');
    expect(summary.items.every((item) => item.category !== 'leverage')).toBe(true);
  });
});

describe('buildRecommendationSummary — coexistence with existing categories', () => {
  it('Repayment/Additional Collateral entries are unaffected by Borrow/Loop being present alongside them', () => {
    const withoutBorrowLoop = buildRecommendationSummary(
      portfolioFixture({ settings: { safetyTargets: { targetHealthFactor: 5 } } }),
    );
    const withBorrowLoop = buildRecommendationSummary(
      portfolioFixture({
        settings: {
          safetyTargets: { targetHealthFactor: 5 },
          recommendationPreferences: {
            borrow: ACTIONABLE_BORROW_PREFS,
            loop: ACTIONABLE_LOOP_PREFS,
          },
        },
      }),
    );

    expect(withBorrowLoop.items[0]).toEqual(withoutBorrowLoop.items[0]);
    expect(withBorrowLoop.items[1]).toEqual(withoutBorrowLoop.items[1]);
  });
});

describe('buildRecommendationSummary — canonical presentation text', () => {
  it('Borrow/Loop entries use presentationTextFor, not the raw triggeringCondition/suggestedAction pairing', () => {
    const portfolio = portfolioFixture({
      settings: {
        safetyTargets: { targetHealthFactor: 5 },
        recommendationPreferences: {
          borrow: ACTIONABLE_BORROW_PREFS,
          loop: ACTIONABLE_LOOP_PREFS,
        },
      },
    });

    const actionsResult = calculateRecommendationActions(portfolio, 'manual');
    expect(actionsResult.ok).toBe(true);
    if (!actionsResult.ok) return;
    const { borrow, loop } = actionsResult.data.items;
    expect(borrow).toBeDefined();
    expect(loop).toBeDefined();
    if (borrow === undefined || loop === undefined) return;

    const expectedBorrow = presentationTextFor('borrow', borrow);
    const expectedLoop = presentationTextFor('loop', loop);

    const summary = buildRecommendationSummary(portfolio);
    const borrowItem = summary.items.find(
      (item) =>
        item.riskLevel === 'Improve Capital Efficiency' && item.category === 'debtManagement',
    );
    const loopItem = summary.items.find((item) => item.category === 'leverage');
    expect(borrowItem?.explanation).toBe(expectedBorrow.headline);
    expect(borrowItem?.suggestedAction).toBe(expectedBorrow.detail);
    expect(loopItem?.explanation).toBe(expectedLoop.headline);
    expect(loopItem?.suggestedAction).toBe(expectedLoop.detail);

    // Headline is the unaltered raw triggeringCondition (spec §10 design rule).
    expect(borrowItem?.explanation).toBe(borrow.triggeringCondition);
    // Detail replaces the raw, directive suggestedAction.
    expect(borrowItem?.suggestedAction).not.toBe(borrow.suggestedAction);
  });

  it('Repayment/Additional Collateral entries keep reading raw triggeringCondition/suggestedAction directly — unaffected by the presentation layer', () => {
    const portfolio = portfolioFixture({ settings: { safetyTargets: { targetHealthFactor: 5 } } });
    const actionsResult = calculateRecommendationActions(portfolio, 'manual');
    expect(actionsResult.ok).toBe(true);
    if (!actionsResult.ok) return;
    const { repayment, additionalCollateral } = actionsResult.data.items;
    expect(repayment).toBeDefined();
    expect(additionalCollateral).toBeDefined();
    if (repayment === undefined || additionalCollateral === undefined) return;

    const summary = buildRecommendationSummary(portfolio);
    expect(summary.items[0].explanation).toBe(repayment.triggeringCondition);
    expect(summary.items[0].suggestedAction).toBe(repayment.suggestedAction);
    expect(summary.items[1].explanation).toBe(additionalCollateral.triggeringCondition);
    expect(summary.items[1].suggestedAction).toBe(additionalCollateral.suggestedAction);
  });
});

describe('buildRecommendationSummary — no mutation of canonical recommendation objects', () => {
  it('does not mutate the input Portfolio, and produces identical Service output on a second, independent call', () => {
    const portfolio = portfolioFixture({
      settings: {
        safetyTargets: { targetHealthFactor: 5 },
        recommendationPreferences: {
          borrow: ACTIONABLE_BORROW_PREFS,
          loop: ACTIONABLE_LOOP_PREFS,
        },
      },
    });
    const portfolioSnapshot = structuredClone(portfolio);
    const beforeResult = calculateRecommendationActions(portfolio, 'manual');

    buildRecommendationSummary(portfolio);

    expect(portfolio).toEqual(portfolioSnapshot);
    const afterResult = calculateRecommendationActions(portfolio, 'manual');
    // Compares `.data` only, not `.metadata` — `calculationTimestamp` is
    // real wall-clock time (`services/shared/result.ts`) and legitimately
    // differs by a few milliseconds between two independent calls; that
    // is not a mutation.
    expect(afterResult.ok).toBe(beforeResult.ok);
    if (beforeResult.ok && afterResult.ok) {
      expect(afterResult.data).toEqual(beforeResult.data);
    }
  });
});
