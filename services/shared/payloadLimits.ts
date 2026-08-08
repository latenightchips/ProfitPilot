/**
 * Payload Structural Limits — 06_TASKS.md M9-032 ("Audit Import
 * Security"), "Deeply nested data" — a genuine gap found and fixed this
 * batch.
 *
 * **The gap**: `services/shared/sensitiveFields.ts`'s own
 * `findSensitiveField` recurses through a payload with no depth bound.
 * A maliciously (or accidentally) deeply nested import payload — e.g.
 * `{"a":{"a":{"a": ... }}}` nested tens of thousands of levels deep,
 * only a few bytes per level, so a small file can still reach a
 * pathological depth — would exhaust the call stack (an uncaught
 * `RangeError`) instead of failing safely through the normal
 * `MappingResult` rejection path every other malformed import already
 * uses. This is exactly the "unsafe imports are rejected without
 * changing application data" DoD M9-032 names, currently violated by a
 * crash rather than satisfied by a graceful rejection.
 *
 * **The fix is a separate, bounded pre-check, not a depth parameter
 * threaded through `findSensitiveField` itself.** `exceedsMaxNestingDepth`
 * below is checked *before* `findSensitiveField` ever runs
 * (`services/persistence/validate.ts`) — its own recursion is
 * self-bounding by construction (it returns `true` the instant
 * `currentDepth` exceeds `maxDepth`, so it never actually descends past
 * `maxDepth + 1` real stack frames regardless of how deep the input
 * claims to be), so it cannot itself be the thing that overflows.
 *
 * **50 levels is a generous ceiling, not a tight one.** The deepest
 * legitimate payload path in this codebase today
 * (`result.strategy.steps[].collateralAfter.quantity`, Loop Strategy
 * results) is 5 levels; 50 leaves an order of magnitude of headroom for
 * any real future Engine-result shape while still bounding recursion
 * far below where a JS engine's default stack size becomes a concern.
 */
export const MAX_PAYLOAD_NESTING_DEPTH = 50;

export function exceedsMaxNestingDepth(
  value: unknown,
  maxDepth: number = MAX_PAYLOAD_NESTING_DEPTH,
  currentDepth = 0,
): boolean {
  if (currentDepth > maxDepth) return true;

  if (Array.isArray(value)) {
    return value.some((item) => exceedsMaxNestingDepth(item, maxDepth, currentDepth + 1));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.values(value).some((item) =>
      exceedsMaxNestingDepth(item, maxDepth, currentDepth + 1),
    );
  }

  return false;
}
