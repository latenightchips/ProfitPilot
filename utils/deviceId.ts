/**
 * Device identifier generation — 06_TASKS.md M8-026 ("Create
 * Synchronization Model")'s "Origin device ID" field
 * (`services/persistence/types/models.ts`'s `PersistedSyncMetadata.originDeviceId`).
 * Retained as part of that generic domain model under Milestone 8's
 * local-only re-scope (`docs/MILESTONE_8_SCOPE_CHANGE.md`).
 *
 * **Generation only — no storage, no lifecycle.** A stable per-install
 * device ID would need to survive across sessions to be useful for real
 * multi-device conflict tracking, which means *something* would have to
 * persist it once (through `services/persistence/`, per this codebase's
 * own "no raw storage access outside the persistence layer" rule — see
 * `services/persistence/types/models.ts`'s own header comment for the
 * same rule applied to `'activePortfolio'`). No feature under the
 * current local-only scope needs that, so this module provides only the
 * genuinely infrastructure-free piece: a correct, tested way to
 * *produce* an ID, without inventing a storage/lifecycle decision
 * nothing currently calls for.
 */
export function generateDeviceId(): string {
  return crypto.randomUUID();
}
