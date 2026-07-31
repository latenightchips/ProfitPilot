/**
 * Shared application types — public entry point.
 *
 * 04_BUILD_GUIDE.md "TYPES DIRECTORY": "Shared TypeScript interfaces,"
 * naming "Portfolio" as its own first example. `06_TASKS.md` M4-001
 * ("Create Portfolio Application Types") and M4-002 ("Create Portfolio
 * Validation Schemas") are its first occupants. `strategy.ts` (M7-002,
 * Milestone 7 Batch 1) is its second — see that file's own header
 * comment for why Milestone 7's shared strategy types belong here
 * rather than inside one feature.
 */
export * from './portfolio';
export * from './portfolio.schema';
export * from './strategy';
