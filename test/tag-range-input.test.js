import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tagRangeProblem } from '../extensions/vscode/src/shared/tags.js';
import { readInputs } from '../src/inputs.js';

const ENV_KEYS = ['INPUT_GITHUB_TOKEN', 'INPUT_API_KEY', 'INPUT_TAG_RANGE'];
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

const tagRange = (value) => {
  if (value === undefined) delete process.env.INPUT_TAG_RANGE;
  else process.env.INPUT_TAG_RANGE = value;
  return readInputs().tagRange;
};

describe('tag_range input', () => {
  it('is null when not set', () => {
    expect(tagRange(undefined)).toBeNull();
    expect(tagRange('   ')).toBeNull();
  });

  it('reads both tags', () => {
    expect(tagRange('phase1..phase2')).toEqual({ from: 'phase1', to: 'phase2' });
  });

  it('reads a range with no end tag', () => {
    expect(tagRange('phase1..')).toEqual({ from: 'phase1', to: '' });
  });

  it('keeps the case of the names and ignores spaces around them', () => {
    expect(tagRange(' Phase1 .. Phase2 ')).toEqual({ from: 'Phase1', to: 'Phase2' });
  });

  it('accepts names with dots and slashes', () => {
    expect(tagRange('v1.0..release/v2.0')).toEqual({ from: 'v1.0', to: 'release/v2.0' });
  });

  it.each([
    ['no separator', 'phase1'],
    ['no start tag', '..phase2'],
    ['only the separator', '..'],
    ['a third tag', 'phase1..phase2..final'],
    ['three dots', 'phase1...phase2'],
    ['a wildcard', 'phase*..phase2'],
    ['a space inside a name', 'phase 1..phase2'],
    ['a name that starts like an option', '-phase1..phase2'],
    ['an end tag that starts like an option', 'phase1..-phase2'],
    ['a name ending in a slash', 'phase1/..phase2'],
  ])('rejects %s', (_, value) => {
    expect(() => tagRange(value)).toThrow(/not a usable range/);
  });

  it('rejects a range that starts and ends at the same tag', () => {
    expect(() => tagRange('phase1..phase1')).toThrow(/same tag/);
  });
});

describe("the extension's copy of the tag_range rule", () => {
  const accepted = (value) => {
    try {
      tagRange(value);
      return true;
    } catch {
      return false;
    }
  };

  it.each([
    'phase1..phase2',
    'phase1..',
    ' Phase1 .. Phase2 ',
    'v1.0..release/v2.0',
    'phase1',
    '..phase2',
    '..',
    'phase1..phase2..final',
    'phase1...phase2',
    'phase1....phase2',
    'phase*..phase2',
    'phase 1..phase2',
    '-phase1..phase2',
    'phase1..-phase2',
    'phase1/..phase2',
    'phase1..phase1',
    '.a..b',
    'a...',
  ])('agrees with the action about "%s"', (value) => {
    expect(tagRangeProblem(value.trim()) === '').toBe(accepted(value));
  });
});
