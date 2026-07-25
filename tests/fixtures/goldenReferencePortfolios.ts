import type { PortfolioInput } from '@/engine/shared/types';

/**
 * Golden Reference Portfolios — 06_TASKS.md M2-028 ("Create Golden
 * Reference Portfolios").
 *
 * Every `expected` value below was independently derived by hand-applying
 * the documented equations (02_Formulas.md F-001 through F-032) with
 * decimal.js at the Engine's own working precision — not copied from a
 * live Engine run — satisfying M2-028's DoD: "Expected results are
 * manually verified and stored as immutable test fixtures." These values
 * must not change except for an intentional formula-version update
 * (02_Formulas.md "VERSION COMPATIBILITY": "New formulas must not alter
 * the behavior of existing Formula IDs without version documentation").
 *
 * All five fixtures share one BTC quantity, BTC price, and set of protocol
 * parameters, varying only the debt balance — this isolates leverage as
 * the only variable across the family, deliberately mirroring
 * 02_Formulas.md's own "GOLDEN REFERENCE PORTFOLIO" section (Initial
 * Capital $100,000 / BTC Price $30,000 / Initial BTC Purchased
 * 3.33333333 BTC / Max LTV 70% / Liquidation Threshold 80% / Borrow APR
 * 5%). `NO_DEBT` below uses those exact figures and *is* that document's
 * "official" reference portfolio in its pre-loop (zero-debt) state — see
 * the "NOT INCLUDED" note at the bottom of this file for why the
 * document's further "loop to Target Health Factor 1.80" step is not
 * reproduced as a fixture.
 *
 * `supplyApr` (0.02) is not specified by either source document for this
 * scenario family; it is carried only because `ProtocolParameters`
 * requires it structurally, and none of the reference outputs below
 * (F-001, F-003, F-004, F-006, F-010, F-011, F-020, F-022, F-023, F-024,
 * F-025, F-030, F-031, F-032) depend on it, so its value cannot affect any
 * expected result in this file.
 *
 * `null` in `expected` means the Formula ID is documented as undefined for
 * that portfolio (e.g. Liquidation Price when there is no debt), not a
 * missing value — the corresponding test asserts a structured failure,
 * per 02_Formulas.md "Invalid inputs should return descriptive errors
 * instead of incorrect calculations."
 *
 * Comparisons should use 02_Formulas.md's own "ACCEPTABLE ERROR" table
 * (Currency ± $0.01, BTC ± 0.00000001, Percentages ± 0.01%, Health Factor
 * ± 0.001), not exact equality — see the ACCEPTABLE_ERROR export below.
 */

const SHARED_PROTOCOL = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
} as const;

const SHARED_MARKET = { btcPriceUsd: 30000 } as const;

/** BTC quantity purchased with $100,000 at $30,000/BTC — 02_Formulas.md's own Golden Reference Portfolio figure. */
const SHARED_BTC_QUANTITY = 3.33333333;

export interface GoldenReferencePortfolioExpected {
  collateralValue: number;
  portfolioValue: number;
  debtValue: number;
  netWorth: number;
  loanToValue: number;
  debtRatio: number;
  exposure: number;
  effectiveLeverage: number;
  /** Infinity when debt is zero (F-022's documented no-debt limit). */
  healthFactor: number;
  /** Infinity when debt is zero (F-023 reuses F-022). */
  liquidationDistance: number;
  /** null when debt is zero: Liquidation Price (F-024) is undefined with no debt. */
  liquidationPrice: number | null;
  /** null when debt is zero: Liquidation Buffer (F-025) reuses F-024. */
  liquidationBuffer: number | null;
  annualInterest: number;
  dailyInterest: number;
  monthlyInterest: number;
}

export interface GoldenReferencePortfolio {
  name: string;
  description: string;
  portfolio: PortfolioInput;
  expected: GoldenReferencePortfolioExpected;
}

/** 02_Formulas.md "ACCEPTABLE ERROR" — the tolerance for comparing engine output against these fixtures. */
export const ACCEPTABLE_ERROR = {
  currency: 0.01,
  btc: 0.00000001,
  /** On a 0-100 scale, matching calculateLiquidationBuffer's F-025 output. */
  percentagePoints: 0.01,
  healthFactor: 0.001,
} as const;

/**
 * "No debt" — also 02_Formulas.md's own official Golden Reference
 * Portfolio, in its pre-loop starting state (Initial Capital $100,000 at
 * $30,000/BTC, before any borrowing). See the file-level comment for why
 * the document's further loop step is not reproduced here.
 */
const NO_DEBT: GoldenReferencePortfolio = {
  name: 'No debt',
  description:
    '02_Formulas.md GOLDEN REFERENCE PORTFOLIO starting state: 3.33333333 BTC collateral, zero debt.',
  portfolio: {
    collateral: { asset: 'BTC', quantity: SHARED_BTC_QUANTITY },
    debt: { asset: 'USDC', balance: 0 },
    market: SHARED_MARKET,
    protocol: SHARED_PROTOCOL,
  },
  expected: {
    collateralValue: 99999.9999,
    portfolioValue: 99999.9999,
    debtValue: 0,
    netWorth: 99999.9999,
    loanToValue: 0,
    debtRatio: 0,
    exposure: 99999.9999,
    effectiveLeverage: 1,
    healthFactor: Infinity,
    liquidationDistance: Infinity,
    liquidationPrice: null,
    liquidationBuffer: null,
    annualInterest: 0,
    dailyInterest: 0,
    monthlyInterest: 0,
  },
};

/** Conservative leverage: LTV ~20%, well inside both Max LTV (70%) and Liquidation Threshold (80%). */
const CONSERVATIVE_LEVERAGE: GoldenReferencePortfolio = {
  name: 'Conservative leverage',
  description: 'Same collateral as NO_DEBT with $20,000 debt drawn (~20% LTV).',
  portfolio: {
    collateral: { asset: 'BTC', quantity: SHARED_BTC_QUANTITY },
    debt: { asset: 'USDC', balance: 20000 },
    market: SHARED_MARKET,
    protocol: SHARED_PROTOCOL,
  },
  expected: {
    collateralValue: 99999.9999,
    portfolioValue: 99999.9999,
    debtValue: 20000,
    netWorth: 79999.9999,
    loanToValue: 0.2000000002,
    debtRatio: 0.2000000002,
    exposure: 99999.9999,
    effectiveLeverage: 1.2500000003125,
    healthFactor: 3.999999996,
    liquidationDistance: 2.999999996,
    liquidationPrice: 7500.0000075,
    liquidationBuffer: 74.999999975,
    annualInterest: 1000,
    dailyInterest: 2.73972602739726,
    monthlyInterest: 82.1917808219178,
  },
};

/** Moderate leverage: LTV ~45%, roughly midway between Max LTV and 0%. */
const MODERATE_LEVERAGE: GoldenReferencePortfolio = {
  name: 'Moderate leverage',
  description: 'Same collateral as NO_DEBT with $45,000 debt drawn (~45% LTV).',
  portfolio: {
    collateral: { asset: 'BTC', quantity: SHARED_BTC_QUANTITY },
    debt: { asset: 'USDC', balance: 45000 },
    market: SHARED_MARKET,
    protocol: SHARED_PROTOCOL,
  },
  expected: {
    collateralValue: 99999.9999,
    portfolioValue: 99999.9999,
    debtValue: 45000,
    netWorth: 54999.9999,
    loanToValue: 0.45000000045,
    debtRatio: 0.45000000045,
    exposure: 99999.9999,
    effectiveLeverage: 1.8181818196694215,
    healthFactor: 1.777777776,
    liquidationDistance: 0.777777776,
    liquidationPrice: 16875.000016875,
    liquidationBuffer: 43.74999994375,
    annualInterest: 2250,
    dailyInterest: 6.164383561643835,
    monthlyInterest: 184.93150684931507,
  },
};

/** High-risk leverage: LTV ~65%, close to but still under Max LTV (70%). */
const HIGH_RISK_LEVERAGE: GoldenReferencePortfolio = {
  name: 'High-risk leverage',
  description:
    'Same collateral as NO_DEBT with $65,000 debt drawn (~65% LTV, near the 70% Max LTV).',
  portfolio: {
    collateral: { asset: 'BTC', quantity: SHARED_BTC_QUANTITY },
    debt: { asset: 'USDC', balance: 65000 },
    market: SHARED_MARKET,
    protocol: SHARED_PROTOCOL,
  },
  expected: {
    collateralValue: 99999.9999,
    portfolioValue: 99999.9999,
    debtValue: 65000,
    netWorth: 34999.9999,
    loanToValue: 0.65000000065,
    debtRatio: 0.65000000065,
    exposure: 99999.9999,
    effectiveLeverage: 2.8571428624489794,
    healthFactor: 1.2307692295384616,
    liquidationDistance: 0.23076922953846155,
    liquidationPrice: 24375.000024375,
    liquidationBuffer: 18.74999991875,
    annualInterest: 3250,
    dailyInterest: 8.904109589041095,
    monthlyInterest: 267.1232876712329,
  },
};

/**
 * Near liquidation: LTV ~77%, above the 70% Max LTV (a new borrow could
 * not reach this) but still below the 80% Liquidation Threshold. This is
 * a realistic post-origination state — Max LTV (F-012 "Borrow Capacity")
 * only constrains new borrowing, not a price decline after the debt was
 * already drawn; only the Liquidation Threshold (F-022, F-024) determines
 * actual liquidation risk. Health Factor is just above 1.0.
 */
const NEAR_LIQUIDATION: GoldenReferencePortfolio = {
  name: 'Near liquidation',
  description:
    'Same collateral as NO_DEBT with $77,000 debt outstanding (~77% LTV, Health Factor just above 1.0).',
  portfolio: {
    collateral: { asset: 'BTC', quantity: SHARED_BTC_QUANTITY },
    debt: { asset: 'USDC', balance: 77000 },
    market: SHARED_MARKET,
    protocol: SHARED_PROTOCOL,
  },
  expected: {
    collateralValue: 99999.9999,
    portfolioValue: 99999.9999,
    debtValue: 77000,
    netWorth: 22999.9999,
    loanToValue: 0.77000000077,
    debtRatio: 0.77000000077,
    exposure: 99999.9999,
    effectiveLeverage: 4.347826101512287,
    healthFactor: 1.038961037922078,
    liquidationDistance: 0.038961037922077925,
    liquidationPrice: 28875.000028875,
    liquidationBuffer: 3.74999990375,
    annualInterest: 3850,
    dailyInterest: 10.547945205479452,
    monthlyInterest: 316.43835616438355,
  },
};

/**
 * 06_TASKS.md M2-028's "Reference cases should include" list names 7
 * scenarios. Only these 5 are represented here — see the file-level "NOT
 * INCLUDED" note below for the other 2.
 */
export const GOLDEN_REFERENCE_PORTFOLIOS: readonly GoldenReferencePortfolio[] = [
  NO_DEBT,
  CONSERVATIVE_LEVERAGE,
  MODERATE_LEVERAGE,
  HIGH_RISK_LEVERAGE,
  NEAR_LIQUIDATION,
];

/**
 * NOT INCLUDED, and why (both documented in PROJECT_STATUS.md, not
 * silently skipped):
 *
 * - "Multiple collateral assets" / "Multiple debt assets" (2 of
 *   M2-028's 7 named reference cases): `PortfolioInput`
 *   (engine/shared/types.ts) models exactly one BTC collateral position
 *   and one stablecoin debt position — 01_PRD.md REQ-003, the approved
 *   single-asset scope (PROJECT_STATUS.md conflict #5). No Formula ID in
 *   02_Formulas.md defines multi-asset aggregation (e.g. a weighted
 *   Liquidation Threshold across several collateral assets), so building
 *   these fixtures would require inventing an aggregation formula that
 *   does not exist in the specification.
 *
 * - The "loop to Target Health Factor 1.80" step of 02_Formulas.md's own
 *   official Golden Reference Portfolio: reproducing the post-loop
 *   collateral/debt state requires `calculateLoopStrategy`'s
 *   `targetBorrowPercentage` input (06_TASKS.md M2-016's own required
 *   parameter), which neither 02_Formulas.md's Golden Reference Portfolio
 *   description nor F-018's pseudo-algorithm ("while Health Factor >
 *   Target: Borrow, Buy BTC, Deposit BTC, Repeat") specifies a value for.
 *   Any single per-step borrow percentage would produce a different final
 *   state, so locking one in as an "immutable" fixture would mean
 *   inventing an unstated assumption rather than reproducing a documented
 *   one — the NO_DEBT fixture above stops at the point the source
 *   document fully specifies (the pre-loop starting state).
 *
 * - Portfolio Score (F-067), named in 02_Formulas.md's own "REFERENCE
 *   OUTPUTS" list for its official Golden Reference Portfolio: not
 *   computed for any fixture here because F-067 has no implementation
 *   (PROJECT_STATUS.md conflict #12 — weights are documented but
 *   per-component 0-100 scoring formulas are not).
 */
