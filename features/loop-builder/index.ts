/**
 * Loop Builder feature module — public entry point. 06_TASKS.md M7-001
 * ("Create Strategy Feature Foundations"). Dependencies: M3-010, M3-011,
 * M3-012 (Loop/Exit/Recommendation Services — all already built).
 * DoD: "Each strategy tool has a clear public entry point and remains
 * isolated from unrelated features." `app/loop-builder/page.tsx` and
 * any later Loop Builder component/hook should import from here, not
 * reach into `features/loop-builder/*` subpaths directly — the same
 * convention `features/dashboard/index.ts` (M5-002) and
 * `features/simulation/index.ts` (M6-002) already established.
 *
 * **`hooks/`, `services/`, `types/`, `utils/` hold only a `.gitkeep`** —
 * no task through M7-002 (Batch 1) has needed any of them yet; the
 * first real component arrives at M7-006 (Batch 2).
 *
 * **This directory intentionally has no `state/` or `tests/`
 * subdirectory**, even though M7-001's own literal suggested-structure
 * code block names both — the same deliberate deviation
 * `features/simulation/index.ts`'s own header comment already
 * documents for M6-002, applied here for an identical reason: every
 * Store in this codebase lives in the project's one top-level `stores/`
 * directory, and every test file lives in the project's one top-level
 * `tests/` directory (both established by M1-003) — never nested inside
 * a feature.
 */
export { LoopPresets } from './components/LoopPresets';
export { LoopStepTable } from './components/LoopStepTable';
export { LoopStrategyControls } from './components/LoopStrategyControls';
export { LoopStrategySummary } from './components/LoopStrategySummary';
export * from './types/loopStrategyControls';
