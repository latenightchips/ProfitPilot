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
| HTTPS only | Not this application's concern to enforce — delegated to hosting/deployment configuration; `SUPABASE_URL` itself is Supabase's own HTTPS endpoint. |
| Environment variables secured | `utils/env.ts` reads `SUPABASE_URL`/`SUPABASE_ANON_KEY` only from `process.env`; no default/fallback value is hardcoded. |
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
"resolved or explicitly documented" standard.

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