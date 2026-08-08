# Support Playbook

`06_TASKS.md` M10-014 ("Create Support Playbook") — Milestone 10 Batch 2.
Dependencies: M10-013. Description: "Document support procedures." DoD:
"Common support requests have documented responses."

**What this document is not**: ProfitPilot has no support email, help
desk, ticketing system, staffed support organization, or response-time
SLA — none is invented here. This is a self-diagnostic playbook for a
user or self-hosting operator working through a problem themselves (or
for whoever they informally ask for help), reusing the detailed
technical material already built across this project rather than
repeating it. Every item below links to where the real detail already
lives.

## Privacy — what must never be requested or shared while troubleshooting

**Before anything else**: diagnosing a ProfitPilot problem never
requires — and must never request or share — any of the following:

- Portfolio balances, collateral quantities, or debt values.
- Any imported or exported portfolio JSON *payload* (the file's
  structure/error can be described without its financial content).
- Passwords, session tokens/cookies, or any Supabase auth token — this
  application does not itself set a cookie (Supabase's client persists a
  session to `localStorage`, not a cookie, `next.config.ts`'s own header
  comment), but no session-identifying value belongs in a support
  conversation regardless.
- A real Supabase project's URL/anon key, if it reveals anything
  beyond what `.env.example` already documents as safe to share
  (`docs/PRODUCTION_READINESS.md` §1 — the anon key itself is a
  publishable, not secret, credential, but there is still no reason to
  paste one into a support conversation).
- A Sentry DSN or any Sentry auth/API token.
- Any other sensitive financial or personal data.

What *is* safe and useful to share: a diagnostic reference code
(`app/error.tsx`'s own `generateDiagnosticId()` output), an
`ApplicationError`'s own `code` field (e.g. `INVALID_IMPORT_FILE`,
`UNSUPPORTED_SCHEMA_VERSION`), the browser and OS name/version, the
exact steps that led to the problem, and a screenshot of an error
banner (which this application's own error/warning UI already renders
without financial values inline where avoidable — see
`docs/DISASTER_RECOVERY.md`'s own per-scenario "Symptom" descriptions
for what each real error code actually looks like). This mirrors
`docs/OBSERVABILITY.md`'s own privacy design exactly: the same fields
`captureError`/`logDiagnosticEvent` are structurally limited to
(`feature`/`operation`/`code`/`category`, never a financial value) are
the same fields safe to describe by hand.

## Application won't start

- **Symptom**: `pnpm dev`/`pnpm start` fails before serving anything.
- **Check**: `utils/env.ts`'s own Zod schema throws a clear
  `Invalid environment configuration:` error listing exactly which
  variable is malformed — read that message first; it names the
  specific field. Since every variable is optional or defaulted, a
  fresh `.env.local` (or none at all) should never trigger this — a
  malformed *value* someone typed is the usual cause, not a missing one.
- **Check**: Node.js 22+ and pnpm 10+ (`CONTRIBUTING.md`'s "Setup"),
  and `pnpm install --frozen-lockfile` completed without error.

## Production build fails

- Run `pnpm typecheck`, `pnpm lint`, and `pnpm test` individually to
  isolate which stage fails — `pnpm validate` runs all of them plus
  the build in sequence and stops at the first failure
  (`CONTRIBUTING.md`'s "Development commands" table).
- The `import-in-the-middle`/`require-in-the-middle` warnings during
  build are expected and do not fail the build — a documented, known
  limitation of `@sentry/nextjs`'s own OpenTelemetry auto-instrumentation
  under pnpm's strict `node_modules` layout (`docs/OBSERVABILITY.md`'s
  own "known, accepted limitation" section) — nothing to fix.

## Local data appears missing

Walk through `docs/DISASTER_RECOVERY.md`'s own scenarios in this order,
since "data is gone" has several different real causes:

1. **Wrong browser/device/profile?** — this application has no cross-
   device sync (Cloud Sync is cancelled); data never appears anywhere
   except the exact browser profile it was created in. See
   `docs/USER_GUIDE.md`'s Troubleshooting: *"My portfolio isn't on this
   device/browser."*
2. **Browser storage actually cleared?** — see `docs/DISASTER_RECOVERY.md`'s
   "Deleted local browser data" — the only recovery path is a
   previously exported backup; nothing survives inside the browser once
   its storage is gone.
3. **A record was deleted on purpose or by mistake?** — see
   `docs/DISASTER_RECOVERY.md`'s "User deletion" (permanent, no
   automatic snapshot — Archive is the reversible alternative for
   portfolios) and "Import replacement mistake" (a Recovery Snapshot
   exists automatically if a `Replace selected`/`Replace all local data`
   import caused it).
4. **A record fails to load with an error?** — see
   `docs/DISASTER_RECOVERY.md`'s "Malformed local storage"
   (`INVALID_PERSISTED_RECORD`) — restore a Recovery Snapshot or a
   backup.

## Import fails

`docs/DISASTER_RECOVERY.md`'s "Failed import" section covers this in
full — a file-level rejection (`INVALID_IMPORT_FILE`: unparsable JSON,
wrong shape, wrong `app` identifier) changes nothing; a partial-apply
failure rolls back automatically to the exact pre-import state. Try a
narrower merge mode (`Add as new` instead of `Replace all local data`)
or re-export a fresh backup from the source and retry.

## Export fails

Uncommon — export reads already-validated local data, so a failure here
usually means the browser itself refused the download (a pop-up/download
blocker, or the browser's own storage/download quota). Check the
browser's own download settings first; this is not an application-level
failure this codebase has a named error code for.

## Unsupported future schema

**Symptom**: data was written by a newer ProfitPilot build than the one
currently running (`UNSUPPORTED_SCHEMA_VERSION`,
`docs/DISASTER_RECOVERY.md`'s own section by this name). **Response**:
update to the build whose `STORAGE_SCHEMA_VERSION` matches or exceeds
the data's own version, or restore an older exported backup compatible
with the currently installed build — there is no forward-compatible read
path by design (`01_PRD.md` REQ-012's "Fail Secure" philosophy); this
application refuses rather than risks a lossy read.

## Corrupted local data

`docs/DISASTER_RECOVERY.md`'s "Malformed local storage" — a checksum
mismatch or an envelope/payload that doesn't match its expected shape
surfaces as `INVALID_PERSISTED_RECORD`, a normal error state, never a
raw crash. Restore a Recovery Snapshot older than when the corruption
began, or import a previously exported backup.

## Optional Authentication unavailable

**"Sign In says cloud accounts aren't available"** — expected in this
project's own default configuration (`docs/USER_GUIDE.md`'s
Troubleshooting section, `services/auth/authService.ts`'s own real
message). This does not affect anything else — signing in never changes
how portfolio data is stored (`CONTRIBUTING.md`'s "Optional
authentication"). A self-hosting operator who wants it working must
configure `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`
with their own real Supabase project — see
`docs/OPERATIONAL_RUNBOOK.md`'s "Optional Authentication setup
boundary."

## Optional Sentry unavailable

Not a fault — Version 1.0.0 ships with no live Sentry project by
default (`docs/OBSERVABILITY.md`). Nothing is captured or sent unless
`NEXT_PUBLIC_SENTRY_DSN` is configured; the SDK is not even loaded into
the bundle otherwise. A self-hosting operator who wants error monitoring
must configure their own real Sentry project — see
`docs/OPERATIONAL_RUNBOOK.md`'s "Optional Sentry setup boundary."

## Browser/storage problems

- **"My data disappeared after clearing browser data / using
  private/incognito mode."** Expected — `localStorage` does not survive
  either (`docs/DISASTER_RECOVERY.md`'s "Deleted local browser data").
- **Storage quota**: if the browser reports storage is full, exporting
  a backup and clearing unused portfolios/scenarios (or the browser's
  own site-data settings) is the only remedy this application offers;
  there is no server-side storage to fall back to.
- Confirmed cross-browser posture: Chromium (Chrome/Edge) is fully
  automated and verified; Firefox/Safari are covered by code-level
  review only, not automated tests — see `docs/CROSS_BROWSER_REVIEW.md`.
  A Firefox/Safari-specific rendering issue should still be reported
  (with browser/OS version, per the privacy section above), just
  understood as less exhaustively pre-verified than Chromium.

## Responsive/UI problems

Tested viewport widths are 375px (mobile), 768px (tablet, sidebar
breakpoint), and 1280px (desktop) — `docs/QUALITY_PLAN.md` §4. A layout
issue outside those widths, or with browser zoom/OS-level text scaling,
is worth reporting with the exact viewport size and browser/OS.

## Financial output/disclosure questions

- **"Why does this number look different from what I expected?"**
  Every calculation traces to a Formula ID in `docs/02_Formulas.md` —
  Developer Mode (`/settings`, or a Dashboard KPI card's own tooltip)
  shows the exact Formula ID and raw value behind any displayed number.
  This application never guesses; if a figure is unavailable, it says
  "Not available"/"N/A" rather than fabricating one (the same honesty
  standard `docs/DEFECT_CLASSIFICATION.md` §6 documents for Health
  Factor risk-band classification).
- **"Is this financial advice?"** No — see `docs/USER_GUIDE.md`'s "What
  ProfitPilot is" section: every suggested action is a calculation to
  verify yourself, not an instruction, and nothing executes a real
  transaction.
- **"Why does this say 'Estimated'?"** Any calculated, forward-looking
  figure (e.g. liquidation price) is explicitly labeled as an estimate,
  distinguished from a current, directly-entered value —
  `docs/USER_GUIDE.md`'s "Understanding risk indicators" section; a
  cross-component labeling inconsistency here was found and fixed in
  Milestone 9 Batch 11 (M9-055).

## Safe diagnostic information to provide

When asking for help, the most useful, always-safe information to
include:

1. The diagnostic reference code (if an error screen showed one) or the
   `ApplicationError` `code` field (if a specific error banner named
   one).
2. Browser name/version and OS.
3. The exact sequence of actions that led to the problem (not the data
   involved — the sequence).
4. Whether the problem is reproducible, and on which route(s).
5. For an import/export problem: the *file size* and *record count* the
   file claims to have (visible in the import preview before applying),
   not the file's own contents.

Never attach the export/import file itself, a screenshot containing
real numbers, or any credential — see "Privacy" above.

## Known limitations affecting support

- No live Sentry project or hosted logging exists by default — a
  developer cannot "just check the logs" the way a hosted product's
  support team could; the browser's own DevTools Console is the primary
  diagnostic surface (`docs/OPERATIONAL_RUNBOOK.md`'s "Diagnostics"
  section).
- No cross-device data — "it works on my other device" is not evidence
  the problem is fixed; each device/browser is independent.
- See `docs/KNOWN_ISSUES.md` for the complete, current list of
  documented product/operational/CI limitations — many "is this a bug?"
  questions are already answered there.
