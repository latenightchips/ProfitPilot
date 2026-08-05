/**
 * Pure text sanitization primitive — 06_TASKS.md M8-052 ("Implement Data
 * Sanitization"). Lives in `utils/` (04_BUILD_GUIDE.md's "UTILS
 * DIRECTORY": "General helper functions... pure and deterministic")
 * rather than `services/shared/`, specifically so `types/portfolio.schema.ts`
 * can apply it at the *creation-input* boundary without inverting this
 * codebase's dependency direction (`types/` is a low-level shared
 * directory every layer imports FROM, never the reverse).
 * `services/shared/sanitizeText.ts` re-exports the Zod-schema wrapper
 * helpers built on top of this function for `services/persistence/schemas/*.ts`'s
 * own use — see that file's header comment for what this does and
 * doesn't defend against.
 */
const MAX_TEXT_LENGTH = 200;

/** Matches C0 controls (U+0000-U+001F), DEL (U+007F), and C1 controls (U+0080-U+009F). */
const CONTROL_CHARACTERS_PATTERN = new RegExp('[\\u0000-\\u001F\\u007F-\\u009F]', 'g');

/**
 * Strips C0/C1 control characters (keeping none — not even tab/newline,
 * since every field this is applied to is a single-line name or short
 * description, never freeform multi-line content), collapses surrounding
 * whitespace, and caps length.
 */
export function sanitizeText(input: string, maxLength: number = MAX_TEXT_LENGTH): string {
  const withoutControlChars = input.replace(CONTROL_CHARACTERS_PATTERN, '');
  return withoutControlChars.trim().slice(0, maxLength);
}
