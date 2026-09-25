import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readInputs } from '../src/inputs.js';

const ENV_KEYS = ['INPUT_GITHUB_TOKEN', 'INPUT_API_KEY', 'INPUT_TAG_DIFF_BASE'];
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

const tagDiffBase = (value) => {
  if (value === undefined) delete process.env.INPUT_TAG_DIFF_BASE;
  else process.env.INPUT_TAG_DIFF_BASE = value;
  return readInputs().tagDiffBase;
};

describe('tag_diff_base input', () => {
  it('defaults to cumulative', () => {
    expect(tagDiffBase(undefined)).toBe('cumulative');
  });

  it('accepts the modes in any case', () => {
    expect(tagDiffBase(' Previous-Tag ')).toBe('previous-tag');
  });

  it('keeps the case of a named tag and normalises the prefix', () => {
    expect(tagDiffBase('TAG: Phase1')).toBe('tag:Phase1');
  });

  it('rejects a named tag with a wildcard', () => {
    expect(() => tagDiffBase('tag:phase*')).toThrow(/does not name a usable tag/);
  });

  it('rejects an empty named tag', () => {
    expect(() => tagDiffBase('tag:')).toThrow(/does not name a usable tag/);
  });

  it('rejects an unknown mode and mentions the tag: form', () => {
    expect(() => tagDiffBase('since-phase1')).toThrow(/"tag:<tag name>"/);
  });
});
