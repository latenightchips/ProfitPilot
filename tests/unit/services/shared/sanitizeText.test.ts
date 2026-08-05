import { describe, expect, it } from 'vitest';

import {
  sanitizedNullableTextSchema,
  sanitizedOptionalTextSchema,
  sanitizedTextSchema,
} from '@/services/shared/sanitizeText';

describe('sanitizedTextSchema', () => {
  it('sanitizes and accepts non-empty text', () => {
    const schema = sanitizedTextSchema('Name is required.');
    expect(schema.parse('  My Portfolio  ')).toBe('My Portfolio');
  });

  it('rejects text that becomes empty after sanitizing', () => {
    const schema = sanitizedTextSchema('Name is required.');
    const result = schema.safeParse('   ');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe('Name is required.');
  });
});

describe('sanitizedOptionalTextSchema', () => {
  it('sanitizes and accepts non-empty text', () => {
    const schema = sanitizedOptionalTextSchema();
    expect(schema.parse('  A description  ')).toBe('A description');
  });

  it('collapses text that becomes empty after sanitizing to undefined', () => {
    const schema = sanitizedOptionalTextSchema();
    expect(schema.parse('   ')).toBeUndefined();
  });

  it('leaves undefined as undefined', () => {
    const schema = sanitizedOptionalTextSchema();
    expect(schema.parse(undefined)).toBeUndefined();
  });
});

describe('sanitizedNullableTextSchema', () => {
  it('sanitizes and accepts non-empty text', () => {
    const schema = sanitizedNullableTextSchema();
    expect(schema.parse('  A description  ')).toBe('A description');
  });

  it('collapses text that becomes empty after sanitizing to null', () => {
    const schema = sanitizedNullableTextSchema();
    expect(schema.parse('   ')).toBeNull();
  });

  it('leaves null as null', () => {
    const schema = sanitizedNullableTextSchema();
    expect(schema.parse(null)).toBeNull();
  });
});
