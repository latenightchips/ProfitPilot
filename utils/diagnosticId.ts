/**
 * Diagnostic identifier generation — 06_TASKS.md M9-043 ("Audit
 * Application Error Boundaries")'s "Diagnostic identifiers" Include item.
 * `app/error.tsx`/`app/global-error.tsx` show this to the user alongside
 * a safe message (something to quote when reporting an issue) and log it
 * to the console alongside the real `Error` object, the same
 * generation-only convention `utils/deviceId.ts` already established for
 * an unrelated ID (no storage/lifecycle — a boundary crash has nothing
 * to persist this against, since `@sentry/nextjs` is installed but not
 * configured, 06_TASKS.md M1-002's own "Explicitly not done" scope).
 */
export function generateDiagnosticId(): string {
  return crypto.randomUUID().slice(0, 8);
}
