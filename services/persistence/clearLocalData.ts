/**
 * Clear Local Data — 06_TASKS.md M8-048 ("Implement Clear Local Data
 * Workflow"). Dependencies: M8-047. Requirements: "Explain what will be
 * deleted. Explain what cloud data will remain. Require explicit
 * confirmation. Offer export first. End with a clean valid application
 * state." DoD: "Users can safely reset the local application."
 *
 * This module is the one Requirement that is genuinely a Service-layer
 * concern ("End with a clean valid application state") plus M8-046's own
 * "Bulk deletion" trigger. The other four Requirements — explaining
 * consequences, requiring confirmation, offering export first — are UI
 * concerns `app/settings/page.tsx` (M8-047) satisfies directly; there is
 * nothing for a Service to enforce about what a user reads or clicks
 * before calling this function, only what happens once they do.
 *
 * **"Explain what cloud data will remain" is satisfied structurally, not
 * by a runtime check here**: no cloud data exists anywhere in this
 * application yet (Milestone 8's Authentication/Cloud Sync batches are
 * both out of scope for this batch, same as Batch 3's own JsonExporter.ts
 * scoping) — `app/settings/page.tsx`'s own copy states this honestly
 * ("ProfitPilot does not yet sync to the cloud") rather than describing
 * a cloud-deletion behavior nothing in this version can exhibit.
 *
 * **Ends with exactly one fresh recovery snapshot, not zero and not the
 * prior history.** `service.clear()` wipes every record type, including
 * `'recoverySnapshot'` itself (see that module's own header comment) —
 * so the bulk-deletion snapshot created immediately before clearing
 * would otherwise be destroyed by the very clear it exists to protect
 * against. Re-persisting just that one envelope afterward is what makes
 * "Recent valid data can be restored" (M8-046's DoD) true for this
 * specific high-risk operation, while still leaving a genuinely "clean"
 * state — the user's prior recovery history does not survive a clear,
 * only their one most recent undo point.
 */
import type { MappingResult } from '@/services/shared';

import type { PersistenceService } from './persistence.service';
import { persistenceService } from './persistence.service';
import { createRecoverySnapshot } from './recoverySnapshot';

export async function clearLocalData(
  service: PersistenceService = persistenceService,
): Promise<MappingResult<void>> {
  const snapshot = await createRecoverySnapshot('bulk-deletion', { service });
  if (!snapshot.ok) return snapshot;

  const cleared = await service.clear();
  if (!cleared.ok) return cleared;

  const preserved = await service.bulkWrite('recoverySnapshot', [snapshot.data]);
  if (!preserved.ok) return preserved;

  return { ok: true, data: undefined };
}
