import { describe, expect, it } from 'vitest';

import * as Services from '@/services';

/**
 * Service layer public API surface — 06_TASKS.md M3-002/M3-003.
 *
 * Mirrors `tests/unit/engine/publicApiSurface.test.ts`'s pattern one
 * layer up: verifies the Standard Service Result Model and Application
 * Error Model are actually reachable through the root `@/services`
 * entry point (not just their own submodule path), the same DoD
 * `services/index.ts` exists to satisfy.
 */
describe('Public Service layer API surface (M3-002, M3-003)', () => {
  const expectedFunctionNames = [
    'createServiceSuccess',
    'createServiceFailure',
    'createApplicationError',
  ];

  it.each(expectedFunctionNames)('%s is reachable through @/services alone', (name) => {
    expect(typeof (Services as Record<string, unknown>)[name]).toBe('function');
  });

  it('a success and failure ServiceResult can be built using only @/services imports', () => {
    const options = { sourceStatus: 'live', engineVersion: '0.1.0', formulaVersion: '1.0' };

    const success = Services.createServiceSuccess({ ok: true }, options);
    expect(success.ok).toBe(true);

    const failure = Services.createServiceFailure(
      [Services.createApplicationError('validation', 'X', 'Invalid input.')],
      options,
    );
    expect(failure.ok).toBe(false);
  });
});
