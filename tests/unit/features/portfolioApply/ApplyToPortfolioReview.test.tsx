import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApplyToPortfolioReview } from '@/features/portfolioApply';
import { calculatePortfolioSummary, type PortfolioApplyProposal } from '@/services';
import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * `ApplyToPortfolioReview` — V1.1 Batch 3, Section 3 ("Confirmation
 * UX"). A real portfolio (`usePortfolioStore().create()`) and a real
 * proposal (`calculatePortfolioSummary`) are used throughout, not mocks
 * — this component's own job is to correctly reflect real before/after
 * numbers and to call the real Store action, which these tests verify
 * end to end.
 */
const INITIAL_STATE = {
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle' as const,
  saveStatus: 'idle' as const,
  errors: [],
  lastSynchronizedAt: null,
};

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_STATE);
  window.localStorage.clear();
});

function createValidPortfolio(overrides: Record<string, unknown> = {}): Portfolio {
  const result = usePortfolioStore.getState().create({
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: { maxLoanToValue: 0.75, liquidationThreshold: 0.8, borrowApr: 0.05, supplyApr: 0.02 },
    settings: {},
    ...overrides,
  });
  if (!result.ok) throw new Error('setup failed');
  return result.data;
}

function proposalFor(
  portfolio: Portfolio,
  proposedCollateralQuantity: number,
  proposedDebtBalance: number,
): PortfolioApplyProposal {
  const proposedPortfolio = {
    ...portfolio,
    collateral: { asset: portfolio.collateral.asset, quantity: proposedCollateralQuantity },
    debt: { asset: portfolio.debt.asset, balance: proposedDebtBalance },
  };
  const before = calculatePortfolioSummary(portfolio, 'manual');
  const after = calculatePortfolioSummary(proposedPortfolio, 'manual');
  if (!before.ok || !after.ok) throw new Error('setup failed');

  return {
    sourceWorkflow: 'loopBuilder',
    portfolioId: portfolio.id,
    sourcePortfolioUpdatedAt: portfolio.updatedAt,
    protocolVersion: 'v3',
    proposedPortfolio,
    unchangedAssumptions: ['Market price', 'Protocol interest rates'],
    before: before.data,
    after: after.data,
    valueBasis: 'hypothetical',
    generatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('ApplyToPortfolioReview — content', () => {
  it('states plainly that this is not an on-chain transaction', () => {
    const portfolio = createValidPortfolio();
    const proposal = proposalFor(portfolio, 3, 30000);
    render(
      <ApplyToPortfolioReview
        portfolio={portfolio}
        proposal={proposal}
        onApplied={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/does not execute transactions on Aave/i)).toBeInTheDocument();
  });

  it('renders every unchanged assumption', () => {
    const portfolio = createValidPortfolio();
    const proposal = proposalFor(portfolio, 3, 30000);
    render(
      <ApplyToPortfolioReview
        portfolio={portfolio}
        proposal={proposal}
        onApplied={() => {}}
        onCancel={() => {}}
      />,
    );
    for (const assumption of proposal.unchangedAssumptions) {
      expect(screen.getByText(assumption)).toBeInTheDocument();
    }
  });

  it('renders "No liquidation risk" and "∞" for a full-repay (zero-debt) proposal, not a fabricated number', () => {
    const portfolio = createValidPortfolio();
    const proposal = proposalFor(portfolio, 2, 0);
    expect(proposal.after.healthFactor).toBe(Infinity);
    render(
      <ApplyToPortfolioReview
        portfolio={portfolio}
        proposal={proposal}
        onApplied={() => {}}
        onCancel={() => {}}
      />,
    );
    // "∞" is the "after" side of a "4 → ∞" before/after delta, a raw
    // text node among sibling nodes within the same <dd> (not its own
    // isolated element) — matched via the row's own <dd> textContent
    // rather than `getByText('∞')`, which only matches a single
    // element's own normalized text.
    const healthFactorRow = screen.getByText('Health Factor').closest('div');
    expect(healthFactorRow?.textContent).toContain('∞');
    const liquidationRow = screen.getByText('Liquidation Price').closest('div');
    expect(liquidationRow?.textContent).toContain('No liquidation risk');
  });
});

describe('ApplyToPortfolioReview — Confirm', () => {
  it('applies the proposal via the real Store action and calls onApplied on success', () => {
    const portfolio = createValidPortfolio();
    const proposal = proposalFor(portfolio, 3, 30000);
    const onApplied = vi.fn();
    render(
      <ApplyToPortfolioReview
        portfolio={portfolio}
        proposal={proposal}
        onApplied={onApplied}
        onCancel={() => {}}
      />,
    );

    screen.getByRole('button', { name: /Apply to Portfolio/i }).click();

    expect(onApplied).toHaveBeenCalledTimes(1);
    const record = usePortfolioStore.getState().portfolios[portfolio.id];
    expect(record.portfolio.collateral.quantity).toBe(3);
    expect(record.portfolio.debt.balance).toBe(30000);
  });

  it('shows an alert and does not call onApplied when the Store action fails (e.g. a stale proposal)', () => {
    const portfolio = createValidPortfolio();
    const proposal = proposalFor(portfolio, 3, 30000);
    // Make the portfolio stale relative to the proposal — a forced later
    // system time, not just a second `update()` call, since `updatedAt`
    // is millisecond-precision and a same-tick create+update in a fast
    // test run can otherwise land on the identical timestamp.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.parse(portfolio.updatedAt) + 60_000));
    usePortfolioStore.getState().update(portfolio.id, { name: 'Renamed' });
    vi.useRealTimers();
    const onApplied = vi.fn();

    render(
      <ApplyToPortfolioReview
        portfolio={portfolio}
        proposal={proposal}
        onApplied={onApplied}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Apply to Portfolio/i }));

    expect(onApplied).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('ApplyToPortfolioReview — Cancel', () => {
  it('calls onCancel and never touches the Store (no mutation, Section 3: "Do not silently apply results")', () => {
    const portfolio = createValidPortfolio();
    const proposal = proposalFor(portfolio, 3, 30000);
    const onCancel = vi.fn();
    const applyPortfolioState = vi.spyOn(usePortfolioStore.getState(), 'applyPortfolioState');

    render(
      <ApplyToPortfolioReview
        portfolio={portfolio}
        proposal={proposal}
        onApplied={() => {}}
        onCancel={onCancel}
      />,
    );
    screen.getByRole('button', { name: /Cancel/i }).click();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(applyPortfolioState).not.toHaveBeenCalled();
    const record = usePortfolioStore.getState().portfolios[portfolio.id];
    expect(record.portfolio.collateral.quantity).toBe(portfolio.collateral.quantity);

    applyPortfolioState.mockRestore();
  });
});
