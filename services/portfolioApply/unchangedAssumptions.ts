/**
 * Shared constants for every `PortfolioApplyProposal` builder — V1.1
 * Batch 3.
 *
 * `SOURCE_STATUS` is always `'manual'`: every proposal is, by
 * `PortfolioApplyProposal.valueBasis`'s own definition, a hypothetical
 * planning result, never a live-sourced calculation — the same
 * `'manual'`-hardcoded precedent `stores/portfolioStore.ts`'s own
 * `SOURCE_STATUS` already establishes for every locally-computed summary.
 *
 * `unchangedAssumptionsFor` states, in the same words across every
 * source workflow, exactly what none of the three builders ever touch —
 * `market`/`protocol.borrowApr`/`protocol.supplyApr`/`protocol.maxLoanToValue`/
 * `protocol.liquidationThreshold` are always carried forward unchanged
 * from the source portfolio (Section 2's "assumptions that remain
 * unchanged"; verified by `buildFinalLoopPortfolio`/
 * `buildPortfolioActionAfterPortfolio`'s own object-spread construction,
 * neither of which ever reassigns `market`/`protocol`), and — for V4 —
 * `v4CollateralRisk`/`v4Position` are carried forward unchanged too (no
 * apply workflow proposes a collateral-risk or on-chain-identity change).
 */
export const SOURCE_STATUS = 'manual';

export function unchangedAssumptionsFor(protocolVersion: 'v3' | 'v4'): readonly string[] {
  const base = ['Market price', 'Protocol interest rates (borrow/supply APR)'];
  if (protocolVersion === 'v4') {
    base.push('Aave V4 collateral-risk configuration', 'Aave V4 on-chain position identity');
  } else {
    base.push('Loan-to-value and liquidation-threshold parameters');
  }
  return base;
}
