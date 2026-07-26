import { beforeEach, describe, expect, it } from 'vitest';

import { buildDashboardViewModel, buildLiquidationRiskPanel } from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Liquidation Risk Panel builder — 06_TASKS.md M5-009.
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

function buildOkViewModel(overrides: Record<string, unknown> = {}) {
  const created = usePortfolioStore.getState().create(validInput(overrides));
  if (!created.ok) throw new Error('setup failed');
  const record = usePortfolioStore.getState().portfolios[created.data.id];
  const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
  if (!viewModel.ok) throw new Error('expected a successful view model');
  return { portfolio: record.portfolio, viewModel };
}

describe('buildLiquidationRiskPanel — reuses already-computed metrics', () => {
  it('reuses the liquidation trio from DashboardMetrics rather than recomputing them', () => {
    const { portfolio, viewModel } = buildOkViewModel();

    const panel = buildLiquidationRiskPanel(
      portfolio,
      viewModel.metrics,
      viewModel.freshness.market,
    );

    expect(panel.estimatedLiquidationPrice).toBe(viewModel.metrics.liquidationPrice);
    expect(panel.liquidationDistance).toBe(viewModel.metrics.liquidationDistance);
    expect(panel.percentageDeclineToLiquidation).toBe(viewModel.metrics.liquidationBuffer);
    expect(panel.currentMarketPrice).toBe(viewModel.freshness.market?.formattedPrice);
  });

  it('includes an assumptions disclosure', () => {
    const { portfolio, viewModel } = buildOkViewModel();
    const panel = buildLiquidationRiskPanel(
      portfolio,
      viewModel.metrics,
      viewModel.freshness.market,
    );
    expect(panel.assumptions.length).toBeGreaterThan(0);
  });
});

describe('buildLiquidationRiskPanel — no target configured', () => {
  it('reports null for both target-safety actions', () => {
    const { portfolio, viewModel } = buildOkViewModel();
    const panel = buildLiquidationRiskPanel(
      portfolio,
      viewModel.metrics,
      viewModel.freshness.market,
    );
    expect(panel.debtRepaymentRequired).toBeNull();
    expect(panel.collateralAdditionRequired).toBeNull();
  });
});

describe('buildLiquidationRiskPanel — target configured', () => {
  it('computes formatted debt repayment and collateral addition figures', () => {
    const { portfolio, viewModel } = buildOkViewModel({
      settings: { safetyTargets: { targetHealthFactor: 5 } },
    });
    const panel = buildLiquidationRiskPanel(
      portfolio,
      viewModel.metrics,
      viewModel.freshness.market,
    );
    expect(panel.debtRepaymentRequired).not.toBeNull();
    expect(panel.collateralAdditionRequired).not.toBeNull();
  });
});

describe('buildLiquidationRiskPanel — zero-debt portfolio (Conflict #20)', () => {
  it('marks the liquidation metrics unavailable, clearly, without crashing', () => {
    const { portfolio, viewModel } = buildOkViewModel({ debt: { asset: 'USDC', balance: 0 } });
    const panel = buildLiquidationRiskPanel(
      portfolio,
      viewModel.metrics,
      viewModel.freshness.market,
    );
    expect(panel.estimatedLiquidationPrice.status).toBe('unavailable');
    expect(panel.estimatedLiquidationPrice.formattedValue).toBe('N/A (no debt)');
  });
});
