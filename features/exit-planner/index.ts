/**
 * Exit Planner feature module — public entry point. 06_TASKS.md M7-001
 * ("Create Strategy Feature Foundations"). See
 * `features/loop-builder/index.ts`'s own header comment for the full
 * reasoning shared by all three Milestone 7 feature modules (Dependency
 * list, DoD, the deliberate `state/`/`tests/` omission).
 *
 * **`hooks/`, `services/` still hold only a `.gitkeep`** — no task
 * through this batch has needed them yet. Milestone 7 Batch 4
 * (M7-019–M7-023) added the first real components (`ExitTypeSelector`,
 * `ExitTargetForm`). Milestone 7 Batch 5 (M7-024–M7-030) adds
 * `FullExitResult`, `PartialExitResult`, `TargetHealthFactorResult`,
 * `ExitFeasibilityAnalysis`, `ExitPriceSensitivity`, `SaveExitPlanForm`,
 * `ExitPlanLibrary`, `ExitPlanExport`, and the first real `utils/`
 * content (`exportExitPlan.ts`). Milestone 7 Batch 8 (M7-044) adds
 * `ApplyExitPlanAsSimulation` — see that component's own header comment
 * for why a nominally test-only task added a real production component.
 */
export { ApplyExitPlanAsSimulation } from './components/ApplyExitPlanAsSimulation';
export { ApplyExitPlanToPortfolio } from './components/ApplyExitPlanToPortfolio';
export { ExitFeasibilityAnalysis } from './components/ExitFeasibilityAnalysis';
export { ExitPlanExport } from './components/ExitPlanExport';
export { ExitPlanLibrary } from './components/ExitPlanLibrary';
export { ExitPriceSensitivity } from './components/ExitPriceSensitivity';
export { ExitTargetForm } from './components/ExitTargetForm';
export { ExitTypeSelector } from './components/ExitTypeSelector';
export { FullExitResult } from './components/FullExitResult';
export { PartialExitResult } from './components/PartialExitResult';
export { SaveExitPlanForm } from './components/SaveExitPlanForm';
export { TargetHealthFactorResult } from './components/TargetHealthFactorResult';
export * from './types/exitTargetForm';
export * from './utils/exportExitPlan';
