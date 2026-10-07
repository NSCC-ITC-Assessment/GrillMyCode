import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readInputs } from '../src/inputs.js';

const ENV_KEYS = ['INPUT_GITHUB_TOKEN', 'INPUT_API_KEY', 'INPUT_PREVIEW_ONLY'];
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

const read = (value) => {
  if (value !== undefined) process.env.INPUT_PREVIEW_ONLY = value;
  return readInputs().previewOnly;
};

describe('preview_only input', () => {
  it('is off unless set', () => {
    expect(read()).toBe(false);
    expect(read('')).toBe(false);
  });

  it('accepts true and false in any case', () => {
    expect(read(' TRUE ')).toBe(true);
    expect(read('False')).toBe(false);
  });

  it('rejects any other value', () => {
    expect(() => read('yes')).toThrow('preview_only must be "true" or "false"; got "yes".');
  });

  it('needs no api_key, which every other run does', () => {
    delete process.env.INPUT_API_KEY;
    expect(read('true')).toBe(true);
    expect(() => read('false')).toThrow(/api_key is required/);
  });
});
