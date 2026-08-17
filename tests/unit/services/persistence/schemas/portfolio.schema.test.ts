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

/**
 * `v4DebtState` — Stage 6 (V4 Readiness Audit §12), same "don't silently
 * strip it" regression this schema already closed for
 * `protocolVersion`/`v4Position` in Stage 5.
 */
const VALID_DEBT_STATE = {
  drawnDebt: 15000,
  premiumDebt: 500,
  baseDrawnApr: 0.05,
  riskPremium: 0.01,
};

describe('persistedPortfolioPayloadSchema (Stage 6: v4DebtState)', () => {
  it('accepts a payload with no v4DebtState (V3/pre-Stage-6 backward compatibility)', () => {
    const result = persistedPortfolioPayloadSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.v4DebtState).toBeUndefined();
  });

  it('accepts and preserves a valid v4DebtState', () => {
    const result = persistedPortfolioPayloadSchema.safeParse(
      validPayload({ v4DebtState: VALID_DEBT_STATE }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.v4DebtState).toEqual(VALID_DEBT_STATE);
  });

  it('rejects a v4DebtState with a negative field, never silently dropping it', () => {
    const result = persistedPortfolioPayloadSchema.safeParse(
      validPayload({ v4DebtState: { ...VALID_DEBT_STATE, drawnDebt: -1 } }),
    );
    expect(result.success).toBe(false);
  });

  it('accepts protocolVersion, v4Position, and v4DebtState all set together', () => {
    const result = persistedPortfolioPayloadSchema.safeParse(
      validPayload({
        protocolVersion: 'v4',
        v4Position: { userAddress: VALID_V4_ADDRESS },
        v4DebtState: VALID_DEBT_STATE,
      }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.protocolVersion).toBe('v4');
    expect(result.data.v4Position).toEqual({ userAddress: VALID_V4_ADDRESS });
    expect(result.data.v4DebtState).toEqual(VALID_DEBT_STATE);
  });

  it('accepts v4DebtState set while protocolVersion/v4Position remain unset (no cross-field requirement)', () => {
    const result = persistedPortfolioPayloadSchema.safeParse(
      validPayload({ v4DebtState: VALID_DEBT_STATE }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.protocolVersion).toBeUndefined();
    expect(result.data.v4Position).toBeUndefined();
  });
});

/**
 * `v4CollateralRisk` — Stage 23C (V4 Readiness Audit §12), same "don't
 * silently strip it" regression this schema already closed for
 * `protocolVersion`/`v4Position`/`v4DebtState` in Stages 5/6.
 */
const VALID_COLLATERAL_RISK = {
  collateralFactor: 0.75,
  dynamicConfigKey: 3,
};

describe('persistedPortfolioPayloadSchema (Stage 23C: v4CollateralRisk)', () => {
  it('accepts a payload with no v4CollateralRisk (V3/pre-Stage-23C backward compatibility)', () => {
    const result = persistedPortfolioPayloadSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.v4CollateralRisk).toBeUndefined();
  });

  it('accepts and preserves a valid v4CollateralRisk', () => {
    const result = persistedPortfolioPayloadSchema.safeParse(
      validPayload({ v4CollateralRisk: VALID_COLLATERAL_RISK }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.v4CollateralRisk).toEqual(VALID_COLLATERAL_RISK);
  });

  it('rejects a collateralFactor above 1 (100%), never silently dropping it', () => {
    const result = persistedPortfolioPayloadSchema.safeParse(
      validPayload({ v4CollateralRisk: { ...VALID_COLLATERAL_RISK, collateralFactor: 1.5 } }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a negative dynamicConfigKey, never silently dropping it', () => {
    const result = persistedPortfolioPayloadSchema.safeParse(
      validPayload({ v4CollateralRisk: { ...VALID_COLLATERAL_RISK, dynamicConfigKey: -1 } }),
    );
    expect(result.success).toBe(false);
  });

  it('accepts protocolVersion, v4Position, v4DebtState, and v4CollateralRisk all set together', () => {
    const result = persistedPortfolioPayloadSchema.safeParse(
      validPayload({
        protocolVersion: 'v4',
        v4Position: { userAddress: VALID_V4_ADDRESS },
        v4DebtState: VALID_DEBT_STATE,
        v4CollateralRisk: VALID_COLLATERAL_RISK,
      }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.protocolVersion).toBe('v4');
    expect(result.data.v4Position).toEqual({ userAddress: VALID_V4_ADDRESS });
    expect(result.data.v4DebtState).toEqual(VALID_DEBT_STATE);
    expect(result.data.v4CollateralRisk).toEqual(VALID_COLLATERAL_RISK);
  });

  it('accepts v4CollateralRisk set while protocolVersion/v4Position/v4DebtState remain unset (no cross-field requirement)', () => {
    const result = persistedPortfolioPayloadSchema.safeParse(
      validPayload({ v4CollateralRisk: VALID_COLLATERAL_RISK }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.protocolVersion).toBeUndefined();
    expect(result.data.v4Position).toBeUndefined();
    expect(result.data.v4DebtState).toBeUndefined();
  });
});
