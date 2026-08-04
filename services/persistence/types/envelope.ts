/**
 * Persisted record types and the Storage Envelope — 06_TASKS.md M8-002
 * ("Create Persisted Data Models") and M8-003 ("Create Storage
 * Envelope").
 *
 * **M8-002's "Include" list collapses to 8 record types, not 12.**
 * "Collateral positions," "Debt positions," "Market assumptions," and
 * "Protocol assumptions" are not separate persisted entities — Conflict A
 * (`types/portfolio.ts`, established Milestone 4) already fixed a single
 * collateral object and a single debt object per portfolio, and
 * `ApplicationPortfolio` (`services/portfolio/models.ts`, M3-004) already
 * nests `market`/`protocol` inside one portfolio record. Persisting them
 * separately would mean inventing a multi-table relational split this
 * application's own domain model was deliberately never given. They
 * persist as fields of `'portfolio'` records instead.
 *
 * "User preferences," "Sync metadata," and "Application metadata" are
 * genuinely new record types with no prior application-layer type to
 * reuse — see `./models.ts` for their shapes.
 *
 * `'recommendationAcknowledgements'` reuses the exact shape
 * `stores/recommendationCenterStore.ts` already keeps in memory
 * (`AcknowledgementsByPortfolio`) rather than inventing a new one.
 *
 * **`'activePortfolio'` added in Milestone 8 Batch 2 (M8-007 "Define
 * Local Storage Keys," whose own "Include" list names "Active portfolio"
 * as its own key category, distinct from "Portfolios").**
 * `stores/portfolioStore.ts`'s `activePortfolioId: string | null` is a
 * single scalar selection, not a domain entity — but the standing
 * architectural rule ("Stores must communicate only through
 * PersistenceService interfaces," no direct storage access anywhere
 * outside `services/persistence/`) means it still needs to go through the
 * same envelope/adapter path as every other record, not a special-cased
 * raw key. It persists as a one-record-per-app singleton, the same
 * pattern `'preferences'`/`'applicationMetadata'` already use (see
 * `../constants.ts`'s `SINGLETON_RECORD_ID`).
 */
export const PERSISTED_RECORD_TYPES = [
  'portfolio',
  'loopStrategy',
  'exitPlan',
  'simulation',
  'recommendationAcknowledgements',
  'preferences',
  'syncMetadata',
  'applicationMetadata',
  'activePortfolio',
] as const;

export type PersistedRecordType = (typeof PERSISTED_RECORD_TYPES)[number];

/**
 * Storage Envelope — M8-003's own "Include" list, verbatim field-for-field:
 * "Application name, Storage schema version, Application version, Created
 * timestamp, Updated timestamp, Record type, Record ID, Payload, Checksum
 * where appropriate."
 *
 * `checksum` is optional ("where appropriate") — populated by
 * `createEnvelope` (`../envelope.ts`) for every record this application
 * writes, but left optional on the type itself so a hand-authored or
 * older imported file that omits it does not fail to parse the envelope
 * shape before `validatePersistedRecord` (M8-005) can produce a proper
 * validation error instead of a raw parse crash.
 *
 * **Not generic-free**: `T` is the already-existing application-layer
 * payload type (`Portfolio`, `SavedLoopStrategy`, etc. — see
 * `./models.ts`), reused as-is rather than re-declared here. M8-002's own
 * Requirement — "Persisted models must be separate from Engine and UI
 * models" — is already satisfied by those types themselves: they were
 * established (M4-001, M7-007/M7-020/M6-013, M7-035) specifically as
 * Store/Service-layer application types independent of both
 * `engine/`'s calculation types and any React/UI concern. Re-declaring a
 * parallel set of "persisted" interfaces with the same fields would be
 * duplication this project's standing rules forbid, not genuine
 * separation.
 */
export interface StorageEnvelope<T> {
  app: string;
  storageSchemaVersion: string;
  appVersion: string;
  recordType: PersistedRecordType;
  recordId: string;
  createdAt: string;
  updatedAt: string;
  checksum?: string;
  payload: T;
}
