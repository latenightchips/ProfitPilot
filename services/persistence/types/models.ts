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
import type { PersistedRecordType } from './envelope';

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
 * Sync metadata payload — 06_TASKS.md M8-002's "Sync metadata." Forward
 * declared for Milestone 8's Cloud Synchronization batch (M8-026 "Create
 * Synchronization Model" onward) — no `SyncService` exists yet
 * (`../sync.service.ts` is an intentionally empty stub this same batch),
 * so nothing produces or reads this record type until that batch lands.
 * Kept minimal and honest rather than guessing at a fuller conflict/queue
 * model that batch's own tasks (M8-027 merge, M8-031 conflict detection,
 * M8-033 offline queue) have not been designed yet.
 */
export interface PersistedSyncMetadata {
  recordType: PersistedRecordType;
  recordId: string;
  lastSyncedAt: string | null;
  cloudUpdatedAt: string | null;
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
