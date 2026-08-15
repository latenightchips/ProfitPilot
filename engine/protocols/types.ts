/**
 * Protocol/version identity for `engine/protocols/`'s protocol-specific
 * modules (`./aaveV3`, `./aaveV4`) — V4 Readiness Audit §12.
 *
 * ProfitPilot v0.1 is Aave-only (01_PRD.md REQ-003), so no `protocol`
 * discriminant exists yet — adding one now (e.g. `{ protocol: 'aave' }`)
 * would invent multi-protocol generality nothing in scope asks for yet.
 * `AaveProtocolVersion` alone is the smallest safe representation.
 *
 * Deliberately NOT the same type as `infrastructure/protocols/aave/types.ts`'s
 * own `AaveProtocolVersion` (currently `'v3'` only) — same name, same
 * real-world concept, but a distinct type in a distinct layer. The Engine
 * has zero external dependencies by design (`engine/index.ts`'s own header
 * comment), so it cannot import Infrastructure's type; duplicating the
 * name here is intentional, not an oversight.
 */
export type AaveProtocolVersion = 'v3' | 'v4';

/**
 * V3's debt-projection request — Stage 1's original 3-field shape,
 * unchanged. `projectProtocolDebt` (`./index.ts`) forwards this verbatim
 * to `./aaveV3`'s own `projectVariableDebt`, byte-for-byte identical to
 * every call before Stage 2.
 */
export interface AaveV3DebtProjectionRequest {
  protocolVersion: 'v3';
  currentDebt: number;
  borrowApr: number;
  elapsedDays: number;
}

/**
 * V4's debt-projection request (Stage 2) — genuinely richer than V3's,
 * not forced through V3's shape. V4 tracks two concurrent debt streams
 * (docs/overview.md "Interest Accrual"; V4 Readiness Audit §3): drawn
 * debt (grows via a linear-interest rate index) and premium debt (grows
 * in proportion to the position's own Risk Premium). Both current
 * balances, the base drawn rate, and the Risk Premium fraction are
 * required inputs — none are invented/defaulted here or in
 * `./aaveV4/projectAaveV4Debt.ts`.
 *
 * `riskPremium` must be the position's CURRENTLY-EFFECTIVE, on-chain
 * persisted Risk Premium — not a freshly recomputed target from the
 * user's current collateral configuration. See
 * `./aaveV4/projectAaveV4Debt.ts`'s `AaveV4DebtProjectionInput.riskPremium`
 * doc comment for the full contract and why the distinction matters.
 */
export interface AaveV4DebtProjectionRequest {
  protocolVersion: 'v4';
  drawnDebt: number;
  premiumDebt: number;
  baseDrawnApr: number;
  riskPremium: number;
  elapsedDays: number;
}

export type ProtocolDebtProjectionRequest =
  AaveV3DebtProjectionRequest | AaveV4DebtProjectionRequest;

/**
 * V4's own result shape — deliberately not a single "normalized debt"
 * number like V3's. V4 has no on-chain equivalent of V3's one
 * normalized variable-debt balance (V4 Readiness Audit §3/§9): drawn and
 * premium are separately tracked, separately accruing streams, so both
 * are returned alongside their sum rather than fabricating a single
 * blended figure that would hide which stream produced the growth.
 */
export interface AaveV4DebtProjection {
  drawnDebt: number;
  premiumDebt: number;
  totalDebt: number;
}
