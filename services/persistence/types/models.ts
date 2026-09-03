/**
 * Persisted record payload models — 06_TASKS.md M8-002 ("Create
 * Persisted Data Models").
 *
 * **Deliberately does not import `Portfolio`, `SavedLoopStrategy`,
 * `SavedExitPlan`, `SavedSimulation`, or the Recommendation Center's
 * acknowledgement shape from their owning Stores.** Every existing
 * dependency-direction precedent in this codebase (`04_BUILD_GUIDE.md`
 * "DEPENDENCY RULES": Presentation → Features → Services → Engine →
 * Infrastructure; every Store already imports from `@/services`, never
 * the reverse) puts Stores *above* Services. Importing a Store-owned
 * type into `services/persistence/` would invert that direction. Instead,
 * `PersistenceService`/`PersistenceAdapter` (`../persistence.service.ts`,
 * `./adapter.ts`) stay fully generic over a payload type `T` supplied by
 * the *caller* (the Store already owns and imports its own type), and
 * `../schemas/*.ts` validates the runtime shape independently via Zod —
 * the same relationship `types/portfolio.schema.ts` already has with
 * `types/portfolio.ts`'s `Portfolio` (a hand-matched Zod schema, not a
 * type-level import). `'portfolio'` records are the one exception: their
 * payload type (`Portfolio`) already lives in the shared `types/`
 * directory, which every layer — including Services — already imports
 * from safely (`services/portfolio/mapping.ts` does today), so no
 * reverse dependency is introduced by referencing it there.
 *
 * The three models below are genuinely new — no existing type owns
 * "user preferences," "application metadata," or "sync metadata" today.
 */
import type { PersistedRecordType, StorageEnvelope } from './envelope';

/**
 * User preferences payload — 06_TASKS.md M8-002's "User preferences."
 * Scoped to what actually exists: `stores/developerModeStore.ts`'s
 * `enabled` boolean is the only real, already-built application-wide
 * preference in this codebase today. `03_UI.md`'s Settings page names
 * further preferences (currency, number/date format, theme) that no
 * task has built a Store for yet — inventing fields for them here would
 * mean persisting values nothing produces or reads. Extend this
 * interface (and `../schemas/preferences.schema.ts`) when a task
 * actually introduces the Store-level preference it represents.
 */
export interface PersistedPreferences {
  developerModeEnabled: boolean;
}

/**
 * Application metadata payload — 06_TASKS.md M8-002's "Application
 * metadata." A singleton record (one instance, well-known ID — see
 * `../persistence.service.ts`) describing the *local dataset's* own
 * migration state, distinct from any individual record's own envelope
 * version fields (`StorageEnvelope.storageSchemaVersion`/`appVersion`
 * describe that one record; this describes the whole local store).
 * Backs 03_UI.md's Settings → "ABOUT" section ("Application Version,"
 * "Last Synchronization").
 */
export interface PersistedApplicationMetadata {
  currentStorageSchemaVersion: string;
  installedAt: string;
  lastOpenedAt: string;
}

/**
 * Sync metadata payload — 06_TASKS.md M8-002's "Sync metadata," fleshed
 * out by M8-026 ("Create Synchronization Model"). Field-for-field, this
 * is M8-026's own "Include" list: "Record ID, Local updated timestamp,
 * Cloud updated timestamp, Last synchronized timestamp, Sync status,
 * Origin device ID, Deletion marker, Conflict status."
 *
 * **Retained as a generic domain model — Milestone 8 is re-scoped to
 * local-only persistence** (product decision — see
 * `docs/MILESTONE_8_SCOPE_CHANGE.md`). Cloud Database (M8-022–025) and
 * Cloud Synchronization (M8-027–035) are cancelled; the Service that
 * would have consumed this model to talk to a real cloud backend does
 * not exist and will not be built. This interface and its companion
 * pure functions (`../syncMetadataModel.ts`) remain valid regardless —
 * they are deterministic data and pure transitions with no Supabase
 * dependency, useful for tracking change/conflict state on any record
 * type even without a cloud counterpart to reconcile against.
 *
 * **`localUpdatedAt` deliberately mirrors, rather than derives from, the
 * underlying record's own `StorageEnvelope.updatedAt`.** Anything
 * consuming this model to answer "does this record need to be
 * reconciled?" can scan only the small `syncMetadata` records, not read
 * every application record's full (potentially large) `payload` — the
 * same "lightweight change-tracking companion, separate from bulk data"
 * pattern real sync systems (CouchDB/PouchDB-style) use. Callers that
 * mutate a record are responsible for calling `markLocalChange`
 * afterward so this mirror stays accurate; nothing wires that call up
 * automatically, since doing so would mean touching every Store's write
 * path — a decision left to whatever future use of this model actually
 * needs it.
 *
 * **`recordType`/`recordId` together are the composite key** to the one
 * application record this sync-metadata entry describes.
 */
export type SyncStatus = 'synced' | 'pendingUpload' | 'pendingDownload' | 'conflict' | 'error';

/**
 * Distinct from, and narrower than, `SyncStatus`. `SyncStatus` answers
 * "what does this record need right now" (push, pull, nothing, or it's
 * broken); `ConflictStatus` separately tracks the *resolution workflow*
 * for a detected conflict — `'resolved'` exists so a conflict that has
 * just been resolved remains visibly distinct from one that was never
 * in conflict at all, until the next successful sync (`markSynced`)
 * clears it back to `'none'`. Deliberately does not attempt to model a
 * higher-level, cross-record UI sync status ("Local only," "Syncing,"
 * "Offline," ...) — that would be a session-level concern computed from
 * many of these per-record entries plus live network state, not a value
 * stored per record here; not needed under the current local-only scope
 * (`docs/MILESTONE_8_SCOPE_CHANGE.md`) in any case.
 */
export type ConflictStatus = 'none' | 'detected' | 'resolved';

export interface PersistedSyncMetadata {
  recordType: PersistedRecordType;
  recordId: string;
  localUpdatedAt: string;
  cloudUpdatedAt: string | null;
  lastSyncedAt: string | null;
  syncStatus: SyncStatus;
  /**
   * The device that produced the current `localUpdatedAt` value —
   * generated by `utils/deviceId.ts`'s pure `generateDeviceId()`.
   * Persisting a *stable* per-install device ID (surviving across
   * sessions) is not wired up anywhere — this model provides the field
   * and a tested generator, not a storage/lifecycle decision, and
   * nothing under the current local-only scope
   * (`docs/MILESTONE_8_SCOPE_CHANGE.md`) currently needs one to persist.
   */
  originDeviceId: string;
  /**
   * `null` while the record is live; set to the ISO timestamp the record
   * was locally marked deleted (a tombstone) once one exists, so a
   * deletion is distinguishable from an ordinary edit using the same
   * real, comparable timestamp rather than a bare boolean.
   */
  deletionMarker: string | null;
  conflictStatus: ConflictStatus;
}

/**
 * Active portfolio selection payload — Milestone 8 Batch 2 (M8-007's
 * "Active portfolio" key). Mirrors `stores/portfolioStore.ts`'s own
 * `activePortfolioId: string | null` field exactly — see
 * `./envelope.ts`'s own header comment for why this is a persisted
 * singleton rather than a special-cased raw key.
 */
export interface PersistedActivePortfolio {
  portfolioId: string | null;
}

/**
 * Automatic Local Recovery Snapshot payload — Milestone 8 Batch 4
 * (M8-046 "Implement Automatic Local Recovery Snapshot"). One record
 * per snapshot (not a singleton) — `../recoverySnapshot.ts` retains a
 * capped, most-recent-first list, pruning the oldest once
 * `MAX_RETAINED_RECOVERY_SNAPSHOTS` is exceeded (M8-046's own "Limit
 * retained snapshots" / "Avoid excessive storage use" requirements).
 *
 * `records` mirrors `services/export/types.ts`'s `FullBackupFile.records`
 * shape exactly (a `Partial<Record<PersistedRecordType, StorageEnvelope<
 * unknown>[]>>`) — a recovery snapshot *is* a full-dataset backup, just
 * one this application creates and restores itself rather than a user
 * downloading/uploading a file. It never includes a `'recoverySnapshot'`
 * key of its own (`../types/envelope.ts`'s `EXPORTABLE_RECORD_TYPES` is
 * what `../recoverySnapshot.ts` snapshots from) — nesting a snapshot's
 * own snapshot history inside itself would grow without bound.
 */
export type RecoverySnapshotReason =
  'migration' | 'large-import' | 'full-replacement' | 'conflict-resolution' | 'bulk-deletion';

export interface PersistedRecoverySnapshot {
  reason: RecoverySnapshotReason;
  createdAt: string;
  records: Partial<Record<PersistedRecordType, StorageEnvelope<unknown>[]>>;
}

/**
 * Portfolio History Entry — V1.1 Batch 2 ("Portfolio History & Risk
 * Timeline"). A minimal, stable point-in-time snapshot of one
 * portfolio's own derived risk/economic metrics — not a copy of the
 * full `Portfolio`/`ApplicationPortfolio` object, and not the UI's own
 * `PortfolioSummary` shape (which changes whenever a display concern
 * changes, not when this history record's own persisted shape should).
 * `AaveProtocolVersion` imported from `@/engine`, the lowest layer that
 * already owns it — no reverse dependency on `services/portfolio/` or
 * any Store, matching this file's own header comment above.
 *
 * **One record per snapshot, `portfolioId`-scoped, not a singleton.**
 * Mirrors `PersistedRecoverySnapshot`'s own "many independent records of
 * one type" shape (`../portfolioHistory.ts`'s `recordPortfolioHistoryEntry`
 * writes each with its own `crypto.randomUUID()` id) rather than nesting
 * an array inside one record — the same reasoning `recoverySnapshot.ts`
 * already established for a genuinely append-only, unbounded-over-time
 * collection.
 *
 * **`collateral`/`debt` carry both a native quantity and a resolved USD
 * value** — the two are not interchangeable (V4's debt quantity and its
 * USD value can genuinely differ once a debt-asset oracle price is
 * involved; V3's do not, since its debt assets are treated as $1-pegged
 * stablecoins). Both are cheap, already-derived numbers at the moment a
 * snapshot is taken — no new calculation is invented for this file,
 * everything here already exists on `PortfolioSummary`/`Portfolio`
 * itself; see `services/portfolioHistory/buildPortfolioHistoryEntry.ts`
 * for exactly which existing values map into which field.
 *
 * **`dataSource` is one summarizing flag, not the four separate
 * provenance fields (`marketSource`/`protocolSource`/
 * `v4DebtStateSource`/`v4CollateralRiskSource`) a live portfolio itself
 * carries.** A history entry answers "was any of the data behind this
 * snapshot live-sourced at the time," a coarser but still materially
 * useful question for a timeline view — not "reconstruct this
 * portfolio's exact live-sync state," which is not this feature's job.
 */
export interface PersistedPortfolioHistoryEntry {
  portfolioId: string;
  protocolVersion: 'v3' | 'v4';
  /** ISO 8601 — the canonical "when" of this snapshot, set once at creation and never revised. */
  createdAt: string;
  collateral: { quantity: number; valueUsd: number };
  debt: { asset: string; quantity: number; valueUsd: number };
  marketPriceUsd: number;
  /** `null` for a zero-debt portfolio (`PortfolioSummary.healthFactor` is `Infinity` there — see `features/dashboard/utils/format.ts`'s own note on this) — JSON cannot represent `Infinity` (it silently becomes `null` through `JSON.stringify`), so this field encodes the same "no liquidation risk" state `liquidationPriceUsd` already uses `null` for, rather than persisting a value JSON would corrupt anyway. */
  healthFactor: number | null;
  /** `null` for a zero-debt portfolio — mirrors `PortfolioLiquidationSummary`'s own `null` case, not a fabricated 0. */
  liquidationPriceUsd: number | null;
  loanToValue: number;
  leverage: number;
  /** `undefined` only when genuinely unavailable (a V4 portfolio with no synced debt state yet) — never a fabricated 0. */
  borrowApr?: number;
  /** `undefined` for every V4 portfolio, unconditionally — mirrors `resolveSupplyAprDisplay`'s own `'not-applicable'` case, never a stale/fabricated V3-shaped number. */
  supplyApr?: number;
  annualizedInterestCost: number;
  dataSource: 'manual' | 'live';
}
