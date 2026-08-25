import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateNonNegative } from '../validation/validate';

const FORMULA_ID = 'F-072';
const FORMULA_VERSION = '1.0';

/**
 * Transaction Gas Cost — 02_Formulas.md F-072 (V4 Readiness Audit §12 P1-5).
 * Equation: Total Gas Cost = Transaction Count x Gas Cost Per Transaction.
 *
 * Gas is an externally-paid, USD-denominated planning assumption — never
 * converted through BTC price (ProfitPilot has no native-gas-token price
 * feed anywhere), never mixed into Borrowing Interest, and never a source
 * of protocol debt. This primitive computes nothing else.
 *
 * `transactionCount` is a bare, caller-supplied input, deliberately not
 * derived from `steps.length` inside this function — 02_Formulas.md's own
 * F-072 entry documents why: the current architecture does not establish
 * a one-loop-step-equals-one-blockchain-transaction relationship. A
 * caller may choose to default it to a Loop strategy's own step count,
 * but that is that caller's own product decision, never this formula's.
 */
export function calculateTransactionGasCost(
  transactionCount: number,
  gasCostPerTransactionUsd: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { transactionCount, gasCostPerTransactionUsd },
  };

  const count = validateNonNegative(transactionCount, 'transactionCount');
  if (!count.ok) return createFailure(count.error, options);
  if (!Number.isInteger(transactionCount)) {
    return createFailure(
      {
        code: 'INVALID_TRANSACTION_COUNT',
        message: 'transactionCount must be a non-negative integer.',
      },
      options,
    );
  }

  const gasCost = validateNonNegative(gasCostPerTransactionUsd, 'gasCostPerTransactionUsd');
  if (!gasCost.ok) return createFailure(gasCost.error, options);

  const totalGasCost = toDecimal(count.value).times(gasCost.value);
  return createSuccess(toOutputNumber(totalGasCost), options);
}
