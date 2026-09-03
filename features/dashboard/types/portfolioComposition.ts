/**
 * Portfolio Composition types — 06_TASKS.md M5-011 ("Implement Portfolio
 * Composition Section"). Dependencies: M5-003. DoD: "Users can understand
 * what contributes to total collateral and debt."
 *
 * **"Portfolio percentage" is always 100% for each row — a structural
 * consequence of Conflict A (approved, single collateral position + single
 * debt position, no arrays), not a computed statistic.** With exactly one
 * collateral asset and one debt asset, each necessarily makes up 100% of
 * its own side of the portfolio. This is not an invented shortcut — it is
 * what "percentage of total collateral/debt" literally equals when there
 * is only one contributor, the same reasoning M4-002's own "Prevent
 * duplicate invalid positions" requirement already used ("structurally
 * satisfied by Conflict A's single-position model — no array-dedup logic
 * exists to write").
 *
 * **M5-012 ("Implement Portfolio Allocation Chart") is satisfied without
 * new code, not skipped.** That task's own Requirement — "Hide the chart
 * when it provides no additional value" — is unconditionally true under
 * Conflict A: a chart visualizing "100% BTC" / "100% USDC" allocation
 * adds nothing beyond what this table already shows. Building a chart
 * component whose own documented rule means it can never render anything
 * in Version 0.1 would be dead code with no way to exercise it
 * meaningfully — `showAllocationChart` is `false` here (not a computed
 * condition, since there is no multi-asset data in this data model to
 * check a count against), and no chart component exists. If Conflict A is
 * ever revisited for multi-asset support, this field is the concrete
 * place a real per-asset percentage and a real "more than one asset"
 * condition would go.
 */
export interface PortfolioCompositionRow {
  assetLabel: string;
  formattedQuantity: string;
  /** "N/A (stablecoin, 1:1 — F-003)" for the debt row — no price lookup exists for stablecoins anywhere in this codebase. */
  formattedCurrentPrice: string;
  formattedPositionValue: string;
  /** Always "100%" — see this file's own header comment. */
  formattedPortfolioPercentage: string;
}

/**
 * **Discriminated by `kind` (V4 Readiness Audit §12 Stage 23E).** V3
 * exposes the documented Max LTV/Liquidation Threshold pair, byte-for-byte
 * unchanged from before this stage. V4 has no such pair (Stage 23B:
 * `collateralFactor` alone governs both borrow capacity and liquidation
 * eligibility) — `v4Available` shows the one real Collateral Factor value
 * instead of reinterpreting a V3 field under a V3 label; `v4Unavailable`
 * covers a V4 portfolio with no synced `v4CollateralRisk` yet. Mirrors
 * `services/portfolio/mapping.ts`'s own `RiskCapacityDisplay` shape —
 * `buildPortfolioComposition.ts` resolves via that shared Service-layer
 * helper and only adds its own local formatting here, never re-deriving
 * the V3/V4 branch itself.
 *
 * **`formattedSupplyApr` exists only on `v3` (Dashboard V3/V4 Semantic
 * Isolation audit).** No Aave V4 boundary this codebase talks to exposes
 * an authoritative supply rate at all (`resolveSupplyAprDisplay`'s own
 * doc comment, `services/portfolio/mapping.ts`), and — specific to this
 * Dashboard — `protocol.supplyApr` is never even a genuine user assertion
 * for a V4 portfolio: `NewPortfolioPageClient.tsx` force-sets it to a
 * fixed, inert `0` placeholder the instant V4 is selected and never
 * exposes a field to edit it afterward for V4 (`ManualAaveV4StateForm.tsx`/
 * `NewPortfolioV4Fields.tsx` have no `supplyApr` input at all). Showing
 * "Supply APR: 0%" for a V4 portfolio therefore isn't a stale-but-once-
 * real V3 number — it is a fabricated value that was never entered by
 * anyone, for any portfolio, ever. Removed from the type entirely (not
 * formatted as "—") so a future caller cannot accidentally resurrect it
 * for V4 by supplying a placeholder string.
 */
export type PortfolioCompositionProtocolParameters =
  | {
      kind: 'v3';
      formattedMaxLoanToValue: string;
      formattedLiquidationThreshold: string;
      formattedBorrowApr: string;
      formattedSupplyApr: string;
    }
  | {
      kind: 'v4Available';
      formattedCollateralFactor: string;
      formattedBorrowApr: string;
    }
  | {
      kind: 'v4Unavailable';
      formattedBorrowApr: string;
    };

export interface PortfolioComposition {
  collateral: PortfolioCompositionRow;
  debt: PortfolioCompositionRow;
  protocolParameters: PortfolioCompositionProtocolParameters;
  /** M5-012 — always `false` under Conflict A; see this file's own header comment. */
  showAllocationChart: boolean;
}
