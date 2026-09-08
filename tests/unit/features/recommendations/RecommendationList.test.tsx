import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { RecommendationList } from '@/features/recommendations';
import type {
  Recommendation,
  RecommendationExplanationSet,
  TargetHealthFactorActions,
} from '@/services';
import { explainTargetHealthFactorActions } from '@/services';
import {
  type RecommendationCenterState,
  useRecommendationCenterStore,
} from '@/stores/recommendationCenterStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Recommendation List — 06_TASKS.md M7-032. Group by
 * Critical/High/Medium/Informational, filter by category. DoD:
 * "Ordering is deterministic and consistent across sessions." Also
 * exercises M7-035 (Acknowledgement) row interactions, M7-037's idle
 * empty state, and M7-038's error recovery (`StrategyErrorBanner`).
 */
const PORTFOLIO: Portfolio = {
  id: 'portfolio-1',
  name: 'Test Portfolio',
  baseCurrency: 'USD',
  collateral: { asset: 'BTC', quantity: 2 },
  debt: { asset: 'USDC', balance: 20000 },
  market: { btcPriceUsd: 50000 },
  protocol: { maxLoanToValue: 0.75, liquidationThreshold: 0.8, borrowApr: 0.05, supplyApr: 0.02 },
  settings: {},
  archivedAt: null,
  marketUpdatedAt: '2026-01-01T00:00:00.000Z',
  protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

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

/** Both recommendations report "no action needed" — used for Section 6/9's healthy/no-action coverage. */
const NO_ACTION_ACTIONS: TargetHealthFactorActions = {
  targetHealthFactor: 1,
  repayment: {
    ...ACTIONS.repayment,
    relevantValues: { ...ACTIONS.repayment.relevantValues, requiredRepayment: 0 },
    suggestedAction: 'No repayment needed.',
  },
  additionalCollateral: {
    ...ACTIONS.additionalCollateral,
    relevantValues: { ...ACTIONS.additionalCollateral.relevantValues, requiredUsd: 0 },
    suggestedAction: 'No additional collateral needed.',
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

describe('RecommendationList — status gates (M7-037 loading/empty states)', () => {
  it('shows a real "preparing" message before any recalculation has run', () => {
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);
    expect(screen.getByText('Preparing recommendations…')).toBeInTheDocument();
  });

  it('shows a real message when no target Health Factor is configured', () => {
    useRecommendationCenterStore.setState({ ...INITIAL_STATE, status: 'noTarget' });
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);
    expect(screen.getByText(/No target Health Factor is configured/)).toBeInTheDocument();
  });
});

describe('RecommendationList — error recovery (M7-038)', () => {
  it('shows the real Engine error via StrategyErrorBanner, with recovery actions, when no prior result exists', () => {
    useRecommendationCenterStore.setState({
      ...INITIAL_STATE,
      status: 'error',
      portfolioId: 'portfolio-1',
      errors: [{ category: 'calculation', code: 'X', message: 'Invalid collateral quantity.' }],
    });
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid collateral quantity.');
    expect(screen.getByRole('link', { name: /Return to Portfolio/ })).toHaveAttribute(
      'href',
      '/portfolio',
    );
    expect(screen.getByRole('button', { name: 'Download recovery copy' })).toBeInTheDocument();
  });

  it('restores the last valid recommendations alongside the error banner', () => {
    useRecommendationCenterStore.setState({
      ...INITIAL_STATE,
      status: 'error',
      portfolioId: 'portfolio-1',
      actions: ACTIONS,
      errors: [{ category: 'calculation', code: 'X', message: 'Invalid collateral quantity.' }],
    });
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid collateral quantity.');
    expect(
      screen.getByText(
        'Current debt exceeds the target debt required to reach the requested Health Factor.',
      ),
    ).toBeInTheDocument();
  });
});

describe('RecommendationList — unavailable categories', () => {
  it.each([
    ['safety', /conflict #1/],
    ['interest', /F-065/],
    ['exitReadiness', /F-060-F-069/],
  ] as const)('shows a real, traceable reason for the %s filter', (category, expected) => {
    setReady({ categoryFilter: category });
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);
    expect(screen.getByText(/Not available for this category/)).toBeInTheDocument();
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  /**
   * v1.18.0 Batch 3 — `leverage` is no longer a permanently-blocked
   * category (spec §8): it moved from the old whole-category
   * `UNAVAILABLE_FILTER_REASONS` banner to a per-item reason sourced
   * from the Store's own `unavailableReasons.loop`, shown without the
   * "Not available for this category" prefix (since `debt` — the other
   * item-level-reason category — is never wholly unavailable).
   */
  it('shows the real, per-portfolio-state reason for Loop under the leverage filter, not the old static Conflict #29 banner', () => {
    setReady({
      categoryFilter: 'leverage',
      unavailableReasons: { loop: 'Configure your Loop preferences to see this recommendation.' },
    });
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);
    expect(
      screen.getByText('Configure your Loop preferences to see this recommendation.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Not available for this category/)).not.toBeInTheDocument();
  });
});

/**
 * Both fixtures use the "not acceptable" / "stop looping" branch —
 * `isActionableRecommendation` (`recommendationTaxonomy.ts`, v1.18.0
 * Batch 3) treats that branch, not the "acceptable"/"loop recommended"
 * one, as the actionable case (spec §8: continuing to borrow/loop safely
 * needs no user attention; being told to stop does) — so these render at
 * the real 'Medium' severity their `decisionPriority` maps to, not
 * demoted to 'Informational'.
 */
const BORROW_RECOMMENDATION: Recommendation = {
  category: 'debtManagement',
  triggeringCondition:
    'One or more of: Health Factor at or below minimum, no available borrow capacity, or Debt Ratio at or above target.',
  relevantValues: {
    healthFactor: 1.2,
    userMinHealthFactor: 1.5,
    availableBorrow: 0,
    debtRatio: 0.6,
    targetDebtRatio: 0.5,
  },
  expectedEffect:
    'Additional borrowing would violate at least one configured safety or leverage limit.',
  decisionPriority: 'Improve Capital Efficiency',
  suggestedAction: 'Do not recommend additional borrowing.',
  formulaReferences: ['F-061', 'F-022', 'F-013', 'F-006'],
};

const LOOP_RECOMMENDATION: Recommendation = {
  category: 'leverage',
  triggeringCondition:
    'One or more of: resulting Health Factor at or below target, no borrow capacity available, or interest cost exceeds the acceptable maximum.',
  relevantValues: {
    newHealthFactor: 7,
    targetHealthFactor: 8,
    availableBorrow: 0,
    annualInterestCost: 6000,
    maxAcceptableAnnualInterestCost: 5000,
  },
  expectedEffect: 'One more loop step would bring Health Factor to approximately 7.',
  decisionPriority: 'Improve Capital Efficiency',
  suggestedAction: 'Stop Looping',
  formulaReferences: ['F-064', 'F-014', 'F-032'],
};

/**
 * v1.18.0 Batch 3 — Borrow/Loop become real, present List items once
 * their own preference pair is complete (spec §8, Goal C). Scenarios
 * S/T/U/W from the Batch 3 test plan.
 */
describe('RecommendationList — Borrow/Loop items (v1.18.0 Batch 3)', () => {
  it('S: shows the Borrow recommendation, with its own real Engine relevantValues-derived copy, once configured', () => {
    setReady({
      actions: {
        repayment: ACTIONS.repayment,
        additionalCollateral: ACTIONS.additionalCollateral,
        borrow: BORROW_RECOMMENDATION,
      },
    });
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);

    expect(
      screen.getByText(
        'One or more of: Health Factor at or below minimum, no available borrow capacity, or Debt Ratio at or above target.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Do not recommend additional borrowing.')).toBeInTheDocument();
  });

  it('S: the Debt filter includes Borrow alongside Repayment', () => {
    setReady({
      categoryFilter: 'debt',
      actions: {
        repayment: ACTIONS.repayment,
        additionalCollateral: ACTIONS.additionalCollateral,
        borrow: BORROW_RECOMMENDATION,
      },
    });
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);

    expect(screen.getByText(/Health Factor at or below minimum/)).toBeInTheDocument();
    expect(screen.getByText(/Current debt exceeds/)).toBeInTheDocument();
    expect(screen.queryByText(/Current collateral is insufficient/)).not.toBeInTheDocument();
  });

  it('T: shows the Loop recommendation, with its own real Engine relevantValues-derived copy, once configured', () => {
    setReady({
      actions: {
        repayment: ACTIONS.repayment,
        additionalCollateral: ACTIONS.additionalCollateral,
        loop: LOOP_RECOMMENDATION,
      },
    });
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);

    expect(
      screen.getByText(
        'One or more of: resulting Health Factor at or below target, no borrow capacity available, or interest cost exceeds the acceptable maximum.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Stop Looping')).toBeInTheDocument();
  });

  it('T: the Leverage filter shows only Loop, never Repayment/Additional Collateral', () => {
    setReady({
      categoryFilter: 'leverage',
      actions: {
        repayment: ACTIONS.repayment,
        additionalCollateral: ACTIONS.additionalCollateral,
        loop: LOOP_RECOMMENDATION,
      },
    });
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);

    expect(screen.getByText(/resulting Health Factor at or below target/)).toBeInTheDocument();
    expect(screen.queryByText(/Current debt exceeds/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Current collateral is insufficient/)).not.toBeInTheDocument();
  });

  it('U: shows the real reason Borrow is unavailable, scoped to the Debt filter, without the old whole-category banner', () => {
    setReady({
      categoryFilter: 'debt',
      actions: { repayment: ACTIONS.repayment, additionalCollateral: ACTIONS.additionalCollateral },
      unavailableReasons: {
        borrow: 'Configure your Borrow preferences to see this recommendation.',
      },
    });
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);

    expect(
      screen.getByText('Configure your Borrow preferences to see this recommendation.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Not available for this category/)).not.toBeInTheDocument();
    expect(screen.getByText(/Current debt exceeds/)).toBeInTheDocument();
  });

  it('W: Repayment/Additional Collateral render unchanged alongside Borrow/Loop once every preference is configured', () => {
    setReady({
      actions: {
        repayment: ACTIONS.repayment,
        additionalCollateral: ACTIONS.additionalCollateral,
        borrow: BORROW_RECOMMENDATION,
        loop: LOOP_RECOMMENDATION,
      },
    });
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);

    expect(screen.getByText(/Current debt exceeds/)).toBeInTheDocument();
    expect(screen.getByText(/Current collateral is insufficient/)).toBeInTheDocument();
    expect(screen.getByText(/Health Factor at or below minimum/)).toBeInTheDocument();
    expect(screen.getByText(/resulting Health Factor at or below target/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'High' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Medium' })).toBeInTheDocument();
  });
});

describe('RecommendationList — real recommendations, grouping and filtering', () => {
  it('shows both real recommendations under the same severity group when both share a Decision Priority tier', () => {
    setReady();
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);

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
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);

    expect(screen.getByText(/Current debt exceeds/)).toBeInTheDocument();
    expect(screen.queryByText(/Current collateral is insufficient/)).not.toBeInTheDocument();
  });

  it('filters to only the Collateral category', () => {
    setReady({ categoryFilter: 'collateral' });
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);

    expect(screen.queryByText(/Current debt exceeds/)).not.toBeInTheDocument();
    expect(screen.getByText(/Current collateral is insufficient/)).toBeInTheDocument();
  });

  it('renders items in a fixed, deterministic order (repayment before additionalCollateral within the same severity group)', () => {
    setReady();
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);

    const rows = screen.getAllByRole('button', { name: /High · Maintain Target Health Factor/ });
    expect(rows[0]).toHaveTextContent('Current debt exceeds');
    expect(rows[1]).toHaveTextContent('Current collateral is insufficient');
  });
});

describe('RecommendationList — acknowledgement (M7-035)', () => {
  it('acknowledging an item moves it out of the active groups and into the Acknowledged section', async () => {
    const user = userEvent.setup();
    setReady();
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);

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
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);

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
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);

    expect(screen.getByText(/No active recommendations in this category/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Acknowledged' })).toBeInTheDocument();
  });
});

/**
 * V1.1 Batch 5, Section 6/9 — a non-actionable ("no action needed")
 * recommendation is demoted to the `'Informational'` severity tier and,
 * once every currently-computed item is non-actionable, a dedicated
 * healthy/no-action banner explains that plainly rather than leaving the
 * user to infer it from two individually-worded rows.
 */
describe('RecommendationList — V1.1 Batch 5: healthy / no-action state', () => {
  it('shows an explicit no-action banner naming the watched Target Health Factor when nothing needs to change', () => {
    setReady({ actions: NO_ACTION_ACTIONS, targetHealthFactor: 1 });
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);

    expect(screen.getByRole('status')).toHaveTextContent('No action needed right now');
    expect(screen.getByRole('status')).toHaveTextContent('(1)');
  });

  it('demotes both items to the Informational tier instead of High when no action is needed', () => {
    setReady({ actions: NO_ACTION_ACTIONS, targetHealthFactor: 1 });
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);

    expect(screen.getByRole('heading', { name: 'Informational' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'High' })).not.toBeInTheDocument();
  });

  it('does not show the no-action banner when at least one recommendation is actionable', () => {
    setReady();
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('RecommendationList — V1.1 Batch 5: confidence badge', () => {
  it('shows each row’s confidence category from the supplied explanations, without needing to open the Detail Panel', () => {
    setReady();
    const explanations: RecommendationExplanationSet = explainTargetHealthFactorActions(
      PORTFOLIO,
      PORTFOLIO.id,
      PORTFOLIO.updatedAt,
      ACTIONS,
      'Medium confidence',
    );
    render(<RecommendationList portfolio={PORTFOLIO} explanations={explanations} />);

    expect(screen.getAllByText(/Medium confidence/)).toHaveLength(2);
  });

  it('renders no confidence text when explanations is null (backward compatible)', () => {
    setReady();
    render(<RecommendationList portfolio={PORTFOLIO} explanations={null} />);
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
  });
});
