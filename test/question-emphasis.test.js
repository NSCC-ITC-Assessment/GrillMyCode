import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readInputs } from '../src/inputs.js';
import { buildPrompt } from '../src/prompt/prompt.js';
import { QUESTION_OPENINGS } from '../src/prompt/openings.js';
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

  it('has research list lookup targets and bar repeats of one', () => {
    const prompt = system({ questionEmphasis: 'research' });
    expect(prompt).toContain("- Before writing any question, go through the student's code");
    expect(prompt).toContain(
      '- No two questions may turn on the same built-in, cast, operator, or condition',
    );
  });

  // A question a student can answer by reading the snippet aloud needs no research.
  it('rules out snippet restatements under research only', () => {
    const rule = 'if a student could answer by reading the snippet aloud';
    expect(system({ questionEmphasis: 'research' })).toMatch(
      new RegExp(`1\\. REASONING STEP — .*${rule}`),
    );
    expect(system({ questionEmphasis: 'tracing' })).not.toContain(rule);
    expect(system({})).not.toContain(rule);
  });

  // Feeding a value past a bound the snippet shows is the same reading.
  it('rules out stated inputs checked against a visible condition under research only', () => {
    const rule = 'Checking a stated input against such a condition';
    expect(system({ questionEmphasis: 'research' })).toMatch(
      new RegExp(`1\\. REASONING STEP — .*${rule}`),
    );
    expect(system({ questionEmphasis: 'tracing' })).not.toContain(rule);
    expect(system({})).not.toContain(rule);
  });

  // Editing a data value and recounting is tracing, not research.
  it('limits type 3 changes to language and library use under research only', () => {
    const rule = 'A type 3 change must alter how the code uses the language or a library';
    expect(system({ questionEmphasis: 'research' })).toMatch(
      new RegExp(`1\\. REASONING STEP — .*${rule}.*never a data value, record, or literal`),
    );
    expect(system({ questionEmphasis: 'tracing' })).not.toContain(rule);
    expect(system({})).not.toContain(rule);
  });

  const openingCheck = (opts) => system(opts).match(/7\. OPENING — .*/)[0];

  // Bare What let the model ask what a call does in general or read a variable off the snippet.
  it('swaps bare What for the research What forms under research only', () => {
    const research = openingCheck({ questionEmphasis: 'research' });
    expect(research).toContain('no other opening: What happens when, What happens if,');
    for (const form of QUESTION_OPENINGS.research.what) expect(research).toContain(form);
    expect(research).toContain('Square brackets describe what goes in their place');
    for (const mode of ['balanced', 'tracing']) {
      expect(openingCheck({ questionEmphasis: mode })).toContain('no other opening: What, Which,');
      expect(openingCheck({ questionEmphasis: mode })).not.toContain('Square brackets');
    }
  });

  it('adds the research banned openings under research only', () => {
    const banned = openingCheck({ questionEmphasis: 'research' }).split('Never begin with')[1];
    for (const opening of QUESTION_OPENINGS.research.banned) expect(banned).toContain(opening);
    expect(openingCheck({})).not.toContain('What is the direct impact of');
  });

  it('keeps every research What form a What opening', () => {
    for (const form of QUESTION_OPENINGS.research.what) expect(form).toMatch(/^What /);
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
    expect(system({ questionEmphasis: 'research' })).toContain(
      'In what order as well as What in the forms the OPENING check allows in this run.',
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
    const { base, ...modes } = QUESTION_OPENINGS;
    for (const { suggest } of Object.values(modes)) {
      for (const opening of suggest) expect(base.allowed).toContain(opening);
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
