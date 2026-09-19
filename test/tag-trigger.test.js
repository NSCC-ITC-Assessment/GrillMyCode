import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const FIRST_COMMIT = 'a'.repeat(40);
const TAG_OBJECT = 'b'.repeat(40);
const TAGGED_COMMIT = 'c'.repeat(40);
const PHASE1_COMMIT = 'd'.repeat(40);

vi.mock('../src/git.js', () => ({
  getFirstCommit: vi.fn(() => FIRST_COMMIT),
  getLeadingSkipCandidates: vi.fn(() => []),
  peelToCommit: vi.fn(),
  listTags: vi.fn(() => []),
  listAncestors: vi.fn(() => []),
  refExists: vi.fn(() => true),
  isAncestor: vi.fn(() => true),
}));

const git = await import('../src/git.js');
const { assertOnDefaultBranch, resolveSHAs, resolveSubmissionTag, resolveTagName, tagGroupSlug } =
  await import('../src/context.js');
const { GIT_EMPTY_TREE_SHA } = await import('../src/constants.js');

const octokit = { rest: { repos: { getCommit: vi.fn(), get: vi.fn() } } };

const tagPushCtx = () => ({
  eventName: 'push',
  ref: 'refs/tags/phase2',
  sha: TAGGED_COMMIT,
  repo: { owner: 'o', repo: 'r' },
  payload: {
    before: '0'.repeat(40),
    after: TAG_OBJECT,
    repository: { default_branch: 'main' },
  },
});

const inputs = (over = {}) => ({
  includeInitialCommit: false,
  skipCommitters: [],
  submissionTags: ['phase*'],
  tagDiffBase: 'cumulative',
  ...over,
});

const savedRef = process.env.GITHUB_REF;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.GITHUB_REF;
  git.peelToCommit.mockReturnValue(TAGGED_COMMIT);
  git.listTags.mockReturnValue([]);
  git.listAncestors.mockReturnValue([]);
  git.refExists.mockReturnValue(true);
  git.isAncestor.mockReturnValue(true);
});

afterEach(() => {
  if (savedRef === undefined) delete process.env.GITHUB_REF;
  else process.env.GITHUB_REF = savedRef;
});

describe('resolveTagName', () => {
  it('returns the tag for a tag ref, slashes included', () => {
    expect(resolveTagName({ ref: 'refs/tags/submit/2026-09-19T14-03-22Z-a1b2c3d' })).toBe(
      'submit/2026-09-19T14-03-22Z-a1b2c3d',
    );
  });

  it('returns an empty string for a branch ref', () => {
    expect(resolveTagName({ ref: 'refs/heads/main' })).toBe('');
  });
});

describe('resolveSubmissionTag', () => {
  it('returns the matching pattern and its slug', () => {
    expect(resolveSubmissionTag('submit/abc', ['phase1', 'submit/*'])).toEqual({
      pattern: 'submit/*',
      slug: 'submit',
    });
  });

  it('fails when the tag matches no pattern', () => {
    expect(() => resolveSubmissionTag('draft', ['phase1'])).toThrow(/does not match/);
  });

  it('fails when submission_tags is not set at all', () => {
    expect(() => resolveSubmissionTag('phase1', [])).toThrow(/submission_tags is not set/);
  });
});

describe('tagGroupSlug', () => {
  it('reduces a pattern to a filename-safe name', () => {
    expect(tagGroupSlug('phase1')).toBe('phase1');
    expect(tagGroupSlug('submit/*')).toBe('submit');
  });

  it('falls back when nothing filename-safe is left', () => {
    expect(tagGroupSlug('**')).toBe('tag');
  });
});

describe('resolveSHAs on a tag run', () => {
  it('peels the pushed tag object to its commit for the head', async () => {
    const { headSha, baseSha, previousTag } = await resolveSHAs(tagPushCtx(), octokit, inputs(), {
      tagName: 'phase2',
    });
    expect(git.peelToCommit).toHaveBeenCalledWith(TAG_OBJECT);
    expect(headSha).toBe(TAGGED_COMMIT);
    expect(baseSha).toBe(FIRST_COMMIT);
    expect(previousTag).toBeNull();
  });

  it('peels ctx.sha on a manual run started on a tag', async () => {
    const ctx = { ...tagPushCtx(), eventName: 'workflow_dispatch', payload: {} };
    await resolveSHAs(ctx, octokit, inputs(), { tagName: 'phase2' });
    expect(git.peelToCommit).toHaveBeenCalledWith(TAGGED_COMMIT);
  });

  it('keeps the cumulative base by default, even with earlier tags present', async () => {
    git.listTags.mockReturnValue([{ name: 'phase1', commit: PHASE1_COMMIT }]);
    const { baseSha } = await resolveSHAs(tagPushCtx(), octokit, inputs(), { tagName: 'phase2' });
    expect(baseSha).toBe(FIRST_COMMIT);
    expect(git.listTags).not.toHaveBeenCalled();
  });

  it('starts the diff at the previous submission tag under previous-tag', async () => {
    git.listTags.mockReturnValue([
      { name: 'phase1', commit: PHASE1_COMMIT },
      { name: 'phase2', commit: TAGGED_COMMIT },
    ]);
    git.listAncestors.mockReturnValue([TAGGED_COMMIT, PHASE1_COMMIT, FIRST_COMMIT]);
    const { baseSha, previousTag } = await resolveSHAs(
      tagPushCtx(),
      octokit,
      inputs({ tagDiffBase: 'previous-tag' }),
      { tagName: 'phase2' },
    );
    expect(baseSha).toBe(PHASE1_COMMIT);
    expect(previousTag).toEqual({ name: 'phase1', commit: PHASE1_COMMIT });
  });

  it('falls back to the cumulative base when there is no earlier tag', async () => {
    git.listAncestors.mockReturnValue([TAGGED_COMMIT, FIRST_COMMIT]);
    const { baseSha, previousTag } = await resolveSHAs(
      tagPushCtx(),
      octokit,
      inputs({ tagDiffBase: 'previous-tag', includeInitialCommit: true }),
      { tagName: 'phase2' },
    );
    expect(baseSha).toBe(GIT_EMPTY_TREE_SHA);
    expect(previousTag).toBeNull();
  });

  it('still lets a manual base_sha win over the previous tag', async () => {
    const overrideBase = 'e'.repeat(40);
    git.listTags.mockReturnValue([{ name: 'phase1', commit: PHASE1_COMMIT }]);
    git.listAncestors.mockReturnValue([TAGGED_COMMIT, PHASE1_COMMIT]);
    const { baseSha } = await resolveSHAs(
      tagPushCtx(),
      octokit,
      inputs({ tagDiffBase: 'previous-tag', baseSha: overrideBase }),
      { tagName: 'phase2' },
    );
    expect(baseSha).toBe(overrideBase);
  });

  it('leaves a branch push untouched by the tag logic', async () => {
    const ctx = { ...tagPushCtx(), ref: 'refs/heads/main' };
    ctx.payload.after = TAGGED_COMMIT;
    const { headSha } = await resolveSHAs(ctx, octokit, inputs({ tagDiffBase: 'previous-tag' }));
    expect(headSha).toBe(TAGGED_COMMIT);
    expect(git.peelToCommit).not.toHaveBeenCalled();
    expect(git.listTags).not.toHaveBeenCalled();
  });
});

describe('assertOnDefaultBranch', () => {
  it('passes when the tagged commit is on the default branch', async () => {
    await expect(
      assertOnDefaultBranch(tagPushCtx(), octokit, TAGGED_COMMIT, 'phase2'),
    ).resolves.toBeUndefined();
    expect(git.isAncestor).toHaveBeenCalledWith(TAGGED_COMMIT, 'refs/remotes/origin/main');
  });

  it('fails when the tagged commit is not on the default branch', async () => {
    git.isAncestor.mockReturnValue(false);
    await expect(
      assertOnDefaultBranch(tagPushCtx(), octokit, TAGGED_COMMIT, 'phase2'),
    ).rejects.toThrow(/not on the default branch \(main\)/);
  });

  it('explains fetch-depth when the default branch is missing from the checkout', async () => {
    git.refExists.mockReturnValue(false);
    await expect(
      assertOnDefaultBranch(tagPushCtx(), octokit, TAGGED_COMMIT, 'phase2'),
    ).rejects.toThrow(/fetch-depth: 0/);
  });

  it('looks the default branch up when the payload does not carry it', async () => {
    octokit.rest.repos.get.mockResolvedValue({ data: { default_branch: 'master' } });
    const ctx = { ...tagPushCtx(), payload: {} };
    await assertOnDefaultBranch(ctx, octokit, TAGGED_COMMIT, 'phase2');
    expect(git.isAncestor).toHaveBeenCalledWith(TAGGED_COMMIT, 'refs/remotes/origin/master');
  });
});
