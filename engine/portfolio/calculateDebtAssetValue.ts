import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validatePrice, validateTokenQuantity } from '../validation/validate';

const FORMULA_ID = 'DEBT-ASSET-USD-VALUE';
const FORMULA_VERSION = '1.0';

/**
 * Debt Asset USD Value — V4 Readiness Audit §12 P1-D2. Not a
 * `02_Formulas.md` Formula ID (that spec's F-001–F-069 catalog is
 * closed/historical — see `../shared/types.ts`'s own header comment),
 * so this uses a descriptive string ID instead of minting a new F-XXX
 * number, the same convention `../protocols/aaveV4/projectAaveV4Debt.ts`
 * (`'AAVE-V4-DRAWN-PREMIUM'`) already established for post-spec
 * additions. Unlike that one, this formula is deliberately
 * protocol-neutral — plain `quantity × price`, structurally identical to
 * `calculateCollateralValue`'s (F-002) own equation — so it is not named
 * with an `AAVE-V4-` prefix.
 *
 * Equation: Debt Asset USD Value = Debt Asset Quantity × Debt Asset USD Price.
 *
 * **Deliberately NOT an extension of `calculateDebtValue` (F-003).**
 * `calculateDebtValue` takes a `DebtPosition` and returns `debt.balance`
 * unchanged — its own equation, "Debt Value = Borrowed Stablecoins"
 * (`02_Formulas.md`), assumes 1 token = $1 by definition, and every one
 * of its existing production callers (`calculateNetWorth`,
 * `calculateBorrowRecommendation`, `calculateAdditionalCollateralRecommendation`,
 * `calculateRepaymentRecommendation`, `simulatePositionChange`,
 * `simulatePriceScenario`) — plus every OTHER direct reader of
 * `debt.balance` across the Engine (Exit Planner, Loop Builder,
 * `simulateInterestScenario`) — already treats `debt.balance` itself as
 * an already-USD value, not a raw token count (verified during the P1-D
 * investigation: `docs/02_Formulas.md`'s own text defines it that way).
 * Changing `calculateDebtValue`'s signature to accept a price would
 * force every one of those callers to pass one (most have none to pass —
 * V3/manual has no live debt-asset price source at all), silently
 * changing their behavior merely to reuse this function's name. This
 * formula exists ADDITIVELY instead: nothing currently calls it, and
 * `calculateDebtValue`/`debt.balance`'s existing meaning is untouched by
 * this file.
 *
 * **Plain scalar parameters, not a `DebtPosition`.** `DebtPosition.balance`
 * (`../shared/types.ts`) already means "USD debt value" everywhere else
 * in this codebase (see above) — accepting a `DebtPosition` here would
 * reuse that same field name to mean "raw token quantity" instead,
 * exactly the ambiguity this stage's own instructions warn against.
 * `debtAssetQuantity`/`debtAssetPriceUsd` name their units unambiguously
 * instead.
 *
 * **No `$1` fallback of any kind.** `debtAssetPriceUsd` is a required
 * parameter, validated as a genuine price (`validatePrice` — must be
 * positive) exactly like `calculateCollateralValue` validates
 * `market.btcPriceUsd`; there is no default, no optional-parameter
 * fallback, and no protocol-specific branch here — the caller (a future
 * stage, not this one) is entirely responsible for supplying an
 * already-normalized USD price from whatever source is authoritative for
 * its protocol version. This file never reads `debtAssetPriceUsd` off any
 * V4 snapshot itself, and has no import from `infrastructure/`.
 */
export function calculateDebtAssetValue(
  debtAssetQuantity: number,
  debtAssetPriceUsd: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { debtAssetQuantity, debtAssetPriceUsd },
  };

  const quantity = validateTokenQuantity(debtAssetQuantity, 'debtAssetQuantity');
  if (!quantity.ok) return createFailure(quantity.error, options);

  const price = validatePrice(debtAssetPriceUsd, 'debtAssetPriceUsd');
  if (!price.ok) return createFailure(price.error, options);

  const value = toDecimal(quantity.value).times(price.value);
  return createSuccess(toOutputNumber(value), options);
}
