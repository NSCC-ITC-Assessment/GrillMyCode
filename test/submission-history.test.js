import { describe, expect, it } from 'vitest';
import {
  TRIGGER_MANUAL_RUN,
  TRIGGER_TAG_PUSH,
  buildSubmissionEntry,
  isCountedSubmission,
  ordinal,
  parseSubmissionLog,
  renderSubmissionLog,
  submissionNote,
  summariseSubmissions,
} from '../src/submission-history.js';

const SHA = 'abcdef1234567890abcdef1234567890abcdef12';
const NOW = new Date('2026-09-21T14:03:59Z');

function entry(over = {}) {
  return buildSubmissionEntry({
    entries: [],
    trigger: TRIGGER_TAG_PUSH,
    actor: 'jsmith',
    studentLogin: 'jsmith',
    tagName: 'phase1',
    headSha: SHA,
    now: NOW,
    ...over,
  });
}

describe('isCountedSubmission', () => {
  it('always counts a tag push', () => {
    expect(
      isCountedSubmission({ trigger: TRIGGER_TAG_PUSH, actor: 'teacher', studentLogin: 'jsmith' }),
    ).toBe(true);
  });

  it('counts a manual run the student started, whatever the case of the login', () => {
    expect(
      isCountedSubmission({ trigger: TRIGGER_MANUAL_RUN, actor: 'JSmith', studentLogin: 'jsmith' }),
    ).toBe(true);
  });

  it('does not count a manual run someone else started', () => {
    expect(
      isCountedSubmission({
        trigger: TRIGGER_MANUAL_RUN,
        actor: 'teacher',
        studentLogin: 'jsmith',
      }),
    ).toBe(false);
  });

  it('counts every manual run in a team repo, where there is no single student', () => {
    expect(
      isCountedSubmission({ trigger: TRIGGER_MANUAL_RUN, actor: 'teacher', studentLogin: '' }),
    ).toBe(true);
  });
});

describe('buildSubmissionEntry', () => {
  it('numbers the first row 1 and shortens the commit', () => {
    expect(entry()).toEqual({
      number: 1,
      date: '2026-09-21 14:03',
      trigger: TRIGGER_TAG_PUSH,
      actor: 'jsmith',
      tag: 'phase1',
      commit: 'abcdef1',
      counted: true,
    });
  });

  it('numbers after the highest existing row, not the row count', () => {
    const existing = [{ number: 2 }, { number: 5 }];
    expect(entry({ entries: existing }).number).toBe(6);
  });
});

describe('submission log', () => {
  it('round-trips through render and parse', () => {
    const rows = [
      entry(),
      entry({ entries: [{ number: 1 }], trigger: TRIGGER_MANUAL_RUN, actor: 'teacher' }),
    ];
    const parsed = parseSubmissionLog(
      renderSubmissionLog({ student: 'jsmith', tagGroup: 'phase1', entries: rows }),
    );
    expect(parsed).toEqual(rows);
  });

  it('keeps a pipe in a tag name from splitting the row', () => {
    const md = renderSubmissionLog({
      student: 'jsmith',
      tagGroup: 'x',
      entries: [entry({ tagName: 'a|b' })],
    });
    expect(parseSubmissionLog(md)).toHaveLength(1);
  });

  it('reads an empty or missing log as no rows', () => {
    expect(parseSubmissionLog('')).toEqual([]);
    expect(parseSubmissionLog(undefined)).toEqual([]);
  });

  it('states how many runs counted', () => {
    const md = renderSubmissionLog({
      student: 'jsmith',
      tagGroup: 'phase1',
      entries: [entry(), entry({ entries: [{ number: 1 }] })],
    });
    expect(md).toContain('**2** counted');
  });
});

describe('summariseSubmissions and submissionNote', () => {
  it('says nothing for a first submission', () => {
    const current = entry();
    const summary = summariseSubmissions([], current);
    expect(summary).toEqual({ submissions: 1, previous: null, counted: true });
    expect(submissionNote(summary, 'phase1', current)).toBe('');
  });

  it('flags a resubmission with its ordinal and the previous run', () => {
    const first = entry();
    const second = entry({ entries: [first], headSha: 'f'.repeat(40) });
    const summary = summariseSubmissions([first], second);
    expect(summary.submissions).toBe(2);
    expect(summary.previous).toBe(first);
    const note = submissionNote(summary, 'phase1', second);
    expect(note).toContain('resubmitted');
    expect(note).toContain('2nd submission of `phase1`');
    expect(note).toContain('2026-09-21 14:03 UTC, `abcdef1`');
  });

  it('skips uncounted rows when counting and choosing the previous run', () => {
    const first = entry();
    const rerun = entry({
      entries: [first],
      trigger: TRIGGER_MANUAL_RUN,
      actor: 'teacher',
      headSha: 'e'.repeat(40),
    });
    const third = entry({ entries: [first, rerun] });
    const summary = summariseSubmissions([first, rerun], third);
    expect(summary.submissions).toBe(2);
    expect(summary.previous).toBe(first);
  });

  it('marks a manual run by someone else as not counted', () => {
    const first = entry();
    const rerun = entry({ entries: [first], trigger: TRIGGER_MANUAL_RUN, actor: 'teacher' });
    const summary = summariseSubmissions([first], rerun);
    expect(summary).toMatchObject({ submissions: 1, counted: false });
    expect(submissionNote(summary, 'phase1', rerun)).toMatch(
      /^manual run by @teacher — not counted.*1 student submission of `phase1`/,
    );
  });
});

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [112, '112th'],
  ])('%i → %s', (n, expected) => {
    expect(ordinal(n)).toBe(expected);
  });
});

describe('instructor report header', async () => {
  const { formatReport } = await import('../src/report.js');
  const base = {
    questions: '1. Q?',
    files: ['a.js'],
    baseSha: 'a'.repeat(40),
    headSha: 'b'.repeat(40),
    provider: 'openrouter',
    model: 'm',
  };

  it('shows the resubmission note when given one', () => {
    expect(formatReport({ ...base, submissionNote: '⚠️ **resubmitted**' })).toContain(
      '> **Submission:** ⚠️ **resubmitted**',
    );
  });

  it('adds no submission line otherwise', () => {
    expect(formatReport(base)).not.toContain('**Submission:**');
  });
});
