/**
 * V4 semantic audit, Batch 2 (A1) — the label counterpart to
 * `resolveMaxLoanToValueAssumption`'s own value-resolution discriminant.
 *
 * `resolveMaxLoanToValueAssumption` already dispatches the *value* shown
 * in Loop Builder's risk-capacity field/rows correctly by protocol
 * version (V3: `protocol.maxLoanToValue`; V4: the canonical
 * `v4CollateralRisk.collateralFactor` via `resolveRiskCapacityFraction`).
 * What stayed wrong was the *label* attached to that value: every
 * surface hardcoded the V3-only term "Maximum LTV" even when the number
 * displayed was actually V4's Collateral Factor — a genuinely different
 * financial concept (V4 has no separate max-LTV/liquidation-threshold
 * pair at all; Collateral Factor alone governs both, see
 * `resolveMaxLoanToValueAssumption`'s own doc comment). This helper is
 * the single place that pairs the right label with that dispatch,
 * reused by every affected surface (`LoopStrategyControls.tsx`,
 * `LoopSafetyAnalysis.tsx`, `types/loopStrategyControls.ts`,
 * `utils/exportLoopStrategy.ts`) so the wording can't drift between them.
 *
 * Uses the same `protocolVersion !== 'v4'` discriminant as
 * `resolveMaxLoanToValueAssumption` itself (an unset/legacy
 * `protocolVersion` is treated as V3) — deliberately not a new
 * discriminant of its own.
 */
export function riskCapacityLabel(protocolVersion: 'v3' | 'v4' | undefined): string {
  return protocolVersion === 'v4' ? 'Collateral Factor' : 'Maximum LTV';
}
