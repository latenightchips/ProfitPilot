/**
 * Simulation feature module — public entry point. 06_TASKS.md M6-002
 * ("Create Simulation Feature Structure"). DoD: "Simulation code
 * remains isolated from unrelated features." `app/simulation/page.tsx`
 * and any later Simulation component/hook should import from here, not
 * reach into `features/simulation/*` subpaths directly — the same
 * public-entry-point convention `features/dashboard/index.ts` (M5-002)
 * already established.
 *
 * **`hooks/`, `services/` still hold only a `.gitkeep`** — no task
 * through M6-004 (Batch 3) has needed either yet.
 *
 * **This directory intentionally has no `state/` or `tests/`
 * subdirectory**, even though M6-002's own literal code block names
 * both — a deliberate deviation from that literal text, not an
 * oversight. `features/dashboard/`'s own real, already-shipped
 * structure (Milestone 5, Batches 1–18) never used either: every Store
 * in this codebase lives in the project's one top-level `stores/`
 * directory (`stores/portfolioStore.ts`, `stores/developerModeStore.ts`,
 * `stores/simulationStore.ts` — all established by M1-003's own
 * top-level directory list, a sibling of `features/`, not nested
 * inside it), and every test file across Milestones 2–6 lives in the
 * project's one top-level `tests/` directory (`tests/unit/`,
 * `tests/integration/`, `tests/e2e/` — M1-003's own convention too),
 * never inside a feature-local `tests/` folder.
 */
export * from './components/ScenarioBuilder';
export * from './types/scenarioBuilder';
export * from './utils/resolveScenarioInputs';
export * from './utils/validateScenarioBuilderInput';
