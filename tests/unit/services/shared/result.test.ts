import { describe, expect, it } from 'vitest';

import { createApplicationError } from '@/services/shared/errors';
import { createServiceFailure, createServiceSuccess } from '@/services/shared/result';

/**
 * Standard Service Result Model — 06_TASKS.md M3-002.
 */
describe('createServiceSuccess (M3-002)', () => {
  const options = { sourceStatus: 'live', engineVersion: '0.1.0', formulaVersion: '1.0' };

  it('returns ok:true with the given data and default (empty) warnings', () => {
    const result = createServiceSuccess({ collateralValue: 100000 }, options);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ collateralValue: 100000 });
    expect(result.warnings).toEqual([]);
  });

  it('carries through explicitly supplied warnings', () => {
    const warning = { code: 'STALE_PRICE', message: 'Price data is more than 5 minutes old.' };
    const result = createServiceSuccess(42, options, [warning]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([warning]);
  });

  it('populates metadata from the provided options plus a fresh ISO timestamp', () => {
    const before = Date.now();
    const result = createServiceSuccess(1, options);
    const after = Date.now();
    expect(result.metadata.sourceStatus).toBe('live');
    expect(result.metadata.engineVersion).toBe('0.1.0');
    expect(result.metadata.formulaVersion).toBe('1.0');

    const timestampMs = new Date(result.metadata.calculationTimestamp).getTime();
    expect(timestampMs).toBeGreaterThanOrEqual(before);
    expect(timestampMs).toBeLessThanOrEqual(after);
  });

  it('does not have an errors field on a success result (discriminated union, not a nullable envelope)', () => {
    const result = createServiceSuccess(1, options);
    expect('errors' in result).toBe(false);
  });
});

describe('createServiceFailure (M3-002/M3-003)', () => {
  const options = { sourceStatus: 'live', engineVersion: '0.1.0', formulaVersion: '1.0' };

  it('returns ok:false with the given errors array', () => {
    const errors = [
      createApplicationError('validation', 'MISSING_FIELD', 'Collateral quantity is required.'),
      createApplicationError('validation', 'MISSING_FIELD', 'Debt balance is required.'),
    ];
    const result = createServiceFailure(errors, options);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(errors);
    expect(result.errors).toHaveLength(2);
  });

  it('accepts a single error just as validly as multiple', () => {
    const errors = [createApplicationError('calculation', 'DIVISION_BY_ZERO', 'Cannot compute.')];
    const result = createServiceFailure(errors, options);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
  });

  it('populates metadata identically to a success result', () => {
    const result = createServiceFailure([createApplicationError('unknown', 'X', 'Y')], options);
    expect(result.metadata.sourceStatus).toBe('live');
    expect(result.metadata.engineVersion).toBe('0.1.0');
    expect(result.metadata.formulaVersion).toBe('1.0');
    expect(typeof result.metadata.calculationTimestamp).toBe('string');
  });

  it('does not have a data field on a failure result (discriminated union, not a nullable envelope)', () => {
    const result = createServiceFailure([createApplicationError('unknown', 'X', 'Y')], options);
    expect('data' in result).toBe(false);
  });
});
