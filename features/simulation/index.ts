/**
 * Simulation feature module — public entry point. 06_TASKS.md M6-002
 * ("Create Simulation Feature Structure"). DoD: "Simulation code
 * remains isolated from unrelated features." `app/simulation/page.tsx`
 * (M6-001) and any later Simulation component/hook should import from
 * here, not reach into `features/simulation/*` subpaths directly — the
 * same public-entry-point convention `features/dashboard/index.ts`
 * (M5-002) already established.
 *
 * **`components/`, `hooks/`, `services/`, `types/`, `utils/` all hold
 * only a `.gitkeep` for now** — this batch (M6-001 + M6-002) is
 * "Simulation Foundation" only, per this milestone's own IMPLEMENTATION
 * ORDER; the Simulation Store (M6-003), Scenario Builder (M6-004), and
 * every calculation-driven component are later, still-unbuilt tasks.
 *
 * **This directory intentionally has no `state/` or `tests/`
 * subdirectory**, even though M6-002's own literal code block names
 * both — a deliberate deviation from that literal text, not an
 * oversight. `features/dashboard/`'s own real, already-shipped
 * structure (Milestone 5, Batches 1–18) never used either: every Store
 * in this codebase lives in the project's one top-level `stores/`
 * directory (`stores/portfolioStore.ts`, `stores/developerModeStore.ts`
 * — both established by M1-003's own top-level directory list, a
 * sibling of `features/`, not nested inside it), and every test file
 * across Milestones 2–5 lives in the project's one top-level `tests/`
 * directory (`tests/unit/`, `tests/integration/`, `tests/e2e/` —
 * M1-003's own convention too), never inside a feature-local `tests/`
 * folder. Following M6-002's own literal tree here would split state
 * management and testing across two different, inconsistent
 * conventions for no documented reason. The Simulation Store (M6-003)
 * will live in `stores/simulationStore.ts`; Simulation tests will live
 * under `tests/unit/features/simulation/`, `tests/integration/simulation/`,
 * and `tests/e2e/`, matching every prior milestone exactly.
 */
export {};
