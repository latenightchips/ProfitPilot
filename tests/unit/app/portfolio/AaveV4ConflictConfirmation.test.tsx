import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { AaveV4ConflictConfirmation } from '@/app/portfolio/AaveV4ConflictConfirmation';
import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * `AaveV4ConflictConfirmation` — V4 Readiness Audit §12 P3-3.
 * `aria-describedby` accessibility fix for the "Use Live Data"/"Keep
 * Manual" buttons — see that component's own header comment for the
 * full reasoning. Renders the real component against a Store
 * pre-populated with pending candidates, rather than driving the whole
 * live-sync flow (already covered end-to-end by
 * `tests/integration/portfolio/aaveV4ManualLiveConflict.test.tsx`).
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
};

const VALID_V4_DEBT_STATE = {
  drawnDebt: 15000,
  premiumDebt: 500,
  baseDrawnApr: 0.05,
  riskPremium: 0.01,
};

const VALID_V4_COLLATERAL_RISK = { collateralFactor: 0.65, dynamicConfigKey: 1 };

function fakePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'p1',
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.5,
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
    protocolVersion: 'v4',
    ...overrides,
  };
}

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_PORTFOLIO_STATE);
});

describe('AaveV4ConflictConfirmation — accessible descriptions (P3-3)', () => {
  it("describes the debt-state panel's buttons via aria-describedby pointing to that panel's own heading", () => {
    usePortfolioStore.setState({
      v4DebtStateCandidates: { p1: VALID_V4_DEBT_STATE },
    });
    render(<AaveV4ConflictConfirmation portfolioId="p1" portfolio={fakePortfolio()} />);

    const heading = screen.getByText(
      'Debt State: live Aave data differs from your manual assumption',
    );
    expect(heading).toHaveAttribute('id', 'v4-debt-state-conflict-heading-p1');

    const useLiveData = screen.getByRole('button', { name: 'Use Live Data' });
    const keepManual = screen.getByRole('button', { name: 'Keep Manual' });
    expect(useLiveData).toHaveAttribute('aria-describedby', 'v4-debt-state-conflict-heading-p1');
    expect(keepManual).toHaveAttribute('aria-describedby', 'v4-debt-state-conflict-heading-p1');
  });

  it("describes the collateral-risk panel's buttons via aria-describedby pointing to that panel's own heading", () => {
    usePortfolioStore.setState({
      v4CollateralRiskCandidates: { p1: VALID_V4_COLLATERAL_RISK },
    });
    render(<AaveV4ConflictConfirmation portfolioId="p1" portfolio={fakePortfolio()} />);

    const heading = screen.getByText(
      'Collateral Risk: live Aave data differs from your manual assumption',
    );
    expect(heading).toHaveAttribute('id', 'v4-collateral-risk-conflict-heading-p1');

    const useLiveData = screen.getByRole('button', { name: 'Use Live Data' });
    const keepManual = screen.getByRole('button', { name: 'Keep Manual' });
    expect(useLiveData).toHaveAttribute(
      'aria-describedby',
      'v4-collateral-risk-conflict-heading-p1',
    );
    expect(keepManual).toHaveAttribute(
      'aria-describedby',
      'v4-collateral-risk-conflict-heading-p1',
    );
  });

  /**
   * The exact reachable scenario this fix targets — see
   * `AaveV4ConflictConfirmation.tsx`'s own header comment: "both can be
   * visible simultaneously if both dimensions happen to be in conflict at
   * once." Previously, all four buttons had the same accessible name with
   * nothing distinguishing which panel each belonged to.
   */
  it('when both panels are visible together, each pair of buttons is described by its own distinct panel heading', () => {
    usePortfolioStore.setState({
      v4DebtStateCandidates: { p1: VALID_V4_DEBT_STATE },
      v4CollateralRiskCandidates: { p1: VALID_V4_COLLATERAL_RISK },
    });
    render(<AaveV4ConflictConfirmation portfolioId="p1" portfolio={fakePortfolio()} />);

    const useLiveDataButtons = screen.getAllByRole('button', { name: 'Use Live Data' });
    const keepManualButtons = screen.getAllByRole('button', { name: 'Keep Manual' });
    expect(useLiveDataButtons).toHaveLength(2);
    expect(keepManualButtons).toHaveLength(2);

    const describedByValues = [...useLiveDataButtons, ...keepManualButtons].map((button) =>
      button.getAttribute('aria-describedby'),
    );
    // Every button has a description, and the debt-state pair and the
    // collateral-risk pair point to two DIFFERENT heading ids — a screen
    // reader can now tell them apart even without the surrounding visual
    // context.
    expect(describedByValues.every((value) => value !== null)).toBe(true);
    expect(new Set(describedByValues).size).toBe(2);
    expect(describedByValues).toContain('v4-debt-state-conflict-heading-p1');
    expect(describedByValues).toContain('v4-collateral-risk-conflict-heading-p1');
  });

  it('renders nothing when neither dimension has a pending candidate', () => {
    render(<AaveV4ConflictConfirmation portfolioId="p1" portfolio={fakePortfolio()} />);
    expect(screen.queryByRole('button', { name: 'Use Live Data' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('visible button text and click behavior are unchanged', async () => {
    const user = userEvent.setup();
    usePortfolioStore.setState({
      v4DebtStateCandidates: { p1: VALID_V4_DEBT_STATE },
    });
    render(<AaveV4ConflictConfirmation portfolioId="p1" portfolio={fakePortfolio()} />);

    await user.click(screen.getByRole('button', { name: 'Keep Manual' }));

    expect(usePortfolioStore.getState().v4DebtStateCandidates.p1).toBeUndefined();
  });
});
