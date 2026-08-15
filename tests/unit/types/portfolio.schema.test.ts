import { describe, expect, it } from 'vitest';

import {
  aaveV4PositionIdentitySchema,
  collateralManagementSchema,
  collateralPositionSchema,
  debtManagementSchema,
  debtPositionSchema,
  portfolioDetailsSchema,
  portfolioInputSchema,
  portfolioInputUpdateSchema,
  protocolParametersSchema,
  protocolVersionSchema,
} from '@/types/portfolio.schema';

/**
 * Portfolio validation schemas — 06_TASKS.md M4-002.
 *
 * Bounds mirror `engine/validation/validate.ts` (see `portfolio.schema.ts`'s
 * own header comment for exactly which Engine validator each field
 * mirrors, and why the "supported assets" and "duplicate positions"
 * choices were made the way they were).
 */
function validInput() {
  return {
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    settings: {},
  };
}

describe('portfolioInputSchema (M4-002)', () => {
  it('accepts a fully valid portfolio input', () => {
    const result = portfolioInputSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it('rejects a missing/empty name (Required names)', () => {
    const result = portfolioInputSchema.safeParse({ ...validInput(), name: '' });
    expect(result.success).toBe(false);
  });

  it('defaults baseCurrency to USD when omitted', () => {
    const input = validInput();
    const withoutCurrency: Partial<typeof input> = { ...input };
    delete withoutCurrency.baseCurrency;
    const result = portfolioInputSchema.safeParse(withoutCurrency);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.baseCurrency).toBe('USD');
  });

  it('accepts an optional description', () => {
    const result = portfolioInputSchema.safeParse({
      ...validInput(),
      description: 'A test portfolio',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an omitted description', () => {
    const result = portfolioInputSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it('accepts optional safety targets in settings', () => {
    const result = portfolioInputSchema.safeParse({
      ...validInput(),
      settings: { safetyTargets: { targetHealthFactor: 1.5 } },
    });
    expect(result.success).toBe(true);
  });

  it('accepts settings with no safety targets at all', () => {
    const result = portfolioInputSchema.safeParse({ ...validInput(), settings: {} });
    expect(result.success).toBe(true);
  });

  it('rejects the maxLoanToValue > liquidationThreshold invariant (04_BUILD_GUIDE.md Engine invariants)', () => {
    const result = portfolioInputSchema.safeParse({
      ...validInput(),
      protocol: {
        maxLoanToValue: 0.9,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('portfolioInputUpdateSchema (M4-002)', () => {
  it('accepts a partial update with only one field', () => {
    const result = portfolioInputUpdateSchema.safeParse({ name: 'Renamed' });
    expect(result.success).toBe(true);
  });

  it('accepts an empty update', () => {
    const result = portfolioInputUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('still rejects an invalid field when provided', () => {
    const result = portfolioInputUpdateSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});

describe('collateralPositionSchema — supported assets (M4-002)', () => {
  it('accepts BTC', () => {
    expect(collateralPositionSchema.safeParse({ asset: 'BTC', quantity: 1 }).success).toBe(true);
  });

  it('rejects any non-BTC asset (Version 0.1 single-collateral-asset scope)', () => {
    expect(collateralPositionSchema.safeParse({ asset: 'ETH', quantity: 1 }).success).toBe(false);
  });

  it('accepts zero quantity (non-negative, not strictly positive)', () => {
    expect(collateralPositionSchema.safeParse({ asset: 'BTC', quantity: 0 }).success).toBe(true);
  });

  it('rejects negative quantity (Token quantities)', () => {
    expect(collateralPositionSchema.safeParse({ asset: 'BTC', quantity: -1 }).success).toBe(false);
  });
});

describe('debtPositionSchema — supported assets and debt amounts (M4-002)', () => {
  it.each(['USDC', 'USDT', 'DAI'])(
    'accepts %s (01_PRD.md PRICING PROVIDER supported assets)',
    (asset) => {
      expect(debtPositionSchema.safeParse({ asset, balance: 1000 }).success).toBe(true);
    },
  );

  it('rejects an unsupported debt asset', () => {
    expect(debtPositionSchema.safeParse({ asset: 'EUR', balance: 1000 }).success).toBe(false);
  });

  it('accepts a zero balance (M4-008: support zero-debt portfolios)', () => {
    expect(debtPositionSchema.safeParse({ asset: 'USDC', balance: 0 }).success).toBe(true);
  });

  it('rejects a negative balance (M4-008: validate non-negative debt)', () => {
    expect(debtPositionSchema.safeParse({ asset: 'USDC', balance: -1 }).success).toBe(false);
  });
});

describe('protocolParametersSchema — percentages (M4-002)', () => {
  const base = { borrowApr: 0.05, supplyApr: 0.02 };

  it('accepts percentages within [0, 1]', () => {
    const result = protocolParametersSchema.safeParse({
      ...base,
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a percentage above 1', () => {
    const result = protocolParametersSchema.safeParse({
      ...base,
      maxLoanToValue: 1.1,
      liquidationThreshold: 1.2,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative rate', () => {
    const result = protocolParametersSchema.safeParse({
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: -0.01,
      supplyApr: 0.02,
    });
    expect(result.success).toBe(false);
  });
});

/**
 * `aaveV4PositionIdentitySchema` — Stage 4A (V4 Readiness Audit §12).
 * Standalone, not yet wired into `portfolioInputSchema` — see
 * `portfolio.schema.ts`'s own header comment on this schema for why
 * (mirrors `protocolVersion`'s own current, unwired state).
 */
describe('aaveV4PositionIdentitySchema (Stage 4A)', () => {
  it('accepts a well-formed 40-hex-character address', () => {
    const result = aaveV4PositionIdentitySchema.safeParse({
      userAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an all-lowercase address (no checksum requirement)', () => {
    const result = aaveV4PositionIdentitySchema.safeParse({
      userAddress: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing 0x prefix', () => {
    const result = aaveV4PositionIdentitySchema.safeParse({
      userAddress: 'd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a too-short address', () => {
    const result = aaveV4PositionIdentitySchema.safeParse({ userAddress: '0xd8dA6BF2' });
    expect(result.success).toBe(false);
  });

  it('rejects a too-long address', () => {
    const result = aaveV4PositionIdentitySchema.safeParse({
      userAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045FF',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-hex characters', () => {
    const result = aaveV4PositionIdentitySchema.safeParse({
      userAddress: '0xzzzz6BF26964aF9D7eEd9e03E53415D37aA96045',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty string', () => {
    const result = aaveV4PositionIdentitySchema.safeParse({ userAddress: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-string value', () => {
    const result = aaveV4PositionIdentitySchema.safeParse({ userAddress: 12345 });
    expect(result.success).toBe(false);
  });

  it('rejects a missing userAddress field entirely', () => {
    const result = aaveV4PositionIdentitySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

/**
 * `protocolVersionSchema` — Stage 5 (V4 Readiness Audit §12). The Zod
 * counterpart to `engine/protocols/types.ts`'s `AaveProtocolVersion`
 * union, first needed by `stores/portfolioStore.ts`'s `setProtocolVersion`.
 */
describe('protocolVersionSchema (Stage 5)', () => {
  it('accepts "v3"', () => {
    expect(protocolVersionSchema.safeParse('v3').success).toBe(true);
  });

  it('accepts "v4"', () => {
    expect(protocolVersionSchema.safeParse('v4').success).toBe(true);
  });

  it('rejects any other string', () => {
    expect(protocolVersionSchema.safeParse('v5').success).toBe(false);
  });

  it('rejects a non-string value', () => {
    expect(protocolVersionSchema.safeParse(4).success).toBe(false);
  });

  it('rejects undefined (the schema itself is required; optionality is applied by callers)', () => {
    expect(protocolVersionSchema.safeParse(undefined).success).toBe(false);
  });
});

describe('portfolioInputSchema — V3/backward compatibility (Stage 4A)', () => {
  it('validates a portfolio input with no protocolVersion or v4Position present (V3 behavior unchanged)', () => {
    const input = validInput();
    const result = portfolioInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect('protocolVersion' in result.data).toBe(false);
    expect('v4Position' in result.data).toBe(false);
  });
});

describe('portfolioDetailsSchema (M4-006)', () => {
  it('accepts exactly the Details Form fields', () => {
    const result = portfolioDetailsSchema.safeParse({
      name: 'My Portfolio',
      description: 'A test portfolio',
      baseCurrency: 'USD',
      settings: { safetyTargets: { targetHealthFactor: 1.5 } },
    });
    expect(result.success).toBe(true);
  });

  it('is structurally incapable of accepting collateral/debt/market/protocol fields (DoD: do not alter position balances)', () => {
    const result = portfolioDetailsSchema.safeParse({
      name: 'My Portfolio',
      baseCurrency: 'USD',
      settings: {},
      collateral: { asset: 'BTC', quantity: 999 },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    // `collateral` is not part of this schema's shape — .safeParse
    // silently strips unknown keys rather than rejecting them, but the
    // parsed *output* never carries it through, so a caller that only
    // ever sends `result.data` onward cannot alter it.
    expect('collateral' in result.data).toBe(false);
  });

  it('still rejects an empty name', () => {
    const result = portfolioDetailsSchema.safeParse({
      name: '',
      baseCurrency: 'USD',
      settings: {},
    });
    expect(result.success).toBe(false);
  });
});

describe('collateralManagementSchema (Portfolio Live-State Cleanup batch — collateral only)', () => {
  it('accepts a valid collateral-only payload', () => {
    const result = collateralManagementSchema.safeParse({
      collateral: { asset: 'BTC', quantity: 2 },
    });
    expect(result.success).toBe(true);
  });

  it('is structurally incapable of accepting a debt/market/protocol field (BTC price/LTV/threshold became live/read-only, not user-submitted)', () => {
    const result = collateralManagementSchema.safeParse({
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 999 },
      market: { btcPriceUsd: 50000 },
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect('debt' in result.data).toBe(false);
    expect('market' in result.data).toBe(false);
    expect('protocol' in result.data).toBe(false);
  });

  it('rejects invalid collateral quantity', () => {
    const result = collateralManagementSchema.safeParse({
      collateral: { asset: 'BTC', quantity: NaN },
    });
    expect(result.success).toBe(false);
  });
});

describe('UX punch-list UX-02/UX-03 — friendly numeric error messages (not the raw Zod default)', () => {
  it('gives debt.balance a friendly message for NaN input, not "Invalid input: expected number, received NaN"', () => {
    const result = debtPositionSchema.safeParse({ asset: 'USDC', balance: NaN });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe('Enter a valid debt amount.');
    expect(result.error.issues[0]?.message).not.toContain('NaN');
    expect(result.error.issues[0]?.message).not.toContain('Invalid input');
  });

  it('gives collateral.quantity a friendly message for NaN input', () => {
    const result = collateralPositionSchema.safeParse({ asset: 'BTC', quantity: NaN });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe('Enter a valid BTC quantity.');
  });

  it('gives protocol.maxLoanToValue/liquidationThreshold/borrowApr/supplyApr friendly messages for NaN input', () => {
    const base = {
      maxLoanToValue: NaN,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    };
    const result = protocolParametersSchema.safeParse(base);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe('Enter Maximum LTV as a percentage.');
  });

  it('describes an out-of-range Maximum LTV/Liquidation Threshold in percentage terms, not the raw 0–1 bound', () => {
    const result = protocolParametersSchema.safeParse({
      maxLoanToValue: 1.5,
      liquidationThreshold: 1.5,
      borrowApr: 0.05,
      supplyApr: 0.02,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const messages = result.error.issues.map((issue) => issue.message);
    expect(messages).toContain('Maximum LTV must be between 0% and 100%.');
  });
});

describe('debtManagementSchema (Portfolio Live-State Cleanup batch — debt only)', () => {
  it('accepts a valid debt-only payload', () => {
    const result = debtManagementSchema.safeParse({
      debt: { asset: 'USDC', balance: 20000 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a zero balance (M4-008: support zero-debt portfolios)', () => {
    const result = debtManagementSchema.safeParse({
      debt: { asset: 'USDC', balance: 0 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a negative balance (M4-008: validate non-negative debt)', () => {
    const result = debtManagementSchema.safeParse({
      debt: { asset: 'USDC', balance: -1 },
    });
    expect(result.success).toBe(false);
  });

  it('is structurally incapable of accepting collateral/market/protocol fields (Borrow rate became live/read-only, not user-submitted)', () => {
    const result = debtManagementSchema.safeParse({
      debt: { asset: 'USDC', balance: 20000 },
      collateral: { asset: 'BTC', quantity: 999 },
      market: { btcPriceUsd: 1 },
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect('collateral' in result.data).toBe(false);
    expect('market' in result.data).toBe(false);
    expect('protocol' in result.data).toBe(false);
  });
});
