# Operational Runbook

`06_TASKS.md` M10-012 ("Create Operational Runbook") — Milestone 10
Batch 2. Dependencies: M10-011. Description: "Document operational
procedures." DoD: "Routine operational work follows documented
procedures."

**Scope, read literally vs. as actually applicable**: M10-012's own
Include list (Deployment, Rollback, Provider outage, Supabase outage,
Authentication failure, Synchronization issues, Import failures, Data
recovery) assumes a hosted, cloud-synchronized product. ProfitPilot
Version 1.0.0 is neither — it is a self-hostable, local-first
application with **no operated ProfitPilot production deployment**
(explicit product/release decision, Milestone 10 Batch 1;
`docs/RELEASE_NOTES.md`) and **no Cloud Synchronization** (cancelled by
product decision, Milestone 8; `docs/MILESTONE_8_SCOPE_CHANGE.md`). This
document covers every item on that list that actually applies to this
product, honestly re-scoped, plus the procedures a **self-hosting
operator** (anyone who runs this application themselves) genuinely
needs. It does not invent a fictional SaaS operations manual — no
production traffic, uptime/SLA, hosted logs, monitoring dashboard,
on-call rotation, or support staff exists to operate.

Every procedure below is marked with who performs it:

- **[Repository]** — already built into this codebase; nothing to set up.
- **[Operator]** — performed by whoever self-hosts this application.
- **[Deferred]** — requires operated ProfitPilot infrastructure that does
  not exist for Version 1.0.0 (see `docs/RELEASE_NOTES.md`,
  `docs/PRODUCTION_READINESS.md`).

## Prerequisites [Operator]

Node.js 22+, pnpm 10+ (`CONTRIBUTING.md`'s own "Setup" section — this
document does not repeat that walkthrough). No database, no cache
server, no external service is required to run Version 1.0.0 — Manual
Mode (the only mode this version ships) needs zero external
configuration (`utils/env.ts`'s own schema: every field is optional or
defaulted).

## Production build/start [Operator]

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Matches `04_BUILD_GUIDE.md`'s own "BUILD PROCESS" pipeline (Install →
Type Check → Lint → Run Tests → Production Build → Deploy → Health
Check → Ready) through "Production Build" — see
`docs/PRODUCTION_READINESS.md` §6 for the full build-configuration audit
(no `vercel.json`/`middleware.ts`, portable to any Next.js-compatible
host). "Deploy" and "Health Check" against a *real* hosted target are
**[Deferred]** — see "Health/readiness checks" below for what can
actually be checked against a local production-mode server today.

## Environment configuration [Operator]

Copy `.env.example` to `.env.local` and fill in only the capabilities
you intend to enable — every variable is optional
(`docs/PRODUCTION_READINESS.md` §1's full audit table). Manual Mode
requires none of them. Setting `NEXT_PUBLIC_SUPABASE_URL`/
`NEXT_PUBLIC_SUPABASE_ANON_KEY` enables optional Authentication (see
below); setting `NEXT_PUBLIC_SENTRY_DSN` enables optional error
monitoring (see below). Neither is required, and this project's own
default configuration ships with neither set.

## Local persistence expectations [Repository]

Everything is stored in the browser's own `localStorage`, versioned
(`STORAGE_SCHEMA_VERSION`, currently `1.0.0`) — see
`CONTRIBUTING.md`'s "Persistence and local-first scope" section. There
is no server-side database, no ProfitPilot-operated storage of any kind
— an operator's own users each carry their own local copy, on their own
device, in their own browser. This is not a temporary limitation; it is
Version 1.0.0's permanent architecture (`docs/RELEASE_NOTES.md`).

## Backup/export [Operator, via the running application]

`/settings` → **Export** → **Full Backup** downloads every record as one
JSON file. This is the only real backup mechanism this version has — see
`docs/USER_GUIDE.md`'s "Your data" section for the full user-facing
walkthrough and `docs/DISASTER_RECOVERY.md` for what each recovery
scenario actually depends on this for. There is no automated,
ProfitPilot-operated backup (**[Deferred]** in the sense that no hosted
backup service exists at all — this is the *only* backup path Version
1.0.0 has, not a stopgap for a missing better one).

## Restore/import [Operator, via the running application]

`/settings` → **Import**, with 4 merge modes (`Add as new`, `Merge
non-conflicting`, `Replace selected`, `Replace all local data`) — see
`docs/USER_GUIDE.md`'s exact, verified UI labels and
`docs/DISASTER_RECOVERY.md`'s "Failed import" section for the automatic
rollback-on-failure guarantee (`applyImport` snapshots the full dataset
before writing anything, restores it exactly on any failure).

## Recovery snapshots [Repository, surfaced via the running application]

`/settings` → **Recovery Snapshots** — taken automatically immediately
before a `Replace selected`/`Replace all local data` import
(`docs/DISASTER_RECOVERY.md`'s "Import replacement mistake" section).
Restore the snapshot dated immediately before a mistaken import to undo
it exactly. An ordinary single-record `Delete` has **no** automatic
snapshot — `docs/DISASTER_RECOVERY.md`'s "User deletion" section
documents this honestly; **Archive** (where available — portfolios only)
is the reversible alternative.

## Storage/schema compatibility [Repository]

`STORAGE_SCHEMA_VERSION` is `1.0.0` — the only version that has ever
shipped (`docs/VERSIONING_STRATEGY.md`'s "Storage versioning and
migration policy"). `REGISTERED_MIGRATIONS`
(`services/persistence/migrations/migrate.ts`) is currently empty
because there is no prior version to migrate from yet; the chain-walking
mechanism itself is fully tested and wired into the real app-boot path
(`providers/PersistenceProvider.tsx`'s `runLocalDataMigration` call, on
every mount) — see `docs/DISASTER_RECOVERY.md`'s "Failed migration" and
"Unsupported future schema" sections for what happens when a real prior
or future version is eventually encountered: migration failures restore
the pre-migration snapshot automatically; an unsupported future schema
is safely rejected, never guessed at.

## Application upgrade procedure [Operator]

There is no prior installed version to upgrade *from* yet — Version
1.0.0 is this project's first release (`docs/RELEASE_NOTES.md`'s
"Upgrade instructions"). For a future release: pull the new build, run
`pnpm install --frozen-lockfile`, rebuild, and restart; any required
local-data migration runs automatically on first load. **Export a backup
first regardless** (`/settings` → **Export** → **Full Backup**) — the
same standing recommendation every other document in this project makes
before any local-data-affecting operation.

## Application rollback procedure [Operator]

Because this application has no server-side state beyond the static
build artifact itself, "rolling back a deployment" is restoring a
previous build/commit — nothing more. Two real, already-tested
guarantees this depends on:

1. **Persisted data compatibility across a rollback** is exactly
   `docs/DISASTER_RECOVERY.md`'s "Unsupported future schema" scenario —
   older code encountering data written by a newer/forward-migrated
   build is rejected safely (`UNSUPPORTED_SCHEMA_VERSION`), never
   silently misread. If the rolled-back build's own
   `STORAGE_SCHEMA_VERSION` is the same as (or newer than) the data's
   own version — the common case for a same-schema patch rollback — no
   compatibility issue exists at all.
2. **Release identification**: `CONTRIBUTING.md`'s "Release
   identification — branch and tag policy" section documents the
   annotated-tag convention (`v1.0.0`, and future `v1.0.x`) an operator
   uses to identify exactly which commit to roll back to or forward
   from.

Rolling back *between two ProfitPilot-operated hosted deployments*
(i.e., restoring a previous *operated* environment) is **[Deferred]** —
no such environment exists for Version 1.0.0. What is real and tested
today is the code/data-compatibility guarantee above, which any operator
can rely on regardless of how they host it.

## Diagnostics [Repository + Operator]

- **Reference codes**: an uncaught render error shows a short reference
  code (`app/error.tsx`/`app/global-error.tsx`, `generateDiagnosticId()`)
  alongside a safe message and confirmation that stored data is
  unaffected — see `docs/SUPPORT_PLAYBOOK.md` for what an operator or
  user may safely share when reporting one.
- **Structured diagnostic events**: `services/observability/diagnosticEvent.ts`'s
  `logDiagnosticEvent` always writes to the browser console (the one
  real, always-available structured log a local-first, client-only
  application has) — see `docs/OBSERVABILITY.md` §M9-050 for the exact
  fields and privacy scrubbing applied.
- **Browser DevTools** (Console/Application/Network tabs) is the primary
  diagnostic surface an operator has today — there is no
  ProfitPilot-operated server log to inspect, because there is no
  ProfitPilot-operated server.

## Optional Sentry setup boundary [Operator, if desired]

Set `NEXT_PUBLIC_SENTRY_DSN` to enable error monitoring
(`docs/OBSERVABILITY.md`) — the SDK is dynamically loaded only when
configured (zero bundle cost otherwise, a real, measured fix
documented in `docs/OBSERVABILITY.md`'s own "bundle-size fix" section).
**Where the boundary sits**: this repository provides the wiring
(`instrumentation-client.ts`, `instrumentation.ts`,
`services/observability/`) and the privacy-scrubbing guarantees
(`docs/OBSERVABILITY.md`'s two-layer privacy section). **Creating an
actual Sentry project, obtaining a real DSN, and operating that
dashboard is the operator's own responsibility** — no live Sentry
project exists for Version 1.0.0 itself (`docs/PRODUCTION_READINESS.md`
§2's identical framing for Supabase applies here too); this is not
something this repository can or does provide.

## Optional Authentication setup boundary [Operator, if desired]

Set `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` to enable
Sign In/Sign Up/Password Reset (`CONTRIBUTING.md`'s "Optional
authentication" section) — dormant and gracefully degrading otherwise
(`getSupabaseClient()` returns `null`, every `authService` method fails
with `SUPABASE_NOT_CONFIGURED` rather than throwing,
`docs/PRODUCTION_READINESS.md` §2). **Where the boundary sits**: this
repository provides the client wiring and the guarantee that signing in
never changes how portfolio data is stored (local-only regardless).
**Creating an actual Supabase project is the operator's own
responsibility** — none exists for Version 1.0.0 itself, and only the
anon (publishable) key is ever read; there is no service-role key
anywhere in this codebase.

## Security-header verification [Operator]

`next.config.ts`'s `headers()` function ships CSP, HSTS,
`X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy` on
every route — already verified against a real local production build
and server (`docs/PRODUCTION_READINESS.md` §4, freshly re-run in
Milestone 10 Batch 1). An operator deploying this application should
re-verify the same headers against their own real, hosted origin after
deployment:

```bash
curl -sI https://<your-real-domain>/ | grep -i "content-security-policy\|strict-transport\|x-frame-options\|x-content-type\|referrer-policy"
```

Expect the same five headers `docs/PRODUCTION_READINESS.md` §4 already
documents. HSTS deliberately omits `preload` — adding it is a
deliberate, per-deployment decision left to whoever actually owns the
domain (`next.config.ts`'s own header comment), not something this
repository decides on an operator's behalf.

## Health/readiness checks that can actually be performed [Operator]

No ProfitPilot-operated health-check endpoint or uptime monitor exists
for Version 1.0.0 — nothing to poll remotely. What an operator can
actually verify against their own real deployment, mirroring exactly
what `docs/PRODUCTION_READINESS.md` verified locally in Milestone 10
Batch 1:

1. The application starts and serves `200` on its root route and every
   other route (`/`, `/portfolios`, `/simulation`, `/loop-builder`,
   `/exit-planner`, `/recommendations`, `/settings`, `/sign-in`,
   `/sign-up`, `/reset-password`), and `404` on an unknown route.
2. The five security headers above are present.
3. `document.title` reflects the correct route (`"Dashboard —
   ProfitPilot"` on `/`, etc.) — confirms client-side hydration
   succeeded, not just that the static HTML shell was served.
4. No console error appears on initial load (open DevTools, reload,
   check the Console tab) — the same "zero console/page errors" bar
   `docs/SECURITY_REVIEW.md`'s own M9-035 verification already used.

A ProfitPilot-operated status page, uptime SLA, or automated alerting
on any of the above is **[Deferred]** — none exists for Version 1.0.0.

## Known operational limitations

- **No ProfitPilot-operated production deployment, monitoring,
  logging, or alerting exists for Version 1.0.0** — every "Deferred"
  item above is a deliberate release decision (`docs/RELEASE_NOTES.md`),
  not an oversight.
- **No Cloud Synchronization** — cancelled by product decision
  (Milestone 8); there is no "synchronization issue" this document can
  meaningfully cover, because there is no synchronization.
- **No Cloud Database** — cancelled by product decision, same source; no
  cross-device data — each browser/device carries its own independent
  local copy; moving data between them is always a manual export/import,
  never automatic.
- **CI does not run the end-to-end (Playwright) suite automatically**
  — a documented, non-blocking limitation
  (`docs/DEFECT_CLASSIFICATION.md` §6); an operator building their own
  release should run `pnpm test:e2e` manually before deploying, the same
  practice this project's own release process follows.
- **Single-copy data model** — a lost device, cleared browser storage,
  or an un-exported dataset has no recovery path beyond a previously
  exported backup (`docs/DISASTER_RECOVERY.md`'s "Deleted local browser
  data"/"Device unavailable" sections) — inherent to local-first
  architecture, not a defect.
