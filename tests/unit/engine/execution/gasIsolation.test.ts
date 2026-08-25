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
 * inside F-072/F-073's own unit tests.
 *
 * `LoopStrategyInput` (still, unchanged) has no gas-related field at
 * all — Loop's gas cost is a Service-layer-only reporting concern
 * (`services/loop/strategy.ts`'s own `LoopExecutionCostInputs`,
 * V4 Readiness Audit §12 P1-6), never threaded into the Engine's own
 * strategy-construction input.
 *
 * `TargetExitParams` (P1-6) DOES now carry an optional `gasCostUsd` —
 * unlike Loop, Exit's `calculateExitPosition` computes cost reporting
 * inline in the same call that resolves the exit itself. The test below
 * now exercises this real field directly (not just its absence), proving
 * a wildly different `gasCostUsd` still never reaches `btcSold`/
 * `repayment`/`remainingDebt` — only the `costs` item it feeds.
 */
describe('Gas isolation — Loop and Exit results are unaffected by any gas computation (P1-5/P1-6)', () => {
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
    const cheapGasParams: TargetExitParams = {
      portfolio,
      target: { type: 'debtBalance', targetDebt: 48000 },
      gasCostUsd: 5,
    };
    const expensiveGasParams: TargetExitParams = { ...cheapGasParams, gasCostUsd: 5000 };

    const cheapGas = calculateTransactionGasCost(1, 5);
    const expensiveGas = calculateTransactionGasCost(1, 5000);
    expect(cheapGas.ok && expensiveGas.ok).toBe(true);
    if (cheapGas.ok && expensiveGas.ok) {
      expect(cheapGas.value).not.toBe(expensiveGas.value);
    }

    const withCheapGasComputed = calculateTargetExit(cheapGasParams);
    const withExpensiveGasComputed = calculateTargetExit(expensiveGasParams);
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
    expect(withCheapGasComputed.value.exit?.remainingCollateralValue).toBe(
      withExpensiveGasComputed.value.exit?.remainingCollateralValue,
    );
    // The wildly different gasCostUsd values DO reach the reported cost
    // item — proving isolation is real (the field is actually wired in,
    // not merely absent), not incidental.
    const cheapGasItem = withCheapGasComputed.value.exit?.costs.find(
      (entry) => entry.item === 'gasEstimate',
    );
    const expensiveGasItem = withExpensiveGasComputed.value.exit?.costs.find(
      (entry) => entry.item === 'gasEstimate',
    );
    expect(cheapGasItem?.amountUsd).toBe(5);
    expect(expensiveGasItem?.amountUsd).toBe(5000);
  });
});
