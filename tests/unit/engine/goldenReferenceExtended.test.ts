import { describe, expect, it } from 'vitest';

import { calculateExitPosition } from '@/engine/exit/calculateExitPosition';
import { calculateLoopStep } from '@/engine/loop/calculateLoopStep';
import { simulatePriceScenario } from '@/engine/simulation/simulatePriceScenario';

import {
  EXIT_GOLDEN_REFERENCE,
  LOOP_STEP_GOLDEN_REFERENCE,
  SIMULATION_GOLDEN_REFERENCE,
} from '../../fixtures/goldenReferenceExtended';

/**
 * Independent Golden Reference Review — 06_TASKS.md M9-006. Verifies the
 * Engine's Loop, Simulation, and Exit outputs against expected values
 * computed by a separate calculation method (Python's `decimal` module —
 * see tests/fixtures/goldenReferenceExtended.ts's own header comment for
 * the independent derivation of each fixture's `expected` values).
 */
describe('Independent Golden Reference Review — Loop, Simulation, Exit outputs (M9-006)', () => {
  it(`${LOOP_STEP_GOLDEN_REFERENCE.name}: matches independently-derived values`, () => {
    const { input, expected } = LOOP_STEP_GOLDEN_REFERENCE;

    const result = calculateLoopStep(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.availableBorrow).toBeCloseTo(expected.availableBorrow, 2);
    expect(result.value.borrowedAmount).toBeCloseTo(expected.borrowedAmount, 2);
    expect(result.value.btcPurchased).toBeCloseTo(expected.btcPurchased, 8);
    expect(result.value.collateralAfter.quantity).toBeCloseTo(expected.collateralAfterQuantity, 8);
    expect(result.value.collateralValueAfter).toBeCloseTo(expected.collateralValueAfter, 2);
    expect(result.value.debtAfter).toBeCloseTo(expected.debtAfter, 2);
    expect(result.value.newLoanToValue).toBeCloseTo(expected.newLoanToValue, 6);
    expect(result.value.newHealthFactor).toBeCloseTo(expected.newHealthFactor, 6);
  });

  it(`${SIMULATION_GOLDEN_REFERENCE.name}: matches independently-derived values`, () => {
    const { portfolio, scenario, expected } = SIMULATION_GOLDEN_REFERENCE;

    const result = simulatePriceScenario({ portfolio, scenario });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.scenarioBtcPriceUsd).toBeCloseTo(expected.scenarioBtcPriceUsd, 2);
    expect(result.value.collateralValue).toBeCloseTo(expected.collateralValue, 2);
    expect(result.value.debtValue).toBeCloseTo(expected.debtValue, 2);
    expect(result.value.netEquity).toBeCloseTo(expected.netEquity, 2);
    expect(result.value.loanToValue).toBeCloseTo(expected.loanToValue, 6);
    expect(result.value.healthFactor).toBeCloseTo(expected.healthFactor, 6);
    expect(result.value.liquidationDistance).toBeCloseTo(expected.liquidationDistance, 6);
    expect(result.value.profitOrLoss).toBeCloseTo(expected.profitOrLoss, 2);
  });

  it(`${EXIT_GOLDEN_REFERENCE.name}: matches independently-derived values`, () => {
    const { portfolio, targetDebt, expected } = EXIT_GOLDEN_REFERENCE;

    const result = calculateExitPosition({ portfolio, targetDebt });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.repayment).toBeCloseTo(expected.repayment, 2);
    expect(result.value.btcSold).toBeCloseTo(expected.btcSold, 8);
    expect(result.value.btcRetained).toBeCloseTo(expected.btcRetained, 8);
    expect(result.value.remainingDebt).toBeCloseTo(expected.remainingDebt, 2);
    expect(result.value.remainingCollateralValue).toBeCloseTo(expected.remainingCollateralValue, 2);
    expect(result.value.remainingEquity).toBeCloseTo(expected.remainingEquity, 2);
  });
});
