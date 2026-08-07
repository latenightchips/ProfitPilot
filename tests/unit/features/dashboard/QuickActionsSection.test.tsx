import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { DashboardMetrics } from '@/features/dashboard';
import { buildQuickActions, QuickActionsSection } from '@/features/dashboard';

/**
 * Quick Actions Section — 06_TASKS.md M5-016.
 */
function metric(label: string, formattedValue: string) {
  return { label, rawValue: 1, formattedValue, status: 'ok' as const, formulaId: null };
}

const METRICS: DashboardMetrics = {
  netPortfolioValue: metric('Net Portfolio Value', '$80,000.00'),
  totalCollateral: metric('Total Collateral', '$100,000.00'),
  totalDebt: metric('Total Debt', '$20,000.00'),
  healthFactor: metric('Health Factor', '3.20'),
  loanToValue: metric('Loan-to-Value', '20.00%'),
  leverage: metric('Effective Leverage', '1.25x'),
  annualInterestCost: metric('Annual Interest Cost', '$1,000.00'),
  liquidationPrice: metric('Liquidation Price', '$25,000.00'),
  liquidationDistance: metric('Distance to Liquidation', '2.20'),
  liquidationBuffer: metric('Liquidation Buffer', '220.00%'),
};

describe('QuickActionsSection — calculation succeeded', () => {
  it('renders every navigation link as a real, working link (M9-017 fix — see buildQuickActions.ts)', () => {
    render(
      <QuickActionsSection
        actions={buildQuickActions(true)}
        portfolioId="abc123"
        portfolioName="My Portfolio"
        calculationTimestamp="2026-07-27T00:00:00.000Z"
        metrics={METRICS}
      />,
    );

    expect(screen.getByRole('link', { name: 'Edit portfolio' })).toHaveAttribute(
      'href',
      '/portfolio',
    );
    expect(screen.getByRole('link', { name: 'Run simulation' })).toHaveAttribute(
      'href',
      '/simulation',
    );
    expect(screen.getByRole('link', { name: 'Build loop strategy' })).toHaveAttribute(
      'href',
      '/loop-builder',
    );
    expect(screen.getByRole('link', { name: 'Create exit plan' })).toHaveAttribute(
      'href',
      '/exit-planner',
    );
    expect(screen.getByRole('link', { name: 'Update prices' })).toHaveAttribute(
      'href',
      '/portfolio',
    );

    expect(screen.getByRole('button', { name: 'Export portfolio (JSON)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export portfolio (CSV)' })).toBeInTheDocument();
  });

  it('Export portfolio (JSON) triggers a real download', async () => {
    const user = userEvent.setup();
    render(
      <QuickActionsSection
        actions={buildQuickActions(true)}
        portfolioId="abc123"
        portfolioName="My Portfolio"
        calculationTimestamp="2026-07-27T00:00:00.000Z"
        metrics={METRICS}
      />,
    );

    const click = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = realCreateElement(tagName);
      if (tagName === 'a') element.click = click;
      return element;
    });
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });

    await user.click(screen.getByRole('button', { name: 'Export portfolio (JSON)' }));
    expect(click).toHaveBeenCalledTimes(1);

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('Export portfolio (CSV) triggers a real download', async () => {
    const user = userEvent.setup();
    render(
      <QuickActionsSection
        actions={buildQuickActions(true)}
        portfolioId="abc123"
        portfolioName="My Portfolio"
        calculationTimestamp="2026-07-27T00:00:00.000Z"
        metrics={METRICS}
      />,
    );

    const click = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = realCreateElement(tagName);
      if (tagName === 'a') element.click = click;
      return element;
    });
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });

    await user.click(screen.getByRole('button', { name: 'Export portfolio (CSV)' }));
    expect(click).toHaveBeenCalledTimes(1);

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});

describe('QuickActionsSection — calculation failed', () => {
  it('disables Export portfolio with a reason, instead of hiding it', () => {
    render(
      <QuickActionsSection
        actions={buildQuickActions(false)}
        portfolioId="abc123"
        portfolioName="My Portfolio"
        calculationTimestamp=""
        metrics={null}
      />,
    );

    const exportButton = screen.getByRole('button', { name: 'Export portfolio' });
    expect(exportButton).toHaveAttribute('aria-disabled', 'true');
    expect(exportButton).toHaveAttribute('title', expect.stringContaining('No calculated summary'));
  });
});
