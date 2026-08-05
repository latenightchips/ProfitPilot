import { describe, expect, it } from 'vitest';

import { createEnvelope, STORAGE_SCHEMA_VERSION } from '@/services/persistence/envelope';
import type { PersistedPreferences } from '@/services/persistence/types';
import { validatePersistedRecord } from '@/services/persistence/validate';
import type { Portfolio } from '@/types/portfolio';

function validLoopStrategyPayload() {
  return {
    id: 'strategy-1',
    name: 'Strategy',
    portfolioId: 'p1',
    portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    settings: { targetLeverage: 2 },
    result: { steps: [] },
    warnings: [],
    metadata: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

/**
 * Persistence validation — 06_TASKS.md M8-005 ("Implement Persistence
 * Validation"). DoD: "Invalid persisted data cannot enter application
 * state silently."
 */
function validPortfolioPayload(): Portfolio {
  return {
    id: 'portfolio-1',
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: { maxLoanToValue: 0.75, liquidationThreshold: 0.8, borrowApr: 0.05, supplyApr: 0.02 },
    settings: {},
    archivedAt: null,
    marketUpdatedAt: '2026-01-01T00:00:00.000Z',
    protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('validatePersistedRecord — envelope + payload structure', () => {
  it('accepts a well-formed preferences envelope', () => {
    const envelope = createEnvelope<PersistedPreferences>('preferences', 'singleton', {
      developerModeEnabled: true,
    });
    const result = validatePersistedRecord<PersistedPreferences>('preferences', envelope);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.payload).toEqual({ developerModeEnabled: true });
  });

  it('accepts a well-formed portfolio envelope, reusing types/portfolio.schema.ts field rules', () => {
    const envelope = createEnvelope<Portfolio>('portfolio', 'portfolio-1', validPortfolioPayload());
    const result = validatePersistedRecord<Portfolio>('portfolio', envelope);
    expect(result.ok).toBe(true);
  });

  it('rejects a portfolio payload with a negative BTC quantity — reused Engine-aligned bounds', () => {
    const invalid = { ...validPortfolioPayload(), collateral: { asset: 'BTC', quantity: -1 } };
    const envelope = createEnvelope('portfolio', 'portfolio-1', invalid);
    const result = validatePersistedRecord('portfolio', envelope);
    expect(result.ok).toBe(false);
  });

  it('rejects a completely malformed value without throwing', () => {
    const result = validatePersistedRecord('preferences', 'not an envelope at all');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].category).toBe('persistence');
  });

  it('rejects an envelope missing required fields (e.g. no recordId)', () => {
    const envelope = createEnvelope<PersistedPreferences>('preferences', 'singleton', {
      developerModeEnabled: true,
    });
    const withoutRecordId: Record<string, unknown> = { ...envelope };
    delete withoutRecordId.recordId;
    const result = validatePersistedRecord('preferences', withoutRecordId);
    expect(result.ok).toBe(false);
  });

  it('rejects an envelope whose recordType does not match the requested record type', () => {
    const envelope = createEnvelope<PersistedPreferences>('preferences', 'singleton', {
      developerModeEnabled: true,
    });
    const mismatched = { ...envelope, recordType: 'applicationMetadata' as const };
    const result = validatePersistedRecord('preferences', mismatched);
    expect(result.ok).toBe(false);
  });
});

describe('validatePersistedRecord — schema versioning (M8-004)', () => {
  it('accepts data already at the current storage schema version', () => {
    const envelope = createEnvelope<PersistedPreferences>('preferences', 'singleton', {
      developerModeEnabled: false,
    });
    expect(envelope.storageSchemaVersion).toBe(STORAGE_SCHEMA_VERSION);
    const result = validatePersistedRecord('preferences', envelope);
    expect(result.ok).toBe(true);
  });

  it('rejects an unsupported future storage schema version safely, without throwing', () => {
    const envelope = createEnvelope<PersistedPreferences>('preferences', 'singleton', {
      developerModeEnabled: false,
    });
    const fromTheFuture = { ...envelope, storageSchemaVersion: '99.0.0' };
    const result = validatePersistedRecord('preferences', fromTheFuture);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('UNSUPPORTED_SCHEMA_VERSION');
  });
});

describe('validatePersistedRecord — Sensitive Data Exclusion Rules (M8-051)', () => {
  it('accepts a clean loop strategy record', () => {
    const envelope = createEnvelope('loopStrategy', 'strategy-1', validLoopStrategyPayload());
    const result = validatePersistedRecord('loopStrategy', envelope);
    expect(result.ok).toBe(true);
  });

  it('rejects a record with a sensitive field smuggled inside a loose nested object', () => {
    const payload = {
      ...validLoopStrategyPayload(),
      result: { steps: [], wallet: { privateKey: '0xabc123' } },
    };
    const envelope = createEnvelope('loopStrategy', 'strategy-1', payload);
    const result = validatePersistedRecord('loopStrategy', envelope);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('SENSITIVE_FIELD_REJECTED');
    expect(result.errors[0].message).toContain('result.wallet.privateKey');
  });

  it('rejects a record with a sensitive field in the settings object', () => {
    const payload = {
      ...validLoopStrategyPayload(),
      settings: { targetLeverage: 2, accessToken: 'secret-token' },
    };
    const envelope = createEnvelope('loopStrategy', 'strategy-1', payload);
    const result = validatePersistedRecord('loopStrategy', envelope);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('SENSITIVE_FIELD_REJECTED');
  });

  it('strict, fully-typed schemas (e.g. portfolio) already strip unknown top-level fields, so a sensitive field there never reaches storage', () => {
    const envelope = createEnvelope('portfolio', 'portfolio-1', {
      ...validPortfolioPayload(),
      privateKey: '0xabc123',
    } as unknown as Portfolio);
    const result = validatePersistedRecord('portfolio', envelope);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.payload).not.toHaveProperty('privateKey');
  });
});
