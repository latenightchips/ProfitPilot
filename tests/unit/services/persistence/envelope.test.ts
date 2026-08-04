import { describe, expect, it } from 'vitest';

import {
  APP_NAME,
  APP_VERSION,
  computeChecksum,
  createEnvelope,
  STORAGE_SCHEMA_VERSION,
  updateEnvelope,
  verifyChecksum,
} from '@/services/persistence/envelope';

/**
 * Storage Envelope — 06_TASKS.md M8-003 ("Create Storage Envelope"),
 * M8-004 ("Implement Storage Schema Versioning").
 */
describe('createEnvelope (M8-003)', () => {
  it('populates every Include field from M8-003: app, versions, record type/id, timestamps, checksum, payload', () => {
    const envelope = createEnvelope('preferences', 'singleton', { developerModeEnabled: true });

    expect(envelope.app).toBe(APP_NAME);
    expect(envelope.storageSchemaVersion).toBe(STORAGE_SCHEMA_VERSION);
    expect(envelope.appVersion).toBe(APP_VERSION);
    expect(envelope.recordType).toBe('preferences');
    expect(envelope.recordId).toBe('singleton');
    expect(envelope.payload).toEqual({ developerModeEnabled: true });
    expect(envelope.checksum).toBe(computeChecksum({ developerModeEnabled: true }));
  });

  it('sets createdAt and updatedAt to the same timestamp on creation', () => {
    const envelope = createEnvelope('preferences', 'singleton', { developerModeEnabled: false });
    expect(envelope.createdAt).toBe(envelope.updatedAt);
  });

  it('accepts an injected clock for deterministic tests', () => {
    const envelope = createEnvelope(
      'preferences',
      'singleton',
      { developerModeEnabled: false },
      { now: () => '2026-01-01T00:00:00.000Z' },
    );
    expect(envelope.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('updateEnvelope (M8-003)', () => {
  it('preserves createdAt and recordId while refreshing updatedAt and checksum', () => {
    const original = createEnvelope(
      'preferences',
      'singleton',
      { developerModeEnabled: false },
      { now: () => '2026-01-01T00:00:00.000Z' },
    );
    const updated = updateEnvelope(
      original,
      { developerModeEnabled: true },
      {
        now: () => '2026-01-02T00:00:00.000Z',
      },
    );

    expect(updated.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(updated.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(updated.recordId).toBe(original.recordId);
    expect(updated.checksum).toBe(computeChecksum({ developerModeEnabled: true }));
    expect(updated.checksum).not.toBe(original.checksum);
    expect(updated.payload).toEqual({ developerModeEnabled: true });
  });
});

describe('computeChecksum / verifyChecksum (M8-003 "Checksum where appropriate")', () => {
  it('produces the same checksum for structurally identical payloads', () => {
    expect(computeChecksum({ a: 1, b: 2 })).toBe(computeChecksum({ a: 1, b: 2 }));
  });

  it('produces a different checksum when the payload changes', () => {
    expect(computeChecksum({ a: 1 })).not.toBe(computeChecksum({ a: 2 }));
  });

  it('verifies a freshly created envelope as intact', () => {
    const envelope = createEnvelope('preferences', 'singleton', { developerModeEnabled: true });
    expect(verifyChecksum(envelope)).toBe(true);
  });

  it('detects a tampered payload whose checksum no longer matches', () => {
    const envelope = createEnvelope('preferences', 'singleton', { developerModeEnabled: true });
    const tampered = { ...envelope, payload: { developerModeEnabled: false } };
    expect(verifyChecksum(tampered)).toBe(false);
  });

  it('treats a missing checksum as valid — "where appropriate" is optional, not mandatory', () => {
    const envelope = createEnvelope('preferences', 'singleton', { developerModeEnabled: true });
    const withoutChecksum = { ...envelope, checksum: undefined };
    expect(verifyChecksum(withoutChecksum)).toBe(true);
  });
});
