/**
 * Exit Planner feature module — public entry point. 06_TASKS.md M7-001
 * ("Create Strategy Feature Foundations"). See
 * `features/loop-builder/index.ts`'s own header comment for the full
 * reasoning shared by all three Milestone 7 feature modules (Dependency
 * list, DoD, the deliberate `state/`/`tests/` omission).
 *
 * **`hooks/`, `services/`, `utils/` still hold only a `.gitkeep`** — no
 * task through this batch has needed them yet. Milestone 7 Batch 4
 * (M7-019–M7-023) adds the first real components (`ExitTypeSelector`,
 * `ExitTargetForm`) and the first real `types/` content
 * (`exitTargetForm.ts`).
 */
export { ExitTargetForm } from './components/ExitTargetForm';
export { ExitTypeSelector } from './components/ExitTypeSelector';
export * from './types/exitTargetForm';
