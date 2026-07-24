import { describe, expect, it } from 'vitest';

import {
  validateFinite,
  validateNonNegative,
  validatePercentage,
  validatePositive,
  validatePrice,
  validateProtocolParameters,
  validateRate,
  validateThreshold,
  validateTimePeriod,
  validateTokenQuantity,
} from '@/engine/validation/validate';

describe('validateFinite', () => {
  it('accepts a finite number', () => {
    const result = validateFinite(5, 'x');
    expect(result.ok).toBe(true);
  });

  it('rejects NaN', () => {
    const result = validateFinite(NaN, 'x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_FINITE');
  });

  it('rejects Infinity', () => {
    const result = validateFinite(Infinity, 'x');
    expect(result.ok).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    const result = validateFinite('not-a-number', 'x');
    expect(result.ok).toBe(false);
  });
});

describe('validateNonNegative', () => {
  it('accepts zero', () => {
    expect(validateNonNegative(0, 'x').ok).toBe(true);
  });

  it('accepts a positive value', () => {
    expect(validateNonNegative(5, 'x').ok).toBe(true);
  });

  it('rejects a negative value', () => {
    const result = validateNonNegative(-1, 'x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });

  it('propagates a non-finite failure instead of evaluating the sign', () => {
    const result = validateNonNegative(NaN, 'x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_FINITE');
  });
});

describe('validatePositive', () => {
  it('rejects zero', () => {
    const result = validatePositive(0, 'x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_POSITIVE');
  });

  it('rejects a negative value', () => {
    expect(validatePositive(-1, 'x').ok).toBe(false);
  });

  it('accepts a positive value', () => {
    expect(validatePositive(0.00000001, 'x').ok).toBe(true);
  });

  it('propagates a non-finite failure instead of evaluating positivity', () => {
    const result = validatePositive(Infinity, 'x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_FINITE');
  });
});

describe('validatePercentage', () => {
  it('accepts 0', () => {
    expect(validatePercentage(0, 'x').ok).toBe(true);
  });

  it('accepts 1 (100%)', () => {
    expect(validatePercentage(1, 'x').ok).toBe(true);
  });

  it('accepts a mid-range decimal', () => {
    expect(validatePercentage(0.8, 'x').ok).toBe(true);
  });

  it('rejects values above 1', () => {
    const result = validatePercentage(1.5, 'x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_PERCENTAGE');
  });

  it('rejects values expressed as whole-number percent (e.g. 80 instead of 0.8)', () => {
    expect(validatePercentage(80, 'x').ok).toBe(false);
  });

  it('rejects negative values', () => {
    expect(validatePercentage(-0.1, 'x').ok).toBe(false);
  });
});

describe('validatePrice', () => {
  it('rejects a zero price', () => {
    expect(validatePrice(0, 'btcPriceUsd').ok).toBe(false);
  });

  it('accepts a positive price', () => {
    expect(validatePrice(65000, 'btcPriceUsd').ok).toBe(true);
  });
});

describe('validateTokenQuantity', () => {
  it('accepts zero holdings', () => {
    expect(validateTokenQuantity(0, 'btcQuantity').ok).toBe(true);
  });

  it('rejects negative holdings', () => {
    expect(validateTokenQuantity(-1, 'btcQuantity').ok).toBe(false);
  });
});

describe('validateRate', () => {
  it('rejects a negative APR', () => {
    const result = validateRate(-0.01, 'borrowApr');
    expect(result.ok).toBe(false);
  });

  it('accepts a zero APR', () => {
    expect(validateRate(0, 'borrowApr').ok).toBe(true);
  });
});

describe('validateThreshold', () => {
  it('behaves like validatePercentage', () => {
    expect(validateThreshold(0.8, 'liquidationThreshold').ok).toBe(true);
    expect(validateThreshold(1.1, 'liquidationThreshold').ok).toBe(false);
  });
});

describe('validateTimePeriod', () => {
  it('accepts zero', () => {
    expect(validateTimePeriod(0, 'days').ok).toBe(true);
  });

  it('rejects a negative period', () => {
    expect(validateTimePeriod(-1, 'days').ok).toBe(false);
  });
});

describe('validateProtocolParameters', () => {
  const valid = {
    maxLoanToValue: 0.7,
    liquidationThreshold: 0.8,
    borrowApr: 0.05,
    supplyApr: 0.02,
  };

  it('accepts a valid parameter set', () => {
    const result = validateProtocolParameters(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.maxLoanToValue.toString()).toBe('0.7');
      expect(result.value.liquidationThreshold.toString()).toBe('0.8');
    }
  });

  it('accepts maxLoanToValue equal to liquidationThreshold', () => {
    const result = validateProtocolParameters({ ...valid, maxLoanToValue: 0.8 });
    expect(result.ok).toBe(true);
  });

  it('rejects maxLoanToValue greater than liquidationThreshold', () => {
    const result = validateProtocolParameters({ ...valid, maxLoanToValue: 0.9 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_PROTOCOL_PARAMETERS');
  });

  it('rejects an invalid maxLoanToValue before checking the other fields', () => {
    const result = validateProtocolParameters({ ...valid, maxLoanToValue: 1.5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_PERCENTAGE');
  });

  it('rejects an invalid liquidationThreshold', () => {
    const result = validateProtocolParameters({ ...valid, liquidationThreshold: -0.1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });

  it('rejects an invalid borrowApr', () => {
    const result = validateProtocolParameters({ ...valid, borrowApr: -0.01 });
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid supplyApr', () => {
    const result = validateProtocolParameters({ ...valid, supplyApr: -0.01 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });
});
