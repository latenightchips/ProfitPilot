import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RecommendationDetailPanel } from '@/features/recommendations';
import type { RecommendationExplanationSet, TargetHealthFactorActions } from '@/services';
import { calculateTargetHealthFactorActions, explainTargetHealthFactorActions } from '@/services';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useRecommendationCenterStore } from '@/stores/recommendationCenterStore';
import { useSimulationStore } from '@/stores/simulationStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Recommendation Detail Panel — 06_TASKS.md M7-033/M7-034. DoD: "Every
 * recommendation is understandable and traceable" / "Users can
 * investigate a recommendation without re-entering known data."
 */
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const RECOMMENDATION_CENTER_INITIAL_STATE = {
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

const EXIT_PLANNER_INITIAL_STATE = {
  exitType: null,
  targetInputs: null,
  currentResult: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  lastMetadata: null,
  priceSensitivity: null,
  priceSensitivityErrors: [],
  savedPlans: [],
  selectedPlanId: null,
};

const SIMULATION_INITIAL_STATE = {
  currentScenario: null,
  currentResult: null,
  portfolioActionPreview: null,
  savedScenarios: [],
  comparisonSelection: [],
  timelineProjection: null,
  lastMetadata: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  previewMode: false,
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

const PORTFOLIO: Portfolio = {
  id: 'portfolio-1',
  name: 'Test Portfolio',
  baseCurrency: 'USD',
  collateral: { asset: 'BTC', quantity: 2 },
  debt: { asset: 'USDC', balance: 20000 },
  market: { btcPriceUsd: 50000 },
  protocol: { maxLoanToValue: 0.75, liquidationThreshold: 0.8, borrowApr: 0.05, supplyApr: 0.02 },
  settings: { safetyTargets: { targetHealthFactor: 8 } },
  archivedAt: null,
  marketUpdatedAt: '2026-01-01T00:00:00.000Z',
  protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const PORTFOLIO_STORE_INITIAL_STATE = {
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle' as const,
  saveStatus: 'idle' as const,
  errors: [],
  lastSynchronizedAt: null,
};

beforeEach(() => {
  useRecommendationCenterStore.setState(RECOMMENDATION_CENTER_INITIAL_STATE);
  useExitPlannerStore.setState(EXIT_PLANNER_INITIAL_STATE);
  useSimulationStore.setState(SIMULATION_INITIAL_STATE);
  usePortfolioStore.setState(PORTFOLIO_STORE_INITIAL_STATE);
  window.localStorage.clear();
  push.mockClear();
});

function setReady(selectedItemId: 'repayment' | 'additionalCollateral' | null, overrides = {}) {
  useRecommendationCenterStore.setState({
    ...RECOMMENDATION_CENTER_INITIAL_STATE,
    status: 'ready',
    portfolioId: 'portfolio-1',
    targetHealthFactor: 8,
    actions: ACTIONS,
    selectedItemId,
    lastMetadata: {
      engineVersion: '1.0',
      formulaVersion: '1.0',
      sourceStatus: 'manual',
      calculationTimestamp: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  });
}

describe('RecommendationDetailPanel — no selection', () => {
  it('prompts the user to select a recommendation', () => {
    render(<RecommendationDetailPanel portfolio={PORTFOLIO} explanations={null} />);
    expect(
      screen.getByText('Select a recommendation from the list to see its full explanation.'),
    ).toBeInTheDocument();
  });
});

describe('RecommendationDetailPanel — repayment (M7-033 Include items)', () => {
  it('shows the triggering condition, all current values, risk level, suggested action, and expected effect', () => {
    setReady('repayment');
    render(<RecommendationDetailPanel portfolio={PORTFOLIO} explanations={null} />);

    expect(
      screen.getByText(
        'Current debt exceeds the target debt required to reach the requested Health Factor.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Current Debt')).toBeInTheDocument();
    expect(screen.getByText('Target Debt')).toBeInTheDocument();
    expect(screen.getByText('Required Repayment')).toBeInTheDocument();
    expect(screen.getByText('Estimated BTC Required')).toBeInTheDocument();
    expect(screen.getByText('High — Maintain Target Health Factor')).toBeInTheDocument();
    expect(
      screen.getByText('Repay 10000 (approximately 0.2 BTC at the current price).'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Repaying 10000 would bring Health Factor to approximately 8.'),
    ).toBeInTheDocument();
  });

  it('shows the Formula IDs and Formula Version', () => {
    setReady('repayment');
    render(<RecommendationDetailPanel portfolio={PORTFOLIO} explanations={null} />);
    expect(screen.getByText('F-062, F-040, F-041, F-042')).toBeInTheDocument();
    expect(screen.getByText('Engine 1.0 · Formula 1.0')).toBeInTheDocument();
  });

  it('omits Formula Version when no metadata is available', () => {
    setReady('repayment', { lastMetadata: null });
    render(<RecommendationDetailPanel portfolio={PORTFOLIO} explanations={null} />);
    expect(screen.queryByText('Formula Version')).not.toBeInTheDocument();
  });

  it('clicking the related-tool action prefills Exit Planner and navigates, without mutating the portfolio', () => {
    setReady('repayment');
    render(<RecommendationDetailPanel portfolio={PORTFOLIO} explanations={null} />);

    screen.getByRole('button', { name: 'Open Exit Planner with this target' }).click();

    expect(useExitPlannerStore.getState().exitType).toBe('partialDebtRepayment');
    expect(useExitPlannerStore.getState().targetInputs).toEqual({ repaymentAmount: 10000 });
    expect(push).toHaveBeenCalledWith('/exit-planner');
  });

  it('hides the action link and shows "no action needed" when no repayment is required', () => {
    setReady('repayment', {
      actions: {
        ...ACTIONS,
        repayment: {
          ...ACTIONS.repayment,
          relevantValues: { ...ACTIONS.repayment.relevantValues, requiredRepayment: 0 },
        },
      },
    });
    render(<RecommendationDetailPanel portfolio={PORTFOLIO} explanations={null} />);

    expect(
      screen.queryByRole('button', { name: 'Open Exit Planner with this target' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/No action needed/)).toBeInTheDocument();
  });
});

describe('RecommendationDetailPanel — additionalCollateral', () => {
  it('shows the collateral-specific current values', () => {
    setReady('additionalCollateral');
    render(<RecommendationDetailPanel portfolio={PORTFOLIO} explanations={null} />);

    expect(screen.getByText('Current Collateral Value')).toBeInTheDocument();
    expect(screen.getByText('Required Additional Collateral (USD)')).toBeInTheDocument();
    expect(screen.getByText('Equivalent BTC')).toBeInTheDocument();
  });

  it('clicking the related-tool action runs a real Simulation action scenario and navigates, without mutating the live portfolio', async () => {
    const user = userEvent.setup();
    setReady('additionalCollateral');
    render(<RecommendationDetailPanel portfolio={PORTFOLIO} explanations={null} />);

    await user.click(
      screen.getByRole('button', { name: 'Open Simulation Workspace with this target' }),
    );

    const preview = useSimulationStore.getState().portfolioActionPreview;
    expect(preview).not.toBeNull();
    // collateralDelta of 2 BTC added to the portfolio's own 2 BTC — a
    // real, independently-computed Simulation result, not a fabricated one.
    expect(preview?.after.collateralValue).toBe(200000);
    expect(push).toHaveBeenCalledWith('/simulation');
  });

  it('hides the action link when no additional collateral is required', () => {
    setReady('additionalCollateral', {
      actions: {
        ...ACTIONS,
        additionalCollateral: {
          ...ACTIONS.additionalCollateral,
          relevantValues: { ...ACTIONS.additionalCollateral.relevantValues, requiredUsd: 0 },
        },
      },
    });
    render(<RecommendationDetailPanel portfolio={PORTFOLIO} explanations={null} />);

    expect(
      screen.queryByRole('button', { name: 'Open Simulation Workspace with this target' }),
    ).not.toBeInTheDocument();
  });
});

/**
 * V1.1 Batch 5 ("Recommendation Quality & Explainability"). Uses a real
 * portfolio (`usePortfolioStore().create(...)`) rather than the plain
 * `PORTFOLIO` fixture above, since the Apply-to-Portfolio flow at the
 * bottom of this describe block needs a real store record to write into
 * — the same discipline `ApplyExitPlanToPortfolio.test.tsx` already
 * establishes for the identical reason.
 */
function createValidPortfolio(): Portfolio {
  const result = usePortfolioStore.getState().create({
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: { maxLoanToValue: 0.75, liquidationThreshold: 0.8, borrowApr: 0.05, supplyApr: 0.02 },
    settings: { safetyTargets: { targetHealthFactor: 5 } },
  });
  if (!result.ok) throw new Error('setup failed');
  return result.data;
}

function readyWithRealExplanations(portfolio: Portfolio): RecommendationExplanationSet {
  const actionsResult = calculateTargetHealthFactorActions(portfolio, 5, 'manual');
  if (!actionsResult.ok) throw new Error('setup failed');
  const explanations = explainTargetHealthFactorActions(
    portfolio,
    portfolio.id,
    portfolio.updatedAt,
    actionsResult.data,
    'High confidence',
  );
  useRecommendationCenterStore.setState({
    ...RECOMMENDATION_CENTER_INITIAL_STATE,
    status: 'ready',
    portfolioId: portfolio.id,
    targetHealthFactor: 5,
    actions: actionsResult.data,
    selectedItemId: 'repayment',
  });
  return explanations;
}

describe('RecommendationDetailPanel — V1.1 Batch 5: explanation extras', () => {
  it('shows Quantified Impact, Risk/Tradeoff, Cost Impact, and Data Confidence for an actionable recommendation', () => {
    const portfolio = createValidPortfolio();
    const explanations = readyWithRealExplanations(portfolio);

    render(<RecommendationDetailPanel portfolio={portfolio} explanations={explanations} />);

    expect(screen.getByText('Quantified Impact')).toBeInTheDocument();
    expect(screen.getByText('Risk / Tradeoff')).toBeInTheDocument();
    expect(screen.getByText(explanations.repayment.risk)).toBeInTheDocument();
    expect(screen.getByText('Cost Impact')).toBeInTheDocument();
    expect(screen.getByText(explanations.repayment.costBenefit)).toBeInTheDocument();
    expect(screen.getByText('Data Confidence')).toBeInTheDocument();
    expect(screen.getByText('High confidence')).toBeInTheDocument();
  });

  it('omits Quantified Impact when the recommendation reports no action needed (no fabricated zero-change row)', () => {
    const portfolio = createValidPortfolio();
    // Target below the current HF — both recommendations report "no action needed."
    const actionsResult = calculateTargetHealthFactorActions(portfolio, 1, 'manual');
    if (!actionsResult.ok) throw new Error('setup failed');
    const explanations = explainTargetHealthFactorActions(
      portfolio,
      portfolio.id,
      portfolio.updatedAt,
      actionsResult.data,
      'High confidence',
    );
    useRecommendationCenterStore.setState({
      ...RECOMMENDATION_CENTER_INITIAL_STATE,
      status: 'ready',
      portfolioId: portfolio.id,
      targetHealthFactor: 1,
      actions: actionsResult.data,
      selectedItemId: 'repayment',
    });

    render(<RecommendationDetailPanel portfolio={portfolio} explanations={explanations} />);

    expect(screen.queryByText('Quantified Impact')).not.toBeInTheDocument();
    // Risk/Cost/Confidence still explain the (non-actionable) recommendation.
    expect(screen.getByText('Risk / Tradeoff')).toBeInTheDocument();
  });

  it('renders nothing extra when explanations is null (backward compatible with the pre-Batch-5 Detail Panel)', () => {
    const portfolio = createValidPortfolio();
    readyWithRealExplanations(portfolio);
    render(<RecommendationDetailPanel portfolio={portfolio} explanations={null} />);

    expect(screen.queryByText('Quantified Impact')).not.toBeInTheDocument();
    expect(screen.queryByText('Risk / Tradeoff')).not.toBeInTheDocument();
    expect(screen.queryByText('Data Confidence')).not.toBeInTheDocument();
  });
});

describe('RecommendationDetailPanel — V1.1 Batch 5, Section 7: Apply to Portfolio (reuses Batch 3 infrastructure)', () => {
  it('reviewing then confirming Apply writes the real repaid debt to the tracked portfolio', () => {
    const portfolio = createValidPortfolio();
    const explanations = readyWithRealExplanations(portfolio);

    render(<RecommendationDetailPanel portfolio={portfolio} explanations={explanations} />);

    fireEvent.click(screen.getByRole('button', { name: 'Review Apply to Portfolio' }));
    expect(screen.getByText(/does not execute transactions on Aave/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Apply to Portfolio$/i }));

    const record = usePortfolioStore.getState().portfolios[portfolio.id];
    expect(record.portfolio.debt.balance).toBeCloseTo(
      20000 - explanations.repayment.recommendation.relevantValues.requiredRepayment,
      6,
    );
    expect(screen.getByText('Applied to portfolio.')).toBeInTheDocument();
  });

  it('Cancel discards the review without touching the portfolio', () => {
    const portfolio = createValidPortfolio();
    const explanations = readyWithRealExplanations(portfolio);

    render(<RecommendationDetailPanel portfolio={portfolio} explanations={explanations} />);

    fireEvent.click(screen.getByRole('button', { name: 'Review Apply to Portfolio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.debt.balance).toBe(
      20000,
    );
    expect(screen.getByRole('button', { name: 'Review Apply to Portfolio' })).toBeInTheDocument();
  });

  it('does not show an Apply-to-Portfolio trigger when the recommendation reports no action needed', () => {
    const portfolio = createValidPortfolio();
    const actionsResult = calculateTargetHealthFactorActions(portfolio, 1, 'manual');
    if (!actionsResult.ok) throw new Error('setup failed');
    const explanations = explainTargetHealthFactorActions(
      portfolio,
      portfolio.id,
      portfolio.updatedAt,
      actionsResult.data,
      'High confidence',
    );
    useRecommendationCenterStore.setState({
      ...RECOMMENDATION_CENTER_INITIAL_STATE,
      status: 'ready',
      portfolioId: portfolio.id,
      targetHealthFactor: 1,
      actions: actionsResult.data,
      selectedItemId: 'repayment',
    });

    render(<RecommendationDetailPanel portfolio={portfolio} explanations={explanations} />);

    expect(
      screen.queryByRole('button', { name: 'Review Apply to Portfolio' }),
    ).not.toBeInTheDocument();
  });
});
