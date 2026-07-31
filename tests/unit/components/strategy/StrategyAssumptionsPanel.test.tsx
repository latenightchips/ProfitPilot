import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StrategyAssumptionsPanel } from '@/components/strategy/StrategyAssumptionsPanel';
import type { Portfolio } from '@/types/portfolio';

/** Shared Strategy Assumptions Panel — 06_TASKS.md M7-004. */
function basePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
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
    settings: {},
    archivedAt: null,
    marketUpdatedAt: '2026-01-01T00:00:00.000Z',
    protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('StrategyAssumptionsPanel', () => {
  it('renders market price, protocol parameters, and borrow rate from the real portfolio', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.getByText('$50,000.00')).toBeInTheDocument();
    expect(screen.getByText('Protocol Parameters')).toBeInTheDocument();
    expect(screen.getByText('Borrow Rate')).toBeInTheDocument();
    expect(screen.getAllByText('5.00%').length).toBeGreaterThan(0);
  });

  it('itemizes fees, slippage, and gas estimate as unavailable rather than fabricating values', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(
      screen.getByText(/no Formula ID or equation for swap fees, slippage, or gas estimation/),
    ).toBeInTheDocument();
  });

  it('omits the Time Horizon row when the caller supplies null', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.queryByText('Time Horizon')).not.toBeInTheDocument();
  });

  it('renders the Time Horizon row when the caller supplies a label', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={null}
        timeHorizonLabel="30 days"
      />,
    );
    expect(screen.getByText('Time Horizon')).toBeInTheDocument();
    expect(screen.getByText('30 days')).toBeInTheDocument();
  });

  it('shows Manual-Data Status using the portfolio’s own marketUpdatedAt timestamp', () => {
    render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.getByText(/Manual Mode/)).toBeInTheDocument();
    expect(screen.getByText(/No live data provider is connected/)).toBeInTheDocument();
  });

  it('omits Formula Version when metadata is null, and shows it when present', () => {
    const { rerender } = render(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={null}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.queryByText('Formula Version')).not.toBeInTheDocument();

    rerender(
      <StrategyAssumptionsPanel
        portfolio={basePortfolio()}
        metadata={{
          sourceStatus: 'manual',
          calculationTimestamp: '2026-01-01T00:00:00.000Z',
          engineVersion: '1.0.0',
          formulaVersion: '1.0.0',
        }}
        timeHorizonLabel={null}
      />,
    );
    expect(screen.getByText('Formula Version')).toBeInTheDocument();
    expect(screen.getByText('Engine 1.0.0 · Formula 1.0.0')).toBeInTheDocument();
  });
});
