# Contributing to ProfitPilot

This is developer/tooling documentation (Milestone 1, task M1-010). It does not
change or supersede anything in `docs/` — the specification documents remain the
single source of truth for product requirements, formulas, UI, and engineering
standards. See `PROJECT_STATUS.md` for current implementation status.

## Setup

```bash
pnpm install
cp .env.example .env.local   # optional — Manual Mode works with no external services
```

Requires Node.js 22+ and pnpm 10+.

## Development commands

| Command             | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `pnpm dev`          | Start the development server (Turbopack)                    |
| `pnpm build`        | Production build                                            |
| `pnpm start`        | Run the production build locally                            |
| `pnpm lint`         | ESLint                                                      |
| `pnpm typecheck`    | TypeScript, no emit                                         |
| `pnpm format`       | Prettier — write                                            |
| `pnpm format:check` | Prettier — check only                                       |
| `pnpm validate`     | typecheck → lint → format:check → test → build (mirrors CI) |

## Testing commands

| Command              | Purpose                         |
| -------------------- | ------------------------------- |
| `pnpm test`          | Unit tests (Vitest), single run |
| `pnpm test:watch`    | Unit tests, watch mode          |
| `pnpm test:coverage` | Unit tests with coverage report |
| `pnpm test:e2e`      | End-to-end tests (Playwright)   |

### End-to-end tests

`tests/e2e/` (Playwright) exercises real application workflows against a
built app in a real browser — `tests/unit/` mocks/renders components in
isolation, `tests/e2e/` does not. `playwright.config.ts` runs a single
`chromium` project only; no Firefox or WebKit binary is available in this
project's own development/CI environment, so those engines are not part of
automated coverage here — see `docs/CROSS_BROWSER_REVIEW.md` for the full
reasoning (including why Chromium is treated as a valid proxy for both
Chrome and Edge, and the code-level risk audit that stands in for Firefox/
Safari where automated coverage isn't available).

## Project structure

```
app/            Next.js App Router routes and layouts (presentation only)
components/     Reusable UI components, incl. components/layout (app shell)
features/       Feature-scoped UI (components/hooks/services per feature)
engine/         Formula Engine — pure, deterministic financial calculations
                (Milestone 2). No React/API/persistence dependencies.
services/       Orchestration layer between the Engine and the UI
stores/         Zustand state stores
hooks/          Shared React hooks (coordinate UI with Services only)
types/          Shared TypeScript types
utils/          Framework-agnostic utilities (e.g. utils/cn.ts, utils/env.ts)
constants/      Shared constants (e.g. navigation)
providers/      React context providers
tests/          tests/unit, tests/e2e, tests/fixtures
docs/           Specification documents — do not edit casually; see below
supabase/       Reserved for future Supabase schema/config (Milestone 8)
.github/        CI workflows
```

Dependency direction is one-way: `Presentation → Features → Services → Engine
→ Infrastructure`. The Engine must never import React, Next.js, Supabase, or
any browser/API/persistence dependency. See `docs/04_BUILD_GUIDE.md`.

## Persistence and local-first scope

ProfitPilot is local-first by product decision: `services/persistence/`
reads and writes `window.localStorage` only (see
`services/persistence/adapters/local-storage.adapter.ts`). Cloud Database
and Cloud Sync were both cancelled as a product decision — do not add a
network-backed persistence adapter or reintroduce either capability without
an explicit product decision to un-cancel them; see `PROJECT_STATUS.md`.

Every persisted record carries a `storageSchemaVersion`
(`services/persistence/envelope.ts`, currently `STORAGE_SCHEMA_VERSION =
'1.0.0'`). `services/persistence/migrations/migrate.ts` walks a registered
chain of migration steps from a record's stored version up to the current
one; unsupported/newer-than-current versions are rejected rather than
guessed at. `REGISTERED_MIGRATIONS` is currently an empty array — schema
`1.0.0` is the only version this application has ever shipped, so there is
no real prior version to migrate from yet. The chain-walking mechanism
itself is still fully exercised by
`tests/unit/services/persistence/migrate.test.ts` against a synthetic
test-only registry. When a future schema change needs a real migration,
add a `MigrationStep` to `REGISTERED_MIGRATIONS` and bump
`STORAGE_SCHEMA_VERSION` — do not silently reinterpret old data in place.

## Optional authentication

`services/auth/` (Supabase) is a dormant capability, not an active
production feature: `getSupabaseClient()` (`services/auth/
supabaseClient.ts`) returns `null` — and every `createAuthService` method
fails gracefully with `SUPABASE_NOT_CONFIGURED` rather than throwing —
whenever `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` are
unset, which is this project's own default (`.env.example` ships neither
set). The application runs fully in local-only mode either way — signing
in never changes how portfolio data is stored, since Cloud Sync/Cloud
Database were cancelled (see "Persistence and local-first scope" above).
Only the anon (publishable) Supabase key is ever read; there is no
service-role key anywhere in this codebase. `supabase/` (the directory)
is currently empty (`.gitkeep` only) — no schema/migration has shipped
for it.

## Deployment

ProfitPilot is a self-hostable Next.js application with no server runtime
of its own beyond what Next.js provides — there is no bundled database,
queue, or backend service to stand up. There is no confirmed production
domain for this project; `next.config.ts`'s own security headers (see its
HSTS comment) are written for "whoever actually deploys this," not for one
specific hosting target. Deploying it is ordinary Next.js deployment:
`pnpm build` then `pnpm start`, or an equivalent Next.js-compatible host,
behind HTTPS (the app enforces HSTS at the header level but does not
itself redirect HTTP → HTTPS — see `docs/SECURITY_REVIEW.md`). Set
environment variables (see `.env.example`) only for the optional
capabilities you intend to enable; Manual Mode (the default, and only
supported mode in Version 1.0) requires none of them.

## Release process

Milestone 9's own task breakdown (`docs/06_TASKS.md`, "Release Candidate,"
M9-057–M9-064) is this project's defined release process: build a Release
Candidate, run the full regression/smoke/exploratory suites, validate the
migration and rollback paths, review open defects, and complete a
Version 1 Quality Sign-Off. That process ran in Milestone 9 Batch 11 and
passed with zero release-blocking defects — see
`docs/DEFECT_CLASSIFICATION.md` §6 for the full open-item review and
`docs/CHANGELOG.md` for the resulting `1.0.0` version record. Passing
sign-off means the Release Candidate is ready to deploy, not that a
deployment has happened — `M1-009` ("Deploy Initial Application") remains
explicitly deferred; this is a self-hostable product with no single owned
production domain by design. See `docs/CHANGELOG.md` for the current
version metadata (application/engine/formula/storage-schema versions,
each an independent axis — they are not expected to match) and known
limitations.

## Incident response

See `docs/INCIDENT_RESPONSE.md` for how to handle a production incident
(incorrect financial output, a data-loss report, a security issue, a
broken import, a failed migration, a critical dependency vulnerability) —
scoped to this project's real solo/self-hosted operating model, not a
generic on-call playbook.

## Observability / error monitoring

Sentry error monitoring (`services/observability/`) is wired but dormant
by default: nothing is captured or sent unless a deployer sets
`NEXT_PUBLIC_SENTRY_DSN` (see `.env.example`). With no DSN set, error
monitoring is a no-op and the Sentry SDK is never even loaded into the
bundle (a dynamic import, not a static one — see `services/observability/
errorMonitoring.ts`'s own header comment for why that distinction matters
for bundle size). See `docs/OBSERVABILITY.md` for the full architecture,
what is and is not captured, and the privacy-scrubbing guarantees that
apply whenever it is enabled.

## Specification documents

`docs/` contains the authoritative product and engineering specification:

- `01_PRD.md` — product requirements (source of truth for _what_ to build)
- `02_Formulas.md` — every financial formula (source of truth for calculations)
- `03_UI.md` — UI/UX specification
- `04_BUILD_GUIDE.md` — engineering architecture and standards (source of truth
  for _how_ to build; two referenced pages — Database Design/State Management,
  and Frontend Implementation/Components/Forms — are missing from the file as
  received; see `PROJECT_STATUS.md`)
- `05_AI_PROMPTS.md` — prompt templates for AI-assisted development
- `06_TASKS.md` — the milestone/task breakdown this project follows
- `CODING_STYLE.md`, `TERMINOLOGY.md` — house style and vocabulary

Do not modify these files as part of ordinary feature work. If a spec is wrong,
ambiguous, or incomplete, document the conflict (see `PROJECT_STATUS.md`) rather
than silently resolving it in code.

## Contribution workflow

1. Read the relevant spec pages before implementing anything.
2. Build in dependency order: Engine → Services → State → UI → Tests → Docs.
   Never start with UI/visual work before the underlying calculation exists.
3. Run `pnpm validate` before opening a PR — CI runs the same steps.
4. Every formula must reference its Formula ID (`F-0xx` / `M-0xx` from
   `02_Formulas.md`) in code and tests.
5. Do not duplicate a calculation that already exists in `engine/`.
