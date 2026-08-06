/**
 * Device identifier generation — 06_TASKS.md M8-026 ("Create
 * Synchronization Model")'s "Origin device ID" field
 * (`services/persistence/types/models.ts`'s `PersistedSyncMetadata.originDeviceId`).
 *
 * **Generation only — no storage, no lifecycle.** A stable per-install
 * device ID needs to survive across sessions to be useful for real
 * multi-device conflict tracking, which means *something* has to persist
 * it once (through `services/persistence/`, per this codebase's own "no
 * raw storage access outside the persistence layer" rule — see
 * `services/persistence/types/models.ts`'s own header comment for the
 * same rule applied to `'activePortfolio'`). Deciding where that
 * persisted singleton lives, and when it's first created, belongs to
 * whichever batch first needs a device ID to actually survive a page
 * reload (M8-027 or M8-033) — inventing that now would be building
 * infrastructure ahead of the feature that defines its real
 * requirements. This module provides the one genuinely infrastructure-
 * free piece: a correct, tested way to *produce* an ID.
 */
export function generateDeviceId(): string {
  return crypto.randomUUID();
}
