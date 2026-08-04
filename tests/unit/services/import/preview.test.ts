import { describe, expect, it } from 'vitest';

import type { ImportValidationIssue } from '@/services/import/ImportValidator';
import { buildImportPreview, planRecordAction } from '@/services/import/preview';
import { createEnvelope } from '@/services/persistence';

describe('planRecordAction', () => {
  it('addAsNew always proposes addAsNew, conflicting or not', () => {
    const noConflict = planRecordAction('portfolio', 'p1', new Set(), 'addAsNew');
    expect(noConflict).toEqual({
      recordType: 'portfolio',
      recordId: 'p1',
      conflict: false,
      action: 'addAsNew',
    });

    const conflict = planRecordAction('portfolio', 'p1', new Set(['p1']), 'addAsNew');
    expect(conflict).toEqual({
      recordType: 'portfolio',
      recordId: 'p1',
      conflict: true,
      action: 'addAsNew',
    });
  });

  it('mergeNonConflicting adds a non-conflicting record and skips a conflicting one', () => {
    const added = planRecordAction('portfolio', 'p1', new Set(), 'mergeNonConflicting');
    expect(added.action).toBe('add');
    expect(added.conflict).toBe(false);

    const skipped = planRecordAction('portfolio', 'p1', new Set(['p1']), 'mergeNonConflicting');
    expect(skipped.action).toBe('skip');
    expect(skipped.conflict).toBe(true);
  });

  it('replaceSelected replaces only ids present in selectedRecordIds', () => {
    const selected = planRecordAction(
      'portfolio',
      'p1',
      new Set(['p1']),
      'replaceSelected',
      new Set(['p1']),
    );
    expect(selected.action).toBe('replace');

    const notSelected = planRecordAction(
      'portfolio',
      'p1',
      new Set(['p1']),
      'replaceSelected',
      new Set(),
    );
    expect(notSelected.action).toBe('skip');

    const nonConflicting = planRecordAction(
      'portfolio',
      'p1',
      new Set(),
      'replaceSelected',
      new Set(['p1']),
    );
    expect(nonConflicting.action).toBe('skip');
  });

  it('replaceAll always proposes replace', () => {
    const result = planRecordAction('portfolio', 'p1', new Set(), 'replaceAll');
    expect(result.action).toBe('replace');
  });
});

describe('buildImportPreview', () => {
  const envelope1 = createEnvelope('portfolio', 'p1', { name: 'One' });
  const envelope2 = createEnvelope('portfolio', 'p2', { name: 'Two' });

  it('reports counts, version, and exported date from the file', () => {
    const preview = buildImportPreview(
      '1.0.0',
      '2026-03-15T12:00:00.000Z',
      { portfolio: [envelope1, envelope2] },
      {},
      [],
      'addAsNew',
    );
    expect(preview.fileVersion).toBe('1.0.0');
    expect(preview.exportedAt).toBe('2026-03-15T12:00:00.000Z');
    expect(preview.counts.portfolio).toBe(2);
  });

  it('computes conflicts against existing ids', () => {
    const preview = buildImportPreview(
      '1.0.0',
      '2026-03-15T12:00:00.000Z',
      { portfolio: [envelope1, envelope2] },
      { portfolio: new Set(['p1']) },
      [],
      'mergeNonConflicting',
    );
    expect(preview.conflicts).toHaveLength(1);
    expect(preview.conflicts[0]?.recordId).toBe('p1');
  });

  it('splits issues into warnings (duplicate ids) and unsupportedRecords (everything else)', () => {
    const issues: ImportValidationIssue[] = [
      { recordType: 'portfolio', recordId: 'p1', code: 'DUPLICATE_RECORD_ID', message: 'dup' },
      { recordType: 'portfolio', recordId: 'p2', code: 'INVALID_RECORD', message: 'invalid' },
      {
        recordType: 'portfolio',
        recordId: 'p3',
        code: 'UNSUPPORTED_SCHEMA_VERSION',
        message: 'unsupported',
      },
    ];
    const preview = buildImportPreview(
      '1.0.0',
      '2026-03-15T12:00:00.000Z',
      {},
      {},
      issues,
      'addAsNew',
    );
    expect(preview.warnings).toEqual(['dup']);
    expect(preview.unsupportedRecords).toEqual(['invalid', 'unsupported']);
  });

  it('recomputes the plan differently across merge modes from identical inputs', () => {
    const validRecordsByType = { portfolio: [envelope1] };
    const existingIdsByType = { portfolio: new Set(['p1']) };

    const addAsNew = buildImportPreview(
      '1.0.0',
      'x',
      validRecordsByType,
      existingIdsByType,
      [],
      'addAsNew',
    );
    const merge = buildImportPreview(
      '1.0.0',
      'x',
      validRecordsByType,
      existingIdsByType,
      [],
      'mergeNonConflicting',
    );
    const replaceAll = buildImportPreview(
      '1.0.0',
      'x',
      validRecordsByType,
      existingIdsByType,
      [],
      'replaceAll',
    );

    expect(addAsNew.plan[0]?.action).toBe('addAsNew');
    expect(merge.plan[0]?.action).toBe('skip');
    expect(replaceAll.plan[0]?.action).toBe('replace');
  });

  it('produces an empty plan for an empty validRecordsByType', () => {
    const preview = buildImportPreview('1.0.0', 'x', {}, {}, [], 'addAsNew');
    expect(preview.plan).toEqual([]);
    expect(preview.conflicts).toEqual([]);
  });
});
