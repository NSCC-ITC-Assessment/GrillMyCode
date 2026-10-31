import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveSHAs,
  resolveSubmissionRunTag,
  resolveTagRangeBranch,
  tagRangeText,
} from '../src/context.js';
import { findCodebaseContextFiles } from '../src/files.js';
import { formatReport } from '../src/report.js';

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

describe('resolveTagRangeBranch', () => {
  const savedRef = process.env.GITHUB_REF;

  // Read before the context, and set when the suite itself runs in Actions.
  const ctxOn = (ref) => ({
    ...dispatchCtx(),
    ref,
    payload: { repository: { default_branch: 'main' } },
  });
  const onRef = (ref) => {
    process.env.GITHUB_REF = ref;
    return ctxOn(ref);
  };

  beforeAll(() => {
    run('update-ref', 'refs/remotes/origin/main', commits.three);
  });

  afterEach(() => {
    if (savedRef === undefined) delete process.env.GITHUB_REF;
    else process.env.GITHUB_REF = savedRef;
  });

  it('files a range ending at a tag under the default branch, from any branch', async () => {
    const branch = await resolveTagRangeBranch(
      onRef('refs/heads/side'),
      octokit,
      inputs('phase1', 'phase2'),
      commits.two,
    );
    expect(branch).toBe('main');
  });

  it('files a range with no end tag under the branch it ran on', async () => {
    const branch = await resolveTagRangeBranch(
      onRef('refs/heads/side'),
      octokit,
      inputs('phase1', ''),
      commits.side,
    );
    expect(branch).toBe('side');
  });

  it('files a run started on a tag under the default branch, not the tag ref', async () => {
    const branch = await resolveTagRangeBranch(
      onRef('refs/tags/phase2'),
      octokit,
      inputs('phase1', ''),
      commits.two,
    );
    expect(branch).toBe('main');
  });

  it('asks the API for the default branch when the event does not say', async () => {
    const get = vi.fn(async () => ({ data: { default_branch: 'main' } }));
    process.env.GITHUB_REF = 'refs/heads/side';
    const branch = await resolveTagRangeBranch(
      dispatchCtx(),
      { rest: { repos: { get } } },
      inputs('phase1', 'phase2'),
      commits.two,
    );
    expect(branch).toBe('main');
    expect(get).toHaveBeenCalled();
  });

  it('fails when the end tag is not on the default branch', async () => {
    await expect(
      resolveTagRangeBranch(
        onRef('refs/heads/main'),
        octokit,
        inputs('phase1', 'side-tag'),
        commits.side,
      ),
    ).rejects.toThrow(/Tag "side-tag" points at .* not on the default branch \(main\)/);
  });

  it('fails when the tag the run started on is not on the default branch', async () => {
    await expect(
      resolveTagRangeBranch(
        onRef('refs/tags/side-tag'),
        octokit,
        inputs('first-tag', ''),
        commits.side,
      ),
    ).rejects.toThrow(/Tag "side-tag" points at .* not on the default branch/);
  });

  it('does not check a tag that head_sha replaced', async () => {
    const branch = await resolveTagRangeBranch(
      onRef('refs/tags/side-tag'),
      octokit,
      inputs('phase1', '', { headSha: commits.side }),
      commits.side,
    );
    expect(branch).toBe('main');
  });
});

describe('tagRangeText', () => {
  it('writes the range as the workflow did', () => {
    expect(tagRangeText({ from: 'phase1', to: 'phase2' })).toBe('phase1..phase2');
    expect(tagRangeText({ from: 'phase1', to: '' })).toBe('phase1..');
  });
});

describe('earlier work on a run with a tag_range', () => {
  it('finds the work before the first tag, and the starter code', () => {
    const found = findCodebaseContextFiles({
      baseSha: commits.one,
      headSha: commits.two,
      firstCommit: commits.first,
      excludePatterns: [],
      excludePatternOverrides: [],
      caseInsensitivePatterns: [],
      assessedFiles: ['two.txt'],
      skippedRange: null,
    });
    expect(found.map(({ filepath, kind }) => [filepath, kind]).sort()).toEqual([
      ['first.txt', 'starter'],
      ['one.txt', 'earlier'],
    ]);
  });
});

// The report is a contract with the editor extensions (see
// extensions/fixtures/README.md), and a range run is not a submission.
describe('the report of a run with a tag_range', () => {
  it('has no submission tag line, and names the branch as any branch run does', () => {
    const report = (over) =>
      formatReport({
        questions: [],
        files: ['two.txt'],
        baseSha: commits.one,
        headSha: commits.two,
        provider: 'openrouter',
        model: 'provider/model',
        branchName: 'main',
        questionSet: { name: '', slug: '' },
        ...over,
      });
    const withRange = report({ tagName: '', previousTagName: 'phase1' });
    expect(withRange).not.toContain('Submission tag');
    expect(withRange).toBe(report({ tagName: '', previousTagName: '' }));
  });
});

describe('a tag run with a tag_range', () => {
  const withRange = (over = {}) => inputs('phase1', '', { submissionTags: ['phase*'], ...over });

  it('is a submission when its tag is in submission_tags', () => {
    expect(resolveSubmissionRunTag('phase2', withRange())).toBe('phase2');
  });

  it('is an ordinary run when its tag is not', () => {
    expect(resolveSubmissionRunTag('draft', withRange())).toBe('');
    expect(resolveSubmissionRunTag('phase2', withRange({ submissionTags: [] }))).toBe('');
  });

  it('is a submission whatever the tag without a tag_range, so a mismatch can fail', () => {
    expect(resolveSubmissionRunTag('draft', withRange({ tagRange: null }))).toBe('draft');
  });

  it('is not a submission when no tag started it', () => {
    expect(resolveSubmissionRunTag('', withRange())).toBe('');
  });

  it('assesses from the first tag to the tag that started it', async () => {
    const { baseSha, headSha, previousTag } = await resolveSHAs(
      dispatchCtx(commits.two),
      octokit,
      withRange(),
      { tagName: 'phase2' },
    );
    expect(baseSha).toBe(commits.one);
    expect(headSha).toBe(commits.two);
    expect(previousTag).toEqual({ name: 'phase1', commit: commits.one });
  });

  it('may name its own tag as the end of the range', async () => {
    const { headSha } = await resolveSHAs(
      dispatchCtx(commits.two),
      octokit,
      inputs('phase1', 'phase2', { submissionTags: ['phase*'] }),
      { tagName: 'phase2' },
    );
    expect(headSha).toBe(commits.two);
  });

  it('fails when a second tag names another commit', async () => {
    await expect(
      resolveSHAs(
        dispatchCtx(commits.two),
        octokit,
        inputs('phase1', 'final', { submissionTags: ['phase*'] }),
        { tagName: 'phase2' },
      ),
    ).rejects.toThrow(/submission under tag "phase2", which ends the range/);
  });

  it('lets head_sha replace the second tag', async () => {
    const { headSha } = await resolveSHAs(
      dispatchCtx(commits.two),
      octokit,
      inputs('phase1', 'final', { submissionTags: ['phase*'], headSha: commits.three }),
      { tagName: 'phase2' },
    );
    expect(headSha).toBe(commits.three);
  });
});
