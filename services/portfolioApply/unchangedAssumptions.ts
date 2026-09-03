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
 *
 * **V4's interest-rate line no longer names "supply APR" (Supply APR
 * Semantic-Boundary Fix follow-up, batch A2).** `protocol.supplyApr` is
 * never a genuine V4 concept at all — see `resolveSupplyAprDisplay`'s own
 * doc comment (`services/portfolio/mapping.ts`) — so telling a V4 user
 * it is one of the assumptions "staying unchanged" implied a real V4
 * value was being preserved, when none exists. The V4 line instead names
 * `v4DebtState.baseDrawnApr`/`.riskPremium` — V4's real rate inputs,
 * genuinely carried forward unchanged by `deriveV4DebtStateAfterDelta`'s
 * own repayment branch (`services/portfolio/mapping.ts`: only
 * `drawnDebt`/`premiumDebt` change on repayment; `baseDrawnApr`/
 * `riskPremium` are copied through as-is), using the same "Base drawn
 * APR"/"Risk premium" vocabulary the rest of the app already establishes
 * (`NewPortfolioV4Fields.tsx`, `ManualAaveV4StateForm.tsx`,
 * `V4ProvenanceDetail.tsx`). V3's line is untouched, byte-for-byte.
 */
export const SOURCE_STATUS = 'manual';

export function unchangedAssumptionsFor(protocolVersion: 'v3' | 'v4'): readonly string[] {
  const base = ['Market price'];
  if (protocolVersion === 'v4') {
    base.push(
      'Aave V4 base drawn APR and risk premium',
      'Aave V4 collateral-risk configuration',
      'Aave V4 on-chain position identity',
    );
  } else {
    base.push(
      'Protocol interest rates (borrow/supply APR)',
      'Loan-to-value and liquidation-threshold parameters',
    );
  }
  return base;
}
