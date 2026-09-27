import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readInputs } from '../src/inputs.js';
import { ALLOWED_OPENINGS, EMPHASES, buildPrompt } from '../src/prompt.js';
import { formatRawOutput } from '../src/report.js';

const ENV_KEYS = ['INPUT_GITHUB_TOKEN', 'INPUT_API_KEY', 'INPUT_QUESTION_EMPHASIS'];
const saved = {};

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  process.env.INPUT_GITHUB_TOKEN = 'token';
  process.env.INPUT_API_KEY = 'key';
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const questionEmphasis = (value) => {
  if (value === undefined) delete process.env.INPUT_QUESTION_EMPHASIS;
  else process.env.INPUT_QUESTION_EMPHASIS = value;
  return readInputs().questionEmphasis;
};

describe('question_emphasis input', () => {
  it('defaults to balanced', () => {
    expect(questionEmphasis(undefined)).toBe('balanced');
  });

  it('accepts the modes in any case', () => {
    expect(questionEmphasis(' Research ')).toBe('research');
    expect(questionEmphasis('TRACING')).toBe('tracing');
  });

  it('rejects an unknown mode and lists the accepted ones', () => {
    expect(() => questionEmphasis('deep')).toThrow(/"balanced", "research", "tracing"/);
  });
});

const BASE = { codeContent: 'code', files: ['a.js'], numQuestions: 20 };
const system = (opts) => buildPrompt({ ...BASE, ...opts })[0].content;
/** The prompt with its per-run nonce blanked, so two builds can be compared. */
const stable = (opts) => system(opts).replace(/[0-9a-f]{24}/g, 'NONCE');

describe('buildPrompt question emphasis', () => {
  it('leaves the prompt unchanged when balanced', () => {
    expect(stable({ questionEmphasis: 'balanced' })).toBe(stable({}));
    expect(system({})).toContain('At least half of the questions must be type 1, 2, 3, 5, or 9');
  });

  it('restricts research to documentation-dependent types', () => {
    const prompt = system({ questionEmphasis: 'research' });
    expect(prompt).toContain('- EVERY question must be type 3, 4, 7, 8, 9, or 10 — ');
    expect(prompt).toContain('Types 1, 2, 5, and 6 are not used in this run');
    expect(prompt).toContain('At least 5 of the 20 questions must be type 8 or type 10.');
    expect(prompt).not.toContain('At least half of the questions must be type 1, 2, 3, 5, or 9');
  });

  it('restricts tracing to execution types', () => {
    const prompt = system({ questionEmphasis: 'tracing' });
    expect(prompt).toContain('- EVERY question must be type 1, 2, 5, or 9 — ');
    expect(prompt).toContain('Types 3, 4, 6, 7, 8, and 10 are not used in this run');
    expect(prompt).not.toContain('Use type 10 wherever');
  });

  // An emphasis the count rule could relax would not be all-or-nothing.
  it.each(['research', 'tracing'])('exempts %s from the count rule relaxation', (mode) => {
    expect(system({ questionEmphasis: mode })).toContain(
      'Never relax the rule above, even where THE COUNT COMES FIRST says to relax the MIXING RULES quotas.',
    );
  });

  // The default list names Why and Under what condition, which no tracing type can use.
  it('draws on the emphasis openings in the question-word rule', () => {
    expect(system({ questionEmphasis: 'tracing' })).toContain(
      'Draw on Which, Where, How many, How often, How much, and In what order as well as What.',
    );
    expect(system({ questionEmphasis: 'research' })).toContain(
      'Draw on Why, How would … change if,',
    );
  });

  it.each([
    [1, 1],
    [6, 2],
    [20, 5],
  ])('scales the research lookup quota to %i questions', (numQuestions, lookups) => {
    const prompt = system({ numQuestions, questionEmphasis: 'research' });
    expect(prompt).toContain(`At least ${lookups} of the ${numQuestions} questions must be type 8`);
  });

  it('only uses openings that are already allowed', () => {
    for (const { openings } of Object.values(EMPHASES)) {
      for (const opening of openings) expect(ALLOWED_OPENINGS).toContain(opening);
    }
  });
});

describe('raw output records the emphasis', () => {
  const opts = {
    rawOutput: '{}',
    baseSha: 'a'.repeat(40),
    headSha: 'b'.repeat(40),
    provider: 'openrouter',
    model: 'some/model',
  };
  const request = { numQuestions: 10, temperature: 0.2 };

  it('names a tilt in the settings line', () => {
    const out = formatRawOutput({ ...opts, request: { ...request, questionEmphasis: 'research' } });
    expect(out).toContain('10 questions requested · research emphasis · temperature 0.2');
  });

  it('says nothing for balanced', () => {
    const out = formatRawOutput({ ...opts, request: { ...request, questionEmphasis: 'balanced' } });
    expect(out).toContain('10 questions requested · temperature 0.2');
  });
});
