import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { AaveV3ConflictConfirmation } from '@/app/portfolio/AaveV3ConflictConfirmation';
import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * `AaveV3ConflictConfirmation` — V1.1 Batch 1 (Live-Data Trust Parity).
 * Mirrors `tests/unit/app/portfolio/AaveV4ConflictConfirmation.test.tsx`
 * exactly: renders the real component against a Store pre-populated
 * with pending candidates, rather than driving the whole live-sync flow
 * (already covered end-to-end by
 * `tests/unit/hooks/useAaveLiveSync.test.ts`'s own "V1.1 Batch 1
 * manual/live conflict rule" describe block).
 */
const INITIAL_PORTFOLIO_STATE = {
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle' as const,
  saveStatus: 'idle' as const,
  errors: [],
  lastSynchronizedAt: null,
  v4DebtStateCandidates: {},
  v4CollateralRiskCandidates: {},
  v4DebtStateErrors: {},
  v4CollateralRiskErrors: {},
  marketCandidates: {},
  protocolCandidates: {},
};

const VALID_MARKET_CANDIDATE = { btcPriceUsd: 71000 };
const VALID_PROTOCOL_CANDIDATE = {
  maxLoanToValue: 0.73,
  liquidationThreshold: 0.78,
  borrowApr: 0.0399,
  supplyApr: 0.005,
};

function fakePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'p1',
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    marketSource: 'manual',
    protocolSource: 'manual',
    settings: {},
    archivedAt: null,
    marketUpdatedAt: '2026-01-01T00:00:00.000Z',
    protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_PORTFOLIO_STATE);
});

describe('AaveV3ConflictConfirmation', () => {
  it("describes the market panel's buttons via aria-describedby pointing to that panel's own heading", () => {
    usePortfolioStore.setState({
      marketCandidates: { p1: VALID_MARKET_CANDIDATE },
    });
    render(<AaveV3ConflictConfirmation portfolioId="p1" portfolio={fakePortfolio()} />);

    const heading = screen.getByText(
      'Market Price: live Aave data differs from your manual assumption',
    );
    expect(heading).toHaveAttribute('id', 'v3-market-conflict-heading-p1');

    const useLiveData = screen.getByRole('button', { name: 'Use Live Data' });
    const keepManual = screen.getByRole('button', { name: 'Keep Manual' });
    expect(useLiveData).toHaveAttribute('aria-describedby', 'v3-market-conflict-heading-p1');
    expect(keepManual).toHaveAttribute('aria-describedby', 'v3-market-conflict-heading-p1');
  });

  it("describes the protocol panel's buttons via aria-describedby pointing to that panel's own heading", () => {
    usePortfolioStore.setState({
      protocolCandidates: { p1: VALID_PROTOCOL_CANDIDATE },
    });
    render(<AaveV3ConflictConfirmation portfolioId="p1" portfolio={fakePortfolio()} />);

    const heading = screen.getByText(
      'Protocol Parameters: live Aave data differs from your manual assumption',
    );
    expect(heading).toHaveAttribute('id', 'v3-protocol-conflict-heading-p1');

    const useLiveData = screen.getByRole('button', { name: 'Use Live Data' });
    const keepManual = screen.getByRole('button', { name: 'Keep Manual' });
    expect(useLiveData).toHaveAttribute('aria-describedby', 'v3-protocol-conflict-heading-p1');
    expect(keepManual).toHaveAttribute('aria-describedby', 'v3-protocol-conflict-heading-p1');
  });

  it('when both panels are visible together, each pair of buttons is described by its own distinct panel heading', () => {
    usePortfolioStore.setState({
      marketCandidates: { p1: VALID_MARKET_CANDIDATE },
      protocolCandidates: { p1: VALID_PROTOCOL_CANDIDATE },
    });
    render(<AaveV3ConflictConfirmation portfolioId="p1" portfolio={fakePortfolio()} />);

    const useLiveDataButtons = screen.getAllByRole('button', { name: 'Use Live Data' });
    const keepManualButtons = screen.getAllByRole('button', { name: 'Keep Manual' });
    expect(useLiveDataButtons).toHaveLength(2);
    expect(keepManualButtons).toHaveLength(2);

    const describedByValues = [...useLiveDataButtons, ...keepManualButtons].map((button) =>
      button.getAttribute('aria-describedby'),
    );
    expect(describedByValues.every((value) => value !== null)).toBe(true);
    expect(new Set(describedByValues).size).toBe(2);
    expect(describedByValues).toContain('v3-market-conflict-heading-p1');
    expect(describedByValues).toContain('v3-protocol-conflict-heading-p1');
  });

  it('renders nothing when neither dimension has a pending candidate', () => {
    render(<AaveV3ConflictConfirmation portfolioId="p1" portfolio={fakePortfolio()} />);
    expect(screen.queryByRole('button', { name: 'Use Live Data' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('"Keep Manual" dismisses the candidate without writing anything', async () => {
    const user = userEvent.setup();
    usePortfolioStore.setState({
      marketCandidates: { p1: VALID_MARKET_CANDIDATE },
    });
    render(<AaveV3ConflictConfirmation portfolioId="p1" portfolio={fakePortfolio()} />);

    await user.click(screen.getByRole('button', { name: 'Keep Manual' }));

    expect(usePortfolioStore.getState().marketCandidates.p1).toBeUndefined();
  });
});
