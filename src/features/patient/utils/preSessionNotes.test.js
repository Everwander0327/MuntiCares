import { describe, expect, it } from 'vitest';
import {
  buildPreSessionNotesSummary,
  mergePreSessionNotes,
} from './preSessionNotes';

describe('buildPreSessionNotesSummary', () => {
  it('joins all provided fields with a pipe separator', () => {
    const summary = buildPreSessionNotesSummary({
      symptomNotes: '  headache  ',
      vitals: { bp: '120/80', temp: '36.5', hr: '72', weight: '65' },
      uploadedCount: 2,
    });

    expect(summary).toBe(
      '[Pre-session Symptoms] headache | BP: 120/80 | Temp: 36.5°C | HR: 72 bpm | Weight: 65 kg | [2 file(s) uploaded]'
    );
  });

  it('returns an empty string when nothing is provided', () => {
    expect(buildPreSessionNotesSummary({})).toBe('');
  });

  it('only includes the uploaded count when files are present', () => {
    expect(buildPreSessionNotesSummary({ uploadedCount: 2 })).toBe('[2 file(s) uploaded]');
  });
});

describe('mergePreSessionNotes', () => {
  it('appends the summary after existing notes', () => {
    expect(mergePreSessionNotes('existing notes', 'new summary')).toBe(
      'existing notes\nnew summary'
    );
  });

  it('uses the summary alone when there are no existing notes', () => {
    expect(mergePreSessionNotes('', 'new summary')).toBe('new summary');
    expect(mergePreSessionNotes(null, 'new summary')).toBe('new summary');
  });
});
