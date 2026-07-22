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
