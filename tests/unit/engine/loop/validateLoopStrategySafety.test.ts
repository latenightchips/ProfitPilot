import { describe, expect, it } from 'vitest';

import type { LoopStrategyInput } from '@/engine/loop/calculateLoopStrategy';
import {
  type LoopSafetyValidationResult,
  validateLoopStrategySafety,
} from '@/engine/loop/validateLoopStrategySafety';
import type { FormulaResult } from '@/engine/shared/result';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

function baseInput(overrides: Partial<LoopStrategyInput> = {}): LoopStrategyInput {
  return {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 60000 },
    protocol,
    targetBorrowPercentage: 0.5,
    maxLoops: 10,
    minHealthFactor: 1.5,
    ...overrides,
  };
}

function expectOk(result: FormulaResult<LoopSafetyValidationResult>): LoopSafetyValidationResult {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected ok result');
  return result.value;
}

describe('validateLoopStrategySafety (M2-018, F-018)', () => {
  it('marks a safe strategy viable with no findings', () => {
    const value = expectOk(validateLoopStrategySafety(baseInput()));
    expect(value.viable).toBe(true);
    expect(value.findings).toEqual([]);
    expect(value.strategy).not.toBeNull();
    expect(value.strategy?.stopReason).toBe('MIN_HEALTH_FACTOR_REACHED');
  });

  it('flags invalid protocol parameters and does not compute a strategy', () => {
    const value = expectOk(
      validateLoopStrategySafety(
        baseInput({ protocol: { ...protocol, maxLoanToValue: 0.9, liquidationThreshold: 0.8 } }),
      ),
    );
    expect(value.viable).toBe(false);
    expect(value.strategy).toBeNull();
    expect(value.findings).toEqual([
      expect.objectContaining({ check: 'VALID_PROTOCOL_PARAMETERS', severity: 'error' }),
    ]);
  });

  it('flags a starting position already at or below Health Factor 1.0 (liquidation proximity)', () => {
    const value = expectOk(
      validateLoopStrategySafety(baseInput({ debt: { asset: 'USDC', balance: 50000 } })),
    );
    expect(value.viable).toBe(false);
    expect(value.strategy).toBeNull();
    expect(
      value.findings.some((f) => f.check === 'LIQUIDATION_PROXIMITY' && f.severity === 'error'),
    ).toBe(true);
  });

  it('flags a configured minimum Health Factor at or below 1.0', () => {
    const value = expectOk(validateLoopStrategySafety(baseInput({ minHealthFactor: 1 })));
    expect(value.viable).toBe(false);
    expect(value.strategy).toBeNull();
    expect(value.findings).toEqual([
      expect.objectContaining({ check: 'MINIMUM_HEALTH_FACTOR', severity: 'error' }),
    ]);
  });

  it('warns (without blocking viability) when there is no borrowing capacity to execute any loop', () => {
    const value = expectOk(
      validateLoopStrategySafety(baseInput({ debt: { asset: 'USDC', balance: 42000 } })),
    );
    expect(value.viable).toBe(true);
    expect(value.findings).toEqual([
      expect.objectContaining({ check: 'BORROWING_CAPACITY', severity: 'warning' }),
    ]);
    expect(value.strategy).not.toBeNull();
    expect(value.strategy?.stopReason).toBe('NO_AVAILABLE_BORROW');
  });

  it('propagates a failure from malformed (negative) collateral input', () => {
    const result = validateLoopStrategySafety(
      baseInput({ collateral: { asset: 'BTC', quantity: -1 } }),
    );
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from malformed (negative) debt input', () => {
    const result = validateLoopStrategySafety(baseInput({ debt: { asset: 'USDC', balance: -1 } }));
    expect(result.ok).toBe(false);
  });

  it('tags results with F-018, reused from calculateLoopStrategy', () => {
    const result = validateLoopStrategySafety(baseInput());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.metadata.formulaId).toBe('F-018');
  });
});
