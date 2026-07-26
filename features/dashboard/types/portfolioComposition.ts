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

export interface PortfolioCompositionProtocolParameters {
  formattedMaxLoanToValue: string;
  formattedLiquidationThreshold: string;
  formattedBorrowApr: string;
  formattedSupplyApr: string;
}

export interface PortfolioComposition {
  collateral: PortfolioCompositionRow;
  debt: PortfolioCompositionRow;
  protocolParameters: PortfolioCompositionProtocolParameters;
  /** M5-012 — always `false` under Conflict A; see this file's own header comment. */
  showAllocationChart: boolean;
}
