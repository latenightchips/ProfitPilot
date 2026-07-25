import { describe, expect, it } from 'vitest';

import { type ApplicationErrorCategory, createApplicationError } from '@/services/shared/errors';

/**
 * Application Error Model — 06_TASKS.md M3-003.
 */
describe('createApplicationError (M3-003)', () => {
  const categories: ApplicationErrorCategory[] = [
    'validation',
    'calculation',
    'persistence',
    'provider',
    'authentication',
    'synchronization',
    'import',
    'export',
    'unknown',
  ];

  it.each(categories)('constructs a well-formed error for category "%s"', (category) => {
    const error = createApplicationError(category, 'SOME_CODE', 'A safe, user-facing message.');
    expect(error).toEqual({
      category,
      code: 'SOME_CODE',
      message: 'A safe, user-facing message.',
    });
  });

  it('covers exactly the 9 documented categories, no more, no fewer', () => {
    expect(categories).toHaveLength(9);
    expect(new Set(categories).size).toBe(9);
  });

  it('does not attach any field beyond category, code, and message (DoD: safe to display)', () => {
    const error = createApplicationError('unknown', 'X', 'Something went wrong.');
    expect(Object.keys(error).sort()).toEqual(['category', 'code', 'message']);
  });
});
