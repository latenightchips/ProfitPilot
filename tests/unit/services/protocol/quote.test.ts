import { describe, expect, it } from 'vitest';

import type { NormalizeProtocolQuoteInput, RawProtocolCandidate } from '@/services/protocol/quote';
import { normalizeProtocolQuote } from '@/services/protocol/quote';

/**
 * Protocol Parameter Service — 06_TASKS.md M3-008.
 */
const VALID_PARAMS = {
  maxLoanToValue: 0.75,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

function baseInput(
  overrides: Partial<NormalizeProtocolQuoteInput> = {},
): NormalizeProtocolQuoteInput {
  return {
    collateralAsset: 'BTC',
    borrowAsset: 'USDC',
    candidates: [],
    ...overrides,
  };
}

describe('normalizeProtocolQuote (M3-008)', () => {
  it('normalizes a live candidate into an available quote', () => {
    const candidates: RawProtocolCandidate[] = [
      { origin: 'live', parameters: VALID_PARAMS, timestamp: '2026-01-01T00:00:00.000Z' },
    ];
    const result = normalizeProtocolQuote(baseInput({ candidates }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      available: true,
      collateralAsset: 'BTC',
      borrowAsset: 'USDC',
      parameters: VALID_PARAMS,
      origin: 'live',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  it('falls back to cache when no live candidate exists', () => {
    const candidates: RawProtocolCandidate[] = [
      {
        origin: 'cache',
        parameters: VALID_PARAMS,
        timestamp: '2025-12-31T00:00:00.000Z',
      },
      {
        origin: 'manual',
        parameters: { ...VALID_PARAMS, borrowApr: 0.1 },
        timestamp: '2025-01-01T00:00:00.000Z',
      },
    ];
    const result = normalizeProtocolQuote(baseInput({ candidates }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.available).toBe(true);
    if (!result.data.available) return;
    expect(result.data.origin).toBe('cache');
  });

  it('falls back to manual when neither live nor cache candidates exist', () => {
    const candidates: RawProtocolCandidate[] = [
      { origin: 'manual', parameters: VALID_PARAMS, timestamp: '2026-01-01T00:00:00.000Z' },
    ];
    const result = normalizeProtocolQuote(baseInput({ candidates }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.available).toBe(true);
    if (!result.data.available) return;
    expect(result.data.origin).toBe('manual');
  });

  it('prefers live over cache and manual even when all three are present', () => {
    const candidates: RawProtocolCandidate[] = [
      { origin: 'manual', parameters: VALID_PARAMS, timestamp: '2026-01-01T00:00:00.000Z' },
      { origin: 'cache', parameters: VALID_PARAMS, timestamp: '2026-01-01T00:00:00.000Z' },
      { origin: 'live', parameters: VALID_PARAMS, timestamp: '2020-01-01T00:00:00.000Z' },
    ];
    const result = normalizeProtocolQuote(baseInput({ candidates }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.available).toBe(true);
    if (!result.data.available) return;
    // Live is chosen even though it is the oldest candidate — no
    // freshness classification is applied to protocol parameters,
    // unlike Market Data Service's price freshness.
    expect(result.data.origin).toBe('live');
    expect(result.data.timestamp).toBe('2020-01-01T00:00:00.000Z');
  });

  it('returns a successful "unavailable" quote (not a failure) when no candidates exist', () => {
    const result = normalizeProtocolQuote(baseInput({ candidates: [] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      available: false,
      collateralAsset: 'BTC',
      borrowAsset: 'USDC',
    });
    expect('parameters' in result.data).toBe(false);
    expect('origin' in result.data).toBe(false);
  });

  it('does not have an errors field on a success result (discriminated union, not a nullable envelope)', () => {
    const result = normalizeProtocolQuote(baseInput({ candidates: [] }));
    expect('errors' in result).toBe(false);
  });

  it('does not have a data field on a failure result (discriminated union, not a nullable envelope)', () => {
    const candidates: RawProtocolCandidate[] = [
      {
        origin: 'live',
        parameters: { ...VALID_PARAMS, maxLoanToValue: -1 },
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];
    const result = normalizeProtocolQuote(baseInput({ candidates }));
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('fails validation when maxLoanToValue is outside [0, 1]', () => {
    const candidates: RawProtocolCandidate[] = [
      {
        origin: 'live',
        parameters: { ...VALID_PARAMS, maxLoanToValue: 1.5 },
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];
    const result = normalizeProtocolQuote(baseInput({ candidates }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'PROTOCOL_QUOTE_MAX_LTV_INVALID' });
  });

  it('fails validation when liquidationThreshold is outside [0, 1]', () => {
    const candidates: RawProtocolCandidate[] = [
      {
        origin: 'live',
        parameters: { ...VALID_PARAMS, liquidationThreshold: -0.1 },
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];
    const result = normalizeProtocolQuote(baseInput({ candidates }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({
      code: 'PROTOCOL_QUOTE_LIQUIDATION_THRESHOLD_INVALID',
    });
  });

  it('fails validation when maxLoanToValue exceeds liquidationThreshold (mirrors the Engine invariant)', () => {
    const candidates: RawProtocolCandidate[] = [
      {
        origin: 'live',
        parameters: { ...VALID_PARAMS, maxLoanToValue: 0.9, liquidationThreshold: 0.8 },
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];
    const result = normalizeProtocolQuote(baseInput({ candidates }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({
      code: 'PROTOCOL_QUOTE_MAX_LTV_EXCEEDS_THRESHOLD',
    });
  });

  it('fails validation when borrowApr is negative', () => {
    const candidates: RawProtocolCandidate[] = [
      {
        origin: 'live',
        parameters: { ...VALID_PARAMS, borrowApr: -0.01 },
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];
    const result = normalizeProtocolQuote(baseInput({ candidates }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'PROTOCOL_QUOTE_BORROW_APR_INVALID' });
  });

  it('fails validation when supplyApr is negative', () => {
    const candidates: RawProtocolCandidate[] = [
      {
        origin: 'live',
        parameters: { ...VALID_PARAMS, supplyApr: -0.01 },
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];
    const result = normalizeProtocolQuote(baseInput({ candidates }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'PROTOCOL_QUOTE_SUPPLY_APR_INVALID' });
  });

  it('fails validation for an unparseable candidate timestamp', () => {
    const candidates: RawProtocolCandidate[] = [
      { origin: 'live', parameters: VALID_PARAMS, timestamp: 'not-a-date' },
    ];
    const result = normalizeProtocolQuote(baseInput({ candidates }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'PROTOCOL_QUOTE_TIMESTAMP_INVALID' });
  });

  it('aggregates errors from multiple malformed candidates rather than stopping at the first', () => {
    const candidates: RawProtocolCandidate[] = [
      {
        origin: 'live',
        parameters: { ...VALID_PARAMS, maxLoanToValue: 2 },
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      { origin: 'manual', parameters: VALID_PARAMS, timestamp: 'not-a-date' },
    ];
    const result = normalizeProtocolQuote(baseInput({ candidates }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(2);
    const codes = result.errors.map((error) => error.code);
    expect(codes).toContain('PROTOCOL_QUOTE_MAX_LTV_INVALID');
    expect(codes).toContain('PROTOCOL_QUOTE_TIMESTAMP_INVALID');
  });

  it('carries the requested collateral and borrow assets through to the quote', () => {
    const result = normalizeProtocolQuote(
      baseInput({ collateralAsset: 'ETH', borrowAsset: 'DAI', candidates: [] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.collateralAsset).toBe('ETH');
    expect(result.data.borrowAsset).toBe('DAI');
  });
});
