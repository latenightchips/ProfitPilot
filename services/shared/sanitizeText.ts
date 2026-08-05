/**
 * Data Sanitization — 06_TASKS.md M8-052 ("Implement Data
 * Sanitization"). Dependencies: M8-005. Apply to: "Portfolio names,
 * Descriptions, Scenario names, Strategy names, Imported metadata." DoD:
 * "Stored text cannot create unsafe rendered output."
 *
 * **Why this is real hygiene, not theater, even though React already
 * prevents script injection.** This codebase renders every one of these
 * fields as plain JSX text content (`{name}`) — confirmed by grep, there
 * is no `dangerouslySetInnerHTML` anywhere in `app/`, `components/`, or
 * `features/` — so React's own automatic escaping already makes classic
 * HTML/script injection through these fields structurally impossible.
 * `sanitizeText` therefore does not attempt to strip HTML-looking
 * substrings (`<script>`, `javascript:`, etc.) — doing so would just
 * mangle legitimate text (a portfolio genuinely named `"BTC <2x Long>"`)
 * without closing a real gap React doesn't already close. What it *does*
 * remove is real: control characters (which can corrupt terminal/log
 * output, confuse fixed-width table rendering, or exploit assumptions in
 * a future non-React renderer or a CSV export cell —
 * `services/export/CsvExporter.ts` reads these exact fields),
 * leading/trailing whitespace, and unbounded length (a UI-breaking and
 * storage-bloat concern for a field with no length limit otherwise).
 *
 * **Applied at the true point of storage, not scattered across every
 * Store action.** `services/persistence/schemas/*.ts`'s own `name`/
 * `description` fields use `sanitizedTextSchema`/`sanitizedOptionalTextSchema`
 * (this module) via Zod's `.transform()` — the same choke point
 * `validatePersistedRecord` already enforces every write and every
 * import through, so "Imported metadata" is covered by construction,
 * not a second, separate check. `types/portfolio.schema.ts`'s own
 * `portfolioInputSchema` applies `utils/sanitizeText.ts`'s pure function
 * directly at the *creation* boundary too, so a Store's own in-memory
 * state reflects sanitized text immediately rather than only what
 * eventually reaches storage — see that file for why it imports the pure
 * function from `utils/` rather than the wrapper schemas here.
 *
 * The pure `sanitizeText` function itself lives in `utils/sanitizeText.ts`
 * (re-exported below for this module's existing callers) so that
 * low-level `types/` code can use it without importing from `services/`.
 */
import { z } from 'zod';

import { sanitizeText } from '@/utils/sanitizeText';

export { sanitizeText };

const MAX_TEXT_LENGTH = 200;

/** For a required field — rejects if sanitization leaves nothing behind. */
export function sanitizedTextSchema(message: string, maxLength: number = MAX_TEXT_LENGTH) {
  return z
    .string()
    .transform((value) => sanitizeText(value, maxLength))
    .refine((value) => value.length > 0, { message });
}

/** For an optional field — `undefined`/empty-after-sanitizing both collapse to `undefined`. */
export function sanitizedOptionalTextSchema(maxLength: number = MAX_TEXT_LENGTH) {
  return z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      const sanitized = sanitizeText(value, maxLength);
      return sanitized.length > 0 ? sanitized : undefined;
    });
}

/** For an optional-but-nullable field (e.g. a saved simulation's `description: string | null`). */
export function sanitizedNullableTextSchema(maxLength: number = MAX_TEXT_LENGTH) {
  return z
    .string()
    .nullable()
    .transform((value) => {
      if (value === null) return null;
      const sanitized = sanitizeText(value, maxLength);
      return sanitized.length > 0 ? sanitized : null;
    });
}
