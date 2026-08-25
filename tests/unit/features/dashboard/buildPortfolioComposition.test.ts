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
    usePortfolioStore
      .getState()
      .setAaveV4DebtState(created.data.id, { ...v4DebtState, debtAssetPriceUsd: 1.0 });
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
  it('formats every protocol parameter as a percentage (V3: kind "v3", Max LTV/Liquidation Threshold pair)', () => {
    const { portfolio, summary, marketFreshness, tracked } = buildOk();
    const composition = buildPortfolioComposition(portfolio, summary, marketFreshness, tracked);
    expect(composition.protocolParameters.kind).toBe('v3');
    if (composition.protocolParameters.kind !== 'v3') return;
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

/**
 * "Max LTV"/"Liquidation Threshold" vs. "Collateral Factor" — V4
 * Readiness Audit §12 Stage 23E. Previously always read
 * `portfolio.protocol.maxLoanToValue`/`.liquidationThreshold`
 * unconditionally — a meaningless V3 pair for a V4 portfolio, shown under
 * V3-only labels. `resolveRiskCapacityDisplay` (`services/portfolio/mapping.ts`)
 * is the single shared resolver; this Dashboard util only formats.
 */
describe('buildPortfolioComposition — V4 risk-capacity display (Stage 23E)', () => {
  function buildOkV4WithCollateralRisk(collateralFactor: number, drawnDebt = 20000) {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().setProtocolVersion(created.data.id, 'v4');
    usePortfolioStore.getState().setAaveV4DebtState(created.data.id, {
      drawnDebt,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0,
      debtAssetPriceUsd: 1.0,
    });
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.data.id, { collateralFactor, dynamicConfigKey: 1 });
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

  it('shows kind: "v4Available" with the real collateralFactor, never protocol.maxLoanToValue/liquidationThreshold', () => {
    const { portfolio, summary, marketFreshness, tracked } = buildOkV4WithCollateralRisk(0.65);
    const composition = buildPortfolioComposition(portfolio, summary, marketFreshness, tracked);
    expect(composition.protocolParameters.kind).toBe('v4Available');
    if (composition.protocolParameters.kind !== 'v4Available') return;
    expect(composition.protocolParameters.formattedCollateralFactor).toBe('65%');
    // The V3-shaped fields are absent from this variant entirely (proven
    // by TypeScript's own discriminated-union narrowing above), not just
    // hidden — no "formattedMaxLoanToValue"/"formattedLiquidationThreshold"
    // exists on this shape at all.
  });

  it('shows kind: "v4Unavailable" when v4CollateralRisk has not synced, never falling back to a V3 number', () => {
    const { portfolio, summary, marketFreshness, tracked } = buildOk();
    const v4PortfolioMissingRisk = { ...portfolio, protocolVersion: 'v4' as const };
    const composition = buildPortfolioComposition(
      v4PortfolioMissingRisk,
      summary,
      marketFreshness,
      tracked,
    );
    expect(composition.protocolParameters.kind).toBe('v4Unavailable');
  });

  it('a V3 (or unset) portfolio is completely unaffected — still shows kind: "v3" with Max LTV/Liquidation Threshold', () => {
    const { portfolio, summary, marketFreshness, tracked } = buildOk();
    const composition = buildPortfolioComposition(portfolio, summary, marketFreshness, tracked);
    expect(composition.protocolParameters.kind).toBe('v3');
    if (composition.protocolParameters.kind !== 'v3') return;
    expect(composition.protocolParameters.formattedMaxLoanToValue).toBe('75%');
    expect(composition.protocolParameters.formattedLiquidationThreshold).toBe('80%');
  });

  it('a deliberately conflicting V3/V4 fixture proves the correct branch is selected purely by protocolVersion', () => {
    const v3 = buildOk();
    const v4 = buildOkV4WithCollateralRisk(0.65);
    const v3Composition = buildPortfolioComposition(
      v3.portfolio,
      v3.summary,
      v3.marketFreshness,
      v3.tracked,
    );
    const v4Composition = buildPortfolioComposition(
      v4.portfolio,
      v4.summary,
      v4.marketFreshness,
      v4.tracked,
    );
    expect(v3Composition.protocolParameters.kind).toBe('v3');
    expect(v4Composition.protocolParameters.kind).toBe('v4Available');
  });

  it('treats collateralFactor: 0 as real configuration ("v4Available" with 0%), not "v4Unavailable"', () => {
    // Zero debt sidesteps calculatePortfolioSummary's liquidation-price
    // step (conflict #20), which would otherwise correctly fail on
    // DIVISION_BY_ZERO for zero effective collateral with nonzero debt —
    // see summary.test.ts's own identical case. This test isolates
    // collateralFactor: 0's display behavior, not the summary calculation.
    const { portfolio, summary, marketFreshness, tracked } = buildOkV4WithCollateralRisk(0, 0);
    const composition = buildPortfolioComposition(portfolio, summary, marketFreshness, tracked);
    expect(composition.protocolParameters.kind).toBe('v4Available');
    if (composition.protocolParameters.kind !== 'v4Available') return;
    expect(composition.protocolParameters.formattedCollateralFactor).toBe('0%');
  });
});

/**
 * "Supply APR" display — V4 Readiness Audit §12 P1-1. No V4 boundary
 * this codebase talks to exposes an authoritative supply rate, so a live
 * V4 portfolio must never keep showing the inherited/leftover
 * `protocol.supplyApr` number. Mirrors the `resolveSupplyAprDisplay`
 * (`services/portfolio/mapping.ts`) unit tests, at the Dashboard
 * formatting layer.
 */
describe('buildPortfolioComposition — Supply APR (P1-1)', () => {
  it('V3: shows the real protocol.supplyApr percentage, unchanged', () => {
    const { portfolio, summary, marketFreshness, tracked } = buildOk();
    const composition = buildPortfolioComposition(portfolio, summary, marketFreshness, tracked);
    expect(composition.protocolParameters.formattedSupplyApr).toBe('2%');
  });

  it('live V4 (setAaveV4CollateralRisk\'s own default source): shows "—", never the leftover protocol.supplyApr figure', () => {
    // `setAaveV4CollateralRisk` with no explicit `source` argument
    // defaults to `'live'` (`stores/portfolioStore.ts`'s own default) —
    // exactly the case this fix targets.
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().setProtocolVersion(created.data.id, 'v4');
    usePortfolioStore.getState().setAaveV4DebtState(created.data.id, {
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0,
      debtAssetPriceUsd: 1.0,
    });
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.data.id, { collateralFactor: 0.65, dynamicConfigKey: 1 });
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    if (!record.summary.ok) throw new Error('expected a successful summary');
    expect(record.portfolio.v4CollateralRiskSource).toBe('live');
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
    if (!viewModel.ok) throw new Error('expected a successful view model');
    const composition = buildPortfolioComposition(
      record.portfolio,
      record.summary.data,
      viewModel.freshness.market,
      {
        engineVersion: record.summary.metadata.engineVersion,
        formulaVersion: record.summary.metadata.formulaVersion,
      },
    );
    expect(composition.protocolParameters.formattedSupplyApr).toBe('—');
  });

  it('V4 with no v4CollateralRisk synced yet: shows "—", not the inherited V3/default figure', () => {
    const { portfolio, summary, marketFreshness, tracked } = buildOk();
    const v4PortfolioMissingRisk = { ...portfolio, protocolVersion: 'v4' as const };
    const composition = buildPortfolioComposition(
      v4PortfolioMissingRisk,
      summary,
      marketFreshness,
      tracked,
    );
    expect(composition.protocolParameters.formattedSupplyApr).toBe('—');
  });

  it('manual V4 (v4CollateralRiskSource explicitly "manual"): shows the real protocol.supplyApr percentage, manual semantics preserved', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().setProtocolVersion(created.data.id, 'v4');
    usePortfolioStore.getState().setAaveV4DebtState(created.data.id, {
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0,
      debtAssetPriceUsd: 1.0,
    });
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(
        created.data.id,
        { collateralFactor: 0.65, dynamicConfigKey: 1 },
        'manual',
      );
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    if (!record.summary.ok) throw new Error('expected a successful summary');
    expect(record.portfolio.v4CollateralRiskSource).toBe('manual');
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
    if (!viewModel.ok) throw new Error('expected a successful view model');
    const composition = buildPortfolioComposition(
      record.portfolio,
      record.summary.data,
      viewModel.freshness.market,
      {
        engineVersion: record.summary.metadata.engineVersion,
        formulaVersion: record.summary.metadata.formulaVersion,
      },
    );
    expect(composition.protocolParameters.formattedSupplyApr).toBe('2%');
  });
});
