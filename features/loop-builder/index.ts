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
 *
 * Milestone 7 Batch 3 adds `LoopSafetyAnalysis` (M7-013),
 * `LoopCostAnalysis` (M7-014), `LoopScenarioSensitivity` (M7-015),
 * `ApplyLoopAsSimulation` (M7-016), `SaveLoopStrategyForm`/
 * `LoopStrategyLibrary` (M7-017), and `LoopStrategyExport` (M7-018).
 */
export { ApplyLoopAsSimulation } from './components/ApplyLoopAsSimulation';
export { LoopCostAnalysis } from './components/LoopCostAnalysis';
export { LoopPresets } from './components/LoopPresets';
export { LoopSafetyAnalysis } from './components/LoopSafetyAnalysis';
export { LoopScenarioSensitivity } from './components/LoopScenarioSensitivity';
export { LoopStepTable } from './components/LoopStepTable';
export { LoopStrategyControls } from './components/LoopStrategyControls';
export { LoopStrategyExport } from './components/LoopStrategyExport';
export { LoopStrategyLibrary } from './components/LoopStrategyLibrary';
export { LoopStrategySummary } from './components/LoopStrategySummary';
export { SaveLoopStrategyForm } from './components/SaveLoopStrategyForm';
export * from './types/loopStrategyControls';
export * from './utils/exportLoopStrategy';
export { resolveBorrowRateAssumption } from './utils/resolveBorrowRateAssumption';
export { resolveMaxLoanToValueAssumption } from './utils/resolveMaxLoanToValueAssumption';
