/**
 * Portfolio Summary Service — 06_TASKS.md M3-005 ("Implement Portfolio
 * Summary Service"): "Create a Service that generates the complete
 * calculated portfolio summary." DoD: "The UI can request one portfolio
 * summary without calling individual Engine modules directly."
 *
 * Composes 10 public Engine functions (M2-031's curated `@/engine` API)
 * into one `ServiceResult<PortfolioSummary>`, covering M3-005's own
 * "Include" list field-for-field:
 *   - Collateral value    → `calculateCollateralValue` (F-002)
 *   - Debt value          → `calculateDebtValue` (F-003)
 *   - Net equity          → `calculateNetWorth` (F-004)
 *   - LTV                 → `calculateLoanToValue` (F-020)
 *   - Leverage            → `calculateEffectiveLeverage` (F-011)
 *   - Health Factor       → `calculateHealthFactor` (F-022)
 *   - Liquidation info    → `calculateLiquidationPrice`/`Distance`/`Buffer`
 *                           (F-024/F-023/F-025), grouped under one
 *                           `liquidation` field — a structural grouping of
 *                           three already-public formulas under the one
 *                           label 06_TASKS.md uses, not a new formula.
 *   - Interest cost        → `calculateAnnualInterest` (F-032). 06_TASKS.md
 *                           does not say which of the four interest
 *                           formulas (Daily/Monthly/Annual/Prorated)
 *                           counts as "the" cost figure for a summary;
 *                           Annual was chosen because it pairs directly
 *                           with `borrowApr` (already an annual rate on
 *                           the portfolio) and, like every other field
 *                           here, is a point-in-time figure rather than a
 *                           windowed one. Documented interpretation, not
 *                           an invented formula — see PROJECT_STATUS.md.
 *   - Warnings             → already covered by `ServiceResult`'s own
 *                           top-level `warnings` field (M3-002); no
 *                           separate field needed here.
 *
 * **Sequential dependency, not independent-field validation (unlike
 * M3-004's mapping)**: every metric after Collateral/Debt Value consumes
 * an already-computed value from an earlier step (e.g. LTV needs Debt
 * Value and Collateral Value; Health Factor needs Collateral Value).
 * `mapPersistencePortfolioToApplicationPortfolio` (M3-004) aggregates
 * every independent field error into one array because its four fields
 * don't depend on each other; here they do, so this function fails fast
 * on the first Engine failure and returns a single error — mirroring
 * `engine/simulation/simulatePositionChange.ts`'s own `computeSnapshot`
 * helper, which composes the same kind of dependent metric chain at the
 * Engine layer the same way.
 *
 * **`sourceStatus` is caller-supplied, never fabricated**: this Service
 * has no way to know whether the market price it's summarizing is live
 * or manually entered — that's Market Data Service's concern (M3-007,
 * not yet built). Approved decision: thread `sourceStatus` through as an
 * explicit parameter rather than hardcoding a placeholder.
 *
 * **Conflict #19 (formula-version aggregation) — approved stopgap, not a
 * real algorithm**: every public Engine function currently reports
 * `formulaVersion: '1.0'`, so in practice a single summary's calls always
 * agree. This function takes the first successful call's
 * `engineVersion`/`formulaVersion` as `ServiceMetadata`'s value, and
 * explicitly checks every subsequent call against it — if a future
 * change ever makes two calls in one summary disagree, this returns a
 * `ServiceFailure` (`FORMULA_VERSION_MISMATCH`) rather than silently
 * picking one. Conflict #19 remains open and documented in
 * PROJECT_STATUS.md; this is a checked stopgap, not a resolution.
 *
 * The `step`/`optionsFrom` mechanism implementing the above now lives in
 * `services/shared/formulaStep.ts` (relocated at M3-009, Simulation
 * Service — the second consumer that needed the identical mechanism,
 * the same promotion trigger already used for `MappingResult<T>` at
 * M3-007). Imported here under its original local names so the rest of
 * this file is unchanged.
 *
 * **Conflict #20 resolution (Milestone 4 Batch 0 follow-up)**: a
 * zero-debt portfolio (collateral > 0, debt = 0) is a valid economic
 * state, but `calculateLiquidationPrice` (F-024) treats "the price that
 * triggers liquidation" as undefined when there is no debt and returns a
 * `NOT_APPLICABLE_NO_DEBT` failure — by design, documented in that
 * formula's own file, not a defect. `calculateLiquidationBuffer` (F-025)
 * calls F-024 internally and inherits the same failure.
 * `calculateLiquidationDistance` (F-023) does not: it derives Distance
 * from `calculateHealthFactor` (F-022) directly, which already succeeds
 * with `Infinity` for zero debt (a deliberate M2-009 design decision).
 *
 * Rather than overriding F-024/F-025's own documented Engine-layer
 * behavior (a Milestone 2, already-shipped formula contract, and a
 * larger blast radius — `engine/simulation/simulatePositionChange.ts`
 * and `simulatePriceScenario.ts` also call these functions), this
 * Service adapts at its own boundary: `liquidation` becomes `null` for a
 * zero-debt portfolio instead of failing the whole summary, mirroring
 * `calculateHealthFactor`'s own zero-debt-as-`Infinity` precedent one
 * layer up. The existing `NO_DEBT` warning already produced by the
 * Health Factor step (line below) carries the explanation; no duplicate
 * warning is invented here. See PROJECT_STATUS.md conflict #20.
 */
import {
  calculateAnnualInterest,
  calculateCollateralValue,
  calculateDebtValue,
  calculateEffectiveLeverage,
  calculateHealthFactor,
  calculateLiquidationBuffer,
  calculateLiquidationDistance,
  calculateLiquidationPrice,
  calculateLoanToValue,
  calculateNetWorth,
} from '@/engine';

import type { TrackedFormulaVersion } from '../shared/formulaStep';
import { formulaStep as step, optionsFromTracked as optionsFrom } from '../shared/formulaStep';
import { createServiceSuccess, type ServiceResult, type ServiceWarning } from '../shared/result';
import { mapApplicationPortfolioToEngineInput } from './mapping';
import type { ApplicationPortfolio } from './models';

export interface PortfolioLiquidationSummary {
  price: number;
  distance: number;
  buffer: number;
}

export interface PortfolioSummary {
  collateralValue: number;
  debtValue: number;
  netEquity: number;
  loanToValue: number;
  leverage: number;
  healthFactor: number;
  /** `null` for a zero-debt portfolio — see this file's conflict #20 note. */
  liquidation: PortfolioLiquidationSummary | null;
  interestCost: number;
}

/**
 * Generates the complete calculated portfolio summary — 06_TASKS.md
 * M3-005. `sourceStatus` must be supplied by the caller (see this file's
 * header comment); it is never fabricated here.
 */
export function calculatePortfolioSummary(
  portfolio: ApplicationPortfolio,
  sourceStatus: string,
): ServiceResult<PortfolioSummary> {
  const engineInput = mapApplicationPortfolioToEngineInput(portfolio);
  const warnings: ServiceWarning[] = [];
  let tracked: TrackedFormulaVersion | null = null;

  const collateralValueStep = step(
    calculateCollateralValue(engineInput.collateral, engineInput.market),
    tracked,
    sourceStatus,
  );
  if (!collateralValueStep.ok) return collateralValueStep.failure;
  tracked = collateralValueStep.tracked;
  warnings.push(...collateralValueStep.warnings);
  const collateralValue = collateralValueStep.value;

  const debtValueStep = step(calculateDebtValue(engineInput.debt), tracked, sourceStatus);
  if (!debtValueStep.ok) return debtValueStep.failure;
  tracked = debtValueStep.tracked;
  warnings.push(...debtValueStep.warnings);
  const debtValue = debtValueStep.value;

  const netEquityStep = step(calculateNetWorth(engineInput), tracked, sourceStatus);
  if (!netEquityStep.ok) return netEquityStep.failure;
  tracked = netEquityStep.tracked;
  warnings.push(...netEquityStep.warnings);
  const netEquity = netEquityStep.value;

  const loanToValueStep = step(
    calculateLoanToValue(debtValue, collateralValue),
    tracked,
    sourceStatus,
  );
  if (!loanToValueStep.ok) return loanToValueStep.failure;
  tracked = loanToValueStep.tracked;
  warnings.push(...loanToValueStep.warnings);
  const loanToValue = loanToValueStep.value;

  const leverageStep = step(calculateEffectiveLeverage(engineInput), tracked, sourceStatus);
  if (!leverageStep.ok) return leverageStep.failure;
  tracked = leverageStep.tracked;
  warnings.push(...leverageStep.warnings);
  const leverage = leverageStep.value;

  const healthFactorStep = step(
    calculateHealthFactor(collateralValue, engineInput.protocol.liquidationThreshold, debtValue),
    tracked,
    sourceStatus,
  );
  if (!healthFactorStep.ok) return healthFactorStep.failure;
  tracked = healthFactorStep.tracked;
  warnings.push(...healthFactorStep.warnings);
  const healthFactor = healthFactorStep.value;

  let liquidation: PortfolioLiquidationSummary | null;
  if (debtValue === 0) {
    // Conflict #20: F-024/F-025 are undefined for zero debt by design —
    // see this file's header comment. No liquidation is possible at any
    // price, so `liquidation` is `null` rather than a failed summary.
    liquidation = null;
  } else {
    const liquidationPriceStep = step(
      calculateLiquidationPrice(
        engineInput.market.btcPriceUsd,
        debtValue,
        collateralValue,
        engineInput.protocol.liquidationThreshold,
      ),
      tracked,
      sourceStatus,
    );
    if (!liquidationPriceStep.ok) return liquidationPriceStep.failure;
    tracked = liquidationPriceStep.tracked;
    warnings.push(...liquidationPriceStep.warnings);

    const liquidationDistanceStep = step(
      calculateLiquidationDistance(
        collateralValue,
        engineInput.protocol.liquidationThreshold,
        debtValue,
      ),
      tracked,
      sourceStatus,
    );
    if (!liquidationDistanceStep.ok) return liquidationDistanceStep.failure;
    tracked = liquidationDistanceStep.tracked;
    warnings.push(...liquidationDistanceStep.warnings);

    const liquidationBufferStep = step(
      calculateLiquidationBuffer(
        engineInput.market.btcPriceUsd,
        debtValue,
        collateralValue,
        engineInput.protocol.liquidationThreshold,
      ),
      tracked,
      sourceStatus,
    );
    if (!liquidationBufferStep.ok) return liquidationBufferStep.failure;
    tracked = liquidationBufferStep.tracked;
    warnings.push(...liquidationBufferStep.warnings);

    liquidation = {
      price: liquidationPriceStep.value,
      distance: liquidationDistanceStep.value,
      buffer: liquidationBufferStep.value,
    };
  }

  const interestCostStep = step(
    calculateAnnualInterest(debtValue, engineInput.protocol.borrowApr),
    tracked,
    sourceStatus,
  );
  if (!interestCostStep.ok) return interestCostStep.failure;
  tracked = interestCostStep.tracked;
  warnings.push(...interestCostStep.warnings);
  const interestCost = interestCostStep.value;

  return createServiceSuccess(
    {
      collateralValue,
      debtValue,
      netEquity,
      loanToValue,
      leverage,
      healthFactor,
      liquidation,
      interestCost,
    },
    optionsFrom(sourceStatus, tracked),
    warnings,
  );
}
