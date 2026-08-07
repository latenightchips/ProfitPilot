import type { PortfolioInput } from '@/engine/shared/types';

import { ACCEPTABLE_ERROR } from './goldenReferencePortfolios';

/**
 * Extended Golden Reference fixtures — 06_TASKS.md M9-006 ("Perform
 * Independent Golden Reference Review"). Dependencies: M2-028, M9-005.
 * Review: "...Loop outputs, Simulation outputs, Exit outputs."
 * Requirements: "Use a separate calculation method or verified external
 * worksheet. Document tolerances."
 *
 * `tests/fixtures/goldenReferencePortfolios.ts` (M2-028) already
 * independently covers Portfolio value, Net equity, LTV, Health Factor,
 * Liquidation price, and Interest cost — 6 of M9-006's 9 named Review
 * items. This file supplies the 3 that were missing: Loop outputs,
 * Simulation outputs, Exit outputs. No portfolio-level fixture is
 * duplicated here.
 *
 * **Separate calculation method**: every `expected` value below was
 * computed independently using Python's `decimal` module (arbitrary
 * precision, 50-digit context) — a different language, library, and
 * execution environment than the Engine's own TypeScript + `decimal.js`
 * implementation — by hand-applying 02_Formulas.md's documented
 * equations directly, not by calling or reading the Engine's own code.
 * The exact script and its output are reproduced in this file's own
 * comments next to each fixture so the independent derivation is
 * auditable, not just asserted.
 *
 * **Tolerances**: reuses `ACCEPTABLE_ERROR` from
 * `goldenReferencePortfolios.ts` (02_Formulas.md's own "ACCEPTABLE
 * ERROR" table — Currency ± $0.01, BTC ± 0.00000001, Percentages ±
 * 0.01%, Health Factor ± 0.001) — the same standard, not a new one for
 * this file.
 */
export { ACCEPTABLE_ERROR };

/**
 * Loop Step golden reference — one `calculateLoopStep` (F-014) call.
 *
 * Independent derivation (Python `decimal`, 50-digit precision):
 * ```
 * collateral_value = 2 * 50000                              # 100000
 * available_borrow = collateral_value * 0.7 - 0              # 70000
 * borrowed_amount = available_borrow * 1.0                  # 70000
 * btc_purchased = borrowed_amount / 50000                   # 1.4
 * collateral_after_qty = 2 + 1.4                             # 3.4
 * collateral_value_after = 3.4 * 50000                       # 170000
 * debt_after = 0 + 70000                                     # 70000
 * new_ltv = 70000 / 170000                                   # 0.41176470588235294117647058823529411764705882352941
 * new_health_factor = (170000 * 0.8) / 70000                 # 1.9428571428571428571428571428571428571428571428571
 * ```
 */
export const LOOP_STEP_GOLDEN_REFERENCE = {
  name: 'Single loop step, 100% borrow percentage',
  description:
    '2 BTC collateral, zero debt, BTC at $50,000, Max LTV 70%, one loop step borrowing 100% of available capacity.',
  input: {
    collateral: { asset: 'BTC' as const, quantity: 2 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.7,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    borrowPercentage: 1.0,
  },
  expected: {
    availableBorrow: 70000,
    borrowedAmount: 70000,
    btcPurchased: 1.4,
    collateralAfterQuantity: 3.4,
    collateralValueAfter: 170000,
    debtAfter: 70000,
    newLoanToValue: 0.411764705882353,
    newHealthFactor: 1.942857142857143,
  },
} as const;

/**
 * Simulation golden reference — one `simulatePriceScenario` (F-050) call.
 *
 * Independent derivation (Python `decimal`, 50-digit precision):
 * ```
 * scenario_price = 50000 * 1.2                                # 60000
 * collateral_value = 2 * 60000                                 # 120000
 * net_equity = 120000 - 60000                                  # 60000
 * loan_to_value = 60000 / 120000                                # 0.5
 * health_factor = (120000 * 0.8) / 60000                        # 1.6
 * liquidation_distance = 1.6 - 1                                 # 0.6
 * baseline_portfolio_value = 2 * 50000                          # 100000
 * scenario_portfolio_value = 2 * 60000                          # 120000
 * profit_or_loss = 120000 - 100000                              # 20000
 * ```
 */
export const SIMULATION_GOLDEN_REFERENCE = {
  name: 'Price scenario, +20% BTC price',
  description:
    '2 BTC collateral, $60,000 debt, BTC at $50,000, liquidation threshold 80%, scenario: +20% price change.',
  portfolio: {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 60000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.7,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
  } satisfies PortfolioInput,
  scenario: { type: 'percentageChange' as const, percentageChange: 0.2 },
  expected: {
    scenarioBtcPriceUsd: 60000,
    collateralValue: 120000,
    debtValue: 60000,
    netEquity: 60000,
    loanToValue: 0.5,
    healthFactor: 1.6,
    liquidationDistance: 0.6,
    profitOrLoss: 20000,
  },
} as const;

/**
 * Exit golden reference — one `calculateExitPosition` (F-042 composite)
 * call, partial exit.
 *
 * Independent derivation (Python `decimal`, 50-digit precision):
 * ```
 * repayment = 60000 - 30000                                    # 30000
 * btc_sold = 30000 / 50000                                     # 0.6
 * btc_retained = 2 - 0.6                                        # 1.4
 * remaining_collateral_value = 1.4 * 50000                      # 70000
 * remaining_equity = 70000 - 30000                               # 40000
 * ```
 */
export const EXIT_GOLDEN_REFERENCE = {
  name: 'Partial exit to $30,000 target debt',
  description: '2 BTC collateral, $60,000 debt, BTC at $50,000, exit to a $30,000 target debt.',
  portfolio: {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 60000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.7,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
  } satisfies PortfolioInput,
  targetDebt: 30000,
  expected: {
    repayment: 30000,
    btcSold: 0.6,
    btcRetained: 1.4,
    remainingDebt: 30000,
    remainingCollateralValue: 70000,
    remainingEquity: 40000,
  },
} as const;
