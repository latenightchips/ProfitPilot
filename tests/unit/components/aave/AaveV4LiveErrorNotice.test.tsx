import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { AaveV4LiveErrorNotice } from '@/components/aave/AaveV4LiveErrorNotice';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * `AaveV4LiveErrorNotice` — V4 Readiness Audit §12 P0-4. Drives
 * `usePortfolioStore`'s `v4DebtStateErrors`/`v4CollateralRiskErrors`
 * directly (the exact shape `hooks/useAaveV4LiveSync.ts`/
 * `useAaveV4CollateralRiskLiveSync.ts` already write into it), so this
 * suite proves the component's own rendering/independence logic in
 * isolation from the hooks — required regression items 3/4/5 (both
 * failures represented simultaneously; debt success + collateral
 * failure identifies only collateral; collateral success + debt failure
 * identifies only debt) map directly onto "is a map entry present or
 * absent," which is exactly what this component reads.
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

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_PORTFOLIO_STATE);
});

describe('AaveV4LiveErrorNotice — renders nothing when there is nothing to show', () => {
  it('renders null for a portfolio with no recorded errors (covers V3, and a V4 portfolio with no failure)', () => {
    const { container } = render(<AaveV4LiveErrorNotice portfolioId="portfolio-1" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AaveV4LiveErrorNotice — debt-only failure', () => {
  it('shows only the Debt State notice, with its exact message and code', () => {
    usePortfolioStore.setState({
      v4DebtStateErrors: {
        'portfolio-1': {
          code: 'AAVE_V4_RPC_TIMEOUT',
          message: 'The Aave V4 data request timed out. Please try again.',
        },
      },
    });
    render(<AaveV4LiveErrorNotice portfolioId="portfolio-1" />);

    expect(screen.getByText('Debt State: live sync failed')).toBeInTheDocument();
    expect(
      screen.getByText('The Aave V4 data request timed out. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Error code: AAVE_V4_RPC_TIMEOUT')).toBeInTheDocument();
    expect(screen.queryByText('Collateral Risk: live sync failed')).not.toBeInTheDocument();
  });

  it('omits the "Error code" line for an unclassified (code: null) failure', () => {
    usePortfolioStore.setState({
      v4DebtStateErrors: {
        'portfolio-1': {
          code: null,
          message: 'Live Aave V4 data is temporarily unavailable.',
        },
      },
    });
    render(<AaveV4LiveErrorNotice portfolioId="portfolio-1" />);

    expect(screen.getByText('Live Aave V4 data is temporarily unavailable.')).toBeInTheDocument();
    expect(screen.queryByText(/Error code:/)).not.toBeInTheDocument();
  });
});

describe('AaveV4LiveErrorNotice — collateral-risk-only failure', () => {
  it('shows only the Collateral Risk notice — debt succeeded, so no debt entry exists', () => {
    usePortfolioStore.setState({
      v4CollateralRiskErrors: {
        'portfolio-1': {
          code: 'AAVE_V4_RPC_NETWORK_ERROR',
          message: 'Could not reach the Ethereum RPC endpoint. Please try again.',
        },
      },
    });
    render(<AaveV4LiveErrorNotice portfolioId="portfolio-1" />);

    expect(screen.getByText('Collateral Risk: live sync failed')).toBeInTheDocument();
    expect(
      screen.getByText('Could not reach the Ethereum RPC endpoint. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Debt State: live sync failed')).not.toBeInTheDocument();
  });
});

describe('AaveV4LiveErrorNotice — both dimensions failing simultaneously', () => {
  it('shows both notices at once, neither hidden behind the other', () => {
    usePortfolioStore.setState({
      v4DebtStateErrors: {
        'portfolio-1': {
          code: 'AAVE_V4_RPC_TIMEOUT',
          message: 'The Aave V4 data request timed out. Please try again.',
        },
      },
      v4CollateralRiskErrors: {
        'portfolio-1': {
          code: 'AAVE_V4_RPC_NETWORK_ERROR',
          message: 'Could not reach the Ethereum RPC endpoint. Please try again.',
        },
      },
    });
    render(<AaveV4LiveErrorNotice portfolioId="portfolio-1" />);

    expect(screen.getByText('Debt State: live sync failed')).toBeInTheDocument();
    expect(screen.getByText('Collateral Risk: live sync failed')).toBeInTheDocument();
    expect(
      screen.getByText('The Aave V4 data request timed out. Please try again.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Could not reach the Ethereum RPC endpoint. Please try again.'),
    ).toBeInTheDocument();
  });
});

describe('AaveV4LiveErrorNotice — cross-portfolio isolation', () => {
  it("never shows portfolio A's error under portfolio B's id", () => {
    usePortfolioStore.setState({
      v4DebtStateErrors: {
        'portfolio-a': {
          code: 'AAVE_V4_RPC_TIMEOUT',
          message: 'The Aave V4 data request timed out. Please try again.',
        },
      },
    });
    const { container } = render(<AaveV4LiveErrorNotice portfolioId="portfolio-b" />);
    expect(container).toBeEmptyDOMElement();
  });
});
