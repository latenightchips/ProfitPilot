# Milestone 8 — Completion and Scope-Change Report

Prepared per your instruction to re-scope Milestone 8 to a local-only
persistence architecture following the decision that Supabase, Cloud
Database, Cloud Sync, Row-Level Security testing, and real
authentication-backed cloud storage are all out of scope, with
anonymous/manual mode as the permanent default. This was analysis and
recommendation only at the time of writing — **no code had been changed
and `PROJECT_STATUS.md` had not been touched**, per your explicit
instructions then. See the Resolution note immediately below for what
was subsequently approved and executed.

> **Resolution (approved)**: this report was approved with Authentication
> explicitly retained as a dormant capability (not removed) and cleanup
> scoped to artifacts that exist exclusively for cancelled Supabase work.
> That cleanup has been executed: `services/persistence/sync.service.ts`
> and `tests/fixtures/fakeSupabaseDatabase.ts` (plus its test) are
> deleted; `docs/CLOUD_READINESS.md` is archived at
> `docs/archive/CLOUD_READINESS_SUPERSEDED.md`; `docs/DISASTER_RECOVERY.md`
> and `docs/SECURITY_REVIEW.md` are updated to reflect the local-only
> scope (see those files). `services/auth/`, `stores/authStore.ts`,
> `providers/AuthProvider.tsx`, and the auth routes are untouched, per
> the approved decision. `PROJECT_STATUS.md` remains unchanged, awaiting
> a separate approval. The classification table and recommendations
> below are left as originally written — an accurate record of the
> analysis this resolution was based on.

## 1. What this changes

Milestone 8, as originally authored in `06_TASKS.md`, describes a
persistence architecture with three tiers: Local Storage (default),
Cloud Storage (optional, for authenticated users), and Export Files. The
new decision permanently removes the middle tier. This is not "cloud
sync isn't ready yet" (this engagement's framing for every batch through
M8-026) — it is a product decision that cloud sync, in any Supabase-shaped
form, will not be built. That distinction matters for how the remaining
tasks are classified below: they are not blocked, they are cancelled.

## 2. Full remaining task review

43 of Milestone 8's 62 tasks are complete and unaffected by this change
(Persistence Foundation, Local Storage, Authentication's own service/store
layer, Import/Export, Backup and Recovery excluding M8-049, Privacy and
Security, and 3 of the 8 Quality/Testing tasks). M8-026
(Synchronization Model) is included in that count, and — per your explicit
decision — **stays valid**: "the synchronization metadata model" is
named as one of the things that "remain valid" alongside local
persistence, import/export, recovery, and security. The remaining 19
tasks (including M8-049, "Implement Cloud Data Deletion Workflow" — its
own Dependencies name M8-025, so it is cloud-dependent even though its
task number falls inside the Backup and Recovery range that otherwise
completed in full) are reclassified below: 16 cancelled outright, 3
satisfied without dedicated new work. **43 + 16 + 3 = 62** — see the
Final tally table in `PROJECT_STATUS.md`'s own `## Milestone 8 progress`
section for the same breakdown, cross-checked against this one.

| Task | Title | Old status | New classification | Why |
|---|---|---|---|---|
| M8-022 | Create Supabase Database Schema | Blocked (no infra) | **Cancelled — product decision** | Supabase-specific; no database tier exists in the new architecture. |
| M8-023 | Implement Row-Level Security | Blocked | **Cancelled — product decision** | RLS only means something against a Postgres table that will never exist. |
| M8-024 | Generate and Validate Database Types | Blocked | **Cancelled — product decision** | `supabase gen types` has no schema to read. |
| M8-025 | Implement Supabase Persistence Adapter | Blocked | **Cancelled — product decision** | Explicitly named: "do not add unused Supabase adapters." |
| M8-026 | Create Synchronization Model | **Done** | **Retained — explicitly kept valid** | Pure local model (`services/persistence/syncMetadataModel.ts`), no Supabase dependency. Not cancelled. |
| M8-027 | Implement First Sign-In Data Merge | Blocked | **Cancelled — product decision** | No cloud data source to merge against. |
| M8-028 | Implement Cloud Upload | Blocked | **Cancelled — product decision** | No cloud destination. |
| M8-029 | Implement Cloud Download | Blocked | **Cancelled — product decision** | No cloud source. |
| M8-030 | Implement Incremental Synchronization | Blocked | **Cancelled — product decision** | Depends on M8-028/029, both cancelled. |
| M8-031 | Implement Conflict Detection | Blocked | **Cancelled — product decision** | The *model* (M8-026) is retained; the *Service* that would apply it to real sync traffic is cancelled — there is no real sync traffic. |
| M8-032 | Implement Conflict Resolution UI | Blocked | **Cancelled — product decision** | Depends on M8-031. |
| M8-033 | Implement Offline Synchronization Queue | Blocked | **Cancelled — product decision** | "Offline" only means something relative to a sync target that no longer exists — the app is already fully usable with no network dependency at all. |
| M8-034 | Implement Synchronization Status | Blocked | **Cancelled — product decision** | No sync state to display. |
| M8-035 | Implement Manual Synchronization | Blocked | **Cancelled — product decision** | Depends on M8-034. |
| M8-049 | Implement Cloud Data Deletion Workflow | Blocked | **Cancelled — product decision** | Own Dependencies name M8-025 (Supabase adapter, cancelled); correctly excluded from the completed Batch 4 (Backup and Recovery, M8-046–048/050) at the time, for the same reason as every other row in this table. Listed here out of numeric order — its task number falls inside the otherwise-complete Backup and Recovery range, but its actual dependency is on Cloud Database. |
| M8-057 | Create Row-Level Security Tests | Blocked | **Not applicable — nothing to test** | There is no RLS policy in this architecture, tested or otherwise. Distinct from "cancelled": this task was never about building something, only verifying something M8-023 would have built. |
| M8-058 | Create Synchronization Tests | Blocked | **Not applicable — nothing to test** | Same reasoning; M8-027–035 are all cancelled. |
| M8-060 | Create Offline End-to-End Tests | Blocked | **Partially retained** | Its three purely-local flows ("Open/edit portfolio offline," "Save simulation offline") are already true and already covered by M8-055's own tests — the app has no network dependency, full stop. Its three cloud-flows ("Queue cloud changes," "Reconnect," "Synchronize successfully") are **cancelled**. No new task needed — already satisfied by existing local persistence tests. |
| M8-061 | Create Persistence End-to-End Tests | Blocked | **Partially retained** | Its local flows ("Create local portfolio and refresh," "Export and restore," "Sign out while retaining local data," "Clear local data") are already covered by existing e2e/unit tests. Its cloud flows ("Sign up with existing local data," "Merge local and cloud records," "Edit on two simulated clients") are **cancelled**. |
| M8-062 | Validate Persistence Against Build Guide | Blocked | **Re-scoped, completable now** | Its "Verify" list includes local-only items (local-first operation, optional authentication, import validation, export portability, version compatibility, offline support, recovery behavior) that are all already true, and cloud items ("Optional cloud synchronization," part of "Conflict handling," part of "Security rules") that are now **N/A by product decision**. A re-scoped version of this audit is completable as a documentation task — not proposed as code in this report, since you asked for review only. |

## 3. Is Milestone 8 complete under the new scope?

Two different questions, with two different honest answers.

**Against the original, literal Milestone 8 text in `06_TASKS.md`: no.**
That document's own Acceptance Criteria and Definition of Done include
items this decision permanently removes — most directly "Synchronize
across devices," "Cloud data is protected by Row-Level Security," and
"Synchronization supports offline work." No amount of local-only work
satisfies those sentences; they describe a capability that will not be
built. I want to state this plainly rather than paper over it: this
report cannot honestly claim the original Milestone 8 spec is 100% done,
because part of what it specifies is being cancelled.

**Against a local-only re-scoped Milestone 8: yes**, with the acceptance
criteria mapped below. Of the original 16 criteria and 10 "a user must
be able to" items, everything not intrinsically cloud-shaped is met:

| Original criterion | Status under local-only scope |
|---|---|
| ProfitPilot works without authentication | ✅ Met |
| Local storage is the default persistence mode | ✅ Met — now the *only* mode |
| Portfolios and saved strategies survive browser refresh | ✅ Met |
| Stored data is validated and versioned | ✅ Met |
| Supported older schemas migrate safely | ✅ Met (mechanism proven; no real second schema version has shipped yet) |
| Authentication is optional | ✅ Met (see §5 — its future is a separate question) |
| Existing local data survives sign-in | ✅ Met (proven structurally independent, `authLocalDataPreservation.test.ts`) |
| Cloud data is protected by Row-Level Security | ⛔ **N/A — no cloud data exists or will exist** |
| Synchronization supports offline work | ⛔ **N/A — no synchronization exists or will exist**; the app already has zero network dependency for any core function, which is a stronger property than "supports offline" |
| Conflicts are never resolved silently | ✅ Met for the conflicts that can occur (import replace-all, recovery snapshots) — the *sync*-conflict half is N/A |
| JSON export and import are complete | ✅ Met |
| CSV export is available | ✅ Met |
| Invalid imports do not change existing data | ✅ Met |
| Recovery snapshots protect high-risk operations | ✅ Met |
| Private keys and credentials are never stored | ✅ Met |
| Persistence and synchronization tests pass | ✅ Met for persistence; synchronization tests are **N/A** |

**Recommendation**: Milestone 8 should be marked complete under an
explicitly re-scoped definition — something like "Milestone 8 — Local
Persistence, Import/Export, Recovery, and Optional Authentication
(Cloud Database and Cloud Synchronization cancelled by product decision,
[date])" — rather than left showing as perpetually "in progress" against
criteria that will never be satisfied. I have not written this into
`PROJECT_STATUS.md`, per your instruction; this is the wording I'd
propose once you approve.

## 4. Dead code, dependencies, routes, and documentation

### Unconditionally dead (recommend removing regardless of the Authentication decision in §5)

- **`services/persistence/sync.service.ts`** — the empty stub reserved
  for Cloud Sync's real Service logic. Its own header comment says "this
  file exists now... so that batch only needs to add exports here" —
  that batch is cancelled. Nothing will ever fill this in. Recommend
  deleting the file (and its one-line `export {}` re-export path in
  `services/persistence/index.ts`, which already tolerates its absence
  since nothing imports from it).
- **`tests/fixtures/fakeSupabaseDatabase.ts`** and
  **`tests/unit/services/persistence/fakeSupabaseDatabase.test.ts`** —
  built explicitly "for future adapter and sync-service tests" (M8-025,
  M8-027+), both now cancelled. This is exactly the "fake cloud
  behavior" your decision says not to add going forward, and it already
  exists from before this decision. Recommend removing both files.
- **`docs/CLOUD_READINESS.md`** — entirely Supabase implementation
  planning (schema DDL, RLS policies, migration strategy, environment
  variables, testing strategy for a Supabase project). None of it
  applies anymore. Recommend either deleting it or retitling/moving it
  to something like `docs/archive/CLOUD_READINESS_SUPERSEDED.md` with a
  one-line note ("Superseded — Supabase declared out of scope,
  [date]. Retained only as a historical record.") if you'd rather keep
  the decision-making trail than delete it outright. I'd lean toward
  keeping a short superseded marker rather than deleting — it documents
  *why* Cloud Database work stopped, which has real value if this
  decision is ever revisited — but this is a judgment call for you.
- **`docs/DISASTER_RECOVERY.md`'s "Sync conflict" and "Unavailable
  Supabase" sections** — currently written as "not yet reachable...
  once that batch ships, this section will document..." That framing is
  now wrong; it implies future work that isn't coming. Recommend
  rewriting both sections to state plainly that Cloud Synchronization is
  out of scope by product decision and these failure modes cannot occur
  in this architecture, rather than describing them as pending.
- **`docs/SECURITY_REVIEW.md`'s cloud-dependent "Follow-up"/"Must be
  addressed when M8-023/M8-031 are implemented" notes** (at minimum: the
  "No session data in exports" follow-up, "No authenticated API access
  after sign-out" follow-up, the Security Checklist's "Row Level
  Security enabled" row, "Replay or duplicate sync operations,"
  "Unauthorized cloud deletion," and "Cross-user access" sections in the
  M8-054 review) — all currently phrased as "cannot occur *yet*" with a
  future trigger condition. Recommend rewording these from "deferred
  until M8-023/M8-031 ship" to "not applicable — Cloud Database/Cloud
  Sync are out of scope by product decision," removing the implication
  that a future batch will need to revisit them.

### Conditionally dead (depends on the Authentication decision — see §5)

If Authentication is removed:
- `services/auth/` (all 4 files), `stores/authStore.ts`,
  `providers/AuthProvider.tsx`, `app/sign-in/`, `app/sign-up/`,
  `app/reset-password/` — full deletion.
- `app/layout.tsx`'s `AuthProvider` wrapper, `app/settings/page.tsx`'s
  Account section (`useAuthStore` reads, sign-out UI),
  `components/layout/AppHeader.tsx`'s Sign In/Account link — partial
  edits to remove the wiring, not full-file deletions.
- All auth-related tests: `tests/unit/services/auth/*`,
  `tests/unit/stores/authStore.test.ts`,
  `tests/unit/stores/authLocalDataPreservation.test.ts`,
  `tests/unit/app/sign-up/`, `tests/e2e/authWorkflows.spec.ts`, plus the
  auth-touching portions of `tests/unit/app/settings/` and
  `tests/e2e/settingsWorkflows.spec.ts`.
- **`@supabase/supabase-js` removed from `package.json`** — the single
  dependency this entire decision is about, and (confirmed by grep) it
  is imported in exactly one production file today
  (`services/auth/supabaseClient.ts`), so removing Authentication
  removes 100% of this codebase's Supabase footprint in one step.
- `SUPABASE_URL`/`SUPABASE_ANON_KEY` removed from `utils/env.ts`'s
  schema and `.env.example`.
- `docs/SECURITY_REVIEW.md`'s "M8-053 — Secure Session Review" section
  becomes entirely moot (nothing left to review) and should be removed,
  not just reworded.

If Authentication is kept dormant: none of the above changes — the
unconditional list above is still the full recommended cleanup.

### Routes

Confirmed via directory listing: `/sign-in`, `/sign-up`,
`/reset-password` are the only three routes tied to this decision.
Every other route (`/portfolio`, `/portfolios`, `/simulation`,
`/loop-builder`, `/exit-planner`, `/recommendations`, `/settings`, `/`)
is core local-only functionality, unaffected.

### Dependencies

`@supabase/supabase-js` is the only Supabase-related entry in
`package.json` (confirmed by grep — no separate `@supabase/postgrest-js`,
`realtime-js`, etc. at the top level; those ship bundled inside the one
package). It is imported in exactly one production file
(`services/auth/supabaseClient.ts`) and referenced only in documentation
comments everywhere else (`stores/authStore.ts`,
`services/auth/{index,authService,types}.ts`,
`app/reset-password/page.tsx`) — confirmed by distinguishing actual
`import` statements from prose mentions. This is a clean, single-point
removal if Authentication goes; see §5.

## 5. Recommendation: remove or keep the Authentication UI as dormant?

You asked me to recommend, not decide silently, so here is the case for
each side and where I land.

**The case for removing it**: Signing in today does nothing beyond
toggling `cloudSyncEligible`/`user` in `authStore` — no other code reads
that state meaningfully, and under this decision nothing ever will,
since Cloud Sync (the one feature "being signed in" was ever *for*) is
cancelled. A "Create Account" call-to-action that leads to an account
with no capability beyond existing is confusing to a real user and
actively contradicts "Anonymous/manual mode remains the permanent
default" if there's a dangling secondary path implying more is coming.
Keeping it dormant means carrying `@supabase/supabase-js` (a real
dependency-audit and bundle-size cost — `docs/SECURITY_REVIEW.md`'s own
`pnpm audit` section already tracks its transitive vulnerabilities) for
a feature with no product purpose. And if a cloud backend is ever
reconsidered later, it's very unlikely to be Supabase specifically given
today's decision — a future integration would likely be rebuilt against
whatever that backend actually is, so today's Supabase-specific
`GoTrueClient` integration wouldn't be reusable scaffolding anyway.

**The case for keeping it dormant**: It is fully isolated behind the
Service/Store boundary this engagement built specifically for this
reason (`services/auth/`, independent `authStore`) — "dormant" is not
"broken," it's inert and gracefully no-ops with zero Supabase
configuration, exactly as designed. If you want to preserve the option
of a lightweight account concept later (even without cloud sync — e.g.,
just "remember me across devices" for something small), the UI and
Service shape already exist and work. Removing it is also real,
non-zero rework if that judgment changes.

**My recommendation: remove it.** The deciding factor is that "dormant"
here doesn't mean "paused, ready to resume" — it means "a feature whose
only purpose was cancelled, kept around anyway." That's different from,
say, keeping `sync.service.ts` as a stub was originally justified (a
seam for near-term, still-planned work). Nothing currently planned would
resume Authentication's usefulness. I'd rather recommend a clean
removal now, fully documented in this report and (once you approve) in
`PROJECT_STATUS.md`, than leave inert Supabase-shaped code and a
half-purposed sign-in flow as a standing question mark for whoever
reads this codebase next. That said, this is genuinely your call — if
there's a product reason to keep the door open (e.g., a near-term
non-Supabase account feature) that I don't have visibility into, "keep
dormant" is a reasonable, low-risk alternative, and nothing about the
architecture forces the removal.

## 6. What I have not done (as originally written — see the Resolution note at the top for what happened afterward)

Per your explicit instructions at the time: no code has been changed, no
file has been deleted, and `PROJECT_STATUS.md` has not been modified.
This report was a new file only. Everything in §4 and §5 was a
recommendation awaiting your approval — including, notably, the
Authentication removal-vs-keep decision, which changed the exact scope
of the cleanup batch that followed.

**This is no longer current.** §4's cleanup recommendations were
approved and executed (artifacts exclusive to cancelled Supabase work
removed or archived; Authentication retained); `PROJECT_STATUS.md` was
subsequently updated in a dedicated documentation-only pass recording
Milestone 8 as complete under the re-scoped definition. See the
Resolution note at the very top of this document, and
`PROJECT_STATUS.md`'s own `## Milestone 8 progress` section, for the
current, authoritative state.
