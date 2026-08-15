import { describe, expect, it } from 'vitest';

import { persistedPortfolioPayloadSchema } from '@/services/persistence/schemas/portfolio.schema';

/**
 * `persistedPortfolioPayloadSchema` — 06_TASKS.md M8-005, extended in V4
 * Readiness Audit §12 Stage 5 to stop silently stripping
 * `protocolVersion`/`v4Position` from every portfolio write (see the
 * schema's own header comment for the "Zod strips unrecognized keys"
 * mechanism this closes).
 */
const VALID_V4_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'portfolio-1',
    name: 'My Portfolio',
    description: undefined,
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 1.5 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 65000 },
    protocol: {
      maxLoanToValue: 0.8,
      liquidationThreshold: 0.83,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    settings: {},
    archivedAt: null,
    marketUpdatedAt: '2026-01-01T00:00:00.000Z',
    protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('persistedPortfolioPayloadSchema (Stage 5: protocolVersion/v4Position)', () => {
  it('accepts a payload with neither protocolVersion nor v4Position (V3 backward compatibility)', () => {
    const result = persistedPortfolioPayloadSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.protocolVersion).toBeUndefined();
    expect(result.data.v4Position).toBeUndefined();
  });

  it('accepts and preserves a valid protocolVersion', () => {
    const result = persistedPortfolioPayloadSchema.safeParse(
      validPayload({ protocolVersion: 'v4' }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.protocolVersion).toBe('v4');
  });

  it('accepts and preserves a valid v4Position', () => {
    const result = persistedPortfolioPayloadSchema.safeParse(
      validPayload({ v4Position: { userAddress: VALID_V4_ADDRESS } }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.v4Position).toEqual({ userAddress: VALID_V4_ADDRESS });
  });

  it('accepts both fields set together', () => {
    const result = persistedPortfolioPayloadSchema.safeParse(
      validPayload({ protocolVersion: 'v4', v4Position: { userAddress: VALID_V4_ADDRESS } }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects an invalid protocolVersion value, never silently dropping it', () => {
    const result = persistedPortfolioPayloadSchema.safeParse(
      validPayload({ protocolVersion: 'v5' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a malformed v4Position address, never silently dropping it', () => {
    const result = persistedPortfolioPayloadSchema.safeParse(
      validPayload({ v4Position: { userAddress: 'not-an-address' } }),
    );
    expect(result.success).toBe(false);
  });

  it('does not strip protocolVersion/v4Position on an otherwise-valid payload (the Stage 5 regression this schema closes)', () => {
    const payload = validPayload({
      protocolVersion: 'v4',
      v4Position: { userAddress: VALID_V4_ADDRESS },
    });
    const result = persistedPortfolioPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    // Every other field is still present and correct alongside the two
    // new ones — this isn't a schema that only validates the new fields.
    expect(result.data.name).toBe('My Portfolio');
    expect(result.data.collateral).toEqual({ asset: 'BTC', quantity: 1.5 });
    expect(result.data.protocolVersion).toBe('v4');
    expect(result.data.v4Position).toEqual({ userAddress: VALID_V4_ADDRESS });
  });
});
