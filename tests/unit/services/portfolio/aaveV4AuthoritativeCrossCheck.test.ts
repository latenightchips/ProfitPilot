import { describe, expect, it } from 'vitest';

import { calculateMaxAdditionalBorrow } from '@/services/portfolio/borrowCapacity';
import type { ApplicationPortfolio } from '@/services/portfolio/models';
import { calculatePortfolioSummary } from '@/services/portfolio/summary';

/**
 * V4 Readiness Audit §12 P1-2 — Health Factor / Borrow Capacity
 * cross-check against Aave V4's own authoritative aggregate account-state
 * view, `ISpoke.getUserAccountData(address)`.
 *
 * **P1-2's investigation finding**: unlike V3 (no equivalent was found in
 * this repo's own code), Aave V4 genuinely exposes an aggregate view —
 * `ISpoke.getUserAccountData` — verified directly against the primary
 * `aave/aave-v4` source at the exact commit
 * (`2524fe4018a42750300e114f2a8c4355df62a878`) this repo's own pinned V4
 * ABI boundary (`infrastructure/protocols/aave/v4/abi.ts`) already trusts.
 * `ISpoke.sol`'s own NatSpec:
 *
 * ```
 * struct UserAccountData {
 *   uint256 riskPremium;           // BPS
 *   uint256 avgCollateralFactor;   // WAD
 *   uint256 healthFactor;          // WAD, 1e18 == HF of 1.00
 *   uint256 totalCollateralValue;  // Value units
 *   uint256 totalDebtValueRay;     // Value units, scaled by RAY (1e27)
 *   uint256 activeCollateralCount;
 *   uint256 borrowCount;
 * }
 * function getUserAccountData(address user) external view returns (UserAccountData memory);
 * ```
 *
 * `Spoke.sol`'s own implementation (`_processUserAccountData`), read in
 * full from the same pinned commit, reduces — for exactly one active
 * collateral reserve and exactly one active debt reserve (ProfitPilot's
 * only supported V0.1 shape: one BTC collateral position, one stablecoin
 * debt position, `engine/shared/types.ts`'s own header comment) — to
 * exactly:
 *
 *   totalCollateralValue = collateralQuantity × collateralOraclePrice
 *   totalDebtValue       = debtQuantity × debtOraclePrice
 *   healthFactor         = (collateralFactor × totalCollateralValue) / totalDebtValue
 *
 * (the general multi-reserve loop's `Σ(collateralFactor_i × value_i)`
 * reduces to a single term; RAY/WAD/BPS scaling on both numerator and
 * denominator of the `mulDiv` cancels algebraically, confirmed by hand —
 * see this file's own `authoritativeV4HealthFactor` below for the
 * reduced-but-faithful reference implementation). This is
 * mathematically IDENTICAL in shape to `engine/health/calculateHealthFactor.ts`'s
 * F-022 (`collateralValue × liquidationThreshold / debtValue`, dispatched
 * to `v4CollateralRisk.collateralFactor` for a V4 portfolio via
 * `services/portfolio/mapping.ts`'s `resolveRiskCapacityFraction`) — no
 * separate LTV/liquidation-threshold split exists on the V4 side either:
 * `_processUserAccountData` reads only `_dynamicConfig[...].collateralFactor`,
 * never a second parameter, independently corroborating this repo's own
 * Stage 23B finding ("V4 has no separate max-LTV/liquidation-threshold
 * pair — `collateralFactor` alone governs both borrow capacity and
 * liquidation eligibility").
 *
 * **`getUserAccountData` has no direct "available to borrow" field** —
 * V4 does not expose a V3-`availableBorrowsBase`-equivalent value at all.
 * The only mathematically consistent way to derive "how much more debt
 * can this position take while keeping HF at or above some target" is by
 * solving the same HF equation for debt — exactly what
 * `engine/health/calculateAdditionalBorrow.ts`'s F-027 already does
 * (`(collateralValue × liquidationThreshold / targetHealthFactor) −
 * currentDebt`). There is no separate authoritative on-chain value this
 * derivation could disagree with; its correctness is entirely a function
 * of the (now cross-checked) Health Factor formula it's derived from.
 *
 * **Why a fixture-based reference implementation, not live RPC.** Per
 * this stage's own instruction: "If deterministic unit/fixture testing is
 * more appropriate than requiring live RPC during the normal test suite,
 * use that. Do not make `pnpm validate` dependent on an unreliable public
 * RPC." `authoritativeV4HealthFactor`/`authoritativeV4MaxAdditionalBorrow`
 * below are a direct, hand-verified transcription of the Solidity
 * reduction above — operating on already oracle-normalized USD ("Value")
 * inputs, the same layer `calculatePortfolioSummary` itself operates at
 * (raw on-chain decimals/oracle-decimals normalization is a separate,
 * already-exhaustively-tested boundary — P1-D1/P1-B/P1-C, `infrastructure/protocols/aave/v4/index.ts`'s
 * own `oraclePriceToUsd` — not re-verified here, since re-deriving it
 * would just duplicate that existing coverage rather than add new
 * verification value). This is a genuine cross-check against a second,
 * independently-derived implementation of the authoritative formula, not
 * a tautological re-statement of `calculateHealthFactor`'s own code.
 *
 * **Rounding, not a real disagreement.** Aave V4's own `mulDiv` uses
 * `Math.Rounding.Floor` on RAY/WAD-scaled integers; ProfitPilot's Engine
 * uses `decimal.js` at 34-digit precision (`engine/shared/decimal.ts`),
 * effectively continuous relative to a RAY's 1e27 granularity. The two
 * can differ by at most ~1e-27 relative — many orders of magnitude below
 * any displayed precision (`DISPLAY_PRECISION.healthFactor: 3`). Assertions
 * below use `toBeCloseTo` with a tolerance far larger than that floor,
 * wide enough to absorb this harmless representation difference but far
 * too tight to hide a real formula-shape disagreement (which would show
 * up as an error many orders of magnitude larger, not a rounding-noise
 * mismatch).
 */

/**
 * Faithful, hand-verified reduction of `Spoke.sol`'s
 * `_processUserAccountData` (single collateral reserve, single debt
 * reserve — ProfitPilot's only supported shape) — operating directly in
 * USD ("Value") units, matching the point in ProfitPilot's own pipeline
 * (`calculatePortfolioSummary`) where oracle-normalized values first
 * appear. Deliberately NOT calling any ProfitPilot Engine/Service
 * function — a second, independent implementation of the same
 * authoritative math, so a real formula-shape bug in `calculateHealthFactor`/
 * `calculateAdditionalBorrow` cannot pass this test merely by agreeing
 * with itself.
 */
function authoritativeV4HealthFactor(
  collateralQuantity: number,
  collateralPriceUsd: number,
  collateralFactor: number, // decimal fraction, e.g. 0.8 for 8000 BPS
  debtQuantity: number,
  debtPriceUsd: number,
): number {
  const totalCollateralValue = collateralQuantity * collateralPriceUsd;
  const totalDebtValue = debtQuantity * debtPriceUsd;
  if (totalDebtValue === 0) return Infinity; // on-chain: type(uint256).max — same "no liquidation risk" meaning
  return (collateralFactor * totalCollateralValue) / totalDebtValue;
}

/**
 * The only mathematically consistent "available to borrow" derivation
 * given V4 exposes no direct field for it — solves
 * `authoritativeV4HealthFactor(..., debtQuantity + additionalDebt / debtPriceUsd, ...) == targetHealthFactor`
 * for `additionalDebt`, in USD.
 */
function authoritativeV4MaxAdditionalBorrow(
  collateralQuantity: number,
  collateralPriceUsd: number,
  collateralFactor: number,
  currentDebtValue: number,
  targetHealthFactor: number,
): number {
  const totalCollateralValue = collateralQuantity * collateralPriceUsd;
  const targetDebtValue = (collateralFactor * totalCollateralValue) / targetHealthFactor;
  return targetDebtValue - currentDebtValue;
}

function v4Portfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: { maxLoanToValue: 0.75, liquidationThreshold: 0.8, borrowApr: 0.05, supplyApr: 0.02 },
    protocolVersion: 'v4',
    v4DebtState: {
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
      debtAssetPriceUsd: 1.0,
    },
    v4DebtStateSource: 'live',
    v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    v4CollateralRiskSource: 'live',
    ...overrides,
  };
}

const SOURCE_STATUS = 'export';

describe('Aave V4 Health Factor cross-check against the authoritative on-chain formula (P1-2)', () => {
  it('single collateral + single debt, at par (debtAssetPriceUsd = $1.00): agrees exactly', () => {
    const portfolio = v4Portfolio();
    const summary = calculatePortfolioSummary(portfolio, SOURCE_STATUS);
    if (!summary.ok) throw new Error('setup failed');

    const expected = authoritativeV4HealthFactor(2, 50000, 0.8, 20000, 1.0);
    expect(summary.data.healthFactor).toBeCloseTo(expected, 9);
    // Sanity: matches the known-good figure independently, not just self-consistency.
    expect(summary.data.healthFactor).toBeCloseTo(4, 9); // (2*50000*0.8)/20000 = 4
  });

  it('a non-$1 authoritative debt oracle price (P1-D3 territory): still agrees exactly', () => {
    const portfolio = v4Portfolio({
      v4DebtState: {
        drawnDebt: 15000,
        premiumDebt: 5000,
        baseDrawnApr: 0.05,
        riskPremium: 0.01,
        debtAssetPriceUsd: 0.9973,
      },
    });
    const summary = calculatePortfolioSummary(portfolio, SOURCE_STATUS);
    if (!summary.ok) throw new Error('setup failed');

    const debtQuantity = 15000 + 5000;
    const expected = authoritativeV4HealthFactor(2, 50000, 0.8, debtQuantity, 0.9973);
    expect(summary.data.healthFactor).toBeCloseTo(expected, 6);
  });

  it('zero debt: both sides agree the position has no liquidation risk (HF = Infinity)', () => {
    const portfolio = v4Portfolio({
      debt: { asset: 'USDC', balance: 0 },
      v4DebtState: {
        drawnDebt: 0,
        premiumDebt: 0,
        baseDrawnApr: 0.05,
        riskPremium: 0.01,
        debtAssetPriceUsd: 1.0,
      },
    });
    const summary = calculatePortfolioSummary(portfolio, SOURCE_STATUS);
    if (!summary.ok) throw new Error('setup failed');

    expect(summary.data.healthFactor).toBe(Infinity);
    expect(authoritativeV4HealthFactor(2, 50000, 0.8, 0, 1.0)).toBe(Infinity);
  });

  it('near-liquidation (HF close to 1.0): agrees exactly at the safety-critical boundary', () => {
    // Debt sized so HF lands just above 1.0: (2*50000*0.8)/D ≈ 1.001 -> D ≈ 79920.08
    const debtQuantity = 79920.08;
    const portfolio = v4Portfolio({
      debt: { asset: 'USDC', balance: debtQuantity },
      v4DebtState: {
        drawnDebt: debtQuantity,
        premiumDebt: 0,
        baseDrawnApr: 0.05,
        riskPremium: 0.01,
        debtAssetPriceUsd: 1.0,
      },
    });
    const summary = calculatePortfolioSummary(portfolio, SOURCE_STATUS);
    if (!summary.ok) throw new Error('setup failed');

    const expected = authoritativeV4HealthFactor(2, 50000, 0.8, debtQuantity, 1.0);
    expect(summary.data.healthFactor).toBeCloseTo(expected, 9);
    expect(summary.data.healthFactor).toBeGreaterThan(1);
    expect(summary.data.healthFactor).toBeLessThan(1.01);
  });

  it('HF exactly at the liquidation boundary (HF = 1.0): both sides agree precisely', () => {
    // D = (2*50000*0.8)/1.0 = 80000
    const debtQuantity = 80000;
    const portfolio = v4Portfolio({
      debt: { asset: 'USDC', balance: debtQuantity },
      v4DebtState: {
        drawnDebt: debtQuantity,
        premiumDebt: 0,
        baseDrawnApr: 0.05,
        riskPremium: 0.01,
        debtAssetPriceUsd: 1.0,
      },
    });
    const summary = calculatePortfolioSummary(portfolio, SOURCE_STATUS);
    if (!summary.ok) throw new Error('setup failed');

    expect(summary.data.healthFactor).toBeCloseTo(1, 9);
    expect(authoritativeV4HealthFactor(2, 50000, 0.8, debtQuantity, 1.0)).toBeCloseTo(1, 9);
  });

  it("drawnDebt + premiumDebt aggregation (V4-specific two-component debt): agrees when both components are summed identically to Aave's own getUserDebt", () => {
    // Aave's own ISpoke.getUserDebt already returns (drawnDebt, premiumDebt)
    // as two independently-resolved current balances (verified during
    // P1-D1/P1-D3) — the authoritative aggregate simply sums them before
    // pricing, exactly as ProfitPilot's resolveCanonicalDebtBalance does.
    const portfolio = v4Portfolio({
      v4DebtState: {
        drawnDebt: 12345.67,
        premiumDebt: 987.65,
        baseDrawnApr: 0.05,
        riskPremium: 0.02,
        debtAssetPriceUsd: 1.0021,
      },
    });
    const summary = calculatePortfolioSummary(portfolio, SOURCE_STATUS);
    if (!summary.ok) throw new Error('setup failed');

    const expected = authoritativeV4HealthFactor(2, 50000, 0.8, 12345.67 + 987.65, 1.0021);
    expect(summary.data.healthFactor).toBeCloseTo(expected, 6);
  });

  it("a differing collateralFactor, exercising ProfitPilot's real V4 collateral configuration path (not a hardcoded 0.8)", () => {
    const portfolio = v4Portfolio({
      v4CollateralRisk: { collateralFactor: 0.735, dynamicConfigKey: 7 },
    });
    const summary = calculatePortfolioSummary(portfolio, SOURCE_STATUS);
    if (!summary.ok) throw new Error('setup failed');

    const expected = authoritativeV4HealthFactor(2, 50000, 0.735, 20000, 1.0);
    expect(summary.data.healthFactor).toBeCloseTo(expected, 9);
  });

  it('a deliberately WRONG reference collateralFactor fails the assertion — proves this test can actually catch a real disagreement, not just tautologically agree', () => {
    const portfolio = v4Portfolio();
    const summary = calculatePortfolioSummary(portfolio, SOURCE_STATUS);
    if (!summary.ok) throw new Error('setup failed');

    const wrongReference = authoritativeV4HealthFactor(2, 50000, 0.5, 20000, 1.0); // wrong CF on purpose
    expect(summary.data.healthFactor).not.toBeCloseTo(wrongReference, 9);
  });
});

describe('Aave V4 borrow capacity cross-check against the authoritative HF-derived formula (P1-2)', () => {
  it('max additional debt at targetHealthFactor 1.0 agrees with the authoritative derivation', () => {
    const portfolio = v4Portfolio();
    const result = calculateMaxAdditionalBorrow(portfolio, 1.0, SOURCE_STATUS);
    if (!result.ok) throw new Error('setup failed');

    const expected = authoritativeV4MaxAdditionalBorrow(2, 50000, 0.8, 20000, 1.0);
    expect(result.data).toBeCloseTo(expected, 6);
    expect(result.data).toBeCloseTo(60000, 6); // (2*50000*0.8)/1.0 - 20000 = 60000
  });

  it('a stricter target health factor (2.0) agrees with the authoritative derivation, and correctly goes negative when already below target', () => {
    const portfolio = v4Portfolio({
      debt: { asset: 'USDC', balance: 70000 },
      v4DebtState: {
        drawnDebt: 70000,
        premiumDebt: 0,
        baseDrawnApr: 0.05,
        riskPremium: 0.01,
        debtAssetPriceUsd: 1.0,
      },
    });
    const result = calculateMaxAdditionalBorrow(portfolio, 2.0, SOURCE_STATUS);
    if (!result.ok) throw new Error('setup failed');

    // Current HF = (2*50000*0.8)/70000 ≈ 1.143, below target 2.0 -> negative (must repay).
    const expected = authoritativeV4MaxAdditionalBorrow(2, 50000, 0.8, 70000, 2.0);
    expect(result.data).toBeCloseTo(expected, 6);
    expect(result.data).toBeLessThan(0);
  });

  it('a non-$1 authoritative debt oracle price: agrees with the authoritative derivation', () => {
    const portfolio = v4Portfolio({
      v4DebtState: {
        drawnDebt: 15000,
        premiumDebt: 5000,
        baseDrawnApr: 0.05,
        riskPremium: 0.01,
        debtAssetPriceUsd: 0.9973,
      },
    });
    const result = calculateMaxAdditionalBorrow(portfolio, 1.0, SOURCE_STATUS);
    if (!result.ok) throw new Error('setup failed');

    const currentDebtValue = (15000 + 5000) * 0.9973;
    const expected = authoritativeV4MaxAdditionalBorrow(2, 50000, 0.8, currentDebtValue, 1.0);
    expect(result.data).toBeCloseTo(expected, 6);
  });
});
