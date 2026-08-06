# Cloud Readiness Report (SUPERSEDED)

> **Superseded — archived, not active guidance.** Milestone 8 was
> re-scoped to local-only persistence by product decision: Supabase,
> Cloud Database, Cloud Synchronization, and Row-Level Security testing
> are all cancelled and will not be built. See
> `docs/MILESTONE_8_SCOPE_CHANGE.md` for the scope-change decision and
> `docs/DISASTER_RECOVERY.md`/`docs/SECURITY_REVIEW.md` for the
> corresponding documentation updates. Everything below this notice is
> retained only as a historical record of the planning work done before
> that decision — none of it describes anything this codebase will
> implement.

Prepared per your instruction: re-evaluate the Milestone 8 tasks that depend
on external (Supabase) infrastructure, determine exactly what completing
them requires, and produce a readiness report — without writing production
code or beginning Cloud Database/Cloud Synchronization implementation. This
document is planning and analysis only; every SQL/TypeScript fragment below
is illustrative (for review), not a file committed to the working tree.

**Status: approved as a planning artifact.** Not yet committed — held
uncommitted until a real Supabase project or local Supabase stack exists,
at which point Batch 8 (M8-022–M8-025) begins using this report as its
implementation blueprint.

## 1. Remaining task mapping

Milestone 8 has 62 tasks. 46 are complete (Persistence Foundation, Local
Storage, Authentication, Import/Export, Backup and Recovery, Privacy and
Security, and the infrastructure-independent third of Quality and Testing).
16 remain, and every one of them depends on Supabase infrastructure this
sandbox does not have, either directly or transitively:

| Task | Title | Direct dependency on unbuilt work | Requires real Supabase to implement/test |
|---|---|---|---|
| M8-022 | Create Supabase Database Schema | M8-002 ✓, M8-014 ✓ | Yes — a project to run DDL against |
| M8-023 | Implement Row-Level Security | M8-022 | Yes — policies only mean something against real tables |
| M8-024 | Generate and Validate Database Types | M8-022 | Yes — `supabase gen types` reads a live schema |
| M8-025 | Implement Supabase Persistence Adapter | M8-022, M8-023, M8-024 | Yes to *test* against real RLS; the adapter code itself is written against the `PersistenceAdapter` interface and doesn't strictly need a live project to *compile* |
| M8-026 | Create Synchronization Model | M8-003 ✓, M8-025 | No live project needed — pure type/metadata design |
| M8-027 | Implement First Sign-In Data Merge | M8-008 ✓, M8-009 ✓, M8-025, M8-026 | Yes — needs a real cloud round trip to test merge states |
| M8-028 | Implement Cloud Upload | M8-027 | Yes |
| M8-029 | Implement Cloud Download | M8-027 | Yes |
| M8-030 | Implement Incremental Synchronization | M8-028, M8-029 | Yes |
| M8-031 | Implement Conflict Detection | M8-026, M8-030 | Yes |
| M8-032 | Implement Conflict Resolution UI | M8-031 | Partially — UI can be built against a fake sync Service, but real conflict scenarios need a live backend to validate |
| M8-033 | Implement Offline Synchronization Queue | M8-030 | Yes |
| M8-034 | Implement Synchronization Status | M8-030, M8-033 | Partially — UI states can be built against a fake, but real transitions need live sync |
| M8-035 | Implement Manual Synchronization | M8-034 | Yes |
| M8-057 | Create Row-Level Security Tests | M8-023 | Yes — the entire point is testing real policies |
| M8-058 | Create Synchronization Tests | M8-035 | Yes |
| M8-060 | Create Offline End-to-End Tests | M8-033, M8-055 ✓ | Yes (three of its six flows are pure offline-local and already covered by M8-055's own tests; "Queue cloud changes / Reconnect / Synchronize successfully" need M8-033) |
| M8-061 | Create Persistence End-to-End Tests | M8-056 ✓, M8-058, M8-059 ✓ | Yes — several of its seven flows are local-only and already provable, but "Sign up with existing local data," "Merge local and cloud records," "Edit on two simulated clients and resolve conflict" need a live backend |
| M8-062 | Validate Persistence Against Build Guide | M8-061 | Yes — the audit itself can't honestly claim cloud items pass until M8-061 does |

**16 tasks remain, all blocked on the same root cause**: no Supabase
project, CLI, or reachable local emulator exists in this sandbox (verified
originally in Batch 5 — `services/auth/supabaseClient.ts`'s own header
comment — and still true; `supabase/` in this repo is still the empty
placeholder directory it was then).

## 2. Dependency graph

```
M8-022 (schema) ─┬─> M8-023 (RLS) ──────────────┬─> M8-025 (adapter) ─┬─> M8-026 (sync model) ─> M8-027 (first sign-in merge) ─┬─> M8-028 (upload) ─┬─> M8-030 (incremental sync) ─┬─> M8-031 (conflict detection) ─> M8-032 (conflict UI)
                  │                              │                    │                                                       │                     │                                ├─> M8-033 (offline queue) ─┬─> M8-034 (sync status) ─> M8-035 (manual sync)
                  └─> M8-024 (generated types) ──┘                    │                                                       └─> M8-029 (download) ──┘                              │                            │
                                                                       │                                                                                                                └────────────────────────────┘
                                                                       │
   M8-023 ──────────────────────────────────────────────────────────┴─> M8-057 (RLS tests)

   M8-035 ─> M8-058 (sync tests)
   M8-033 + M8-055(done) ─> M8-060 (offline e2e)
   M8-056(done) + M8-058 + M8-059(done) ─> M8-061 (persistence e2e)
   M8-061 ─> M8-062 (final Build Guide audit)
```

Three tasks — M8-022, M8-023, M8-024 — form the critical path everything
else funnels through. M8-025 (the adapter) is the single chokepoint between
"database exists" and every synchronization feature. Everything from
M8-026 onward is strictly serial to M8-035, with M8-032/M8-034's UI shells
as the only two tasks that can start slightly ahead of their full backend
(see §3).

## 3. Implementation order

A batch-by-batch order that respects every dependency above, sized the
same way this engagement has sized every prior Milestone 8 batch:

1. **Batch 8 — Cloud Database** (M8-022, M8-023, M8-024, M8-025). Cannot
   start without a real Supabase project (§4). This is the one batch
   where "implement" and "get credentials" are the same blocking event —
   there is no useful local-only subset beyond what §9 below describes.
2. **Batch 9 — Synchronization Model & First-Sync Merge** (M8-026, M8-027).
   M8-026 is pure type/metadata design and could be drafted before Batch 8
   finishes (see §9); M8-027 needs the real adapter.
3. **Batch 10 — Upload/Download/Incremental Sync** (M8-028, M8-029,
   M8-030). The core bidirectional sync engine.
4. **Batch 11 — Conflict Handling** (M8-031, M8-032). Detection first,
   then the UI that lets a user act on it.
5. **Batch 12 — Offline Queue & Sync Status** (M8-033, M8-034, M8-035).
   M8-034's UI states can be scaffolded against a hand-written fake sync
   Service slightly ahead of M8-033 finishing, the same
   "Store/UI built against a fake, Service wired to the real thing last"
   pattern this engagement used for Authentication (Batch 5).
6. **Batch 13 — Cloud-Dependent Testing** (M8-057, M8-058). Written
   immediately after the feature batch each depends on, not deferred to
   the end — matching how M8-055/M8-056/M8-059 were written directly
   after their own dependencies in Batch 7, not held back.
7. **Batch 14 — End-to-End & Final Audit** (M8-060, M8-061, M8-062). Last,
   since M8-061 is the union of nearly everything above.

This is 7 batches, comparable in count to the 7 already completed for the
local-only two-thirds of Milestone 8.

## 4. Required Supabase configuration

### 4.1 Project

One Supabase project is required at minimum for real development/testing;
a second (see §6) is recommended before production traffic exists. Free
tier is sufficient for all of Version 1's stated scope — no Storage
buckets, no Edge Functions, no paid add-on is implied by any task text
below.

### 4.2 Database schema

`PERSISTED_RECORD_TYPES` (`services/persistence/types/envelope.ts`)
already enumerates exactly what needs a cloud home: `portfolio`,
`loopStrategy`, `exitPlan`, `simulation`, `recommendationAcknowledgements`,
`preferences`, `syncMetadata`, `applicationMetadata`, `activePortfolio`,
`recoverySnapshot`. M8-022's own "Suggested tables" (Profiles, Portfolios,
Simulations, Loop strategies, Exit plans, User preferences, Sync metadata)
is a subset of this — not a contradiction, since it's explicitly
"suggested," but M8-022 needs to decide the remaining three explicitly
rather than by omission:

- `recommendationAcknowledgements` and `activePortfolio` are small,
  clearly belong in the cloud schema (both are genuine per-user state).
- **Decided (approved): `applicationMetadata` and `recoverySnapshot` are
  local-only, not synchronized to the cloud, unless a documented
  Milestone 8 requirement explicitly requires it.** Neither M8-022's own
  "Suggested tables" nor any other Milestone 8 task text names either as
  something that must sync — `applicationMetadata` is bootstrap/install
  bookkeeping meaningful only to a single local install, and
  `recoverySnapshot` is this application's own local safety net,
  deliberately excluded from JSON export too (`envelope.ts`'s own header
  comment). Neither gets a cloud table in M8-022. If a later, real task
  text is found that requires otherwise, revisit explicitly rather than
  defaulting back silently.

Illustrative shape (for review only — not a migration file), following
M8-022's own Requirements ("stable UUIDs," "ownership fields," "schema
versions," "created/updated timestamps") and mirroring
`StorageEnvelope<T>`'s existing field set so the adapter's mapping stays a
straight translation rather than a redesign:

```sql
-- Illustrative only — one representative table; the rest of the eight
-- synced record types (everything in PERSISTED_RECORD_TYPES except
-- applicationMetadata and recoverySnapshot, per the decision above)
-- follow the identical shape.
create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,           -- matches StorageEnvelope.recordId (the app's own stable local ID)
  storage_schema_version text not null,
  app_version text not null,
  payload jsonb not null,
  checksum text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, record_id)
);
create index on public.portfolios (user_id);
```

Every one of the eight synced record types follows this same
`(id, user_id, record_id, storage_schema_version, app_version, payload
jsonb, checksum, created_at, updated_at)` shape — `payload` stores exactly
what `StorageEnvelope<T>.payload` already validates client-side via
`services/persistence/schemas/`, so the database is not re-specifying
field-level shape, only adding ownership and a stable row identity. This
mirrors 04_BUILD_GUIDE.md's "Response Validation" principle (validate
before mapping into application models, never trust a table's shape
blindly) and directly serves M8-024's own Requirement.

**Decided (M8-026, "Create Synchronization Model," now implemented as
local-only preparation work — `services/persistence/types/models.ts`'s
`PersistedSyncMetadata`)**: `syncMetadata` gets its own table, not columns
bolted onto every synced table. The local storage model already keeps
`'syncMetadata'` as its own `PersistedRecordType`, separate from
`'portfolio'`/`'loopStrategy'`/etc., composite-keyed by
`(recordType, recordId)` back to the record it describes — the cloud
schema mirrors that 1:1 so the future adapter's mapping (M8-025) stays a
straight translation, the same reasoning this section already gives for
every other table. Illustrative shape (for review only):

```sql
-- Illustrative only — one row per (user, recordType, recordId), tracking
-- sync state for a record in one of the eight tables above without
-- widening every one of those tables with sync-only columns.
create table public.sync_metadata (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null,
  record_id text not null,
  local_updated_at timestamptz not null,
  cloud_updated_at timestamptz,
  last_synced_at timestamptz,
  sync_status text not null,       -- 'synced' | 'pendingUpload' | 'pendingDownload' | 'conflict' | 'error'
  origin_device_id text not null,
  deletion_marker timestamptz,
  conflict_status text not null,   -- 'none' | 'detected' | 'resolved'
  unique (user_id, record_type, record_id)
);
create index on public.sync_metadata (user_id);
```

The deterministic conflict rule this table's `sync_status`/`conflict_status`
columns exist to support — "a conflict exists exactly when both the local
and cloud copies changed since the last successful sync" — is implemented
today as pure, fully-tested TypeScript transition functions
(`services/persistence/syncMetadataModel.ts`: `createSyncMetadata`,
`markLocalChange`, `markLocalDeletion`, `markCloudChange`, `markSynced`,
`markSyncFailed`, `resolveConflict`), ready for M8-027 onward to call
with real data once a cloud adapter exists to supply it.

### 4.3 Row-Level Security policies

04_BUILD_GUIDE.md's "SUPABASE SECURITY" section states this exactly:
"Every user-owned table must include `user_id`... Authenticated users may
access only rows where `auth.uid() = user_id`... Never rely only on
frontend filtering." Illustrative policy set per table (for review only):

```sql
alter table public.portfolios enable row level security;

create policy "select own portfolios"
  on public.portfolios for select
  using (auth.uid() = user_id);

create policy "insert own portfolios"
  on public.portfolios for insert
  with check (auth.uid() = user_id);

create policy "update own portfolios"
  on public.portfolios for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own portfolios"
  on public.portfolios for delete
  using (auth.uid() = user_id);
```

No `select`/`insert`/`update`/`delete` policy exists for unauthenticated
(`anon`) access on any of these tables — RLS defaults to deny, so
"Unauthenticated access is denied" (M8-023's own Requirement) is the
default outcome of simply not writing an `anon`-role policy, not
something that needs separate enforcement code.

### 4.4 Authentication requirements

Already fully satisfied by Batch 5 — `services/auth/` implements sign-up,
sign-in, sign-out, session refresh, and password reset entirely through
Supabase's own `GoTrueClient`, behind the Service boundary, with
`authStore` independent from every feature Store. Nothing new is required
here for Cloud Database/Sync to build on top of; M8-022 onward simply
consumes `auth.uid()` (server-side, via RLS) and `useAuthStore`'s existing
`user`/`cloudSyncEligible` state (client-side, to decide when to attempt a
cloud operation at all).

### 4.5 Storage buckets

None required. No task in Milestone 8 (Cloud Database, Cloud
Synchronization, or otherwise) names a file/blob artifact — every synced
entity is JSON-shaped application data that belongs in a `jsonb` column,
not object storage. 04_BUILD_GUIDE.md's own Technology Stack and Security
Principles never mention Supabase Storage. Revisit only if a future
version introduces actual file attachments.

### 4.6 Environment variables

`utils/env.ts` and `.env.example` already declare `SUPABASE_URL`/
`SUPABASE_ANON_KEY` — no new *client-facing* variable is needed; the
existing anon key is sufficient for every RLS-protected client operation
Cloud Database/Sync will perform. One likely **server-only, CI/tooling**
addition, never bundled to the browser:

```text
# --- Supabase (server-only; migrations/CI, never in the browser bundle) -----
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_REF=
SUPABASE_ACCESS_TOKEN=
```

`SUPABASE_SERVICE_ROLE_KEY` would only ever be read by a CI migration
step or `supabase db push`/`gen types` tooling run in a trusted
environment — never added to `utils/env.ts`'s schema (which is validated
and read by client-and-server-shared code) or referenced from
`services/auth/supabaseClient.ts`. This matches the existing, explicit
"no service-role key anywhere in this codebase" guarantee
(`supabaseClient.ts`'s own header comment) — that guarantee is about the
browser bundle, and stays true; a service-role key used only by a CI job
never touches it.

### 4.7 Migrations

Supabase CLI's own migration model (`supabase/migrations/*.sql`,
timestamp-ordered, applied via `supabase db push` or CI) is the natural
fit — `supabase/` in this repo is already reserved (currently an empty
placeholder) for exactly this. Each of M8-022's tables plus its M8-023
policies belongs in one migration per logical change, not one giant file,
so that schema history stays reviewable the same way this engagement's
own git history stays one-batch-per-commit.

## 5. Local-development strategy

Two real options, plus this sandbox's own constraint:

1. **Supabase CLI + local Docker stack** (`supabase start`) — the
   standard approach for iterating on schema/RLS without touching a
   shared project. Requires Docker. **Not available in this specific
   sandbox** (verified in Batch 5: no reachable Docker daemon) — but this
   is a sandbox constraint, not a codebase one; a normal development
   machine or CI runner with Docker available can use this path directly
   once credentials/tooling exist.
2. **A real, dedicated development Supabase project** (free tier) — the
   fallback when a local Docker stack isn't available (this sandbox,
   certain CI runners). Slower iteration (real network round trips) but
   requires nothing beyond `SUPABASE_URL`/`SUPABASE_ANON_KEY` in
   `.env.local`, which this codebase already knows how to read.
3. **This sandbox today**: neither is available (no Docker, no project).
   Everything in §9 below is scoped to what's buildable without either.

Recommendation once credentials exist: development Supabase project
first (fastest to unblock M8-022–025), local Docker stack adopted
afterward if iteration speed on RLS policy changes becomes a bottleneck —
consistent with this engagement's own "don't build tooling ahead of a
demonstrated need" discipline.

## 6. Testing strategy

Extending the fakes-first discipline already established for
Authentication (Batch 5) and every Service in this codebase
(`createPersistenceService(adapter)`, `createAuthService(client)`):

- **Unit tests** (M8-057, M8-058, and the cloud-touching parts of
  M8-025–M8-035): a hand-written fake satisfying the same narrow
  structural interface the real Supabase client would (the same pattern
  `AuthClient` in `services/auth/authService.ts` already established for
  auth — a fake far smaller than the full `SupabaseClient` surface). This
  is how the *logic* of upload/download/merge/conflict-detection gets
  proven without a network call, the same way `authService.test.ts`
  proves sign-in/sign-out logic today.
- **RLS tests** (M8-057) are the one category that is **structurally
  incapable of being faked** — the entire point is verifying Postgres
  itself denies cross-user access, which no in-memory fake can stand in
  for. These require a real project (dev or CI-provisioned) with two real
  test user accounts and real rows, run either via Supabase's own
  `pgTAP`-based policy testing or integration tests hitting the real REST
  API with two distinct authenticated sessions.
- **Integration/E2E tests** (M8-060, M8-061) similarly require a real
  project — Playwright driving the actual app against real sign-in and
  real sync round trips, not a mocked network layer, since "Reconnect,"
  "Synchronize successfully," and "Merge local and cloud records" are
  claims about real cross-boundary behavior a fake cannot honestly prove.
- **A dedicated test/CI Supabase project**, separate from development,
  is recommended before M8-057 starts — RLS and sync tests should run
  against disposable data, ideally reset between runs (Supabase CLI's
  `supabase db reset` against a project seeded from the migrations in
  §4.7), never against real user data or even real development data.

This mirrors exactly what this batch's own instructions already asked for
in the abstract ("Clearly identify which functionality can be fully
implemented locally and which requires external Supabase infrastructure")
— the split is real, not just administrative: business logic is
fake-testable, ownership enforcement and real network behavior are not.

## 7. Deployment considerations

- **RLS must ship enabled from the first migration**, not added after
  tables go live — 04_BUILD_GUIDE.md's "Never rely only on frontend
  filtering" is a standing requirement, not a hardening pass to schedule
  later.
- **Migrations belong in CI**, applied via `supabase db push` (or
  equivalent) against the production project on merge to the default
  branch, using `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_REF` (§4.6) as
  CI-only secrets — never a developer's local credentials.
- **Generated types (M8-024) must be regenerated and committed whenever
  the schema changes**, and CI should fail if committed types drift from
  the live schema (a `supabase gen types` diff check), so "avoid
  handwritten assumptions about table shapes" (M8-024's own Requirement)
  stays true over time, not just at the moment M8-024 is first done.
- **Anonymous/manual mode must keep working through every step of this
  rollout** — every task above builds strictly on top of the existing
  `PersistenceAdapter`/`AuthClient` boundaries specifically so that
  shipping Cloud Database/Sync to production is additive: a user who
  never signs in is unaffected, the same "no Supabase configuration
  present → clean fallback" behavior already proven for Authentication
  (Batch 5) and Persistence (`local-storage.adapter.ts`'s own
  `checkAvailability`).
- **Staged rollout**: nothing in Milestone 8's task text requires Cloud
  Sync to launch to all users simultaneously — a feature flag or
  percentage rollout is a reasonable deployment-time decision once
  M8-035 is done, though no task currently names one explicitly; flagging
  it here as a deployment-time option, not a new requirement.

## 8. Security checklist (cloud-specific, extending `docs/SECURITY_REVIEW.md`)

`docs/SECURITY_REVIEW.md` (M8-053/M8-054) already reviewed everything
buildable without cloud infrastructure and explicitly flagged what it
could not yet check. This is that checklist, made concrete now that the
implementation shape is known:

- [ ] Every user-owned table has RLS enabled **before** it accepts any
      write (§4.3) — verified by attempting an unauthenticated request
      against a freshly created table before its first policy is added,
      not assumed from policy code review alone.
- [ ] Every RLS policy uses `auth.uid() = user_id`, never a
      client-supplied user ID column trusted without that check.
- [ ] No `service_role` key reachable from any client bundle — verified
      the same way `supabaseClient.test.ts` already verifies "no
      service-role key anywhere in this codebase" today, extended to
      confirm no new file introduces one.
- [ ] `findSensitiveField` (`services/shared/sensitiveFields.ts`, M8-051)
      is reused, not reimplemented, for any payload written to a cloud
      table — the same choke point (`validatePersistedRecordSchema`)
      already sits between every local write and the database; the cloud
      adapter must call through it too, not bypass it for a "trusted"
      cloud path.
- [ ] Generated database types (M8-024) are validated against, never
      trusted as, the actual response — 04_BUILD_GUIDE.md's "Response
      Validation" principle applied to Supabase responses specifically,
      the same discipline already applied to every external price/protocol
      provider (`services/market/`, `services/protocol/`).
- [ ] Sync/conflict logic never silently discards data — M8-027's own
      Requirement ("Never overwrite data automatically when both sources
      contain meaningful records") and M8-031's ("Conflicts are never
      resolved silently when user data could be lost") checked against
      the actual merge/conflict implementation, not just the UI copy.
- [ ] A recovery snapshot (existing M8-046 mechanism, already built) is
      taken before any destructive sync resolution — M8-029's own
      Requirement ("Keep a local recovery backup") and M8-032's
      ("Create a recovery copy before resolution") both point at reusing
      `services/persistence/recoverySnapshot.ts` rather than inventing a
      second snapshot mechanism. Note this is the *mechanism* being
      reused for cloud-triggered snapshots — the recovery snapshot record
      type itself stays local-only per §4.2's decision; only its
      trigger sites expand.
- [ ] `pnpm audit` re-run once `@supabase/supabase-js`'s realtime/postgrest
      sub-dependencies are actually exercised at runtime (today they're
      imported but unused, since no adapter calls them yet) — the
      `docs/SECURITY_REVIEW.md` audit only covered what's reachable today.

## 9. What can be prepared before credentials exist

Concretely, without a Supabase project, CLI, or Docker:

- **M8-026 (Synchronization Model) — done.** Implemented as the "Local-only
  Cloud Preparation" batch this section anticipated:
  `services/persistence/types/models.ts`'s extended `PersistedSyncMetadata`
  (all eight fields), `services/persistence/schemas/metadata.schema.ts`'s
  matching Zod validation, and `services/persistence/syncMetadataModel.ts`'s
  pure, fully-tested deterministic conflict-detection transition functions
  (`createSyncMetadata`, `markLocalChange`, `markLocalDeletion`,
  `markCloudChange`, `markSynced`, `markSyncFailed`, `resolveConflict`).
  Also delivered alongside it: `utils/deviceId.ts` (a pure device-ID
  generator — persistence/lifecycle of a *stable* device ID is still
  deferred to M8-027/M8-033, see that file's own header comment) and
  `tests/fixtures/fakeSupabaseDatabase.ts` (a narrow, self-tested fake of
  Supabase's row-level table operations, for M8-025's and M8-027+'s future
  tests — explicitly not a substitute for M8-057's real RLS verification).
  §4.2 above now reflects the resolved schema design this work settled
  (`sync_metadata` as its own table, mirroring the local model 1:1).
- **The illustrative schema and RLS policies in §4.2/§4.3** can be
  refined into real migration-file drafts (still just files in this
  repo, not applied anywhere) once you're ready — but writing them as
  actual `supabase/migrations/*.sql` files felt like crossing from
  "readiness report" into "beginning M8-022," so I stopped at the
  illustrative-code-block stage in this document and left the real files
  for you to authorize explicitly.
- **The `PersistenceAdapter` interface itself needs no changes** —
  confirmed by re-reading `services/persistence/types/adapter.ts`: it was
  already written generically enough (`MappingResult<T>`, async
  throughout) to serve a real network-backed Supabase adapter without
  modification. M8-025's adapter is new code that *implements* this
  existing interface, not a change to it.
- **A fake Supabase client for unit tests — done** (see the M8-026 bullet
  above): `tests/fixtures/fakeSupabaseDatabase.ts`, a narrow, self-tested
  fake modeling the row-level table operations a future adapter will
  call, with in-memory ownership scoping standing in for what real RLS
  would enforce.
- **`.env.example`'s Supabase section** could be extended now with the
  server-only variables from §4.6, documented as not-yet-used — a
  one-line, non-functional documentation change, listed here rather than
  made unilaterally since even that is a repo change outside this
  report.

Everything else in §1's table has a hard dependency on a real project
existing and is not preparable further without one.

## Summary

15 tasks remain in Milestone 8. M8-026 (Synchronization Model) is now
complete as local-only preparation work — see the §9 update above. The
other 15 are all downstream of Cloud Database (M8-022–025) and require a
real Supabase project or network access this sandbox does not have (see
the Batch 8 attempt log below). The critical path is short (schema → RLS
→ types → adapter), everything after it is strictly serial through Cloud
Synchronization, and the two testing tasks (M8-057, M8-058) plus the
final audit (M8-062) close out the milestone once the corresponding
feature work lands. Nothing here requires new architecture —
`PersistenceAdapter`, `AuthClient`, and the existing sensitive-field/
sanitization/recovery-snapshot mechanisms were all built generically
enough in prior batches to extend, not redesign. `applicationMetadata`
and `recoverySnapshot` are decided as local-only for the cloud schema
(§4.2). The only genuinely blocking requirement is a real, *reachable*
Supabase project (or Docker for a local stack); once either exists,
Batch 8 (M8-022–025) can begin immediately using this report as its
blueprint.

## Batch 8 attempt log

A real Supabase development project was reported available, and Batch 8
(M8-022–025) was attempted. Pre-implementation verification (per the
standing workflow) found: no `SUPABASE_URL`/`SUPABASE_ANON_KEY` in this
session's environment, no Supabase CLI installed, no reachable Docker
daemon, and this sandbox's outbound proxy explicitly denies the
connection to `api.supabase.com` (`403`, policy denial). All four
checks point to the same conclusion: this specific session cannot
perform real schema application, RLS testing, or type generation
regardless of whether a project exists elsewhere. Batch 8 was not
started; this report's blueprint stands unchanged and ready for whenever
that access gap closes (credentials plus network access, in this session
or a different execution path such as CI).
