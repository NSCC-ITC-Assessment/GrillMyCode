import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveSHAs } from '../src/context.js';

// The range comes from what git says the tags point at, annotated tags
// included, so these run against a throwaway repository rather than a mock.

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
  dir = mkdtempSync(join(tmpdir(), 'gmc-tag-range-'));
  run('init', '-q', '-b', 'main');
  run('config', 'user.email', 'test@example.com');
  run('config', 'user.name', 'Test');
  run('config', 'tag.gpgSign', 'false');
  run('config', 'commit.gpgSign', 'false');
  commit('first');
  commit('one');
  run('tag', 'phase1'); // lightweight
  run('tag', 'phase1-again');
  commit('two');
  run('tag', '-a', 'phase2', '-m', 'annotated'); // annotated
  commits.phase2Object = run('rev-parse', 'refs/tags/phase2');
  commit('three');
  run('checkout', '-q', '-b', 'side', commits.first);
  commit('side');
  run('tag', 'side-tag');
  run('checkout', '-q', 'main');
  originalCwd = process.cwd();
  process.chdir(dir);
});

afterAll(() => {
  process.chdir(originalCwd);
  rmSync(dir, { recursive: true, force: true });
});

const octokit = { rest: { repos: { getCommit: vi.fn() } } };

const dispatchCtx = (sha = commits.three) => ({
  eventName: 'workflow_dispatch',
  sha,
  repo: { owner: 'o', repo: 'r' },
  payload: {},
});

const pushCtx = (after = commits.three) => ({
  eventName: 'push',
  sha: after,
  repo: { owner: 'o', repo: 'r' },
  payload: { after },
});

const inputs = (from, to, over = {}) => ({
  starterCode: 'ignore',
  skipCommitters: [],
  submissionTags: [],
  tagDiffBase: 'cumulative',
  tagRange: { from, to },
  ...over,
});

describe('tag_range', () => {
  it.each([
    ['a manual run', dispatchCtx],
    ['a push', pushCtx],
  ])('assesses from the first tag to the second on %s', async (_, ctx) => {
    const result = await resolveSHAs(ctx(), octokit, inputs('phase1', 'phase2'));
    expect(result.baseSha).toBe(commits.one);
    expect(result.headSha).toBe(commits.two);
    expect(result.previousTag).toEqual({ name: 'phase1', commit: commits.one });
  });

  it('assesses up to the commit a manual run started on with no end tag', async () => {
    const { baseSha, headSha } = await resolveSHAs(dispatchCtx(), octokit, inputs('phase1', ''));
    expect(baseSha).toBe(commits.one);
    expect(headSha).toBe(commits.three);
  });

  it('assesses up to the pushed commit with no end tag', async () => {
    const { headSha } = await resolveSHAs(pushCtx(), octokit, inputs('phase1', ''));
    expect(headSha).toBe(commits.three);
  });

  it('peels an annotated tag pushed to a workflow with no end tag', async () => {
    const { headSha } = await resolveSHAs(
      pushCtx(commits.phase2Object),
      octokit,
      inputs('phase1', ''),
    );
    expect(headSha).toBe(commits.two);
  });

  it('reads an annotated tag at the start of the range as its commit', async () => {
    const { baseSha, headSha } = await resolveSHAs(dispatchCtx(), octokit, inputs('phase2', ''));
    expect(baseSha).toBe(commits.two);
    expect(headSha).toBe(commits.three);
  });

  it('starts at the first tag under starter_code none', async () => {
    const { baseSha } = await resolveSHAs(
      dispatchCtx(),
      octokit,
      inputs('phase1', 'phase2', { starterCode: 'none' }),
    );
    expect(baseSha).toBe(commits.one);
  });

  it('is not read as the event when the event has no usable SHA', async () => {
    const { headSha } = await resolveSHAs(
      dispatchCtx('not-a-sha'),
      octokit,
      inputs('phase1', 'phase2'),
    );
    expect(headSha).toBe(commits.two);
  });

  describe('fails the run', () => {
    it('when the first tag is missing', async () => {
      await expect(resolveSHAs(dispatchCtx(), octokit, inputs('nope', 'phase2'))).rejects.toThrow(
        /tag_range is "nope\.\.phase2", but there is no tag "nope"/,
      );
    });

    it('when the second tag is missing', async () => {
      await expect(resolveSHAs(dispatchCtx(), octokit, inputs('phase1', 'nope'))).rejects.toThrow(
        /tag_range is "phase1\.\.nope", but there is no tag "nope"/,
      );
    });

    it('when the tags are the wrong way round', async () => {
      await expect(resolveSHAs(dispatchCtx(), octokit, inputs('phase2', 'phase1'))).rejects.toThrow(
        /is not an earlier commit/,
      );
    });

    it('when the first tag is on another line of history', async () => {
      await expect(
        resolveSHAs(dispatchCtx(), octokit, inputs('side-tag', 'phase2')),
      ).rejects.toThrow(/is not an earlier commit/);
    });

    it('when both tags are on the same commit', async () => {
      await expect(
        resolveSHAs(dispatchCtx(), octokit, inputs('phase1', 'phase1-again')),
      ).rejects.toThrow(/no work since it to assess/);
    });

    it('when the run started on the first tag and there is no end tag', async () => {
      await expect(
        resolveSHAs(dispatchCtx(commits.one), octokit, inputs('phase1', '')),
      ).rejects.toThrow(/no work since it to assess/);
    });
  });

  describe('beside the other range settings', () => {
    it('takes precedence over tag_diff_base on a run started by a tag', async () => {
      const { baseSha, previousTag } = await resolveSHAs(
        dispatchCtx(commits.two),
        octokit,
        inputs('phase1', '', { tagDiffBase: 'tag:nope', submissionTags: ['phase*'] }),
        { tagName: 'phase2' },
      );
      expect(baseSha).toBe(commits.one);
      expect(previousTag?.name).toBe('phase1');
    });

    it('takes precedence over previous-tag on a run started by a tag', async () => {
      const { baseSha } = await resolveSHAs(
        dispatchCtx(commits.three),
        octokit,
        inputs('phase1', '', { tagDiffBase: 'previous-tag', submissionTags: ['phase*'] }),
        { tagName: 'phase3' },
      );
      expect(baseSha).toBe(commits.one);
    });

    it('gives way to base_sha, which need not find its first tag', async () => {
      const { baseSha, headSha, previousTag } = await resolveSHAs(
        dispatchCtx(),
        octokit,
        inputs('nope', 'phase2', { baseSha: commits.first }),
      );
      expect(baseSha).toBe(commits.first);
      expect(headSha).toBe(commits.two);
      expect(previousTag).toBeNull();
    });

    it('gives way to head_sha, which need not find its second tag', async () => {
      const { baseSha, headSha } = await resolveSHAs(
        dispatchCtx(),
        octokit,
        inputs('phase1', 'nope', { headSha: commits.three }),
      );
      expect(baseSha).toBe(commits.one);
      expect(headSha).toBe(commits.three);
    });

    it('gives way to base_sha and head_sha together', async () => {
      const { baseSha, headSha } = await resolveSHAs(
        dispatchCtx(),
        octokit,
        inputs('nope', 'nope', { baseSha: commits.one, headSha: commits.two }),
      );
      expect(baseSha).toBe(commits.one);
      expect(headSha).toBe(commits.two);
    });
  });
});
