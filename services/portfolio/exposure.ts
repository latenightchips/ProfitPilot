/**
 * Portfolio BTC Exposure — a small Service added in Milestone 7 Batch 2
 * to support M7-011 ("Implement Loop Strategy Summary")'s own "BTC
 * exposure" Display item for the *current* (pre-strategy) portfolio
 * state — `LoopStrategyResult` itself only carries the *final*
 * strategy's exposure, and no existing Service exposed the portfolio's
 * own current exposure value on its own.
 *
 * A thin wrapper around `calculateExposure` (F-010) — the same
 * "Service wraps one Engine call for a UI-facing gap" pattern
 * `interestBreakdown.ts` already established, applied here to a single
 * already-public Engine function rather than a small group of them.
 */
import { calculateExposure } from '@/engine';

import { formulaStep, optionsFromTracked } from '../shared/formulaStep';
import { createServiceSuccess, type ServiceResult } from '../shared/result';
import { mapApplicationPortfolioToEngineInput } from './mapping';
import type { ApplicationPortfolio } from './models';

export function calculatePortfolioExposure(
  portfolio: ApplicationPortfolio,
  sourceStatus: string,
): ServiceResult<number> {
  const engineInput = mapApplicationPortfolioToEngineInput(portfolio);
  const exposureStep = formulaStep(
    calculateExposure(engineInput.collateral, engineInput.market),
    null,
    sourceStatus,
  );
  if (!exposureStep.ok) return exposureStep.failure;
  return createServiceSuccess(
    exposureStep.value,
    optionsFromTracked(sourceStatus, exposureStep.tracked),
    exposureStep.warnings,
  );
}
