import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { ISSUE_LAYOUT_VERSION } from '../src/constants.js';
import { neutraliseIssueAutoLinks } from '../src/delivery/issue.js';
import { QUESTIONS_COMMENT_OPEN, formatReport, questionsComment } from '../src/report.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), warning: vi.fn() }));

const HEAD_SHA = '9b8e7d6c5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c';

/** A numbered question as the pipeline holds it, with everything a student must not see. */
const question = (number, overrides = {}) => ({
  number,
  broader: false,
  aboutStarter: false,
  question: `What does SECRET_QUESTION_${number} do?`,
  answer: `SECRET_ANSWER_${number}`,
  distractors: [`SECRET_DISTRACTOR_${number}A`, `SECRET_DISTRACTOR_${number}B`],
  snippets: [
    { file: 'src/cart.js', start: 3, end: 9, language: 'js', code: `SECRET_CODE_${number}();` },
  ],
  ...overrides,
});

/** The record a comment carries, read back the way an extension would. */
function read(comment) {
  expect(comment.startsWith(QUESTIONS_COMMENT_OPEN)).toBe(true);
  expect(comment.endsWith(' -->')).toBe(true);
  return JSON.parse(comment.slice(QUESTIONS_COMMENT_OPEN.length, -' -->'.length));
}

const report = (extra = {}) =>
  formatReport({
    questions: '**Question 1:**\n\n**Why?**',
    files: ['src/cart.js'],
    baseSha: '4f1c9a2b7d3e5f60718293a4b5c6d7e8f9012345',
    headSha: HEAD_SHA,
    provider: 'openrouter',
    model: 'a-model',
    ...extra,
  });

describe('questionsComment', () => {
  const questions = [question(1), question(2, { broader: true, snippets: [] })];

  it('carries the version, the commit and where each question points', () => {
    expect(read(questionsComment({ headSha: HEAD_SHA, questions }))).toEqual({
      version: ISSUE_LAYOUT_VERSION,
      headSha: HEAD_SHA,
      questions: [
        {
          number: 1,
          broader: false,
          snippets: [{ file: 'src/cart.js', start_line: 3, end_line: 9 }],
        },
        { number: 2, broader: true, snippets: [] },
      ],
    });
  });

  // The student can read the comment. Naming the fields allowed, rather than
  // the ones refused, means a field added to a question later stays out too.
  it('never carries an answer, a distractor, the question or the code', () => {
    const comment = questionsComment({ headSha: HEAD_SHA, questions });
    expect(comment).not.toContain('SECRET');
    const record = read(comment);
    expect(Object.keys(record)).toEqual(['version', 'headSha', 'questions']);
    for (const q of record.questions) {
      expect(Object.keys(q)).toEqual(['number', 'broader', 'snippets']);
      for (const s of q.snippets)
        expect(Object.keys(s)).toEqual(['file', 'start_line', 'end_line']);
    }
  });

  it('cannot be closed early by a file name', () => {
    const file = 'src/--> <b>x</b>.js';
    const comment = questionsComment({
      headSha: HEAD_SHA,
      questions: [question(1, { snippets: [{ file, start: 1, end: 2, language: '', code: '' }] })],
    });
    expect(comment.indexOf('-->')).toBe(comment.length - '-->'.length);
    expect(comment.slice(QUESTIONS_COMMENT_OPEN.length)).not.toContain('<');
    expect(read(comment).questions[0].snippets[0].file).toBe(file);
  });

  // postIssue puts a zero-width space after an @ or a # in the report's prose,
  // which would corrupt a path in the comment.
  it('comes through the auto-link defusing unchanged', () => {
    const file = 'packages/@scope/#1 `notes`.js';
    const comment = questionsComment({
      headSha: HEAD_SHA,
      questions: [question(1, { snippets: [{ file, start: 1, end: 2, language: '', code: '' }] })],
    });
    const body = `Before @someone #12 \`code\`\n\n${comment}\n\nAfter @someone \`more\``;
    const posted = neutraliseIssueAutoLinks(body);
    expect(posted).not.toBe(body);
    expect(posted).toContain(comment);
    expect(read(comment).questions[0].snippets[0].file).toBe(file);
  });
});

describe('formatReport and the hidden comment', () => {
  it('puts it straight after the heading, so a cut report keeps it', () => {
    const lines = report({ issueQuestions: [question(1)] }).split('\n');
    expect(lines[0]).toMatch(/^## .*GrillMyCode$/);
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe(questionsComment({ headSha: HEAD_SHA, questions: [question(1)] }));
    expect(lines[3]).toBe('');
  });

  // The PDF source and the instructor's copy are built without it.
  it('leaves it out unless the questions are passed', () => {
    expect(report()).not.toContain('gmc:questions');
  });

  it('writes it for a report with no questions left to show', () => {
    expect(read(report({ issueQuestions: [] }).split('\n')[2]).questions).toEqual([]);
  });
});

describe('the fixtures the extensions read', () => {
  const dir = join(import.meta.dirname, '..', 'extensions', 'fixtures', 'current');

  // with-answers is posted with include_answers on, so its Markdown shows the
  // answers. Its comment still must not.
  it.each(readdirSync(dir))('%s: the comment carries no answer or distractor', (name) => {
    const body = readFileSync(join(dir, name, 'body.md'), 'utf-8');
    const comment = body.split('\n').find((line) => line.startsWith(QUESTIONS_COMMENT_OPEN));
    expect(comment).not.toMatch(/answer|distractor/i);
    for (const q of read(comment).questions) {
      expect(Object.keys(q)).toEqual(['number', 'broader', 'snippets']);
    }
  });
});
