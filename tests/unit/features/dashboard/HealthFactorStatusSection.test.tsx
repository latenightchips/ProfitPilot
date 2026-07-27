import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { buildHealthFactorStatus, HealthFactorStatusSection } from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Health Factor Status Component — 06_TASKS.md M5-007.
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

function buildStatus(overrides: Record<string, unknown> = {}) {
  const created = usePortfolioStore.getState().create(validInput(overrides));
  if (!created.ok) throw new Error('setup failed');
  const record = usePortfolioStore.getState().portfolios[created.data.id];
  if (!record.summary.ok) throw new Error('expected a successful summary');
  return buildHealthFactorStatus(record.portfolio, record.summary.data);
}

describe('HealthFactorStatusSection — no target configured', () => {
  it('renders the current Health Factor and explanation, without a target or required actions', () => {
    render(<HealthFactorStatusSection status={buildStatus()} />);
    expect(screen.getByText('Current Health Factor')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.queryByText('Configured Target')).not.toBeInTheDocument();
    expect(
      screen.getByText('No target Health Factor is configured for this portfolio.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Required action to restore target:')).not.toBeInTheDocument();
  });
});

describe('HealthFactorStatusSection — target configured', () => {
  it('renders the target, distance, and both real required actions', () => {
    render(
      <HealthFactorStatusSection
        status={buildStatus({ settings: { safetyTargets: { targetHealthFactor: 5 } } })}
      />,
    );
    expect(screen.getByText('Configured Target')).toBeInTheDocument();
    expect(screen.getByText('Distance From Target')).toBeInTheDocument();
    expect(screen.getByText('Required action to restore target:')).toBeInTheDocument();
  });
});

describe('HealthFactorStatusSection — Formula reference', () => {
  it('exposes F-022 as a tooltip on the Current Health Factor value', () => {
    render(<HealthFactorStatusSection status={buildStatus()} />);
    expect(screen.getByText('Current Health Factor').closest('[title]')).toHaveAttribute(
      'title',
      'F-022 — see docs/02_Formulas.md',
    );
  });

  it('is keyboard-focusable, so the tooltip is reachable without a mouse (M5-028, Batch 18)', () => {
    render(<HealthFactorStatusSection status={buildStatus()} />);
    expect(screen.getByText('Current Health Factor').closest('[title]')).toHaveAttribute(
      'tabIndex',
      '0',
    );
  });
});

describe('HealthFactorStatusSection — Risk classification is not rendered (Conflict #1)', () => {
  it('never renders a risk-band label like "Healthy" or "Critical"', () => {
    render(<HealthFactorStatusSection status={buildStatus()} />);
    for (const label of ['Healthy', 'Critical', 'Safe', 'Elevated']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });
});

describe('HealthFactorStatusSection — zero debt (M5-025, Batch 15)', () => {
  it('renders the Infinity Health Factor as "∞", not NaN or a crash', () => {
    const status = buildStatus({ debt: { asset: 'USDC', balance: 0 } });
    expect(status.currentHealthFactor).toBe(Infinity);

    render(<HealthFactorStatusSection status={status} />);

    expect(screen.getByText('Current Health Factor')).toBeInTheDocument();
    expect(screen.getByText('∞')).toBeInTheDocument();
  });
});

describe('HealthFactorStatusSection — critical (near-liquidation) Health Factor (M5-025, Batch 15)', () => {
  it('renders a real Health Factor just above 1.0 without clamping, rounding to 1, or crashing', () => {
    // 2 BTC * $50,000 * 0.8 liquidation threshold / $79,000 debt ≈ 1.0127 — deliberately close to the liquidation boundary (1.0).
    const status = buildStatus({ debt: { asset: 'USDC', balance: 79000 } });
    expect(status.currentHealthFactor).toBeGreaterThan(1);
    expect(status.currentHealthFactor).toBeLessThan(1.1);

    render(<HealthFactorStatusSection status={status} />);

    expect(screen.getByText(status.formattedCurrentHealthFactor)).toBeInTheDocument();
  });
});
