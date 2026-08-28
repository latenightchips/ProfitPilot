/**
 * Loop Builder -> Apply-to-Portfolio proposal — V1.1 Batch 3. Reuses
 * `buildFinalLoopPortfolio` (`services/loop`) directly, the same final
 * state `ApplyLoopAsSimulation.tsx`/`LoopStrategySummary.tsx` already
 * render — no loop math is rerun or reinterpreted here (Section 5's own
 * instruction). `buildFinalLoopPortfolio` already omits `v4DebtState`
 * entirely for an ambiguous V4 borrow (see that function's own header
 * comment), which `calculatePortfolioSummary` below then fails closed on
 * (`AAVE_V4_DEBT_STATE_MISSING`) — so an ambiguous-borrow loop naturally
 * produces a `ServiceFailure` here too, the same "invalid/partial results
 * must not expose Apply" rule Section 4 states for Simulation.
 */
import { buildFinalLoopPortfolio, type LoopStrategyResult } from '@/services/loop';
import { type ApplicationPortfolio, calculatePortfolioSummary } from '@/services/portfolio';
import { optionsFromTracked } from '@/services/shared/formulaStep';
import { createServiceSuccess, type ServiceResult } from '@/services/shared/result';

import type { PortfolioApplyProposal } from './types';
import { SOURCE_STATUS, unchangedAssumptionsFor } from './unchangedAssumptions';

export function buildLoopApplyProposal(
  portfolioId: string,
  portfolioUpdatedAt: string,
  portfolio: ApplicationPortfolio,
  strategy: LoopStrategyResult,
  now: () => string = () => new Date().toISOString(),
): ServiceResult<PortfolioApplyProposal> {
  const beforeResult = calculatePortfolioSummary(portfolio, SOURCE_STATUS);
  if (!beforeResult.ok) return beforeResult;

  const proposedPortfolio = buildFinalLoopPortfolio(portfolio, strategy);
  const afterResult = calculatePortfolioSummary(proposedPortfolio, SOURCE_STATUS);
  if (!afterResult.ok) return afterResult;

  const protocolVersion = portfolio.protocolVersion === 'v4' ? 'v4' : 'v3';

  return createServiceSuccess(
    {
      sourceWorkflow: 'loopBuilder' as const,
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
    [...beforeResult.warnings, ...afterResult.warnings],
  );
}
