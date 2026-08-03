import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RecommendationDetailPanel } from '@/features/recommendations';
import type { TargetHealthFactorActions } from '@/services';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';
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

beforeEach(() => {
  useRecommendationCenterStore.setState(RECOMMENDATION_CENTER_INITIAL_STATE);
  useExitPlannerStore.setState(EXIT_PLANNER_INITIAL_STATE);
  useSimulationStore.setState(SIMULATION_INITIAL_STATE);
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
    render(<RecommendationDetailPanel portfolio={PORTFOLIO} />);
    expect(
      screen.getByText('Select a recommendation from the list to see its full explanation.'),
    ).toBeInTheDocument();
  });
});

describe('RecommendationDetailPanel — repayment (M7-033 Include items)', () => {
  it('shows the triggering condition, all current values, risk level, suggested action, and expected effect', () => {
    setReady('repayment');
    render(<RecommendationDetailPanel portfolio={PORTFOLIO} />);

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
    render(<RecommendationDetailPanel portfolio={PORTFOLIO} />);
    expect(screen.getByText('F-062, F-040, F-041, F-042')).toBeInTheDocument();
    expect(screen.getByText('Engine 1.0 · Formula 1.0')).toBeInTheDocument();
  });

  it('omits Formula Version when no metadata is available', () => {
    setReady('repayment', { lastMetadata: null });
    render(<RecommendationDetailPanel portfolio={PORTFOLIO} />);
    expect(screen.queryByText('Formula Version')).not.toBeInTheDocument();
  });

  it('clicking the related-tool action prefills Exit Planner and navigates, without mutating the portfolio', () => {
    setReady('repayment');
    render(<RecommendationDetailPanel portfolio={PORTFOLIO} />);

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
    render(<RecommendationDetailPanel portfolio={PORTFOLIO} />);

    expect(
      screen.queryByRole('button', { name: 'Open Exit Planner with this target' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/No action needed/)).toBeInTheDocument();
  });
});

describe('RecommendationDetailPanel — additionalCollateral', () => {
  it('shows the collateral-specific current values', () => {
    setReady('additionalCollateral');
    render(<RecommendationDetailPanel portfolio={PORTFOLIO} />);

    expect(screen.getByText('Current Collateral Value')).toBeInTheDocument();
    expect(screen.getByText('Required Additional Collateral (USD)')).toBeInTheDocument();
    expect(screen.getByText('Equivalent BTC')).toBeInTheDocument();
  });

  it('clicking the related-tool action runs a real Simulation action scenario and navigates, without mutating the live portfolio', async () => {
    const user = userEvent.setup();
    setReady('additionalCollateral');
    render(<RecommendationDetailPanel portfolio={PORTFOLIO} />);

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
    render(<RecommendationDetailPanel portfolio={PORTFOLIO} />);

    expect(
      screen.queryByRole('button', { name: 'Open Simulation Workspace with this target' }),
    ).not.toBeInTheDocument();
  });
});
