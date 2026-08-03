import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { RecommendationList } from '@/features/recommendations';
import type { TargetHealthFactorActions } from '@/services';
import {
  type RecommendationCenterState,
  useRecommendationCenterStore,
} from '@/stores/recommendationCenterStore';

/**
 * Recommendation List — 06_TASKS.md M7-032. Group by
 * Critical/High/Medium/Informational, filter by category. DoD:
 * "Ordering is deterministic and consistent across sessions." Also
 * exercises M7-035 (Acknowledgement) row interactions.
 */
const INITIAL_STATE = {
  status: 'idle' as const,
  portfolioId: null,
  targetHealthFactor: null,
  actions: null,
  errors: [],
  lastMetadata: null,
  categoryFilter: 'all' as const,
  selectedItemId: null,
  acknowledgements: {},
};

const ACTIONS: TargetHealthFactorActions = {
  targetHealthFactor: 8,
  repayment: {
    category: 'debtManagement',
    triggeringCondition:
      'Current debt exceeds the target debt required to reach the requested Health Factor.',
    relevantValues: {
      currentDebt: 20000,
      targetDebt: 10000,
      targetHealthFactor: 8,
      requiredRepayment: 10000,
      estimatedBtcRequired: 0.2,
    },
    expectedEffect: 'Repaying 10000 would bring Health Factor to approximately 8.',
    decisionPriority: 'Maintain Target Health Factor',
    suggestedAction: 'Repay 10000 (approximately 0.2 BTC at the current price).',
    formulaReferences: ['F-062', 'F-040', 'F-041', 'F-042'],
  },
  additionalCollateral: {
    category: 'collateralManagement',
    triggeringCondition: 'Current collateral is insufficient to reach the requested Health Factor.',
    relevantValues: {
      currentCollateralValue: 100000,
      targetCollateralValue: 200000,
      targetHealthFactor: 8,
      requiredUsd: 100000,
      equivalentBtc: 2,
    },
    expectedEffect: 'Adding 100000 in collateral would bring Health Factor to approximately 8.',
    decisionPriority: 'Maintain Target Health Factor',
    suggestedAction: 'Add 100000 in collateral (approximately 2 BTC at the current price).',
    formulaReferences: ['F-063', 'F-022'],
  },
};

beforeEach(() => {
  useRecommendationCenterStore.setState(INITIAL_STATE);
});

function setReady(overrides: Partial<RecommendationCenterState> = {}) {
  useRecommendationCenterStore.setState({
    ...INITIAL_STATE,
    status: 'ready',
    portfolioId: 'portfolio-1',
    actions: ACTIONS,
    ...overrides,
  });
}

describe('RecommendationList — status gates', () => {
  it('renders nothing before any recalculation has run', () => {
    const { container } = render(<RecommendationList />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a real message when no target Health Factor is configured', () => {
    useRecommendationCenterStore.setState({ ...INITIAL_STATE, status: 'noTarget' });
    render(<RecommendationList />);
    expect(screen.getByText(/No target Health Factor is configured/)).toBeInTheDocument();
  });

  it('shows the real Engine error message on failure', () => {
    useRecommendationCenterStore.setState({
      ...INITIAL_STATE,
      status: 'error',
      errors: [{ category: 'calculation', code: 'X', message: 'Invalid collateral quantity.' }],
    });
    render(<RecommendationList />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid collateral quantity.');
  });
});

describe('RecommendationList — unavailable categories', () => {
  it.each([
    ['safety', /conflict #1/],
    ['interest', /F-065/],
    ['exitReadiness', /F-060-F-069/],
    ['leverage', /conflict #29/],
  ] as const)('shows a real, traceable reason for the %s filter', (category, expected) => {
    setReady({ categoryFilter: category });
    render(<RecommendationList />);
    expect(screen.getByText(/Not available for this category/)).toBeInTheDocument();
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});

describe('RecommendationList — real recommendations, grouping and filtering', () => {
  it('shows both real recommendations under the same severity group when both share a Decision Priority tier', () => {
    setReady();
    render(<RecommendationList />);

    expect(screen.getByRole('heading', { name: 'High' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Current debt exceeds the target debt required to reach the requested Health Factor.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Current collateral is insufficient to reach the requested Health Factor.'),
    ).toBeInTheDocument();
  });

  it('filters to only the Debt category', () => {
    setReady({ categoryFilter: 'debt' });
    render(<RecommendationList />);

    expect(screen.getByText(/Current debt exceeds/)).toBeInTheDocument();
    expect(screen.queryByText(/Current collateral is insufficient/)).not.toBeInTheDocument();
  });

  it('filters to only the Collateral category', () => {
    setReady({ categoryFilter: 'collateral' });
    render(<RecommendationList />);

    expect(screen.queryByText(/Current debt exceeds/)).not.toBeInTheDocument();
    expect(screen.getByText(/Current collateral is insufficient/)).toBeInTheDocument();
  });

  it('renders items in a fixed, deterministic order (repayment before additionalCollateral within the same severity group)', () => {
    setReady();
    render(<RecommendationList />);

    const rows = screen.getAllByRole('button', { name: /High · Maintain Target Health Factor/ });
    expect(rows[0]).toHaveTextContent('Current debt exceeds');
    expect(rows[1]).toHaveTextContent('Current collateral is insufficient');
  });
});

describe('RecommendationList — acknowledgement (M7-035)', () => {
  it('acknowledging an item moves it out of the active groups and into the Acknowledged section', async () => {
    const user = userEvent.setup();
    setReady();
    render(<RecommendationList />);

    const acknowledgeButtons = screen.getAllByRole('button', { name: 'Acknowledge' });
    expect(acknowledgeButtons).toHaveLength(2);
    await user.click(acknowledgeButtons[0]);

    expect(screen.getByRole('heading', { name: 'Acknowledged' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Un-acknowledge' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Acknowledge' })).toHaveLength(1);
  });

  it('un-acknowledging returns the item to the active groups', async () => {
    const user = userEvent.setup();
    setReady({
      acknowledgements: {
        'portfolio-1': { repayment: { ...ACTIONS.repayment.relevantValues } },
      },
    });
    render(<RecommendationList />);

    expect(screen.getByRole('heading', { name: 'Acknowledged' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Un-acknowledge' }));

    expect(screen.queryByRole('heading', { name: 'Acknowledged' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Acknowledge' })).toHaveLength(2);
  });

  it('shows a real message when every item in the filtered category is acknowledged', () => {
    setReady({
      categoryFilter: 'debt',
      acknowledgements: {
        'portfolio-1': { repayment: { ...ACTIONS.repayment.relevantValues } },
      },
    });
    render(<RecommendationList />);

    expect(screen.getByText(/No active recommendations in this category/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Acknowledged' })).toBeInTheDocument();
  });
});
