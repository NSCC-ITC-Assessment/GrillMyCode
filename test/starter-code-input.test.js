import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readInputs } from '../src/inputs.js';

const INPUTS = {
  starter_code: 'INPUT_STARTER_CODE',
  previous_work: 'INPUT_PREVIOUS_WORK',
  include_initial_commit: 'INPUT_INCLUDE_INITIAL_COMMIT',
  include_codebase_context: 'INPUT_INCLUDE_CODEBASE_CONTEXT',
  starter_questions_one_in: 'INPUT_STARTER_QUESTIONS_ONE_IN',
};
const ENV_KEYS = ['INPUT_GITHUB_TOKEN', 'INPUT_API_KEY', ...Object.values(INPUTS)];
const saved = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  process.env.INPUT_GITHUB_TOKEN = 'token';
  process.env.INPUT_API_KEY = 'key';
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const read = (values = {}) => {
  for (const [name, value] of Object.entries(values)) process.env[INPUTS[name]] = value;
  const { starterCode, previousWork } = readInputs();
  return { starterCode, previousWork };
};

describe('starter_code and previous_work inputs', () => {
  it('default to ignore and context', () => {
    expect(read()).toEqual({ starterCode: 'ignore', previousWork: 'context' });
  });

  it('accept their values in any case', () => {
    expect(read({ starter_code: ' Ask ', previous_work: 'IGNORE' })).toEqual({
      starterCode: 'ask',
      previousWork: 'ignore',
    });
  });

  it.each(['starter_code', 'previous_work'])('%s rejects an unknown value', (name) => {
    expect(() => read({ [name]: 'include' })).toThrow(new RegExp(`${name} must be one of`));
  });
});

describe('the inputs starter_code replaces', () => {
  it.each([
    [{ include_initial_commit: 'true' }, 'none', 'context'],
    [{ include_initial_commit: 'false' }, 'ignore', 'context'],
    [{ include_codebase_context: 'true' }, 'context', 'context'],
    [{ include_codebase_context: 'false' }, 'ignore', 'ignore'],
    [{ include_initial_commit: 'true', include_codebase_context: 'true' }, 'none', 'context'],
  ])('map %o', (values, starterCode, previousWork) => {
    expect(read(values)).toEqual({ starterCode, previousWork });
  });

  it('give way to the new inputs when those are set', () => {
    expect(
      read({
        starter_code: 'ask',
        previous_work: 'context',
        include_initial_commit: 'true',
        include_codebase_context: 'false',
      }),
    ).toEqual({ starterCode: 'ask', previousWork: 'context' });
  });
});

describe('starter_questions_one_in input', () => {
  const oneIn = (value) => {
    if (value !== undefined) process.env.INPUT_STARTER_QUESTIONS_ONE_IN = value;
    return readInputs().starterQuestionsOneIn;
  };

  it('defaults to 5', () => {
    expect(oneIn()).toBe(5);
    expect(oneIn('not a number')).toBe(5);
  });

  it('reads a whole number', () => {
    expect(oneIn('10')).toBe(10);
  });

  it.each([
    ['1', 2],
    ['0', 2],
    ['-3', 2],
    ['80', 50],
  ])('clamps %s to %i', (value, expected) => {
    expect(oneIn(value)).toBe(expected);
  });
});
