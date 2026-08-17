import { beforeEach, describe, expect, it } from 'vitest';

import { buildDashboardViewModel, buildDebtAndInterestPanel } from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Debt and Interest Panel builder — 06_TASKS.md M5-013.
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

function buildOk(overrides: Record<string, unknown> = {}) {
  const created = usePortfolioStore.getState().create(validInput(overrides));
  if (!created.ok) throw new Error('setup failed');
  const record = usePortfolioStore.getState().portfolios[created.data.id];
  if (!record.summary.ok) throw new Error('expected a successful summary');
  const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
  if (!viewModel.ok) throw new Error('expected a successful view model');
  return {
    portfolio: record.portfolio,
    summary: record.summary.data,
    protocolFreshness: viewModel.freshness.protocol,
    tracked: {
      engineVersion: record.summary.metadata.engineVersion,
      formulaVersion: record.summary.metadata.formulaVersion,
    },
  };
}

/**
 * V4 setup — `create()` only ever accepts V3-shaped input
 * (`portfolioInputSchema` has no `protocolVersion`/`v4DebtState` fields,
 * by Stage 13's own design: creation always starts V3-shaped). Opting a
 * portfolio into V4 for a test means the same two real Store actions the
 * real UI uses (`setProtocolVersion`/`setAaveV4Position`), mirroring
 * `tests/unit/app/portfolio/page.test.tsx`'s own `createAndSelectV4`
 * helper, then `setAaveV4DebtState` when a test needs synced state.
 *
 * A V4 portfolio with NO synced `v4DebtState` fails closed at the Store's
 * own `summary` (Stage 9/10's guard) — this Dashboard never actually
 * calls `buildDebtAndInterestPanel` for one in production (`summary`
 * gates on `record.summary.ok`, so `DashboardErrorBanner` shows instead).
 * `formatBorrowRate`'s own `v4DebtState === undefined` branch is
 * still real, defensive code worth its own direct unit-test coverage —
 * tested below by constructing the `Portfolio`/`PortfolioSummary` inputs
 * directly rather than forcing the Store through an unreachable state.
 */
function buildOkV4(v4DebtState?: {
  drawnDebt: number;
  premiumDebt: number;
  baseDrawnApr: number;
  riskPremium: number;
}) {
  const created = usePortfolioStore.getState().create(validInput());
  if (!created.ok) throw new Error('setup failed');
  usePortfolioStore.getState().setProtocolVersion(created.data.id, 'v4');
  usePortfolioStore.getState().setAaveV4Position(created.data.id, {
    userAddress: '0x1234567890123456789012345678901234567890',
  });
  if (v4DebtState !== undefined) {
    usePortfolioStore.getState().setAaveV4DebtState(created.data.id, v4DebtState);
    // Stage 23C: the calculation now also requires `v4CollateralRisk` to be
    // synced (mirroring this same `v4DebtState` guard) — set alongside it
    // whenever a test needs the calculation to actually succeed.
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.data.id, { collateralFactor: 0.8, dynamicConfigKey: 1 });
  }
  const record = usePortfolioStore.getState().portfolios[created.data.id];
  if (!record.summary.ok) throw new Error('expected a successful summary');
  const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
  if (!viewModel.ok) throw new Error('expected a successful view model');
  return {
    portfolio: record.portfolio,
    summary: record.summary.data,
    protocolFreshness: viewModel.freshness.protocol,
    tracked: {
      engineVersion: record.summary.metadata.engineVersion,
      formulaVersion: record.summary.metadata.formulaVersion,
    },
  };
}

describe('buildDebtAndInterestPanel — real Service outputs, not derived approximations', () => {
  it('formats total debt, borrow rate, and annual/monthly/daily interest cost', () => {
    const { portfolio, summary, protocolFreshness, tracked } = buildOk();
    const panel = buildDebtAndInterestPanel(portfolio, summary, protocolFreshness, tracked);

    expect(panel.formattedTotalDebt).toBe('$20,000.00');
    expect(panel.formattedCurrentBorrowRate).toBe('5%');
    expect(panel.formattedAnnualInterestCost).toBe('$1,000.00');
    // Daily = 20000 * 0.05 / 365 ≈ 2.7397; Monthly = Daily * 30 ≈ 82.19
    expect(panel.formattedDailyInterestCost).toBe('$2.74');
    expect(panel.formattedMonthlyInterestCost).toBe('$82.19');
  });

  it('monthly interest is not annual/12 — proves the real F-030/F-031 chain is used', () => {
    const { portfolio, summary, protocolFreshness, tracked } = buildOk();
    const panel = buildDebtAndInterestPanel(portfolio, summary, protocolFreshness, tracked);
    expect(panel.formattedMonthlyInterestCost).not.toBe('$83.33');
  });

  it('reports the rate source from protocol freshness', () => {
    const { portfolio, summary, protocolFreshness, tracked } = buildOk();
    const panel = buildDebtAndInterestPanel(portfolio, summary, protocolFreshness, tracked);
    expect(panel.rateSource).toBe('manual');
  });
});

describe('buildDebtAndInterestPanel — zero-debt portfolio', () => {
  it('reports zero interest costs without failing', () => {
    const { portfolio, summary, protocolFreshness, tracked } = buildOk({
      debt: { asset: 'USDC', balance: 0 },
    });
    const panel = buildDebtAndInterestPanel(portfolio, summary, protocolFreshness, tracked);
    expect(panel.formattedTotalDebt).toBe('$0.00');
    expect(panel.formattedDailyInterestCost).toBe('$0.00');
    expect(panel.formattedMonthlyInterestCost).toBe('$0.00');
  });
});

/**
 * "Current Borrow Rate" for a V4 portfolio — V4 Readiness Audit §12
 * Stage 15. Previously always `formatPercent(portfolio.protocol.borrowApr)`,
 * mathematically unrelated to the real V4 `formattedAnnualInterestCost`
 * right next to it. Every value below is cross-checked against an
 * independently-computed rate, never a hand-picked constant.
 */
describe('buildDebtAndInterestPanel — V4 effective borrow rate (Stage 15)', () => {
  it('derives the real V4 rate from synced v4DebtState, not the legacy protocol.borrowApr', () => {
    const { portfolio, summary, protocolFreshness, tracked } = buildOkV4({
      drawnDebt: 20000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
    });
    const panel = buildDebtAndInterestPanel(portfolio, summary, protocolFreshness, tracked);
    // Same Stage 10 regression vector: annualCost 1100 / totalDebt 20500 ≈ 5.37%.
    expect(panel.formattedCurrentBorrowRate).toBe('5.37%');
    expect(panel.formattedCurrentBorrowRate).not.toBe('5%');
  });

  it('shows "—" (never a stale/fabricated number) when v4DebtState is absent from a V4 Portfolio/PortfolioSummary pair', () => {
    const { portfolio, summary, protocolFreshness, tracked } = buildOk();
    const v4PortfolioMissingState = { ...portfolio, protocolVersion: 'v4' as const };
    const panel = buildDebtAndInterestPanel(
      v4PortfolioMissingState,
      summary,
      protocolFreshness,
      tracked,
    );
    expect(panel.formattedCurrentBorrowRate).toBe('—');
  });

  it('a V3 (or unset) portfolio is completely unaffected — still reads protocol.borrowApr directly', () => {
    const { portfolio, summary, protocolFreshness, tracked } = buildOk();
    const panel = buildDebtAndInterestPanel(portfolio, summary, protocolFreshness, tracked);
    expect(panel.formattedCurrentBorrowRate).toBe('5%');
  });
});
