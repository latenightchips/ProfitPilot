import { beforeEach, describe, expect, it } from 'vitest';

import { buildDashboardViewModel, buildPortfolioComposition } from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Portfolio Composition builder — 06_TASKS.md M5-011.
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
    marketFreshness: viewModel.freshness.market,
    tracked: {
      engineVersion: record.summary.metadata.engineVersion,
      formulaVersion: record.summary.metadata.formulaVersion,
    },
  };
}

/** See `buildDebtAndInterestPanel.test.ts`'s identical helper for the full reasoning. */
function buildOkV4(
  v4DebtState?: {
    drawnDebt: number;
    premiumDebt: number;
    baseDrawnApr: number;
    riskPremium: number;
  },
  overrides: Record<string, unknown> = {},
) {
  const created = usePortfolioStore.getState().create(validInput(overrides));
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
    marketFreshness: viewModel.freshness.market,
    tracked: {
      engineVersion: record.summary.metadata.engineVersion,
      formulaVersion: record.summary.metadata.formulaVersion,
    },
  };
}

describe('buildPortfolioComposition — collateral and debt rows', () => {
  it('reports each asset, quantity, price, value, and always-100% portfolio percentage (Conflict A)', () => {
    const { portfolio, summary, marketFreshness, tracked } = buildOk();
    const composition = buildPortfolioComposition(portfolio, summary, marketFreshness, tracked);

    expect(composition.collateral.assetLabel).toBe('BTC');
    expect(composition.collateral.formattedQuantity).toBe('2');
    expect(composition.collateral.formattedPositionValue).toBe('$100,000.00');
    expect(composition.collateral.formattedPortfolioPercentage).toBe('100%');

    expect(composition.debt.assetLabel).toBe('USDC');
    expect(composition.debt.formattedQuantity).toBe('20,000');
    expect(composition.debt.formattedPositionValue).toBe('$20,000.00');
    expect(composition.debt.formattedPortfolioPercentage).toBe('100%');
  });

  it('reports the debt row price as a fixed 1:1 stablecoin peg, in plain user-facing language (UX punch-list UX-04: no internal Formula ID)', () => {
    const { portfolio, summary, marketFreshness, tracked } = buildOk();
    const composition = buildPortfolioComposition(portfolio, summary, marketFreshness, tracked);
    expect(composition.debt.formattedCurrentPrice).toBe('$1.00 (stablecoin)');
    expect(composition.debt.formattedCurrentPrice).not.toContain('F-003');
  });
});

describe('buildPortfolioComposition — protocol parameters', () => {
  it('formats every protocol parameter as a percentage', () => {
    const { portfolio, summary, marketFreshness, tracked } = buildOk();
    const composition = buildPortfolioComposition(portfolio, summary, marketFreshness, tracked);
    expect(composition.protocolParameters.formattedMaxLoanToValue).toBe('75%');
    expect(composition.protocolParameters.formattedLiquidationThreshold).toBe('80%');
    expect(composition.protocolParameters.formattedBorrowApr).toBe('5%');
    expect(composition.protocolParameters.formattedSupplyApr).toBe('2%');
  });
});

describe('buildPortfolioComposition — M5-012 allocation chart', () => {
  it('always reports showAllocationChart as false under Conflict A', () => {
    const { portfolio, summary, marketFreshness, tracked } = buildOk();
    const composition = buildPortfolioComposition(portfolio, summary, marketFreshness, tracked);
    expect(composition.showAllocationChart).toBe(false);
  });
});

/**
 * "Borrow APR" for a V4 portfolio — V4 Readiness Audit §12 Stage 15. See
 * `buildDebtAndInterestPanel.test.ts`'s identical describe block for the
 * full reasoning; this Dashboard section reads the same legacy scalar
 * and needed the identical fix.
 */
describe('buildPortfolioComposition — V4 effective borrow rate (Stage 15)', () => {
  it('derives the real V4 rate from synced v4DebtState, not the legacy protocol.borrowApr', () => {
    const { portfolio, summary, marketFreshness, tracked } = buildOkV4({
      drawnDebt: 20000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
    });
    const composition = buildPortfolioComposition(portfolio, summary, marketFreshness, tracked);
    expect(composition.protocolParameters.formattedBorrowApr).toBe('5.37%');
    expect(composition.protocolParameters.formattedBorrowApr).not.toBe('5%');
  });

  it('shows "—" (never a stale/fabricated number) when v4DebtState is absent from a V4 Portfolio/PortfolioSummary pair', () => {
    const { portfolio, summary, marketFreshness, tracked } = buildOk();
    const v4PortfolioMissingState = { ...portfolio, protocolVersion: 'v4' as const };
    const composition = buildPortfolioComposition(
      v4PortfolioMissingState,
      summary,
      marketFreshness,
      tracked,
    );
    expect(composition.protocolParameters.formattedBorrowApr).toBe('—');
  });

  it('a V3 (or unset) portfolio is completely unaffected — still reads protocol.borrowApr directly', () => {
    const { portfolio, summary, marketFreshness, tracked } = buildOk();
    const composition = buildPortfolioComposition(portfolio, summary, marketFreshness, tracked);
    expect(composition.protocolParameters.formattedBorrowApr).toBe('5%');
  });
});

/**
 * Debt row "Quantity" for a V4 portfolio — V4 Readiness Audit §12 Stage
 * 16. `debt.balance` deliberately disagrees with the real synced
 * `v4DebtState` below, proving the displayed quantity uses the canonical
 * total (`resolveCanonicalDebtBalance`), matching the row's own already-
 * canonical `formattedPositionValue` sibling, not the stale legacy field.
 */
describe('buildPortfolioComposition — V4 canonical debt quantity (Stage 16)', () => {
  it('derives the real canonical total from synced v4DebtState, not the deliberately-disagreeing legacy debt.balance', () => {
    const { portfolio, summary, marketFreshness, tracked } = buildOkV4(
      { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      { debt: { asset: 'USDC', balance: 999999 } },
    );
    const composition = buildPortfolioComposition(portfolio, summary, marketFreshness, tracked);
    expect(composition.debt.formattedQuantity).toBe('15,500');
    expect(composition.debt.formattedQuantity).not.toBe('999,999');
    // Matches its own sibling field, already canonical since Stage 9.
    expect(composition.debt.formattedPositionValue).toBe('$15,500.00');
  });

  it('shows "—" (never a stale/fabricated number) when v4DebtState is absent from a V4 Portfolio/PortfolioSummary pair', () => {
    const { portfolio, summary, marketFreshness, tracked } = buildOk();
    const v4PortfolioMissingState = { ...portfolio, protocolVersion: 'v4' as const };
    const composition = buildPortfolioComposition(
      v4PortfolioMissingState,
      summary,
      marketFreshness,
      tracked,
    );
    expect(composition.debt.formattedQuantity).toBe('—');
  });

  it('a V3 (or unset) portfolio is completely unaffected — still reads debt.balance directly', () => {
    const { portfolio, summary, marketFreshness, tracked } = buildOk();
    const composition = buildPortfolioComposition(portfolio, summary, marketFreshness, tracked);
    expect(composition.debt.formattedQuantity).toBe('20,000');
  });
});
