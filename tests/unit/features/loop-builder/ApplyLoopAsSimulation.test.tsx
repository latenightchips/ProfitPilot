import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { formatHealthFactor } from '@/components/strategy/format';
import { ApplyLoopAsSimulation } from '@/features/loop-builder';
import { stopReasonLabel } from '@/features/loop-builder/utils/stopReasonLabel';
import type { ApplicationPortfolio } from '@/services';
import { buildFinalLoopPortfolio, V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE } from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Apply Loop as Simulation — 06_TASKS.md M7-016. DoD: "Loop strategies
 * integrate with the broader Simulation Workspace." See this
 * component's own header comment for the `PortfolioActionSimulationInput`
 * architectural resolution.
 */
const LOOP_INITIAL_STATE = {
  settings: null,
  currentResult: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  lastMetadata: null,
  savedStrategies: [],
  selectedStrategyId: null,
  sensitivityResult: null,
  sensitivityErrors: [],
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

function validPortfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.5,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    ...overrides,
  };
}

beforeEach(() => {
  useLoopBuilderStore.setState(LOOP_INITIAL_STATE);
  useSimulationStore.setState(SIMULATION_INITIAL_STATE);
});

describe('ApplyLoopAsSimulation — empty state', () => {
  it('prompts for a viable strategy before any calculation has run', () => {
    render(<ApplyLoopAsSimulation portfolio={validPortfolio()} />);
    expect(screen.getByText(/Configure a viable strategy/i)).toBeInTheDocument();
  });
});

describe('ApplyLoopAsSimulation — applying', () => {
  it('computes the real collateral/debt delta and applies it via runPortfolioActionSimulation, without touching currentScenario/currentResult', () => {
    const portfolio = validPortfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    screen.getByRole('button', { name: /Apply Loop as Simulation/i }).click();

    const simState = useSimulationStore.getState();
    expect(simState.portfolioActionPreview).not.toBeNull();
    expect(simState.currentScenario).toBeNull();
    expect(simState.currentResult).toBeNull();
  });

  it('shows a real Health Factor before is different from after applying', () => {
    const portfolio = validPortfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    screen.getByRole('button', { name: /Apply Loop as Simulation/i }).click();

    const preview = useSimulationStore.getState().portfolioActionPreview;
    expect(preview).not.toBeNull();
    expect(preview?.before.healthFactor).not.toBe(preview?.after.healthFactor);
  });

  it('renders a link to the Simulation Workspace with the correct href', () => {
    const portfolio = validPortfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    expect(screen.getByRole('link', { name: /Open Simulation Workspace/i })).toHaveAttribute(
      'href',
      '/simulation',
    );
  });
});

/**
 * V4 structured Loop → Simulation handoff — V4 Readiness Audit §12 Stage
 * 18. Before this stage, `handleApply` reduced the loop's final state to
 * a scalar `debtDelta` for EVERY portfolio, including V4 — and since a
 * viable loop always borrows more (a positive delta), routing that
 * through `runPortfolioActionSimulation` always hit
 * `deriveV4DebtStateAfterDelta`'s deliberate "genuinely ambiguous, fail
 * closed" rule for any positive V4 delta (`services/portfolio/mapping.ts`).
 * That meant clicking "Apply Loop as Simulation" on any real V4 loop
 * always produced an error — a real, shipped, user-reachable bug, not a
 * hypothetical. `handleApply` now builds the final portfolio directly via
 * `buildFinalLoopPortfolio` (Stage 17, already carries a real structured
 * `v4DebtState` forward) and calls `runPortfolioTransitionSimulation`
 * instead, which never reduces that structured state to a delta.
 */
describe('ApplyLoopAsSimulation — V4 structured Loop → Simulation handoff (Stage 18)', () => {
  function v4Portfolio(): ApplicationPortfolio {
    return validPortfolio({
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 999999 },
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      // Stage 23D's collateral-risk guard now requires this on every V4
      // portfolio; same value as `protocol.liquidationThreshold` on
      // `validPortfolio` (0.8) so this Stage 18 suite's expected values
      // (which never assert on healthFactor) are unaffected.
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    });
  }

  function runViableV4Strategy(portfolio: ApplicationPortfolio) {
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.3, maxLoops: 2, minHealthFactor: 1.2 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
  }

  /**
   * BLOCKER #3 fix — `runViableV4Strategy` above always borrows more (a
   * real, positive delta), which is now the exact case
   * `loopIntroducesAmbiguousV4Borrow` blocks (see
   * `services/loop/finalPortfolio.ts`'s own header comment). The two
   * tests below ("requirement 1"/"requirement 2") accordingly now assert
   * the correct BLOCKED outcome for that same scenario, rather than the
   * pre-BLOCKER-#3 assumption that a fabricated post-borrow state could
   * be safely handed to Simulation. `runUnambiguousV4Strategy` (zero
   * loops, no real borrow) is used separately below to prove the
   * structured Loop → Simulation handoff mechanism itself still works
   * correctly for the case it is NOT ambiguous.
   */
  function runUnambiguousV4Strategy(portfolio: ApplicationPortfolio) {
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.3, maxLoops: 0, minHealthFactor: 1.2 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
  }

  it('requirement 1 (BLOCKER #3 update) — a real new borrow is blocked: Apply is disabled and runPortfolioTransitionSimulation is never called', () => {
    const portfolio = v4Portfolio();
    runViableV4Strategy(portfolio);
    const { currentResult } = useLoopBuilderStore.getState();
    if (currentResult?.strategy === null || currentResult === null) {
      throw new Error('setup failed: expected a viable strategy');
    }
    expect(currentResult.strategy.finalDebt).toBeGreaterThan(15500);

    const runPortfolioTransitionSimulation = vi
      .spyOn(useSimulationStore.getState(), 'runPortfolioTransitionSimulation')
      .mockImplementation(() => {});
    const runPortfolioActionSimulation = vi
      .spyOn(useSimulationStore.getState(), 'runPortfolioActionSimulation')
      .mockImplementation(() => {});

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    const button = screen.getByRole('button', { name: /Apply Loop as Simulation/i });
    expect(button).toBeDisabled();
    button.click();

    expect(runPortfolioTransitionSimulation).not.toHaveBeenCalled();
    expect(runPortfolioActionSimulation).not.toHaveBeenCalled();
    expect(screen.getByText(V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE)).toBeInTheDocument();

    runPortfolioTransitionSimulation.mockRestore();
    runPortfolioActionSimulation.mockRestore();
  });

  it('structured handoff mechanism (unaffected by BLOCKER #3) — a non-ambiguous V4 strategy still calls runPortfolioTransitionSimulation with the exact buildFinalLoopPortfolio output, not a scalar delta', () => {
    const portfolio = v4Portfolio();
    runUnambiguousV4Strategy(portfolio);
    const { currentResult } = useLoopBuilderStore.getState();
    if (currentResult?.strategy === null || currentResult === null) {
      throw new Error('setup failed: expected a viable strategy');
    }
    const expectedAfter = buildFinalLoopPortfolio(portfolio, currentResult.strategy);

    const runPortfolioTransitionSimulation = vi
      .spyOn(useSimulationStore.getState(), 'runPortfolioTransitionSimulation')
      .mockImplementation(() => {});
    const runPortfolioActionSimulation = vi
      .spyOn(useSimulationStore.getState(), 'runPortfolioActionSimulation')
      .mockImplementation(() => {});

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    screen.getByRole('button', { name: /Apply Loop as Simulation/i }).click();

    expect(runPortfolioTransitionSimulation).toHaveBeenCalledTimes(1);
    const [before, after] = runPortfolioTransitionSimulation.mock.calls[0]!;
    expect(before).toBe(portfolio);
    expect(after).toEqual(expectedAfter);
    expect(after.v4DebtState).toBeDefined();
    // The genuinely ambiguous delta-based path must never be reached for V4.
    expect(runPortfolioActionSimulation).not.toHaveBeenCalled();

    runPortfolioTransitionSimulation.mockRestore();
    runPortfolioActionSimulation.mockRestore();
  });

  it('requirement 2 (BLOCKER #3 update) — a real new borrow is blocked before any preview is computed', () => {
    const portfolio = v4Portfolio();
    runViableV4Strategy(portfolio);

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    screen.getByRole('button', { name: /Apply Loop as Simulation/i }).click();

    expect(useSimulationStore.getState().portfolioActionPreview).toBeNull();
  });

  it('the resulting preview uses real V4 rate/debt semantics, not the legacy debt.balance/protocol.borrowApr fields (non-ambiguous case)', () => {
    const portfolio = v4Portfolio();
    runUnambiguousV4Strategy(portfolio);

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    screen.getByRole('button', { name: /Apply Loop as Simulation/i }).click();

    const preview = useSimulationStore.getState().portfolioActionPreview;
    expect(preview).not.toBeNull();
    if (preview === null) return;
    // Canonical total (15500) must drive debtValue, never the deliberately
    // disagreeing legacy debt.balance (999999).
    expect(preview.before.debtValue).toBe(15500);
    expect(preview.after.debtValue).toBeLessThan(999999);
  });

  it('does not apply for a V3 (or unset) portfolio — that path is untouched (requirement 4/5)', () => {
    const portfolio = validPortfolio();
    runViableV4Strategy(portfolio);

    const runPortfolioTransitionSimulation = vi
      .spyOn(useSimulationStore.getState(), 'runPortfolioTransitionSimulation')
      .mockImplementation(() => {});

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    screen.getByRole('button', { name: /Apply Loop as Simulation/i }).click();

    expect(runPortfolioTransitionSimulation).not.toHaveBeenCalled();
    expect(useSimulationStore.getState().portfolioActionPreview).not.toBeNull();

    runPortfolioTransitionSimulation.mockRestore();
  });
});

describe('ApplyLoopAsSimulation — V3 debtDelta computation unchanged (Stage 16, reconfirmed at Stage 18)', () => {
  it('a V3 (or unset) portfolio still computes debtDelta from the real legacy debt.balance and calls runPortfolioActionSimulation, byte-for-byte as before', () => {
    const portfolio = validPortfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
    const { currentResult } = useLoopBuilderStore.getState();
    if (currentResult?.strategy === null || currentResult === null) {
      throw new Error('setup failed: expected a viable strategy');
    }
    const expectedDebtDelta = currentResult.strategy.finalDebt - portfolio.debt.balance;

    const runPortfolioActionSimulation = vi
      .spyOn(useSimulationStore.getState(), 'runPortfolioActionSimulation')
      .mockImplementation(() => {});

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    screen.getByRole('button', { name: /Apply Loop as Simulation/i }).click();

    expect(runPortfolioActionSimulation).toHaveBeenCalledTimes(1);
    const [, input] = runPortfolioActionSimulation.mock.calls[0]!;
    expect(input.debtDelta).toBe(expectedDebtDelta);

    runPortfolioActionSimulation.mockRestore();
  });
});

/**
 * "Applied — ..." confirmation message — V4 Readiness Audit §12 Stage 25
 * follow-up. Closes a real, reproduced bug (the same class already fixed
 * in `ApplyExitPlanAsSimulation.test.tsx`'s own Stage 25D): the message
 * used to read `useSimulationStore.portfolioActionPreview` reactively —
 * a Store shared with Simulation's own Portfolio Action feature and
 * Exit Planner's `ApplyExitPlanAsSimulation`. A stale result left over
 * from any of those (or an earlier loop-apply attempt with a different
 * strategy) showed as "Applied" with the WRONG Health Factor, and —
 * worse than the Exit Planner case — `strategy.stopReason` was read
 * LIVE from the currently-configured strategy, so it could show a Stop
 * Reason that was never actually applied at all if the strategy was
 * edited after a real apply. Fixed by snapshotting both values locally,
 * only at the moment `handleApply` actually runs, and clearing that
 * snapshot whenever the current strategy's own final state changes.
 */
describe('ApplyLoopAsSimulation — "Applied" confirmation is never stale (Stage 25 follow-up)', () => {
  function poisonSimulationStore() {
    useSimulationStore.setState({
      portfolioActionPreview: {
        before: { healthFactor: 1.73 } as never,
        after: { healthFactor: 1.73 } as never,
        profitOrLoss: 0,
      },
    });
  }

  it('shows no "Applied" message before the button has ever been clicked, even with a stale portfolioActionPreview already in the Store', () => {
    poisonSimulationStore();

    const portfolio = validPortfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/Applied —/)).not.toBeInTheDocument();
  });

  it('shows the real, freshly-applied Health Factor and Stop Reason after clicking (V3 path), not stale ones already sitting in the Store', () => {
    poisonSimulationStore();

    const portfolio = validPortfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
    const { currentResult } = useLoopBuilderStore.getState();
    if (currentResult?.strategy === null || currentResult === null) {
      throw new Error('setup failed: expected a viable strategy');
    }
    const realStrategy = currentResult.strategy;

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    fireEvent.click(screen.getByRole('button', { name: /Apply Loop as Simulation/i }));

    const preview = useSimulationStore.getState().portfolioActionPreview;
    expect(preview).not.toBeNull();
    const status = screen.getByRole('status');
    expect(status.textContent).not.toMatch(/1\.73/);
    expect(status.textContent).toContain(formatHealthFactor(preview!.after.healthFactor));
    expect(status.textContent).toContain(stopReasonLabel(realStrategy.stopReason));
  });

  it('shows the real, freshly-applied Health Factor and Stop Reason after clicking on a V4 loop (structured transition path), not stale ones already sitting in the Store', () => {
    poisonSimulationStore();

    // BLOCKER #3 fix — `maxLoops: 0` (not 2) so this scenario is not an
    // ambiguous real borrow (which BLOCKER #3 now blocks) — this test's
    // own concern is the Applied-snapshot mechanism, not the borrow
    // ambiguity itself, which has its own dedicated coverage elsewhere.
    const portfolio = validPortfolio({
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 999999 },
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    });
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.3, maxLoops: 0, minHealthFactor: 1.2 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
    const { currentResult } = useLoopBuilderStore.getState();
    if (currentResult?.strategy === null || currentResult === null) {
      throw new Error('setup failed: expected a viable strategy');
    }
    const realStrategy = currentResult.strategy;

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    fireEvent.click(screen.getByRole('button', { name: /Apply Loop as Simulation/i }));

    const preview = useSimulationStore.getState().portfolioActionPreview;
    expect(preview).not.toBeNull();
    const status = screen.getByRole('status');
    expect(status.textContent).not.toMatch(/1\.73/);
    expect(status.textContent).toContain(formatHealthFactor(preview!.after.healthFactor));
    expect(status.textContent).toContain(stopReasonLabel(realStrategy.stopReason));
  });

  it('clears a previously-shown "Applied" message once the strategy changes, rather than leaving it referring to a stale Stop Reason', () => {
    const portfolio = validPortfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.2, maxLoops: 1, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    const { rerender } = render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    fireEvent.click(screen.getByRole('button', { name: /Apply Loop as Simulation/i }));
    expect(screen.getByRole('status')).toBeInTheDocument();

    // The user edits the strategy settings after applying — a genuinely
    // different final state, never re-applied.
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
    rerender(<ApplyLoopAsSimulation portfolio={portfolio} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/Applied —/)).not.toBeInTheDocument();
  });

  it('does not show a confirmation for a portfolio that has never actually been applied in this render, even with a poisoned shared Simulation store', () => {
    // Simulates a stale global Store value left over from an entirely
    // unrelated apply — Exit Planner, Simulation's own Portfolio Action,
    // or a loop applied for a different portfolio earlier in the
    // session — never touched by anything in this render.
    poisonSimulationStore();

    const portfolio = validPortfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

/**
 * BLOCKER #3 fix — dedicated coverage for the Apply button's own
 * disabled/message state, independent of the "structured handoff" and
 * "Applied confirmation" describe blocks above (which each cover their
 * own narrower concern using a non-ambiguous fixture). `riskPremium: 0.13`
 * is a deliberately distinctive value (unused elsewhere in this file).
 */
describe('ApplyLoopAsSimulation — V4 ambiguous borrow disables Apply (BLOCKER #3 fix)', () => {
  function v4Portfolio(): ApplicationPortfolio {
    return validPortfolio({
      collateral: { asset: 'BTC', quantity: 2 },
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.13 },
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    });
  }

  it('disables Apply and shows the risk-premium message for a real new borrow', () => {
    const portfolio = v4Portfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
    expect(useLoopBuilderStore.getState().currentResult?.strategy?.finalDebt).toBeGreaterThan(
      20000 + 500,
    );

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    expect(screen.getByRole('button', { name: /Apply Loop as Simulation/i })).toBeDisabled();
    expect(screen.getByText(V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE)).toBeInTheDocument();
  });

  it('keeps Apply enabled, with no risk-premium message, for a zero-loop V4 strategy', () => {
    const portfolio = v4Portfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 0, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
    expect(useLoopBuilderStore.getState().currentResult?.strategy?.finalDebt).toBeCloseTo(
      20000 + 500,
      6,
    );

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    expect(screen.getByRole('button', { name: /Apply Loop as Simulation/i })).not.toBeDisabled();
    expect(screen.queryByText(V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE)).not.toBeInTheDocument();
  });

  it('never shows the risk-premium message or disables Apply for a V3 portfolio', () => {
    const portfolio = validPortfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    expect(screen.getByRole('button', { name: /Apply Loop as Simulation/i })).not.toBeDisabled();
    expect(screen.queryByText(V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE)).not.toBeInTheDocument();
  });
});
