/**
 * Loop Strategy Service — 06_TASKS.md M3-010 ("Implement Loop Strategy
 * Service"): "Coordinate Loop Builder calculations." Responsibilities:
 * validate strategy settings, load protocol parameters, apply cost
 * assumptions, call loop calculation modules, return step-by-step
 * outputs, surface safety warnings. DoD: "The Loop Builder can request
 * one complete strategy result from the Service."
 *
 * **Revisiting conflict #8 (swap fees/slippage/gas estimate gap) —
 * resolved by faithful pass-through, not by inventing a cost model.**
 * `06_TASKS.md`'s "Apply cost assumptions" reads as though it requires a
 * complete cost model, which does not exist anywhere in `02_Formulas.md`
 * — but the Engine layer already resolved this at M2-017
 * (`calculateLoopCosts`): it computes what is documented (Borrowing
 * Interest F-032, Break-Even BTC Appreciation F-037) and itemizes what
 * is not (`swapFees`/`slippage`/`gasEstimate`/`totalImplementationCost`,
 * each with a reason) rather than fabricating a fee/slippage/gas model.
 * This Service calls `calculateLoopCosts` as-is and passes the
 * `unavailable` array straight through — "apply cost assumptions" is
 * satisfied for what is documented; conflict #8 remains open at the
 * specification level (no new formula was authored), but does not block
 * this task, the same way conflict #9 did not block M3-012.
 *
 * **"Validate strategy settings" and "surface safety warnings" reuse
 * `validateLoopStrategySafety` (M2-018) directly** — it already performs
 * every documented safety check (protocol parameter validity,
 * liquidation proximity, minimum Health Factor floor, borrowing
 * capacity, resulting LTV, loop count) and returns `viable`/`findings`
 * exactly matching this Responsibility. No separate validation layer is
 * added on top.
 *
 * **"Load protocol parameters"**: no Protocol Parameter Service (M3-008)
 * exists yet to load from. `protocol` comes from the portfolio's own
 * `ProtocolParameters` field (already part of `ApplicationPortfolio`,
 * M3-004) — the caller supplies it, the same "accept what the Service
 * doesn't own as a parameter" principle as `sourceStatus` (M3-005) and
 * `RecommendationRuleConfig` (M3-012). When M3-008 exists, its output
 * naturally becomes the source of this same field; nothing here needs
 * to change.
 */
import {
  calculateExposure,
  calculateLoopCosts,
  type LoopCostResult,
  type LoopSafetyFinding,
  type LoopStrategyResult,
  validateLoopStrategySafety,
} from '@/engine';

import { mapApplicationPortfolioToEngineInput } from '../portfolio/mapping';
import type { ApplicationPortfolio } from '../portfolio/models';
import { formulaStep, optionsFromTracked, type TrackedFormulaVersion } from '../shared/formulaStep';
import { createServiceSuccess, type ServiceResult, type ServiceWarning } from '../shared/result';

export interface LoopStrategySettings {
  targetBorrowPercentage: number;
  maxLoops: number;
  minHealthFactor: number;
}

export interface LoopStrategyPreview {
  viable: boolean;
  findings: LoopSafetyFinding[];
  /** null when the strategy is not viable (see `findings` for why). */
  strategy: LoopStrategyResult | null;
  /** null alongside `strategy` — no final position exists to cost. */
  costs: LoopCostResult | null;
}

/**
 * Plans and safety-checks a Loop strategy in one call — 06_TASKS.md
 * M3-010. `sourceStatus` is caller-supplied for the same reason as
 * `calculatePortfolioSummary` (M3-005).
 */
export function planLoopStrategy(
  portfolio: ApplicationPortfolio,
  settings: LoopStrategySettings,
  sourceStatus: string,
): ServiceResult<LoopStrategyPreview> {
  const engineInput = mapApplicationPortfolioToEngineInput(portfolio);
  const warnings: ServiceWarning[] = [];

  const safetyStep = formulaStep(
    validateLoopStrategySafety({ ...engineInput, ...settings }),
    null,
    sourceStatus,
  );
  if (!safetyStep.ok) return safetyStep.failure;
  let tracked: TrackedFormulaVersion = safetyStep.tracked;
  warnings.push(...safetyStep.warnings);
  const safety = safetyStep.value;

  if (safety.strategy === null) {
    return createServiceSuccess(
      { viable: safety.viable, findings: safety.findings, strategy: null, costs: null },
      optionsFromTracked(sourceStatus, tracked),
      warnings,
    );
  }

  const exposureStep = formulaStep(
    calculateExposure(safety.strategy.finalCollateral, engineInput.market),
    tracked,
    sourceStatus,
  );
  if (!exposureStep.ok) return exposureStep.failure;
  tracked = exposureStep.tracked;
  warnings.push(...exposureStep.warnings);

  const costsStep = formulaStep(
    calculateLoopCosts(
      safety.strategy.finalDebt,
      engineInput.protocol.borrowApr,
      exposureStep.value,
    ),
    tracked,
    sourceStatus,
  );
  if (!costsStep.ok) return costsStep.failure;
  tracked = costsStep.tracked;
  warnings.push(...costsStep.warnings);

  return createServiceSuccess(
    {
      viable: safety.viable,
      findings: safety.findings,
      strategy: safety.strategy,
      costs: costsStep.value,
    },
    optionsFromTracked(sourceStatus, tracked),
    warnings,
  );
}
