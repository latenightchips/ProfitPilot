import { describe, expect, it } from 'vitest';

import {
  persistedApplicationMetadataPayloadSchema,
  persistedSyncMetadataPayloadSchema,
} from '@/services/persistence/schemas/metadata.schema';

function validSyncMetadataPayload(overrides: Record<string, unknown> = {}) {
  return {
    recordType: 'portfolio',
    recordId: 'portfolio-1',
    localUpdatedAt: '2026-01-01T00:00:00.000Z',
    cloudUpdatedAt: null,
    lastSyncedAt: null,
    syncStatus: 'pendingUpload',
    originDeviceId: 'device-1',
    deletionMarker: null,
    conflictStatus: 'none',
    ...overrides,
  };
}

describe('persistedApplicationMetadataPayloadSchema', () => {
  it('accepts a valid payload', () => {
    const result = persistedApplicationMetadataPayloadSchema.safeParse({
      currentStorageSchemaVersion: '1.0.0',
      installedAt: '2026-01-01T00:00:00.000Z',
      lastOpenedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing field', () => {
    const result = persistedApplicationMetadataPayloadSchema.safeParse({
      currentStorageSchemaVersion: '1.0.0',
      installedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('persistedSyncMetadataPayloadSchema (M8-026)', () => {
  it('accepts a valid never-synced payload', () => {
    const result = persistedSyncMetadataPayloadSchema.safeParse(validSyncMetadataPayload());
    expect(result.success).toBe(true);
  });

  it('accepts a valid fully-synced payload with real timestamps', () => {
    const result = persistedSyncMetadataPayloadSchema.safeParse(
      validSyncMetadataPayload({
        cloudUpdatedAt: '2026-01-02T00:00:00.000Z',
        lastSyncedAt: '2026-01-02T00:00:00.000Z',
        syncStatus: 'synced',
      }),
    );
    expect(result.success).toBe(true);
  });

  it('accepts a valid deleted-and-pending payload', () => {
    const result = persistedSyncMetadataPayloadSchema.safeParse(
      validSyncMetadataPayload({ deletionMarker: '2026-01-03T00:00:00.000Z' }),
    );
    expect(result.success).toBe(true);
  });

  it.each(['recordId', 'localUpdatedAt', 'syncStatus', 'originDeviceId', 'conflictStatus'])(
    'rejects a payload missing %s',
    (field) => {
      const payload = validSyncMetadataPayload() as Record<string, unknown>;
      delete payload[field];
      const result = persistedSyncMetadataPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    },
  );

  it('rejects an invalid recordType', () => {
    const result = persistedSyncMetadataPayloadSchema.safeParse(
      validSyncMetadataPayload({ recordType: 'notARealRecordType' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an invalid syncStatus value', () => {
    const result = persistedSyncMetadataPayloadSchema.safeParse(
      validSyncMetadataPayload({ syncStatus: 'not-a-real-status' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an invalid conflictStatus value', () => {
    const result = persistedSyncMetadataPayloadSchema.safeParse(
      validSyncMetadataPayload({ conflictStatus: 'not-a-real-status' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a non-empty originDeviceId requirement being violated', () => {
    const result = persistedSyncMetadataPayloadSchema.safeParse(
      validSyncMetadataPayload({ originDeviceId: '' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a malformed deletionMarker timestamp', () => {
    const result = persistedSyncMetadataPayloadSchema.safeParse(
      validSyncMetadataPayload({ deletionMarker: 'not-a-date' }),
    );
    expect(result.success).toBe(false);
  });
});
