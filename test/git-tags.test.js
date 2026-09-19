import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isAncestor, listAncestors, listTags, peelToCommit, refExists } from '../src/git.js';

// These helpers parse real git output (peeled annotated tags, exit-code
// answers), so they run against a throwaway repository rather than a mock.

let dir;
let originalCwd;
const commits = {};

function run(...args) {
  const result = spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

function commit(name) {
  writeFileSync(join(dir, `${name}.txt`), name);
  run('add', '.');
  run('commit', '-q', '-m', name);
  commits[name] = run('rev-parse', 'HEAD');
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'gmc-git-tags-'));
  run('init', '-q', '-b', 'main');
  run('config', 'user.email', 'test@example.com');
  run('config', 'user.name', 'Test');
  run('config', 'tag.gpgSign', 'false');
  run('config', 'commit.gpgSign', 'false');
  commit('one');
  run('tag', 'phase1'); // lightweight
  commit('two');
  run('tag', '-a', 'phase2', '-m', 'annotated'); // annotated
  run('checkout', '-q', '-b', 'side', commits.one);
  commit('side');
  run('checkout', '-q', 'main');
  originalCwd = process.cwd();
  process.chdir(dir);
});

afterAll(() => {
  process.chdir(originalCwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('git tag helpers', () => {
  it('lists lightweight and annotated tags with the commit each points at', () => {
    const tags = Object.fromEntries(listTags().map((t) => [t.name, t.commit]));
    expect(tags).toEqual({ phase1: commits.one, phase2: commits.two });
  });

  it('peels an annotated tag object to its commit', () => {
    const tagObject = run('rev-parse', 'refs/tags/phase2');
    expect(tagObject).not.toBe(commits.two);
    expect(peelToCommit(tagObject)).toBe(commits.two);
    expect(peelToCommit(commits.one)).toBe(commits.one);
  });

  it('lists ancestors nearest first', () => {
    expect(listAncestors(commits.two)).toEqual([commits.two, commits.one]);
  });

  it('answers ancestry through the exit code', () => {
    expect(isAncestor(commits.one, 'main')).toBe(true);
    expect(isAncestor(commits.side, 'main')).toBe(false);
  });

  it('reports whether a ref exists', () => {
    expect(refExists('refs/heads/main')).toBe(true);
    expect(refExists('refs/heads/nope')).toBe(false);
  });
});
