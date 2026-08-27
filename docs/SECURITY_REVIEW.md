# Security Review

06_TASKS.md M8-053 ("Implement Secure Session Review") and M8-054
("Complete Persistence Threat Review"). Both are reviews of already-built
behavior, not new features — every finding below cites the exact file and
mechanism it verifies.

**Milestone 8 is re-scoped to local-only persistence** (product
decision — see `docs/MILESTONE_8_SCOPE_CHANGE.md`): Cloud Database,
Cloud Synchronization, and Row-Level Security testing are cancelled and
will not be built. Items below that depend on that cancelled work are
marked **not applicable**, not "deferred" — there is no future batch
that will revisit them. Authentication (`services/auth/`) remains in the
codebase as a dormant, fully-functional-with-zero-configuration
capability, independent of this cancellation — see
`docs/MILESTONE_8_SCOPE_CHANGE.md` §5.

## M8-053 — Secure Session Review

Scope: `services/auth/`, `stores/authStore.ts`, `providers/AuthProvider.tsx`,
`app/sign-up`, `app/sign-in`, `app/reset-password` (Milestone 8 Batch 5,
M8-014–M8-021). Verified against 04_BUILD_GUIDE.md's own Security
Checklist (see the table at the end of this section).

### Secure token handling

Session tokens (`access_token`/`refresh_token`) never enter this
application's own state or storage. `@supabase/supabase-js`'s `GoTrueClient`
(`services/auth/supabaseClient.ts`) owns them entirely — `persistSession: true`,
`autoRefreshToken: true`, the library's own defaults, under its own
`sb-<project-ref>-auth-token` `localStorage` key, structurally separate
from every `profitpilot:v1:*` key `services/persistence/` writes.

`services/auth/authService.ts`'s `toAuthSession` does map `access_token`/
`refresh_token` onto this application's own `AuthSession` type — but
`stores/authStore.ts`'s `applySession` (the only place that return value is
ever consumed) immediately discards them, keeping only `user` (`id`,
`email`), `status`, and `cloudSyncEligible` in Zustand state. `authStore`
carries no persist middleware (confirmed: no `persist(...)` wrapper in
`stores/authStore.ts`), so even that reduced state never reaches
`localStorage`. Verified by grep across `app/`, `components/`, `features/`,
`services/` (excluding `services/auth/` and its own tests): no file reads
`.accessToken`/`.refreshToken` off an `AuthSession`.

**Finding**: none. Token material has exactly one owner (`GoTrueClient`'s
own storage) and no second copy anywhere in this codebase.

### Session expiration

Delegated entirely to `GoTrueClient`'s own `autoRefreshToken` — this
application registers one listener (`authService.onAuthStateChange`,
subscribed once in `stores/authStore.ts`'s `initialize()`) and reacts to
whatever session state the library reports, rather than tracking
`expires_at` or scheduling its own refresh. This is the same
"reuse an already-audited implementation rather than hand-roll token
rotation" choice `services/auth/supabaseClient.ts`'s own header comment
documents for session storage generally.

**Finding**: none, structurally — there is no custom expiration logic in
this codebase to have a bug in.

### Sign-out cleanup

`authStore.signOut()` calls `authService.signOut()` (real `GoTrueClient.signOut()`
in production, which clears its own storage) and then unconditionally sets
`{ user: null, status: 'unauthenticated', cloudSyncEligible: false }` —
even on error paths on already-half-signed-out clients, this is the
terminal client-side state. `app/settings/page.tsx`'s sign-out control is a
separate, explicitly confirmed action (`confirmSignOutClear`) from
**Clear Local Data** (`confirmClear`) — signing out never deletes local
portfolio data, and clearing local data never touches the auth session;
each is independently confirmed and independently testable
(`tests/unit/stores/authStore.test.ts`'s `describe('signOut', ...)`).

**Finding**: none.

### Password reset flow

`app/reset-password/page.tsx` implements both request and completion
states, distinguished by Supabase's own `'PASSWORD_RECOVERY'` auth event
rather than a URL parameter this application parses itself — so this file
never touches the recovery token embedded in the emailed link's URL; that
parsing is entirely `@supabase/supabase-js`'s `detectSessionInUrl`.
Success, failure, and (structurally, per that page's own header comment)
expiration states are all distinct, user-visible outcomes.

**Finding**: none in the code reviewed. See "External-service limitation"
below — this flow's real-email, real-token behavior has never been
exercised against a live Supabase project in this environment.

### No session data in exports

`services/export/JsonExporter.ts`'s own header comment already documents
this as satisfied structurally, not by a runtime filter: `EXPORTABLE_RECORD_TYPES`
is fixed to the record types `services/persistence/types/envelope.ts`
declares, none of which is session- or token-shaped, and `'syncMetadata'`
(the one record type that could one day carry something session-like) has
no writer anywhere in this codebase yet. Re-verified for this review: grep
across `services/export/` for `accessToken`/`refreshToken`/`session` finds
only this documentation, no field access.

**Finding**: none today, and this is now a permanent property rather than
a pending check — Cloud Sync (the only feature that would ever have
given `'syncMetadata'` a real writer) is cancelled by product decision,
so no future writer will introduce session-shaped data there.
`services/persistence/validate.ts`'s M8-051 sensitive-field check
(`findSensitiveField`) remains in place regardless, catching a literal
`accessToken`/`refreshToken`/`sessionToken`-named field on any record
type if one were ever introduced.

### No authenticated API access after sign-out

No code path in this application makes an authenticated API call with a
session token at all, signed in or not — `services/persistence/adapters/`
contains only `local-storage.adapter.ts` and `memory.adapter.ts`; no
Supabase-backed persistence adapter exists, and none will (Cloud
Database and Cloud Sync are cancelled by product decision — see
`docs/MILESTONE_8_SCOPE_CHANGE.md`). "No authenticated API access after
sign-out" is therefore permanently, structurally true, not a
placeholder for a future check.

**Finding**: none exploitable, and none possible under the current
scope — there is no authenticated persistence API for a post-sign-out
request to reach.

### External-service limitation

Every item above was verified by reading the implementation and this
batch's own tests (`tests/unit/services/auth/`, `tests/unit/stores/authStore.test.ts`,
`tests/e2e/authWorkflows.spec.ts`) against a fake `AuthClient` — this
sandbox has no real Supabase project, CLI, or reachable local emulator
(`services/auth/supabaseClient.ts`'s own header comment). Real-network
Authentication behavior (actual token expiry timing, actual email
delivery, Supabase's own rate limiting) has never been exercised and is
not claimed to be. Row-Level Security is a separate, cancelled item
(§ M8-054 below) — not merely untested here.

### Security Checklist cross-reference (04_BUILD_GUIDE.md)

| Item | Status |
| --- | --- |
| HTTPS only | Not this application's concern to enforce at the server level — delegated to hosting/deployment configuration; `NEXT_PUBLIC_SUPABASE_URL` itself is Supabase's own HTTPS endpoint. `next.config.ts`'s own `Strict-Transport-Security` header (M9-035, Batch 6) adds the client-reinforcement half. |
| Environment variables secured | `utils/env.ts` reads `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` only from `process.env`; no default/fallback value is hardcoded. See §M9-030 below — both were renamed this batch from their original, non-`NEXT_PUBLIC_`-prefixed names, a genuine defect fix, not a stylistic change. |
| Row Level Security enabled | Not applicable — Cloud Database is cancelled by product decision; no Supabase table exists or will exist. |
| Input validation complete | Auth forms validate email format and password length client-side (`app/sign-up`, `app/sign-in`); `services/persistence/schemas/` validates everything that reaches storage. |
| No secrets committed | Verified: no `.env` file, no hardcoded key, checked into this repository. |
| No private keys requested | Confirmed — no field anywhere in this application's forms or schemas asks for a wallet private key or seed phrase; `services/shared/sensitiveFields.ts` (M8-051) additionally rejects one if it were ever smuggled into persisted data. |
| No wallet signing | Confirmed — no signing library, no wallet-connect integration exists in this codebase. |
| Dependency audit completed | See M8-054's "Sensitive data leakage" section below for the audit run as part of this review. |

## M8-054 — Persistence Threat Review

Scope: `services/persistence/`, `services/import/`, `services/export/`.
Dependencies per 06_TASKS.md: M8-023 (Cloud Database), M8-031 (Cloud
Sync), M8-043 (Import Merge Options), M8-051 (Sensitive Data Exclusion
Rules). M8-023 and M8-031 are both cancelled by product decision —
Milestone 8 is re-scoped to local-only persistence
(`docs/MILESTONE_8_SCOPE_CHANGE.md`); no Supabase infrastructure will be
built. Three of the seven threat categories below depend entirely on
that cancelled work; each is still reviewed and documented, honestly
scoped to "not applicable," rather than skipped or described as handled.

### Malicious imports

**Reviewed and mitigated.** `services/import/ImportValidator.ts` rejects
at the file level (`INVALID_IMPORT_FILE`: unparsable JSON, wrong outer
shape, wrong `app` identifier) and at the per-record level
(`validatePersistedRecordSchema`, which every individual record — whether
from a normal write or an import — passes through). As of M8-051 (this
same batch), that per-record check also rejects any record carrying a
sensitive-looking field smuggled into a nested loose-object payload
(`findSensitiveField`), closing the one concrete gap this review
identified in the pre-M8-051 code (`looseRecordSchema`'s deliberate
shallowness — see `services/persistence/schemas/shared.schema.ts` and
`services/shared/sensitiveFields.ts`'s own header comments). `services/import/apply.ts`
additionally requires `confirmedReplaceAll` for the one import mode that
can overwrite everything, and snapshots the prior dataset before any
replace-mode apply.

**Residual risk**: a maliciously crafted import cannot smuggle credentials
or corrupt other records' shapes, but nothing prevents importing
plausible-looking *nonsense* data (e.g., a portfolio with a technically
valid but fabricated balance) — this is inherent to a local-only import
feature with no source-of-truth to check against, not a defect; the
existing preview-before-apply step (`app/settings/page.tsx`) is the
intended mitigation, giving the user a chance to see what would be
written before it is.

### Corrupted local storage

**Reviewed and mitigated.** Every envelope carries an FNV-1a checksum
(`services/persistence/envelope.ts`'s `computeChecksum`/`verifyChecksum`)
over its payload — an explicitly non-cryptographic corruption/truncation
detector, not a tamper-proof control (documented as such in that file's
own header comment, matching REQ-012's "Fail Secure" philosophy rather
than promising more than local unencrypted browser storage can honestly
provide). A record that fails schema validation or checksum verification
surfaces as `INVALID_PERSISTED_RECORD` through the normal Store error
path, never a raw exception — see `docs/DISASTER_RECOVERY.md`'s own
"Malformed local storage" section for the full user/developer recovery
path, which this review re-confirms is still accurate.

**Finding**: none beyond what `DISASTER_RECOVERY.md` already documents.

### Replay or duplicate sync operations

**Not applicable.** This threat only exists if a synchronization protocol
exists between local storage and a cloud store; Cloud Sync is cancelled
by product decision, so no such protocol exists or will exist.
`services/persistence/types/envelope.ts`'s `'syncMetadata'` record type
has no writer and none is planned. The Synchronization Model (M8-026,
`services/persistence/syncMetadataModel.ts`) that would provide the
idempotency-relevant fields (`recordId`, `lastSyncedAt`) is retained as a
generic domain model, but nothing in this codebase performs the sync
operation this threat describes.

### Accidental overwrite

**Reviewed and mitigated, for the one operation that can cause it today.**
`services/import/apply.ts` enforces `confirmedReplaceAll` server-side, not
only gated in the UI (`if (mergeMode === 'replaceAll' && options.confirmedReplaceAll !== true)`
returns a validation failure, never proceeds silently) and always calls
`createRecoverySnapshot` before a replace-mode apply. `services/persistence/clearLocalData.ts`
(bulk deletion) follows the identical pattern: snapshot first, clear,
re-persist exactly that one snapshot. Both are covered by existing tests
(`tests/unit/services/import/apply.test.ts`, `tests/unit/services/persistence/clearLocalData.test.ts`).

**Finding**: none.

### Unauthorized cloud deletion

**Not applicable.** No cloud deletion exists to be unauthorized, and
none will — no Supabase-backed persistence adapter exists or is planned
(Cloud Database and Cloud Sync are cancelled by product decision).
`app/settings/page.tsx`'s own Clear Local Data copy already states
"ProfitPilot does not yet sync to the cloud"; that copy should be
revisited to reflect that this is now a permanent architectural fact
rather than a not-yet-shipped feature, but the underlying security
property (no cloud data, nothing to delete) already holds.

### Sensitive data leakage

**Reviewed and mitigated**, on two independent fronts:

1. **Field-level (M8-051, this batch)**: `services/shared/sensitiveFields.ts`
   rejects any persisted or imported record containing a field matching a
   canonical list of 22 credential/key/token field names, checked
   recursively including inside the loose nested Engine-result objects
   that would otherwise let one through undetected. Proven end-to-end by
   `tests/unit/services/export/smoke.test.ts`'s "never persisted, never
   reappears in export" test.
2. **Dependency audit**: `pnpm audit` run as part of this review (2026-08-05)
   found 16 known advisories (9 high, 7 moderate, 0 critical), every one in
   build-time or test-time tooling, none in a runtime dependency this
   application's own code imports:
   - `undici` (7 advisories, high/moderate) — transitive via `jsdom`, used
     only inside the Vitest test environment, never shipped to the
     production bundle.
   - `postcss` (3 advisories, high/moderate) and `sharp` (1, high) —
     transitive via `next`'s own build pipeline; run at `pnpm build` time,
     not in the served application.
   - `brace-expansion` (4 advisories, high) — transitive via `eslint`'s
     own dependency tree (`@eslint/eslintrc`, `@typescript-eslint/eslint-plugin`);
     lint-time only.
   - `fast-uri` (1 advisory, high) — transitive via `@sentry/nextjs`'s
     webpack plugin; build-time only.

   No advisory is "critical" severity, and no advisory is reachable from
   application runtime code or user input — all four are pinned by this
   project's direct dependencies' own transitive requirements (`next`,
   `eslint-config-next`, `@sentry/nextjs`, `vitest`'s `jsdom`), not by a
   version this codebase chose directly, so there is no independent
   version bump available without upgrading those major dependencies
   themselves. Documented here per M8-054's own DoD ("Critical findings
   are resolved or explicitly documented before release") — there are no
   critical findings; these high/moderate build/test-tooling findings are
   explicitly documented rather than silently carried. **Follow-up**:
   re-run `pnpm audit` whenever `next`/`eslint-config-next`/`@sentry/nextjs`
   are next upgraded, since each is the most likely path to a fix.

**Finding**: no critical findings; the moderate/high findings above are
build/test-tooling-only and documented, not resolved, per the DoD's own
"resolved or explicitly documented" standard. **This count is now
historical** — advisory counts drift as upstream packages publish new
ones; see §M9-029 below for the current, freshly re-run figure and the
full per-package table, produced this batch specifically because
`06_TASKS.md` M9-029 ("Perform Dependency Security Audit") names a full
dependency re-audit as its own later, dedicated task.

## Summary

Of the seven M8-054 threat categories, four were fully reviewed against
already-built code and found mitigated (malicious imports, corrupted
local storage, accidental overwrite, sensitive data leakage); three
(replay/duplicate sync, unauthorized cloud deletion, and "cross-user
access" below) are not applicable and will remain so — Cloud
Database/Cloud Sync (M8-023/M8-031) are cancelled by product decision,
not merely unbuilt, so there is no future work these three categories
are waiting on.

### Cross-user access

**Not applicable.** There is only one "user" in the sense this threat
means: local browser storage has no concept of another user's data to
leak into. Supabase Authentication (Batch 5, retained as a dormant
capability) issues per-user sessions, but no code in this codebase reads
or writes a Supabase-backed table scoped by user, and none will — Cloud
Database (M8-023, the only thing that would have introduced cross-user
data at all) is cancelled by product decision. Row-Level Security
testing (M8-057) is correspondingly not applicable, not merely deferred:
there is no policy to test.

---

# Milestone 9 Batch 6 — Security Hardening (M9-029–M9-035)

Everything above this line is Milestone 8's own M8-053/M8-054 review,
unchanged except two corrected environment-variable-name references and
one forward-reference note (both marked inline above). Everything below
is new: `06_TASKS.md`'s dedicated Security Hardening batch, auditing (and,
where a genuine gap was found, fixing) the eight areas M9-029–M9-036 name.
M9-036 ("Complete Security Threat Model") is its own document,
`docs/SECURITY_THREAT_MODEL.md`, since its own DoD asks for a threat-model
document distinct from this review.

## M9-029 — Dependency Security Audit

Review: known vulnerabilities, unmaintained packages, unnecessary
packages, transitive risk, license concerns, upgrade requirements. DoD:
"Critical and high-severity dependency vulnerabilities are resolved or
formally mitigated."

**Known vulnerabilities — freshly re-run this batch, not copied from
M8-054 or `docs/DOD_COMPLIANCE_AUDIT.md`.** `pnpm audit` now reports
**18 vulnerability instances (11 high, 7 moderate, 0 critical) across 7
distinct packages** — drift from both prior recorded counts (M8-054's 16;
`docs/DOD_COMPLIANCE_AUDIT.md`'s own Batch 1 re-check, 17), the same
"advisory counts drift as upstream publishes new ones" pattern already
established, not evidence of anything this codebase did. Two packages
appear that neither prior count named:

| Package | Instances | Path | Runtime reachability |
|---|---|---|---|
| `sharp` | 1 high | `.>next>sharp` | Build-time (Next.js image optimization); never shipped |
| `postcss` | 2 high + 2 moderate | `.>next>postcss`, `.>@tailwindcss/postcss>postcss` | Build-time (CSS pipeline); never shipped |
| `brace-expansion` | 4 high | `.>@eslint/eslintrc>minimatch>brace-expansion`, `.>eslint-config-next>@typescript-eslint/eslint-plugin>...` | Lint-time only |
| `undici` | 1 high + 4 moderate | `.>jsdom>undici` | Vitest test environment only; never shipped |
| `fast-uri` | 1 high | `.>@sentry/nextjs>@sentry/webpack-plugin` | Build-time (Sentry's webpack plugin); never shipped |
| `js-yaml` | 1 high (new this batch) | `.>@eslint/eslintrc>js-yaml` | Lint-time only |
| `nanoid` | 1 high (new this batch) | `.>@tailwindcss/postcss>postcss>nanoid` | Build-time (Tailwind's PostCSS pipeline); never shipped |

Every one of the 18 instances is build-time, lint-time, or test-time
tooling — the identical conclusion M8-054 and `docs/DOD_COMPLIANCE_AUDIT.md`
both already reached, re-verified rather than assumed to still hold. None
is reachable from application runtime code shipped to the browser, and
none is "critical" severity. All 7 packages are transitive dependencies
of `next`, `eslint-config-next`, `@sentry/nextjs`, `@tailwindcss/postcss`,
or `vitest`'s own `jsdom` — not a version this codebase chose directly, so
there is no independent version bump available short of upgrading one of
those five direct dependencies. DoD ("resolved or formally mitigated")
satisfied by "formally mitigated": every advisory is real, documented
here with its exact path, and consciously not treated as
production-relevant, per the same reasoning M8-054 already established.
**Follow-up, unchanged from M8-054**: re-run `pnpm audit` whenever
`next`/`eslint-config-next`/`@sentry/nextjs`/`@tailwindcss/postcss`/
`vitest` are next upgraded.

**Unmaintained packages**: no direct dependency in `package.json` shows
signs of abandonment (no multi-year-stale major version, no
deprecation warning surfaced by `pnpm install`/`pnpm audit`) — a direct
scan of `dependencies`/`devDependencies`, not an exhaustive
per-package maintenance-history audit.

**Unnecessary packages**: `@sentry/nextjs` was installed but unwired as
of this batch (M9-029) — no `Sentry.init()` call existed anywhere in
this codebase then (`docs/DOD_COMPLIANCE_AUDIT.md`'s own re-check,
re-confirmed here at the time). Not removed: `SENTRY_DSN` was already a
declared, documented optional environment variable (`utils/env.ts`,
`.env.example`), and wiring `Sentry.init()` behind that variable was
named error-monitoring infrastructure this application intended to use,
not dead weight — removing the package then would have meant re-adding
it later for no benefit. **Update (Milestone 9 Batch 9, M9-049
"Implement Production Error Monitoring"): this is no longer a "not yet
wired" state.** `services/observability/errorMonitoring.ts`,
`instrumentation-client.ts`, and `instrumentation.ts` now call
`Sentry.init()` (conditionally, only when `NEXT_PUBLIC_SENTRY_DSN` is
configured — this sandbox still has none set, so it remains dormant
here the same way Authentication does) — see that batch's own section
below for the full implementation.

**License concerns**: no license-audit tool (`license-checker`,
`pnpm licenses`, or similar) is configured in this repository — a
genuine, real gap, not previously documented. A manual scan of
`package.json`'s `dependencies`/`devDependencies` found no GPL/AGPL-family
license among them (Next.js, React, Zustand, Zod, Tailwind, Radix-derived
utilities, and the testing toolchain are all MIT/Apache-2.0/BSD-licensed,
per their own published `LICENSE` files) — a real but manual, one-time
check, not an automated, repeatable one. **Deferred**: adding a license-
audit tool to the standing `pnpm lint`/`pnpm audit` pipeline is a genuine
improvement outside this batch's own scope (no task in M9-029's Review
list asks for tooling, only "License concerns" as a review item, which
this manual pass satisfies for today).

**Upgrade requirements**: none rise to "required" — every named
vulnerability is transitive, build/lint/test-time-only tooling (above),
so there is no vulnerable package this application's own runtime needs
patched today.

### R2-4 update — production dependency audit, overrides, and ongoing policy

**A narrower, `--prod`-scoped re-run, not a replacement for the audit
above.** M9-029's own 18-instance count above covers the *full*
dependency tree, including dev/lint/test-only tooling (`eslint`,
`jsdom`, etc.) — legitimate for a one-time full review, but too broad
for an ongoing *release* gate, which only needs to know what actually
ships in the built application. `pnpm audit --prod` (production
dependency tree only) is the narrower, repeatable command this section
below establishes as the standing policy.

**Result at the time of this update**: `pnpm audit --prod` reported 9
findings (7 high, 2 moderate) across 5 packages, all transitive through
`next`/`@sentry/nextjs`:

| Package | Path | Reachability |
|---|---|---|
| `postcss` (4 findings) | `.>next>postcss` | Build-time only — processes this repository's own trusted Tailwind/CSS source during `next build`, never attacker-controlled input, never shipped to the browser |
| `nanoid` (1) | `.>next>postcss>nanoid` | Same build-time path as `postcss` above |
| `brace-expansion` (2) | `.>@sentry/nextjs>@sentry/bundler-plugin-core>glob>minimatch>brace-expansion` | Build-time only — Sentry's build-time bundler plugin (source-map/release tooling), which `next.config.ts`'s own `withSentryConfig` call already disables (`sourcemaps: {disable: true}`, `telemetry: false`) |
| `fast-uri` (1) | `.>@sentry/nextjs>@sentry/webpack-plugin>webpack>schema-utils>ajv>fast-uri` | Build-time only — the identical Sentry build-plugin path |
| `sharp` (1) | `.>next>sharp` | **Confirmed unused** — Next.js's own optional image-optimization dependency; a repository-wide search found zero `next/image` usage anywhere in this application |

**Remediation applied**: `package.json`'s `pnpm.overrides` now pins
`postcss>=8.5.23`, `nanoid>=3.3.18`, `brace-expansion>=5.0.9`,
`fast-uri>=3.1.5` — each a same-major-line minor/patch bump for a
narrowly-scoped utility package, not a `next`/`@sentry/nextjs` version
change. Verified, not assumed: `pnpm install` resolves cleanly,
`pnpm audit --prod` afterward reports exactly 1 remaining finding
(`sharp`), and a full `pnpm validate` (typecheck/lint/format/all
3710 unit tests/production build) passes unchanged. This closes 8 of
the 9 findings.

**`sharp` deliberately left un-overridden.** Unlike the four packages
above, `sharp` ships native, platform-specific prebuilt binaries —
overriding its resolved version carries real installation risk across
different CI/deployment platforms (binary availability, ABI
compatibility) that a pure-JS utility package override does not. Given
this application never invokes the one feature (`next/image`) that
would ever load `sharp` at all, that risk is not worth taking for zero
practical security benefit. Tracked as **TRACK / WAIT FOR UPSTREAM** —
revisit if `next` itself bumps its own `sharp` dependency, or if this
application ever adopts `next/image` (at which point reachability
changes and this classification must be revisited).

**Ongoing production dependency-security policy** (the standing answer
to "what known production dependency advisories exist, and why are we
accepting or fixing them?"):

- **Command**: `pnpm audit --prod` — production dependency tree only,
  not the broader dev/lint/test tree M9-029's own one-time audit above
  covered.
- **When to run**: before cutting a release, and whenever `next`,
  `@sentry/nextjs`, `@supabase/supabase-js`, or any other direct
  production dependency in `package.json` is upgraded.
- **Triage**: for each finding, trace the actual dependency path (`pnpm
  why <package>`) and classify — **FIX NOW** (a safe override or direct
  upgrade exists per the preconditions this section's own R2-4 example
  demonstrates), **TRACK / WAIT FOR UPSTREAM** (no safe fix yet, or the
  regression risk outweighs the benefit — `sharp` above), **NOT
  RUNTIME-REACHABLE** (build/lint/test-time-only, confirmed by tracing
  the dependency path, not assumed from the package name), or
  **FALSE/IRRELEVANT FOR CURRENT PRODUCT USAGE** (gates a feature this
  application doesn't use, like `next/image`).
- **What blocks a release**: a finding that is both runtime-reachable
  *and* has no safe override/upgrade available. Nothing in the current
  9-finding (now 1-finding) set meets both conditions.
- **Audit output alone is never sufficient** — every finding above was
  classified by tracing its actual dependency path and asking whether
  attacker-controlled input ever reaches it in this application's own
  runtime, not from its CVSS/severity label alone. A `pnpm audit --prod`
  run with zero findings would not, by itself, prove the application is
  secure; a run with findings does not, by itself, prove it is not.
- **How accepted risk is recorded**: this section, updated in place the
  next time `pnpm audit --prod` is re-run — not a separate tracking
  system, and not a third-party SaaS dependency scanner (none is
  currently used by this repository, and nothing here warrants adding
  one).

## M9-030 — Audit Environment Variable Handling

Check: no secrets committed, no service-role keys exposed, public
variables are intentionally public, missing optional configuration fails
gracefully, production and preview values are separated. DoD: "Client
bundles contain no prohibited secret material."

**No secrets committed**: confirmed — no `.env`/`.env.local` file exists
in this repository (`.gitignore` excludes them; `git status`/`git ls-files`
confirmed neither is tracked); `.env.example` ships only empty values.

**No service-role keys exposed**: `utils/env.ts`'s schema declares no
`SUPABASE_SERVICE_ROLE_KEY` field at all — a service-role key cannot
reach this codebase, let alone the browser, through any path this
application reads environment variables from.

**Public variables are intentionally public**: `NEXT_PUBLIC_APP_NAME`
(display name), `NEXT_PUBLIC_DEFAULT_CURRENCY` (a currency code label),
`NEXT_PUBLIC_PRICE_API_URL` (a price-provider endpoint URL, not a
credential), and — as of Milestone 9 Batch 9 (M9-049, "Implement
Production Error Monitoring") — `NEXT_PUBLIC_SENTRY_DSN` (a write-only
ingestion-endpoint identifier, Sentry's own documented "safe for a
client bundle" token category, the same one Supabase's anon key already
belongs to) are all genuinely non-sensitive. `COINGECKO_API_KEY` remains
deliberately *not* `NEXT_PUBLIC_`-prefixed — a real API credential,
correctly kept server-only, unlike the three tokens above.

**Missing optional configuration fails gracefully**: every field in
`utils/env.ts`'s schema is optional or defaulted (REQ-010 "Manual Mode
functions without backend services") — `loadEnv()` only throws on a
*provided*, malformed value, never on absence.

**Genuine defect found and fixed — `SUPABASE_URL`/`SUPABASE_ANON_KEY`
were not `NEXT_PUBLIC_`-prefixed.** Next.js only inlines
`NEXT_PUBLIC_*`-prefixed variables into the client bundle; every other
`process.env.*` reference reads as `undefined` in the browser.
`services/auth/supabaseClient.ts` is reached from `providers/AuthProvider.tsx`
(a Client Component) and must construct a `SupabaseClient` in the
browser — under the old names, `checkSupabaseConfig()` would report
`configured: false` in every browser context regardless of what a
deployer actually set in production, silently and permanently defeating
the dormant Auth capability even once "configured." This directly
contradicted this same module's own header comment, which already
asserted the anon key is "safe to ship to a browser bundle" (Supabase's
own documented design for that key) — a true claim about the *key*, but
not, until this fix, a true claim about what this codebase actually did
with it. **Fixed**: renamed to `NEXT_PUBLIC_SUPABASE_URL`/
`NEXT_PUBLIC_SUPABASE_ANON_KEY` throughout (`utils/env.ts`,
`services/auth/supabaseClient.ts`, `.env.example`, and every test
referencing the old names) — a mechanical deviation from
`04_BUILD_GUIDE.md`'s own literal (non-prefixed) variable names, recorded
in `PROJECT_STATUS.md`'s "Deviations from a literal reading of the docs"
section. This sandbox has neither variable set either way, so the rename
has zero observable behavior change here — it corrects behavior for a
future real deployment, the only place this defect was ever reachable.

**Client bundles contain no prohibited secret material (DoD)**: true
both before and after this fix, for different reasons — before, because
nothing Supabase-related ever reached the client bundle at all (the bug
this section fixes); after, because only the anon/publishable key
(explicitly designed to be public) does. `COINGECKO_API_KEY` remains
server-only and was never at risk. `SENTRY_DSN` was renamed
`NEXT_PUBLIC_SENTRY_DSN` in Milestone 9 Batch 9 for the identical
"publishable-by-design token" reason the anon key already established
here — see that batch's own M9-049 section below for the full reasoning
and `PROJECT_STATUS.md`'s "Deviations from a literal reading of the
docs" section for the record.

**Production and preview values are separated**: a hosting-platform
concern (e.g. Vercel's per-environment variable scoping), not something
this codebase's own `utils/env.ts` can enforce or observe — recorded as
a deployment-configuration expectation.

## M9-031 — Audit Authentication and Authorization

Verify: session expiration, password reset, sign-out, Row-Level Security,
ownership enforcement, unauthenticated denial, cross-user isolation,
revoked session behavior. DoD: "No user can access or modify another
user's records through tested paths."

**Already exhaustively covered by this document's own M8-053 section
above**: secure token handling, session expiration, sign-out cleanup,
password reset flow, no session data in exports, no authenticated API
access after sign-out. Row-Level Security and cross-user isolation are
correctly **not applicable** (§"Cross-user access" above) — Cloud
Database is cancelled by product decision, so there is no second user's
data anywhere in this local-only application for any of these threats to
apply to. Re-verified this batch, not assumed still accurate:
`tests/unit/stores/authStore.test.ts` still passes in full (part of this
batch's own full validation run), and `services/auth/supabaseClient.ts`'s
own architecture (no direct `@supabase/supabase-js` import outside
`services/auth/`) is unchanged.

**"Unauthenticated denial" and "revoked session behavior" — the two
M9-031 Verify items M8-053 did not separately name.** Both are delegated
entirely to `@supabase/supabase-js`'s own `GoTrueClient`, the same
"reuse an already-audited implementation rather than hand-roll token
rotation" choice `services/auth/supabaseClient.ts`'s own header comment
already documents for session storage generally:

- **Unauthenticated denial**: this application has no protected API
  route or server action of its own to deny access to — every Store
  (`stores/portfolioStore.ts` and siblings) reads/writes only
  `localStorage` via `PersistenceService`, gated by nothing but the
  browser's own same-origin storage isolation. There is no
  authentication-gated resource in this codebase for an unauthenticated
  request to reach, structurally, not by omission.
- **Revoked session behavior**: `stores/authStore.ts`'s `initialize()`
  subscribes once to `authService.onAuthStateChange`, and reacts to
  whatever event `GoTrueClient` reports — a `SIGNED_OUT` event (which
  `GoTrueClient` fires on a revoked/expired session it detects, the same
  event it fires for an explicit sign-out) drives `authStore` to
  `{ user: null, status: 'unauthenticated' }` through the identical
  code path `describe('signOut', ...)` in `authStore.test.ts` already
  exercises — there is no separate "revoked" code path to independently
  test, by construction, since this application never distinguishes the
  two.

**No user can access or modify another user's records through tested
paths (DoD)**: satisfied vacuously but honestly — there is exactly one
"user" any code path in this application can ever act on (local browser
storage), so there is no second user's records to access or modify.

## M9-032 — Audit Import Security

Test: oversized files, deeply nested data, unexpected fields, script-like
text, unsupported versions, duplicate identifiers, invalid numeric
values, corrupted checksums. DoD: "Unsafe imports are rejected without
changing application data."

| Test item | Status before this batch | Status after |
|---|---|---|
| Unexpected fields | Already covered — `validatePersistedRecord`'s schema layer (`services/persistence/schemas/`) | Unchanged |
| Unsupported versions | Already covered, tested (`ImportValidator.test.ts`'s own `UNSUPPORTED_SCHEMA_VERSION` test, M8-059) | Unchanged |
| Duplicate identifiers | Already covered, tested (`DUPLICATE_RECORD_ID`) | Unchanged |
| Invalid numeric values | Already covered — Zod schema `.finite()`/type checks reject them | Unchanged |
| Script-like text | Already safe structurally — React's default JSX escaping means no `dangerouslySetInnerHTML` exists anywhere in this codebase (confirmed by repo-wide search) for a script-shaped name/description to ever execute | Unchanged |
| **Oversized files** | **Genuine gap — no size limit existed anywhere on the import path** | **Fixed**: `ImportValidator.ts`'s own `MAX_IMPORT_FILE_SIZE_BYTES` (25 MB) rejects an oversized file before `JSON.parse` ever runs |
| **Deeply nested data** | **Genuine gap — `findSensitiveField` recursed with no depth bound, an uncaught-`RangeError` risk, not a graceful rejection** | **Fixed**: `services/shared/payloadLimits.ts`'s `exceedsMaxNestingDepth` (self-bounding recursion, 50-level ceiling) checked before `findSensitiveField` runs |
| **Corrupted checksums** | **Genuine gap — `verifyChecksum` (`envelope.ts`, M8-003) existed and was unit-tested in isolation, but had zero production callers** | **Fixed**: wired into `validatePersistedRecordSchema`, the same chokepoint the M8-051 sensitive-field check already uses; verified against the raw, pre-schema-parse payload specifically (a second bug found while wiring this in — see `validate.ts`'s own header comment for why verifying against the post-Zod-strip payload would have spuriously rejected legitimate records) |

All three genuine gaps found this batch — oversized files, deeply nested
data, corrupted checksums — are exercised end-to-end through
`validateImportFile` (not just their own isolated units) in
`tests/unit/services/import/ImportValidator.test.ts`, plus dedicated unit
tests for each new function
(`tests/unit/services/shared/payloadLimits.test.ts`,
`tests/unit/services/persistence/validate.test.ts`'s new describe blocks).

## M9-033 — Audit Export Privacy

Verify exported files exclude: authentication tokens, session metadata,
provider secrets, private keys, seed phrases, internal authorization
fields, unnecessary personal data. DoD: "Exported data contains only
documented user-owned application records and metadata."

**Already covered, re-verified**: `services/export/JsonExporter.ts`'s
own structural exclusion (no session-shaped record type exists in
`PersistedRecordType`) and `tests/unit/services/export/smoke.test.ts`'s
end-to-end "never persisted, never reappears in export" test (M8-051) —
both re-confirmed passing this batch, unchanged.

**Genuine gap found and closed — CSV export had zero dedicated privacy
test, unlike JSON.** `services/export/CsvExporter.ts`'s own `build*Csv`
functions only ever read a fixed, named set of fields from each record
(never a raw dump of a record's loose `result`/`settings` object), so a
smuggled sensitive field structurally cannot reach CSV output even in
the hypothetical case one existed in source data — but nothing proved
this before this batch. **Fixed** (test-only, no production code
change was needed — the existing design was already correct):
`tests/unit/services/export/CsvExporter.test.ts`'s new "never includes
an arbitrary field from the loose result object, even one shaped like a
credential" test constructs a loop strategy record with a
`result.wallet.privateKey`/`seedPhrase` and proves neither the field
name nor its value ever appears in the generated CSV.

## M9-034 — Perform Input and Output Sanitization Review

Check: portfolio names, descriptions, strategy names, scenario names,
error messages, export filenames, rendered imported content. DoD:
"User-controlled content cannot produce executable or unsafe rendered
output."

| Surface | Sanitization |
|---|---|
| Portfolio names/descriptions | `utils/sanitizeText.ts` via `types/portfolio.schema.ts` |
| Strategy/exit-plan/simulation ("scenario") names+descriptions | `utils/sanitizeText.ts` via `services/persistence/schemas/strategy.schema.ts` |
| Error messages | `ApplicationError.message` is always an authored, static string (`services/shared/errors.ts`'s own DoD) — never a raw exception/stack trace interpolated verbatim |
| Export filenames | `services/export/filenames.ts`'s own independent `sanitizeNameSegment` (strips non-alphanumeric characters) |
| Rendered imported content | React's default JSX escaping — no `dangerouslySetInnerHTML` exists anywhere in this codebase (repo-wide search, re-confirmed this batch) |

**Genuine gap found and fixed — CSV formula/injection (CWE-1236).** A
user-controlled `Name` field (portfolio/strategy/scenario/exit-plan)
beginning with `=`, `+`, `-`, `@`, tab, or carriage return could be
interpreted as a formula by Excel/Sheets when the exported CSV is later
opened — not "executable" in the sense of running inside this
application, but exactly the "unsafe rendered output" this task's own
DoD names, produced by a different renderer (the spreadsheet
application) than the one this review's other rows already cover.
**Fixed**: `services/export/CsvExporter.ts`'s `csvLine` now prefixes any
genuinely string-typed field beginning with one of those characters with
a leading `'`, the standard CSV-injection mitigation — applied only to
string-typed fields, checked before `String(field)` stringification, so
a legitimate negative number (e.g. a debt balance of `-500`) is never
touched. Regression tests in `tests/unit/services/export/CsvExporter.test.ts`
cover the injection case, the safe-negative-number case, and every
trigger character.

## M9-035 — Review Security Headers and Deployment Controls

Review: Content Security Policy where practical, frame restrictions,
content type protections, referrer policy, HTTPS enforcement, secure
cookies, preview deployment access where appropriate. DoD: "Production
responses include approved security protections without breaking
required functionality."

**Genuine, full gap — confirmed empty before this batch.** No
`headers()` function in `next.config.ts` (which was an empty `{}`), no
`middleware.ts` anywhere in this repository —
`docs/DOD_COMPLIANCE_AUDIT.md`'s own finding, re-confirmed true at the
start of this batch before writing anything.

**Fixed** — see `next.config.ts`'s own extensive header comment for the
full reasoning behind every choice below:

| Control | Implementation |
|---|---|
| Content Security Policy | `default-src 'self'`; `script-src`/`style-src` allow `'unsafe-inline'` (Next.js's own inline hydration scripts and Tailwind's runtime styles require it short of a larger nonce-based `middleware.ts` change); `connect-src` built dynamically from this app's own two optional external origins (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_PRICE_API_URL`) rather than a hardcoded guess; `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'` |
| Frame restrictions | `X-Frame-Options: DENY` (and `frame-ancestors 'none'` in the CSP itself, belt-and-suspenders) |
| Content type protections | `X-Content-Type-Options: nosniff` |
| Referrer policy | `Referrer-Policy: strict-origin-when-cross-origin` |
| HTTPS enforcement | `Strict-Transport-Security: max-age=63072000; includeSubDomains` — the client-reinforcement half; the actual HTTP→HTTPS redirect is delegated to hosting configuration (this application has no server runtime of its own to add a redirect to). Deliberately no `preload` directive — see `next.config.ts`'s own header comment for why defaulting a self-hostable application onto the largely-irreversible browser HSTS preload list is a per-deployment decision, not something this codebase should presume on every future deployer's behalf. |
| Secure cookies | **Not applicable** — no header here sets a cookie, because this application's own code never sets one; `GoTrueClient` persists to `localStorage`, not a cookie |
| Preview deployment access | A hosting-platform concern (e.g. a password-protected preview URL) — recorded as a deployment recommendation, not expressible in `next.config.ts` |
| Permissions Policy | **R2-3** ("Add Minimal Permissions-Policy Browser Hardening") — `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()`, a deny-list built from a repository-wide search confirming zero production-code use of any of the eight capabilities, not a generic template. `clipboard-*`/`fullscreen` deliberately left ungated — see `next.config.ts`'s own header comment. |

**Verified working, not just configured**: `pnpm build` succeeds with
the new `headers()` function (confirmed present in the build's own
`routes-manifest.json`); a real `next start` server was launched in this
environment and `curl`'d directly, returning all six headers exactly as
configured (`Permissions-Policy` re-verified the same way by R2-3); a
real headless-Chromium page load against that running server rendered
the Dashboard successfully with zero console/page errors — the CSP does
not break this application's own runtime. `tests/unit/next.config.test.ts`
(13 tests as of R2-3) locks in the header set, the dynamic `connect-src`
behavior for both the unconfigured (this environment's real state) and a
hypothetically-configured-Supabase case, and the `Permissions-Policy`
value itself.