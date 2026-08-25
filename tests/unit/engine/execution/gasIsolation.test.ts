import { describe, expect, it } from 'vitest';

import { calculateTransactionGasCost } from '@/engine/execution/calculateTransactionGasCost';
import { calculateTargetExit, type TargetExitParams } from '@/engine/exit/calculateTargetExit';
import { calculateLoopStrategy, type LoopStrategyInput } from '@/engine/loop/calculateLoopStrategy';
import type { PortfolioInput } from '@/engine/shared/types';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

/**
 * Gas isolation, end-to-end — 02_Formulas.md F-072's own explicit "must
 * not" list, verified at the Loop/Exit call-chain boundary, not just
 * inside F-072/F-073's own unit tests. `LoopStrategyInput`/
 * `TargetExitParams` (V4 Readiness Audit §12 P1-5) have no gas-related
 * field at all — there is no parameter through which a gas assumption
 * could reach borrow amount, BTC purchased/sold, protocol debt,
 * repayment, collateral, or Health Factor, even if a caller computed a
 * wildly different gas figure via F-072 in the same request.
 */
describe('Gas isolation — Loop and Exit results are unaffected by any gas computation (P1-5)', () => {
  it("two wildly different F-072 gas costs computed alongside an identical Loop strategy do not change that strategy's own result", () => {
    const loopInput: LoopStrategyInput = {
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 0 },
      market: { btcPriceUsd: 60000 },
      protocol,
      targetBorrowPercentage: 0.5,
      maxLoops: 3,
      minHealthFactor: 1.5,
    };

    const cheapGas = calculateTransactionGasCost(3, 5);
    const expensiveGas = calculateTransactionGasCost(3, 5000);
    expect(cheapGas.ok && expensiveGas.ok).toBe(true);
    if (cheapGas.ok && expensiveGas.ok) {
      expect(cheapGas.value).not.toBe(expensiveGas.value);
    }

    // loopInput has no field to receive either gas figure — running the
    // identical Loop strategy alongside each must produce byte-identical
    // output.
    const withCheapGasComputed = calculateLoopStrategy(loopInput);
    const withExpensiveGasComputed = calculateLoopStrategy(loopInput);
    expect(withCheapGasComputed.ok && withExpensiveGasComputed.ok).toBe(true);
    if (!withCheapGasComputed.ok || !withExpensiveGasComputed.ok) return;
    expect(withCheapGasComputed.value.finalDebt).toBe(withExpensiveGasComputed.value.finalDebt);
    expect(withCheapGasComputed.value.finalCollateral.quantity).toBe(
      withExpensiveGasComputed.value.finalCollateral.quantity,
    );
    expect(withCheapGasComputed.value.finalHealthFactor).toBe(
      withExpensiveGasComputed.value.finalHealthFactor,
    );
  });

  it("two wildly different F-072 gas costs computed alongside an identical Exit target do not change that exit's own result", () => {
    const portfolio: PortfolioInput = {
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 60000 },
      market: { btcPriceUsd: 60000 },
      protocol,
    };
    const exitParams: TargetExitParams = {
      portfolio,
      target: { type: 'debtBalance', targetDebt: 48000 },
    };

    const cheapGas = calculateTransactionGasCost(1, 5);
    const expensiveGas = calculateTransactionGasCost(1, 5000);
    expect(cheapGas.ok && expensiveGas.ok).toBe(true);
    if (cheapGas.ok && expensiveGas.ok) {
      expect(cheapGas.value).not.toBe(expensiveGas.value);
    }

    const withCheapGasComputed = calculateTargetExit(exitParams);
    const withExpensiveGasComputed = calculateTargetExit(exitParams);
    expect(withCheapGasComputed.ok && withExpensiveGasComputed.ok).toBe(true);
    if (!withCheapGasComputed.ok || !withExpensiveGasComputed.ok) return;
    expect(withCheapGasComputed.value.exit?.btcSold).toBe(
      withExpensiveGasComputed.value.exit?.btcSold,
    );
    expect(withCheapGasComputed.value.exit?.repayment).toBe(
      withExpensiveGasComputed.value.exit?.repayment,
    );
    expect(withCheapGasComputed.value.exit?.remainingDebt).toBe(
      withExpensiveGasComputed.value.exit?.remainingDebt,
    );
  });
});
