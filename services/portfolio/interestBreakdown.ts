/**
 * Debt Interest Breakdown — a small Service added in Milestone 5 Batch 6
 * to support M5-013 ("Implement Debt and Interest Panel"): "Display ...
 * Annual interest cost, Monthly interest cost, Daily interest cost."
 *
 * `calculatePortfolioSummary` (M3-005) already computes Annual Interest
 * (F-032) as `PortfolioSummary.interestCost`, so this Service does not
 * recompute it. Monthly (F-031) and Daily (F-030) are NOT simple
 * divisions of the annual figure — 02_Formulas.md's own equations are
 * `Daily = Debt × APR / 365` and `Monthly = Daily × 30`, which do not
 * equal `Annual / 365` and `Annual / 12` respectively (30/365 ≈ 0.0822,
 * not 1/12 ≈ 0.0833) — so this Service calls the actual public Engine
 * functions (`calculateDailyInterest`, `calculateMonthlyInterest`,
 * already exported from `@/engine`'s M2-031 curated barrel, previously
 * unused by any Service) rather than approximating from the already-
 * known annual value.
 *
 * **V4 rate fix (V4 Readiness Audit §12 Stage 11)** — for a V4 portfolio
 * with synced `v4DebtState`, Daily/Monthly no longer read the V3-shaped
 * `protocol.borrowApr` (Stage 10 flagged this as open for this file
 * specifically). Both now come from `projectAaveV4InterestCostUsd`
 * (`services/portfolio/mapping.ts`) with `elapsedDays: 1`/`30` —
 * projecting the portfolio's own real V4 rates the exact `elapsedDays`
 * this Service needs through the same validated Engine accrual math
 * `calculatePortfolioSummary`'s own `interestCost` (Stage 10) already
 * uses for 365 days, not a hand-derived "daily figure × 30" scaling, then
 * converting the raw debt-token-quantity result to USD (V4 Readiness
 * Audit §12 P1-D3 — see that function's own doc comment).
 */
import { calculateDailyInterest, calculateDebtValue, calculateMonthlyInterest } from '@/engine';

import {
  formulaStep as step,
  optionsFromTracked as optionsFrom,
  type TrackedFormulaVersion,
} from '../shared/formulaStep';
import { createServiceSuccess, type ServiceResult, type ServiceWarning } from '../shared/result';
import {
  checkAaveV4DebtAssetPriceAvailable,
  checkAaveV4DebtStateAvailable,
  mapApplicationPortfolioToEngineInput,
  projectAaveV4InterestCostUsd,
} from './mapping';
import type { ApplicationPortfolio } from './models';

export interface DebtInterestBreakdown {
  daily: number;
  monthly: number;
}

/**
 * Computes daily and monthly interest cost for a portfolio's current
 * debt and borrow rate. `calculatePortfolioSummary`'s own `interestCost`
 * (F-032, Annual) remains the source for the annual figure — this
 * Service is additive, not a replacement.
 */
export function calculateDebtInterestBreakdown(
  portfolio: ApplicationPortfolio,
  sourceStatus: string,
): ServiceResult<DebtInterestBreakdown> {
  const engineInput = mapApplicationPortfolioToEngineInput(portfolio);
  const warnings: ServiceWarning[] = [];
  let tracked: TrackedFormulaVersion | null = null;

  const debtValueStep = step(calculateDebtValue(engineInput.debt), tracked, sourceStatus);
  if (!debtValueStep.ok) return debtValueStep.failure;
  tracked = debtValueStep.tracked;
  warnings.push(...debtValueStep.warnings);
  const debtValue = debtValueStep.value;

  // V4 Readiness Audit §12 Stage 10 — `debtValue` above already reads
  // canonical V4 debt when available (Stage 9's `mapApplicationPortfolioToEngineInput`),
  // but a V4 portfolio with no synced `v4DebtState` would otherwise
  // silently fall back to legacy `debt.balance`. Fail closed instead.
  const v4GuardFailure = checkAaveV4DebtStateAvailable(portfolio, tracked, sourceStatus);
  if (v4GuardFailure !== null) return v4GuardFailure;

  // V4 Readiness Audit §12 P1-D3 — same fail-closed discipline as the
  // guard above, now for a 'live'-sourced `v4DebtState` that is missing
  // its authoritative debt-asset oracle price (never fires for manual V4).
  const v4PriceGuardFailure = checkAaveV4DebtAssetPriceAvailable(portfolio, tracked, sourceStatus);
  if (v4PriceGuardFailure !== null) return v4PriceGuardFailure;

  // V4 Readiness Audit §12 Stage 11 — the guard above already proved
  // `v4DebtState` is defined whenever `protocolVersion === 'v4'`.
  const dailyStep =
    portfolio.protocolVersion === 'v4' && portfolio.v4DebtState !== undefined
      ? step(projectAaveV4InterestCostUsd(portfolio.v4DebtState, 1), tracked, sourceStatus)
      : step(
          calculateDailyInterest(debtValue, engineInput.protocol.borrowApr),
          tracked,
          sourceStatus,
        );
  if (!dailyStep.ok) return dailyStep.failure;
  tracked = dailyStep.tracked;
  warnings.push(...dailyStep.warnings);

  const monthlyStep =
    portfolio.protocolVersion === 'v4' && portfolio.v4DebtState !== undefined
      ? step(projectAaveV4InterestCostUsd(portfolio.v4DebtState, 30), tracked, sourceStatus)
      : step(
          calculateMonthlyInterest(debtValue, engineInput.protocol.borrowApr),
          tracked,
          sourceStatus,
        );
  if (!monthlyStep.ok) return monthlyStep.failure;
  tracked = monthlyStep.tracked;
  warnings.push(...monthlyStep.warnings);

  return createServiceSuccess(
    { daily: dailyStep.value, monthly: monthlyStep.value },
    optionsFrom(sourceStatus, tracked),
    warnings,
  );
}
