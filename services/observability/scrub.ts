/**
 * Shared telemetry scrubbing — reused by `errorMonitoring.ts` (M9-049)
 * and `diagnosticEvent.ts` (M9-050) so both funnel through one
 * implementation of "redact anything credential-shaped" rather than
 * two independently-maintained copies. See `errorMonitoring.ts`'s own
 * header comment for why this is defense-in-depth, not the primary
 * guarantee (the primary guarantee is that neither module's own public
 * function signature accepts a raw application object in the first
 * place).
 */
import { isSensitiveFieldName } from '@/services/shared';

/**
 * Redacts any value reachable under a credential-shaped key name (reuses
 * `services/shared/sensitiveFields.ts`'s own name detection). Uses
 * `isSensitiveFieldName` — a single-key check with no recursion of its
 * own — not `findSensitiveField`, which recurses through an entire
 * subtree and would therefore redact an *outer* key merely because
 * something sensitive exists somewhere underneath it (this function
 * already does its own recursion, one key at a time — found the hard
 * way, by a failing test: an earlier version used `findSensitiveField`
 * here and redacted a whole `{ wallet: { privateKey } }` object under
 * its outer key instead of only the inner `privateKey` field).
 */
export function scrubForTelemetry(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubForTelemetry);
  if (typeof value !== 'object' || value === null) return value;

  const clone: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    clone[key] = isSensitiveFieldName(key) ? '[redacted]' : scrubForTelemetry(nested);
  }
  return clone;
}
