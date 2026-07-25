/**
 * Service layer — public entry point.
 *
 * 06_TASKS.md M3-001 ("Create Service Foundation"): "Create the Service
 * layer structure defined in the Build Guide." Mirrors the Formula
 * Engine's own single-entry-point convention (`engine/index.ts`,
 * 06_TASKS.md M2-001) one layer up: Services are the only code that may
 * import the Engine directly (04_BUILD_GUIDE.md "DEPENDENCY RULES" —
 * "Only services communicate directly with the Formula Engine"), and
 * this file is where the rest of the application should import Services
 * from.
 *
 * Currently re-exports nothing: every subdirectory below is a documented,
 * intentionally empty placeholder (see each one's own doc comment) until
 * its own dedicated Milestone 3 task builds it. The wiring exists now so
 * later tasks only need to add exports, not restructure.
 */
export * from './exit';
export * from './export';
export * from './import';
export * from './loop';
export * from './market';
export * from './persistence';
export * from './portfolio';
export * from './protocol';
export * from './recommendation';
export * from './shared';
export * from './simulation';
