/**
 * Simulation / Exit Planner -> Apply-to-Portfolio proposal — V1.1 Batch
 * 3. Both features' results reduce to the same
 * `{collateralDelta, debtDelta}` shape `services/simulation`'s own
 * `PortfolioActionSimulationInput` already defines:
 * - **Simulation**: `stores/simulationStore.ts`'s own `portfolioActionInput`
 *   — the input that produced the currently-displayed
 *   `portfolioActionPreview` (a Portfolio Action / Portfolio Transition
 *   scenario). A price/interest `SimulationScenario` has no resulting
 *   collateral/debt state at all (see this Service's own README-level
 *   audit note) and must never reach this function.
 * - **Exit Planner**: `-transaction.btcSold`/`-transaction.repayment` —
 *   the exact numbers `ApplyExitPlanAsSimulation.tsx` already uses to
 *   bridge into Simulation's own Portfolio Action feature; this reuses
 *   the identical delta, just fed into the real portfolio instead.
 *
 * One shared function for both, parameterized only by `sourceWorkflow`
 * (a label, not a behavior branch) — `buildPortfolioActionAfterPortfolio`
 * (`services/simulation`) does all real work, including the V4
 * fail-closed rule for an ambiguous new borrow (a positive `debtDelta`
 * with no already-synced `v4DebtState`), so a proposal naturally fails to
 * build in exactly that case, the same "invalid/partial results must not
 * expose Apply" rule `buildLoopApplyProposal` follows via
 * `buildFinalLoopPortfolio`'s own omission.
 */
import { type ApplicationPortfolio, calculatePortfolioSummary } from '@/services/portfolio';
import { optionsFromTracked } from '@/services/shared/formulaStep';
import { createServiceSuccess, type ServiceResult } from '@/services/shared/result';
import {
  buildPortfolioActionAfterPortfolio,
  type PortfolioActionSimulationInput,
} from '@/services/simulation';

import type { PortfolioApplyProposal, PortfolioApplySourceWorkflow } from './types';
import { SOURCE_STATUS, unchangedAssumptionsFor } from './unchangedAssumptions';

export function buildPortfolioActionApplyProposal(
  sourceWorkflow: Extract<PortfolioApplySourceWorkflow, 'simulation' | 'exitPlanner'>,
  portfolioId: string,
  portfolioUpdatedAt: string,
  portfolio: ApplicationPortfolio,
  input: PortfolioActionSimulationInput,
  now: () => string = () => new Date().toISOString(),
): ServiceResult<PortfolioApplyProposal> {
  const beforeResult = calculatePortfolioSummary(portfolio, SOURCE_STATUS);
  if (!beforeResult.ok) return beforeResult;

  const afterPortfolioResult = buildPortfolioActionAfterPortfolio(portfolio, input, SOURCE_STATUS);
  if (!afterPortfolioResult.ok) return afterPortfolioResult;
  const proposedPortfolio = afterPortfolioResult.data;

  const afterResult = calculatePortfolioSummary(proposedPortfolio, SOURCE_STATUS);
  if (!afterResult.ok) return afterResult;

  const protocolVersion = portfolio.protocolVersion === 'v4' ? 'v4' : 'v3';

  return createServiceSuccess(
    {
      sourceWorkflow,
      portfolioId,
      sourcePortfolioUpdatedAt: portfolioUpdatedAt,
      protocolVersion,
      proposedPortfolio,
      unchangedAssumptions: unchangedAssumptionsFor(protocolVersion),
      before: beforeResult.data,
      after: afterResult.data,
      valueBasis: 'hypothetical' as const,
      generatedAt: now(),
    },
    optionsFromTracked(SOURCE_STATUS, afterResult.metadata),
    [...beforeResult.warnings, ...afterPortfolioResult.warnings, ...afterResult.warnings],
  );
}
