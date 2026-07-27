import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildDashboardViewModel,
  buildLiquidationRiskPanel,
  LiquidationRiskPanel,
} from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Liquidation Risk Panel — 06_TASKS.md M5-009. DoD: "The section clearly
 * distinguishes current values from calculated estimates."
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

function buildPanel(overrides: Record<string, unknown> = {}) {
  const created = usePortfolioStore.getState().create(validInput(overrides));
  if (!created.ok) throw new Error('setup failed');
  const record = usePortfolioStore.getState().portfolios[created.data.id];
  const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
  if (!viewModel.ok) throw new Error('expected a successful view model');
  return buildLiquidationRiskPanel(record.portfolio, viewModel.metrics, viewModel.freshness.market);
}

describe('LiquidationRiskPanel — current vs. calculated distinction (M5-009 DoD)', () => {
  it('labels the current market price under its own "Current" heading, separate from "Calculated Estimates"', () => {
    render(<LiquidationRiskPanel panel={buildPanel()} />);
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Calculated Estimates')).toBeInTheDocument();
    expect(screen.getByText('$50,000.00')).toBeInTheDocument();
  });

  it('renders each calculated estimate with its own Formula ID tooltip', () => {
    render(<LiquidationRiskPanel panel={buildPanel()} />);
    expect(screen.getByText('Estimated Liquidation Price').closest('[title]')).toHaveAttribute(
      'title',
      'F-024 — see docs/02_Formulas.md',
    );
  });
});

describe('LiquidationRiskPanel — no target configured', () => {
  it('omits the target-safety action lines entirely', () => {
    render(<LiquidationRiskPanel panel={buildPanel()} />);
    expect(screen.queryByText(/Debt repayment required/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Collateral addition required/)).not.toBeInTheDocument();
  });
});

describe('LiquidationRiskPanel — target configured', () => {
  it('renders both target-safety action lines', () => {
    render(
      <LiquidationRiskPanel
        panel={buildPanel({ settings: { safetyTargets: { targetHealthFactor: 5 } } })}
      />,
    );
    expect(screen.getByText(/Debt repayment required for target safety/)).toBeInTheDocument();
    expect(screen.getByText(/Collateral addition required for target safety/)).toBeInTheDocument();
  });
});

describe('LiquidationRiskPanel — assumptions disclosure', () => {
  it('always renders an assumptions note', () => {
    render(<LiquidationRiskPanel panel={buildPanel()} />);
    expect(screen.getByText(/Assumes the current BTC price/)).toBeInTheDocument();
  });
});

describe('LiquidationRiskPanel — zero debt (M5-025, Batch 15)', () => {
  it('marks all three calculated estimates unavailable, not a crash or a fabricated number', () => {
    const panel = buildPanel({ debt: { asset: 'USDC', balance: 0 } });

    render(<LiquidationRiskPanel panel={panel} />);

    expect(panel.estimatedLiquidationPrice.status).toBe('unavailable');
    expect(panel.liquidationDistance.status).toBe('unavailable');
    expect(panel.percentageDeclineToLiquidation.status).toBe('unavailable');
    expect(screen.getAllByText('N/A (no debt)').length).toBe(3);
    expect(screen.getAllByText('Unavailable').length).toBe(3);
  });
});

describe('LiquidationRiskPanel — critical (near-liquidation) Health Factor (M5-025, Batch 15)', () => {
  it('renders real, small estimates as the position approaches liquidation, not "unavailable"', () => {
    // Same near-liquidation fixture as HealthFactorStatusSection's own critical-HF test.
    const panel = buildPanel({ debt: { asset: 'USDC', balance: 79000 } });

    render(<LiquidationRiskPanel panel={panel} />);

    expect(panel.estimatedLiquidationPrice.status).toBe('ok');
    expect(panel.percentageDeclineToLiquidation.status).toBe('ok');
    expect(screen.getByText(panel.estimatedLiquidationPrice.formattedValue)).toBeInTheDocument();
  });
});

describe('LiquidationRiskPanel — Developer Mode (M5-022, Batch 14)', () => {
  it('shows no developer details by default', () => {
    render(<LiquidationRiskPanel panel={buildPanel()} />);
    expect(screen.queryByText(/Formula ID: F-024/)).not.toBeInTheDocument();
  });

  it('shows Formula ID and Engine/Formula version for each estimate when enabled', () => {
    render(
      <LiquidationRiskPanel
        panel={buildPanel()}
        developerMode
        engineVersion="1.0"
        formulaVersion="1.0"
      />,
    );
    expect(screen.getByText(/Formula ID: F-024/)).toBeInTheDocument();
    expect(screen.getAllByText(/Engine v1\.0, Formula v1\.0/).length).toBe(3);
  });
});
