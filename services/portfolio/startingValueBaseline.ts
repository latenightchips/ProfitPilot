/**
 * Starting-Value Baseline comparison — canonical specification
 * `docs/STARTING_VALUE_BASELINE_SPEC.md` §4 (current comparison), §5
 * (quantity-change detection), §6 (behavior after quantity changes).
 *
 * **Deliberately not a `ServiceResult`/Formula-ID calculation** — per
 * that document's §12, no existing Formula ID governs this feature and
 * none is invented here. This is plain, untracked arithmetic on two
 * already-validated `Portfolio` fields (`collateral.quantity`,
 * `market.btcPriceUsd`), the same "plain display-shape resolver, no
 * Engine `formulaStep` plumbing" pattern `resolveRiskCapacityDisplay`/
 * `resolveSupplyAprDisplay` (`./mapping.ts`) already use for values that
 * are genuinely just reshaping already-validated portfolio state, not
 * invoking a new Engine calculation.
 *
 * Returns `null` when no baseline is set — the three baseline fields are
 * only ever written together (`stores/portfolioStore.ts`'s `setBaseline`),
 * so checking any one for `undefined` is equivalent to checking all
 * three, per that document's own §2/§10.
 */
import type { Portfolio } from '@/types/portfolio';

export interface StartingValueBaselineComparison {
  /**
   * `'current'` iff the portfolio's live `collateral.quantity` still
   * exactly equals the baseline's own recorded `collateralQuantity`
   * (§5) — a single deterministic equality check, no epsilon, no
   * rounding. `'compositionChanged'` otherwise, regardless of cause.
   */
  status: 'current' | 'compositionChanged';
  /** ISO 8601 — the baseline's own recorded `establishedAt`, unchanged by composition changes. */
  establishedAt: string;
  /** The baseline's own recorded `collateralQuantity`, unchanged by composition changes. */
  baselineCollateralQuantity: number;
  /** `baselineCollateralQuantity * marketPriceUsd` at baseline-establishment time. */
  baselineValueUsd: number;
  /** The portfolio's live `collateral.quantity` at read time. */
  currentCollateralQuantity: number;
  /** The portfolio's live `collateral.quantity * market.btcPriceUsd` at read time. */
  currentValueUsd: number;
  /** `currentValueUsd - baselineValueUsd`. Always well-defined. */
  absoluteChangeUsd: number;
  /**
   * `(currentValueUsd - baselineValueUsd) / baselineValueUsd`, or `null`
   * when `baselineValueUsd` is `0` (§4's zero-baseline case) — never
   * `NaN`/`Infinity`.
   */
  percentageChange: number | null;
}

export function calculateStartingValueBaselineComparison(
  portfolio: Portfolio,
): StartingValueBaselineComparison | null {
  if (
    portfolio.establishedAt === undefined ||
    portfolio.collateralQuantity === undefined ||
    portfolio.marketPriceUsd === undefined
  ) {
    return null;
  }

  const baselineCollateralQuantity = portfolio.collateralQuantity;
  const baselineValueUsd = baselineCollateralQuantity * portfolio.marketPriceUsd;
  const currentCollateralQuantity = portfolio.collateral.quantity;
  const currentValueUsd = currentCollateralQuantity * portfolio.market.btcPriceUsd;
  const absoluteChangeUsd = currentValueUsd - baselineValueUsd;
  const percentageChange =
    baselineValueUsd === 0 ? null : (currentValueUsd - baselineValueUsd) / baselineValueUsd;
  const status: 'current' | 'compositionChanged' =
    currentCollateralQuantity === baselineCollateralQuantity ? 'current' : 'compositionChanged';

  return {
    status,
    establishedAt: portfolio.establishedAt,
    baselineCollateralQuantity,
    baselineValueUsd,
    currentCollateralQuantity,
    currentValueUsd,
    absoluteChangeUsd,
    percentageChange,
  };
}
