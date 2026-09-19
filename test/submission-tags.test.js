import { describe, expect, it } from 'vitest';
import {
  findMatchingTagPattern,
  isSafeTagPattern,
  pickPreviousSubmissionTag,
} from '../src/tags.js';

describe('isSafeTagPattern', () => {
  it.each(['complete', 'phase1', 'submit/*', 'release/**', 'v[0-9]+', 'milestone-?', 'a.b_c'])(
    'accepts %s',
    (pattern) => {
      expect(isSafeTagPattern(pattern)).toBe(true);
    },
  );

  it.each([
    ['negation', '!submit/*'],
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
    expect(findMatchingTagPattern(['submit/*'], 'submit/2026-09-19T14-03-22Z-a1b2c3d')).toBe(
      'submit/*',
    );
    expect(findMatchingTagPattern(['submit/*'], 'submit/a/b')).toBeNull();
    expect(findMatchingTagPattern(['submit/*'], 'submit')).toBeNull();
  });

  it('lets ** cross a slash', () => {
    expect(findMatchingTagPattern(['submit/**'], 'submit/a/b')).toBe('submit/**');
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
  const patterns = ['phase*', 'submit/*'];

  it('picks the nearest earlier tag matching any configured pattern', () => {
    const tags = [
      { name: 'phase1', commit: 'c1' },
      { name: 'submit/x', commit: 'c2' },
    ];
    expect(pickPreviousSubmissionTag({ tags, ancestors, patterns, headSha: 'head' })).toEqual({
      name: 'submit/x',
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
      { name: 'submit/y', commit: 'head' },
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
