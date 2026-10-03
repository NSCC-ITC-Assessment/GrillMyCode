import { describe, expect, it } from 'vitest';
import { formatReleaseNotes, parseArgs } from '../scripts/release-notes.js';

/** Commit messages as `git log --pretty=format:%B%x1e` prints them. */
const log = (...messages) => messages.map((m) => `${m}\x1e`).join('\n');

describe('formatReleaseNotes', () => {
  it('groups commits by type, in a fixed order', () => {
    const notes = formatReleaseNotes(
      log(
        'docs: explain tag triggers',
        'fix: handle an empty diff',
        'feat: add starter_code',
        'fix: retry on 502',
      ),
    );
    expect(notes).toBe(
      [
        "### What's Changed",
        '',
        '### Features',
        '',
        '- add starter_code',
        '',
        '### Bug Fixes',
        '',
        '- handle an empty diff',
        '- retry on 502',
        '',
        '### Documentation',
        '',
        '- explain tag triggers',
        '',
      ].join('\n'),
    );
  });

  it('shows a scope in bold', () => {
    expect(formatReleaseNotes(log('feat(vscode): pin questions to lines'))).toContain(
      '- **vscode:** pin questions to lines',
    );
  });

  it('files build and ci under chores', () => {
    const notes = formatReleaseNotes(log('ci: cache pnpm', 'build: bump node', 'chore: tidy'));
    expect(notes).toContain('### Chores & Maintenance\n\n- cache pnpm\n- bump node\n- tidy');
  });

  it('files any other type, and a header that is not conventional, under Other', () => {
    const notes = formatReleaseNotes(log('style: reformat', 'Update README'));
    expect(notes).toContain('### Other\n\n- reformat\n- Update README');
  });

  it('lists a further conventional line in the body as an entry of its own', () => {
    const notes = formatReleaseNotes(log('feat: add an input\n\nfix: correct its default'));
    expect(notes).toContain('### Features\n\n- add an input');
    expect(notes).toContain('### Bug Fixes\n\n- correct its default');
  });

  it('never takes a trailer or a sentence with a colon for an entry', () => {
    const notes = formatReleaseNotes(
      log(
        'fix: handle an empty diff\n\nNote: this changes nothing else.\n\nRefs: 12\nCo-Authored-By: Someone <s@example.com>',
      ),
    );
    expect(notes).toBe("### What's Changed\n\n### Bug Fixes\n\n- handle an empty diff\n");
  });

  it('reads only the first line of a subject that runs on', () => {
    expect(formatReleaseNotes(log('fix: one thing\nand some more text'))).toBe(
      "### What's Changed\n\n### Bug Fixes\n\n- one thing\n",
    );
  });

  it('leaves out the docs snapshot commit a release makes', () => {
    expect(formatReleaseNotes(log('docs: update v0 snapshot', 'fix: a real change'))).toBe(
      "### What's Changed\n\n### Bug Fixes\n\n- a real change\n",
    );
  });

  it('returns nothing when there is nothing to list', () => {
    expect(formatReleaseNotes('')).toBe('');
    expect(formatReleaseNotes(log('docs: update v0 snapshot'))).toBe('');
  });
});

describe('parseArgs', () => {
  it('reads the options, collecting every --path', () => {
    expect(
      parseArgs([
        '--tag',
        'v0.25.0',
        '--match',
        'v[0-9]*',
        '--path',
        '.',
        '--path',
        ':(exclude)extensions',
        '--out',
        'notes.md',
      ]),
    ).toEqual({
      tag: 'v0.25.0',
      match: 'v[0-9]*',
      path: ['.', ':(exclude)extensions'],
      out: 'notes.md',
    });
  });

  it('needs no --path', () => {
    expect(parseArgs(['--tag', 't', '--match', 'm', '--out', 'o']).path).toEqual([]);
  });

  it.each([
    [['--match', 'm', '--out', 'o'], '--tag is required'],
    [['--tag', 't', '--out', 'o'], '--match is required'],
    [['--tag', 't', '--match', 'm'], '--out is required'],
    [['--tag'], 'expected --name value pairs'],
    [['tag', 't'], 'expected --name value pairs'],
  ])('rejects %j', (argv, message) => {
    expect(() => parseArgs(argv)).toThrow(message);
  });
});
