import { describe, expect, it } from 'vitest';

import { sanitizeText } from '@/utils/sanitizeText';

describe('sanitizeText', () => {
  it('trims leading and trailing whitespace', () => {
    expect(sanitizeText('  Hello World  ')).toBe('Hello World');
  });

  it('caps length at the default of 200 characters', () => {
    expect(sanitizeText('a'.repeat(300))).toHaveLength(200);
  });

  it('caps length at a custom maxLength', () => {
    expect(sanitizeText('abcdefghij', 5)).toBe('abcde');
  });

  it('strips C0 control characters', () => {
    const bell = String.fromCharCode(7);
    expect(sanitizeText(`Hello${bell}World`)).toBe('HelloWorld');
  });

  it('strips C1 control characters', () => {
    const c1 = String.fromCharCode(0x9f);
    expect(sanitizeText(`Hello${c1}World`)).toBe('HelloWorld');
  });

  it('strips tabs and newlines, since these fields are single-line', () => {
    const tab = String.fromCharCode(9);
    const newline = String.fromCharCode(10);
    expect(sanitizeText(`Hello${tab}World${newline}`)).toBe('HelloWorld');
  });

  it('does not strip HTML-looking substrings, since React already escapes rendered text', () => {
    expect(sanitizeText('BTC <2x Long>')).toBe('BTC <2x Long>');
  });

  it('returns an empty string for input that is entirely control characters', () => {
    const nul = String.fromCharCode(0);
    expect(sanitizeText(nul)).toBe('');
  });

  it('leaves already-clean text unchanged', () => {
    expect(sanitizeText('My Portfolio')).toBe('My Portfolio');
  });
});
