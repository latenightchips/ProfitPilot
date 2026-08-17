import { type ApplicationPortfolio, deriveAaveV4EffectiveBorrowRate } from '@/services';

/**
 * V4 Readiness Audit §12 Stage 20. Mirrors
 * `features/loop-builder/utils/resolveBorrowRateAssumption.ts`'s exact
 * shape (not imported directly — Simulation and Loop Builder do not
 * import each other's feature-local `utils/`; both reuse the same
 * canonical `deriveAaveV4EffectiveBorrowRate` Service formula instead of
 * duplicating any math).
 *
 * **This is the BLENDED, whole-position "effective borrow rate" —
 * `annualCost / totalDebt` — NOT the same quantity as `AaveV4DebtState.baseDrawnApr`
 * (the raw Hub-level rate applied only to the drawn-debt stream, with
 * `riskPremium` layered on top separately by the Engine's own
 * `projectAaveV4Debt`).** The two are easy to conflate because both are
 * "a percentage that represents the borrow rate," but they are not
 * interchangeable: passing this function's return value into
 * `AaveV4RateStress.baseDrawnApr` double-counts `riskPremium`'s effect
 * (once already blended into this number, once again applied by the
 * Engine on top of it) — see `resolveScenarioInputs.ts`'s own header
 * comment for the full reasoning and how `ScenarioBuilder.tsx` avoids
 * that mixup. Use `resolveEffectiveBorrowRate` only for DISPLAY (what a
 * user sees as "the current borrow rate") — never as an input to
 * `v4RateStress`.
 *
 * V3 (or unset): the raw `protocol.borrowApr` scalar, unchanged. V4: the
 * canonical rate, `null` (never a fabricated or stale V3 number) when
 * `v4DebtState` has not synced yet or the derivation itself fails.
 */
export function resolveEffectiveBorrowRate(portfolio: ApplicationPortfolio): number | null {
  if (portfolio.protocolVersion !== 'v4') {
    return portfolio.protocol.borrowApr;
  }
  if (portfolio.v4DebtState === undefined) {
    return null;
  }
  const rateStep = deriveAaveV4EffectiveBorrowRate(portfolio.v4DebtState, null, 'manual');
  return rateStep.ok ? rateStep.value : null;
}
