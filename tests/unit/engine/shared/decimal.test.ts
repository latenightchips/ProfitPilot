import { describe, expect, it } from 'vitest';

import {
  Decimal,
  DISPLAY_PRECISION,
  roundForDisplay,
  toDecimal,
  toOutputNumber,
} from '@/engine/shared/decimal';

describe('toDecimal', () => {
  it('converts a number', () => {
    expect(toDecimal(1.5).toString()).toBe('1.5');
  });

  it('converts a string without floating-point drift', () => {
    expect(toDecimal('0.1').plus('0.2').toString()).toBe('0.3');
  });

  it('passes an existing Decimal through unchanged', () => {
    const d = new Decimal('42');
    expect(toDecimal(d)).toBe(d);
  });
});

describe('roundForDisplay', () => {
  it('rounds currency to 2 decimals', () => {
    expect(roundForDisplay('100.005', DISPLAY_PRECISION.currency).toString()).toBe('100.01');
  });

  it('rounds BTC to 8 decimals', () => {
    expect(roundForDisplay('1.123456789', DISPLAY_PRECISION.btc).toString()).toBe('1.12345679');
  });

  it('does not mutate the input value', () => {
    const input = toDecimal('1.23456789');
    roundForDisplay(input, 2);
    expect(input.toString()).toBe('1.23456789');
  });
});

describe('toOutputNumber', () => {
  it('converts a Decimal back to a plain number', () => {
    expect(toOutputNumber(new Decimal('3.5'))).toBe(3.5);
  });
});
