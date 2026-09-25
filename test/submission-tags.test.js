import { describe, expect, it } from 'vitest';
import {
  findMatchingTagPattern,
  isSafeTagName,
  isSafeTagPattern,
  namedDiffBaseTag,
  pickPreviousSubmissionTag,
} from '../src/tags.js';

describe('isSafeTagName', () => {
  it.each(['phase1', 'Phase-1', 'sprint/3', 'v1.2.0', '_draft'])('accepts %s', (name) => {
    expect(isSafeTagName(name)).toBe(true);
  });

  it.each([
    ['an empty name', ''],
    ['a wildcard', 'phase*'],
    ['a leading dash', '-phase1'],
    ['a leading slash', '/phase1'],
    ['a trailing slash', 'phase1/'],
    ['a double dot', 'phase..1'],
    ['whitespace', 'phase 1'],
    ['a caret', 'phase1^'],
  ])('rejects %s', (_label, name) => {
    expect(isSafeTagName(name)).toBe(false);
  });
});

describe('namedDiffBaseTag', () => {
  it('returns the tag name from the tag: form', () => {
    expect(namedDiffBaseTag('tag:Phase1')).toBe('Phase1');
  });

  it.each(['cumulative', 'previous-tag', '', undefined])('returns "" for %s', (value) => {
    expect(namedDiffBaseTag(value)).toBe('');
  });
});

describe('isSafeTagPattern', () => {
  it.each(['complete', 'phase1', 'sprint/*', 'release/**', 'v[0-9]+', 'milestone-?', 'a.b_c'])(
    'accepts %s',
    (pattern) => {
      expect(isSafeTagPattern(pattern)).toBe(true);
    },
  );

  it.each([
    ['negation', '!sprint/*'],
    ['whitespace', 'phase 1'],
    ['a quote', 'phase"1'],
    ['a leading quantifier', '+phase'],
    ['a stacked quantifier', 'v*+'],
    ['an empty string', ''],
  ])('rejects %s', (_label, pattern) => {
    expect(isSafeTagPattern(pattern)).toBe(false);
  });
});

describe('findMatchingTagPattern', () => {
  it('matches a literal name exactly and case-sensitively', () => {
    expect(findMatchingTagPattern(['complete'], 'complete')).toBe('complete');
    expect(findMatchingTagPattern(['complete'], 'Complete')).toBeNull();
    expect(findMatchingTagPattern(['complete'], 'complete2')).toBeNull();
  });

  it('keeps regex metacharacters in a literal name literal', () => {
    expect(findMatchingTagPattern(['v1.0'], 'v1.0')).toBe('v1.0');
    expect(findMatchingTagPattern(['v1.0'], 'v1x0')).toBeNull();
  });

  it('does not let * cross a slash', () => {
    expect(findMatchingTagPattern(['sprint/*'], 'sprint/3')).toBe('sprint/*');
    expect(findMatchingTagPattern(['sprint/*'], 'sprint/a/b')).toBeNull();
    expect(findMatchingTagPattern(['sprint/*'], 'sprint')).toBeNull();
  });

  it('lets ** cross a slash', () => {
    expect(findMatchingTagPattern(['sprint/**'], 'sprint/a/b')).toBe('sprint/**');
  });

  it('supports ?, + and character classes on the preceding character', () => {
    expect(findMatchingTagPattern(['phases?'], 'phase')).toBe('phases?');
    expect(findMatchingTagPattern(['phases?'], 'phases')).toBe('phases?');
    expect(findMatchingTagPattern(['phase[0-9]+'], 'phase12')).toBe('phase[0-9]+');
    expect(findMatchingTagPattern(['phase[0-9]+'], 'phase')).toBeNull();
  });

  it('returns the first listed pattern when several match', () => {
    expect(findMatchingTagPattern(['phase1', 'phase*'], 'phase1')).toBe('phase1');
    expect(findMatchingTagPattern(['phase*', 'phase1'], 'phase1')).toBe('phase*');
  });

  it('skips an unsafe pattern rather than matching through it', () => {
    expect(findMatchingTagPattern(['!phase1'], 'phase1')).toBeNull();
  });
});

describe('pickPreviousSubmissionTag', () => {
  // History, nearest first: head → c3 → c2 → c1
  const ancestors = ['head', 'c3', 'c2', 'c1'];
  const patterns = ['phase*', 'sprint/*'];

  it('picks the nearest earlier tag matching any configured pattern', () => {
    const tags = [
      { name: 'phase1', commit: 'c1' },
      { name: 'sprint/x', commit: 'c2' },
    ];
    expect(pickPreviousSubmissionTag({ tags, ancestors, patterns, headSha: 'head' })).toEqual({
      name: 'sprint/x',
      commit: 'c2',
    });
  });

  it('ignores tags that match no configured pattern', () => {
    const tags = [
      { name: 'phase1', commit: 'c1' },
      { name: 'experiment', commit: 'c3' },
    ];
    expect(pickPreviousSubmissionTag({ tags, ancestors, patterns, headSha: 'head' })?.name).toBe(
      'phase1',
    );
  });

  it('ignores tags on the head commit, including the one that started the run', () => {
    const tags = [
      { name: 'phase2', commit: 'head' },
      { name: 'sprint/y', commit: 'head' },
      { name: 'phase1', commit: 'c2' },
    ];
    expect(pickPreviousSubmissionTag({ tags, ancestors, patterns, headSha: 'head' })?.name).toBe(
      'phase1',
    );
  });

  it('ignores tags on commits that are not ancestors of the head', () => {
    const tags = [{ name: 'phase9', commit: 'elsewhere' }];
    expect(pickPreviousSubmissionTag({ tags, ancestors, patterns, headSha: 'head' })).toBeNull();
  });

  it('breaks a tie on one commit by name so the choice is stable', () => {
    const tags = [
      { name: 'phase2', commit: 'c3' },
      { name: 'phase1', commit: 'c3' },
    ];
    expect(pickPreviousSubmissionTag({ tags, ancestors, patterns, headSha: 'head' })?.name).toBe(
      'phase1',
    );
  });

  it('returns null when there is no earlier submission tag', () => {
    expect(
      pickPreviousSubmissionTag({ tags: [], ancestors, patterns, headSha: 'head' }),
    ).toBeNull();
  });
});
