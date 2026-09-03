/**
 * Portfolio Composition builder — 06_TASKS.md M5-011. See
 * `../types/portfolioComposition.ts` for the full design reasoning
 * (100% portfolio percentages and M5-012's no-new-code resolution, both
 * structural consequences of Conflict A).
 */
import {
  deriveAaveV4EffectiveBorrowRate,
  type PortfolioSummary,
  resolveCanonicalDebtBalance,
  resolveRiskCapacityDisplay,
  resolveSupplyAprDisplay,
} from '@/services';
import type { Portfolio } from '@/types/portfolio';

import type {
  PortfolioComposition,
  PortfolioCompositionProtocolParameters,
} from '../types/portfolioComposition';
import type { DashboardMarketFreshness } from '../types/viewModel';
import { formatCurrency, formatPercent, formatQuantity } from './format';

const ALWAYS_100_PERCENT = formatPercent(1);

/** Matches `buildDebtAndInterestPanel.ts`'s own `SOURCE_STATUS` — every portfolio is manually entered in this version (M4-014/M4-015). */
const SOURCE_STATUS = 'manual';

/**
 * "Borrow APR" — V4 Readiness Audit §12 Stage 15. `portfolio.protocol.borrowApr`
 * is a legacy V3-shaped scalar with no defined relationship to a V4
 * position's real two-parameter rate (`baseDrawnApr` + `riskPremium`) —
 * see `services/portfolio/mapping.ts`'s `deriveAaveV4EffectiveBorrowRate`
 * for the full reasoning. For a V4 portfolio, this now derives the real
 * rate from synced `v4DebtState` instead; `'—'` (never a fabricated or
 * stale V3 number) when that state is absent, invalid, or the derivation
 * itself fails — the same fail-closed convention already used elsewhere
 * on this Dashboard for a missing/invalid value.
 */
function formatBorrowRate(
  portfolio: Portfolio,
  tracked: { engineVersion: string; formulaVersion: string },
): string {
  if (portfolio.protocolVersion !== 'v4') {
    return formatPercent(portfolio.protocol.borrowApr);
  }
  if (portfolio.v4DebtState === undefined) return '—';
  const rateStep = deriveAaveV4EffectiveBorrowRate(portfolio.v4DebtState, tracked, SOURCE_STATUS);
  return rateStep.ok ? formatPercent(rateStep.value) : '—';
}

/**
 * Debt row "Quantity" — V4 Readiness Audit §12 Stage 16. Previously
 * always `formatQuantity(portfolio.debt.balance)`, the legacy V3 scalar,
 * inconsistent with this same row's own `formattedPositionValue` (already
 * canonical via `summary.debtValue`) for a V4 portfolio whose
 * `debt.balance` has drifted from its real synced total. `'—'` (never a
 * stale number) when that state is required but absent — the same
 * fail-closed convention `formatBorrowRate` above already established.
 */
function formatDebtQuantity(portfolio: Portfolio): string {
  if (portfolio.protocolVersion === 'v4' && portfolio.v4DebtState === undefined) return '—';
  return formatQuantity(resolveCanonicalDebtBalance(portfolio));
}

/**
 * "Max LTV"/"Liquidation Threshold" vs. "Collateral Factor" — V4
 * Readiness Audit §12 Stage 23E. Previously always
 * `formatPercent(portfolio.protocol.maxLoanToValue)`/`.liquidationThreshold`,
 * a V3-only pair with no V4 equivalent (Stage 23B:
 * `collateralFactor` alone governs both) — rendering a meaningless V3
 * number under a V3-only label for a V4 portfolio. Resolves via the
 * shared `resolveRiskCapacityDisplay` (`services/portfolio/mapping.ts`)
 * rather than re-deriving the V3/V4 branch here; only the formatting
 * (`formatPercent`) is local to this Dashboard util, consistent with the
 * Service layer's own "never format for display" rule.
 *
 * **"Supply APR" is V3-only (Dashboard V3/V4 Semantic Isolation audit,
 * superseding V4 Readiness Audit §12 P1-1's own fix).** P1-1 made this
 * `'—'` for an "untrusted" V4 portfolio (`v4CollateralRiskSource !==
 * 'manual'`) while still showing `portfolio.protocol.supplyApr` as a real
 * "available" value whenever collateral risk WAS manually entered — but
 * that conflates two unrelated fields. `v4CollateralRiskSource` describes
 * only the collateral-factor assertion; it says nothing about
 * `protocol.supplyApr`, which for V4 is a fixed, inert `0` placeholder
 * `NewPortfolioPageClient.tsx` writes once at creation and no V4-facing
 * form (`NewPortfolioV4Fields.tsx`/`ManualAaveV4StateForm.tsx`) ever
 * exposes for editing — there is no path, manual-collateral-risk or
 * otherwise, by which a V4 portfolio's `protocol.supplyApr` can ever be a
 * genuine user assertion. Confirmed via `resolveSupplyAprDisplay`'s own
 * doc comment too: no V4 boundary this codebase talks to exposes an
 * authoritative supply rate at all, live or manual. So this Dashboard
 * panel never calls `resolveSupplyAprDisplay` for a V4 portfolio at all —
 * V3 still calls it exactly as before (see `PortfolioCompositionProtocolParameters`'s
 * own doc comment for why the field is dropped from the V4 branches'
 * shape entirely, not just formatted as "—").
 */
function formatProtocolParameters(
  portfolio: Portfolio,
  formattedBorrowApr: string,
): PortfolioCompositionProtocolParameters {
  const display = resolveRiskCapacityDisplay(portfolio);
  if (display.kind === 'v3') {
    const supplyAprDisplay = resolveSupplyAprDisplay(portfolio);
    const formattedSupplyApr =
      supplyAprDisplay.kind === 'available' ? formatPercent(supplyAprDisplay.supplyApr) : '—';
    return {
      kind: 'v3',
      formattedMaxLoanToValue: formatPercent(display.maxLoanToValue),
      formattedLiquidationThreshold: formatPercent(display.liquidationThreshold),
      formattedBorrowApr,
      formattedSupplyApr,
    };
  }
  if (display.kind === 'v4Available') {
    return {
      kind: 'v4Available',
      formattedCollateralFactor: formatPercent(display.collateralFactor),
      formattedBorrowApr,
    };
  }
  return { kind: 'v4Unavailable', formattedBorrowApr };
}

export function buildPortfolioComposition(
  portfolio: Portfolio,
  summary: PortfolioSummary,
  marketFreshness: DashboardMarketFreshness | null,
  tracked: { engineVersion: string; formulaVersion: string },
): PortfolioComposition {
  return {
    collateral: {
      assetLabel: portfolio.collateral.asset,
      formattedQuantity: formatQuantity(portfolio.collateral.quantity),
      formattedCurrentPrice:
        marketFreshness?.formattedPrice ?? formatCurrency(portfolio.market.btcPriceUsd),
      formattedPositionValue: formatCurrency(summary.collateralValue),
      formattedPortfolioPercentage: ALWAYS_100_PERCENT,
    },
    debt: {
      assetLabel: portfolio.debt.asset,
      formattedQuantity: formatDebtQuantity(portfolio),
      formattedCurrentPrice: '$1.00 (stablecoin)',
      formattedPositionValue: formatCurrency(summary.debtValue),
      formattedPortfolioPercentage: ALWAYS_100_PERCENT,
    },
    protocolParameters: formatProtocolParameters(portfolio, formatBorrowRate(portfolio, tracked)),
    showAllocationChart: false,
  };
}
