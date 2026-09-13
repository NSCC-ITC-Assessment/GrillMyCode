import { beforeEach, describe, expect, it, vi } from 'vitest';

const FIRST_COMMIT = 'a'.repeat(40);

vi.mock('../src/git.js', () => ({
  getFirstCommit: vi.fn(() => FIRST_COMMIT),
  getLeadingSkipCandidates: vi.fn(() => []),
}));

const { getLeadingSkipCandidates } = await import('../src/git.js');
const { resolveSHAs } = await import('../src/context.js');
const { GIT_EMPTY_TREE_SHA } = await import('../src/constants.js');

const EVENT_BEFORE = 'b'.repeat(40);
const EVENT_AFTER = 'c'.repeat(40);
const OVERRIDE_HEAD = 'd'.repeat(40);
const OVERRIDE_BASE = 'e'.repeat(40);

const octokit = { rest: { repos: { getCommit: vi.fn() } } };

const pushCtx = () => ({
  eventName: 'push',
  sha: EVENT_AFTER,
  repo: { owner: 'o', repo: 'r' },
  payload: { before: EVENT_BEFORE, after: EVENT_AFTER },
});

const dispatchCtx = () => ({
  eventName: 'workflow_dispatch',
  sha: EVENT_AFTER,
  repo: { owner: 'o', repo: 'r' },
  payload: {},
});

/** include_initial_commit is pinned on so baseSha is the empty tree unless overridden. */
const inputs = (over = {}) => ({ includeInitialCommit: true, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  getLeadingSkipCandidates.mockReturnValue([]);
});

describe('head_sha override', () => {
  // The defect: head_sha was only consulted when base_sha was supplied too, so
  // setting it alone resolved the head from the event as though it were absent.
  it.each([
    ['push', pushCtx],
    ['workflow_dispatch', dispatchCtx],
  ])('is honoured on its own for a %s event', async (_label, makeCtx) => {
    const { baseSha, headSha } = await resolveSHAs(
      makeCtx(),
      octokit,
      inputs({ headSha: OVERRIDE_HEAD }),
    );
    expect(headSha).toBe(OVERRIDE_HEAD);
    // The base is still auto-detected, mirroring how base_sha alone behaves.
    expect(baseSha).toBe(GIT_EMPTY_TREE_SHA);
  });

  it('still lets base_sha be overridden on its own', async () => {
    const { baseSha, headSha } = await resolveSHAs(
      pushCtx(),
      octokit,
      inputs({ baseSha: OVERRIDE_BASE }),
    );
    expect(baseSha).toBe(OVERRIDE_BASE);
    expect(headSha).toBe(EVENT_AFTER);
  });

  it('honours both when both are supplied', async () => {
    const { baseSha, headSha } = await resolveSHAs(
      pushCtx(),
      octokit,
      inputs({ baseSha: OVERRIDE_BASE, headSha: OVERRIDE_HEAD }),
    );
    expect(baseSha).toBe(OVERRIDE_BASE);
    expect(headSha).toBe(OVERRIDE_HEAD);
  });

  it('resolves from the event when neither is supplied', async () => {
    const { baseSha, headSha } = await resolveSHAs(pushCtx(), octokit, inputs());
    expect(baseSha).toBe(GIT_EMPTY_TREE_SHA);
    expect(headSha).toBe(EVENT_AFTER);
  });

  it('rejects a malformed head_sha rather than silently ignoring it', async () => {
    await expect(resolveSHAs(pushCtx(), octokit, inputs({ headSha: 'not-a-sha' }))).rejects.toThrow(
      /Invalid git commit SHA/,
    );
  });
});

describe('head_sha override does not disturb event parsing', () => {
  // The both-supplied fast path exists to skip event parsing entirely. Removing
  // it in favour of a second tail override — which is what a symmetric-looking
  // fix would do — reintroduces the throw these two cases prove is absent.
  it('tolerates an unusable push payload when both SHAs are supplied', async () => {
    const ctx = { ...pushCtx(), payload: { before: 'not-a-sha', after: 'junk' } };
    const { baseSha, headSha } = await resolveSHAs(
      ctx,
      octokit,
      inputs({ baseSha: OVERRIDE_BASE, headSha: OVERRIDE_HEAD }),
    );
    expect(baseSha).toBe(OVERRIDE_BASE);
    expect(headSha).toBe(OVERRIDE_HEAD);
  });

  it('tolerates an absent ctx.sha when head_sha supplies the head', async () => {
    const ctx = { ...dispatchCtx(), sha: undefined };
    const { headSha } = await resolveSHAs(ctx, octokit, inputs({ headSha: OVERRIDE_HEAD }));
    expect(headSha).toBe(OVERRIDE_HEAD);
  });
});

describe('head_sha override reaches skip_committers', () => {
  // The override is applied where the event head is derived rather than in a
  // tail at the end, so the bot-commit walk ranges over the commits the caller
  // asked about instead of advancing the base against a head it will discard.
  it('walks the overridden range, not the event range', async () => {
    await resolveSHAs(
      pushCtx(),
      octokit,
      inputs({ headSha: OVERRIDE_HEAD, skipCommitters: ['github-actions[bot]'] }),
    );
    expect(getLeadingSkipCandidates).toHaveBeenCalledWith(GIT_EMPTY_TREE_SHA, OVERRIDE_HEAD, [
      'github-actions[bot]',
    ]);
  });
});
