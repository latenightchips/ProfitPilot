import { describe, expect, it } from 'vitest';

import { createApplicationError } from '@/services/shared/errors';
import type { MappingResult } from '@/services/shared/mappingResult';

/**
 * Mapping Result — relocated to `services/shared/` at M3-007 (originally
 * M3-004). Structural checks only: the type has no functions of its own
 * (`createServiceSuccess`-style constructors were never part of its
 * design — see `mapPersistencePortfolioToApplicationPortfolio` and
 * `normalizeMarketQuote` for the two real consumers building these
 * values directly).
 */
describe('MappingResult<T> (relocated at M3-007)', () => {
  it('a success value has data and no errors field', () => {
    const result: MappingResult<number> = { ok: true, data: 42 };
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(42);
    expect('errors' in result).toBe(false);
  });

  it('a failure value has errors and no data field', () => {
    const result: MappingResult<number> = {
      ok: false,
      errors: [createApplicationError('validation', 'X', 'Invalid.')],
    };
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect('data' in result).toBe(false);
  });
});
