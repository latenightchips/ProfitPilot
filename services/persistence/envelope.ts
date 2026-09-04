/**
 * Storage Envelope construction — 06_TASKS.md M8-003 ("Create Storage
 * Envelope"), M8-004 ("Implement Storage Schema Versioning").
 *
 * `APP_VERSION`/`STORAGE_SCHEMA_VERSION` are hardcoded constants, not
 * imported from `package.json` — the same convention the four existing
 * feature exporters already use (`PORTFOLIO_RECOVERY_SCHEMA_VERSION`,
 * `LOOP_EXPORT_SCHEMA_VERSION`, `EXIT_EXPORT_SCHEMA_VERSION`,
 * `SIMULATION_EXPORT_SCHEMA_VERSION` — each a hardcoded `'0.1.0'`
 * string). `STORAGE_SCHEMA_VERSION` starts its own version lineage at
 * `'1.0.0'`, not `'0.1.0'`: it is a brand-new artifact this batch
 * introduces (the unified envelope every persisted/exported record now
 * shares), not a continuation of any of those four pre-existing,
 * independent export formats — there is no prior "0.x" of it to be
 * consistent with.
 */
import type { PersistedRecordType, StorageEnvelope } from './types/envelope';
import { PERSISTED_RECORD_TYPES } from './types/envelope';

export const APP_NAME = 'ProfitPilot';
export const APP_VERSION = '1.3.0';
export const STORAGE_SCHEMA_VERSION = '1.0.0';

/**
 * A non-cryptographic checksum (FNV-1a, 32-bit) over the payload's JSON
 * serialization — a corruption/tamper *detection* aid for locally stored
 * or exported data, not a security control. REQ-012's own Security
 * Philosophy ("Never Custody Assets... Fail Secure") never asks for
 * cryptographic integrity on local, unencrypted browser storage; a
 * lightweight hash that reliably flags "this payload was edited or
 * truncated since it was written" is the honest scope for "Checksum
 * where appropriate" (M8-003).
 */
export function computeChecksum(payload: unknown): string {
  const serialized = JSON.stringify(payload);
  let hash = 0x811c9dc5;
  for (let i = 0; i < serialized.length; i += 1) {
    hash ^= serialized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function verifyChecksum(envelope: StorageEnvelope<unknown>): boolean {
  if (envelope.checksum === undefined) return true;
  return envelope.checksum === computeChecksum(envelope.payload);
}

export interface CreateEnvelopeOptions {
  /** Overrides `new Date().toISOString()` — for tests only. */
  now?: () => string;
}

export function createEnvelope<T>(
  recordType: PersistedRecordType,
  recordId: string,
  payload: T,
  options: CreateEnvelopeOptions = {},
): StorageEnvelope<T> {
  const now = (options.now ?? (() => new Date().toISOString()))();
  return {
    app: APP_NAME,
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    recordType,
    recordId,
    createdAt: now,
    updatedAt: now,
    checksum: computeChecksum(payload),
    payload,
  };
}

/**
 * Rebuilds an envelope around an updated payload, preserving the
 * original `createdAt` and refreshing `updatedAt`/`checksum` — the
 * update path every future adapter write should use so `createdAt`
 * never silently drifts on an edit.
 */
export function updateEnvelope<T>(
  existing: StorageEnvelope<T>,
  payload: T,
  options: CreateEnvelopeOptions = {},
): StorageEnvelope<T> {
  const now = (options.now ?? (() => new Date().toISOString()))();
  return {
    ...existing,
    updatedAt: now,
    checksum: computeChecksum(payload),
    payload,
  };
}

export { PERSISTED_RECORD_TYPES };
