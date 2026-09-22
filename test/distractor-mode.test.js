import { describe, expect, it } from 'vitest';
import { buildPrompt } from '../src/prompt.js';
import { redactStudentQuestions, stripAnswers } from '../src/postprocess.js';

const BASE = {
  codeContent: '**app.js**\n\n```js\nconst total = items.length;\n```',
  files: ['app.js'],
  numQuestions: 6,
  instructorContext: '',
  assignmentContext: '',
};

/** The system prompt for one mode. */
function systemPrompt(includeDistractors) {
  return buildPrompt({ ...BASE, includeDistractors })[0].content;
}

/** The user message for one mode. */
function userPrompt(includeDistractors) {
  return buildPrompt({ ...BASE, includeDistractors })[1].content;
}

describe('buildPrompt distractor mode', () => {
  it('asks for distractors by default', () => {
    expect(buildPrompt(BASE)[0].content).toContain('**Distractors for Multiple-Choice Quiz:**');
  });

  it('asks for distractors when the flag is set', () => {
    const prompt = systemPrompt(true);
    expect(prompt).toContain('**Distractors for Multiple-Choice Quiz:**');
    expect(prompt).toContain('UNIQUENESS RULE');
    expect(prompt).toContain('VISUAL BALANCE');
  });

  // The rules exist only to make three wrong options sit convincingly beside
  // the right one. A stray mention in the answers-only prompt would have the
  // model emit options no parser downstream is expecting.
  it('says nothing about distractors when the flag is clear', () => {
    expect(systemPrompt(false)).not.toMatch(/distractor|incorrect option/i);
    expect(userPrompt(false)).not.toMatch(/distractor|incorrect option/i);
  });

  // Stated once beside the question-count rule and again in the rejection list
  // and the user message: an omitted distractor block is a silent failure
  // downstream, so it is the one requirement worth repeating.
  it('states up front that a question without distractors is a failed response', () => {
    const prompt = systemPrompt(true);
    expect(prompt).toContain('DISTRACTORS ARE NOT OPTIONAL');
    expect(prompt).toContain('There are NO exemptions.');
    expect(prompt).toMatch(
      /Omitting the .*Distractors for Multiple-Choice Quiz.* section for ANY question/,
    );
    expect(userPrompt(true)).toContain('mandatory for every question without exception');
  });

  // The counts are derived, so a non-default question count has to carry
  // through or the model is handed a self-check it cannot satisfy.
  it('scales the distractor counts to the question count', () => {
    const prompt = buildPrompt({ ...BASE, numQuestions: 4, includeDistractors: true })[0].content;
    expect(prompt).toContain('4 questions means 4 distractor sections and 12 distractor bullets');
    expect(prompt).toContain('and 12 distractor bullets. If any of those three counts is short');
  });

  it('drops the length machinery that only balances options against each other', () => {
    const prompt = systemPrompt(false);
    expect(prompt).not.toContain('VISUAL BALANCE');
    expect(prompt).not.toContain('JUSTIFICATION SYMMETRY');
    expect(prompt).not.toContain('STRUCTURAL MATCHING');
    expect(prompt).not.toContain('<!-- Lengths:');
  });

  // Everything postprocess.js and generate-lms-quiz.yml key on has to survive
  // in both modes, or the answers-only reply parses as a malformed one and the
  // fail-closed guards withhold every question in it.
  it.each([true, false])('keeps the parsed structure intact (distractors: %s)', (mode) => {
    const prompt = systemPrompt(mode);
    expect(prompt).toContain('<!-- gmc:answer -->');
    expect(prompt).toContain('<!-- /gmc:answer -->');
    expect(prompt).toContain('**Answer:**');
    expect(prompt).toContain('ANSWER CONTAINER (MANDATORY)');
    expect(prompt).toContain('STRUCTURAL HEADINGS ARE LITERAL (MANDATORY)');
  });

  it.each([true, false])('keeps the answer rules the student is graded on (%s)', (mode) => {
    const prompt = systemPrompt(mode);
    expect(prompt).toContain('SHORT-ANSWER QUESTIONS (exactly one in every three)');
    expect(prompt).toContain('at least 8 words');
    expect(prompt).toContain('CORRECT ANSWER LENGTH CAP');
    expect(prompt).toContain('ANTI-TRUNCATION RULE');
  });

  it('is substantially shorter without the distractor rules', () => {
    expect(systemPrompt(false).length).toBeLessThan(systemPrompt(true).length * 0.6);
  });
});

/** A model reply in the answers-only shape: one bullet, no options. */
const ANSWERS_ONLY = [
  '**app.js**',
  '',
  '```js',
  'const total = items.length;',
  '```',
  '',
  '1. What does `total` hold after this line runs?',
  '',
  '   <!-- gmc:answer -->',
  '   **Answer:**',
  '   - It holds the number of entries currently in the items array, counted once at assignment time',
  '   <!-- /gmc:answer -->',
  '',
  '---',
  '',
  '**app.js**',
  '',
  '```js',
  'return total > 0;',
  '```',
  '',
  '2. What does this return when `items` is empty?',
  '',
  '   <!-- gmc:answer -->',
  '   **Answer:**',
  '   - false',
  '   <!-- /gmc:answer -->',
].join('\n');

describe('answers-only output through the report pipeline', () => {
  it('withholds nothing and leaks nothing in the student view', () => {
    const { text, structural, leak, dropped } = redactStudentQuestions(ANSWERS_ONLY);
    expect(dropped).toBe(0);
    expect(structural).toBe(0);
    expect(leak).toBe(0);
    expect(text).toContain('What does `total` hold after this line runs?');
    expect(text).not.toContain('counted once at assignment time');
    expect(text).not.toContain('**Answer:**');
    expect(text).not.toContain('gmc:answer');
  });

  it('keeps the answer intact for include_answers', () => {
    const out = stripAnswers(ANSWERS_ONLY, { keepAnswers: true });
    expect(out).toContain('**Answer:**');
    expect(out).toContain('counted once at assignment time');
    expect(out).not.toContain('gmc:answer');
    // The separator between the two questions has to survive the container
    // trim, or the two merge into one block downstream.
    expect(out).toContain('\n---\n');
  });

  it('leaves the instructor copy untouched', () => {
    expect(ANSWERS_ONLY).toContain('<!-- gmc:answer -->');
  });
});
