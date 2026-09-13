import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as core from '@actions/core';
import { postIssue } from '../src/delivery/issue.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), warning: vi.fn() }));

/** An open assessment issue as returned by issues.listForRepo. */
function issue(number, title) {
  return { number, title, node_id: `I_${number}` };
}

/**
 * Builds an octokit stub whose repository has the given open issues. GraphQL
 * mutations are dispatched by name; `deleteError` makes deleteIssue throw.
 */
function fakeOctokit(openIssues, { deleteError } = {}) {
  const graphql = vi.fn(async (query, { issueId }) => {
    if (query.includes('updateIssue')) {
      const number = Number(issueId.slice(2));
      return { updateIssue: { issue: { number, url: `https://example.test/${number}` } } };
    }
    if (query.includes('deleteIssue')) {
      if (deleteError) throw deleteError;
      return { deleteIssue: { repository: { id: 'R_1' } } };
    }
    if (query.includes('pinIssue')) return { pinIssue: { issue: { title: 'x' } } };
    throw new Error(`unexpected query: ${query}`);
  });
  return {
    graphql,
    rest: {
      issues: {
        listForRepo: vi.fn(async () => ({ data: openIssues })),
        createComment: vi.fn(async () => ({})),
        create: vi.fn(async () => ({
          data: { number: 99, html_url: 'https://example.test/99', node_id: 'I_99' },
        })),
      },
    },
  };
}

/** Issue node ids passed to a given GraphQL mutation. */
function mutated(octokit, name) {
  return octokit.graphql.mock.calls
    .filter(([query]) => query.includes(name))
    .map(([, vars]) => vars.issueId);
}

function post(octokit, branchName) {
  return postIssue({
    octokit,
    ctx: { repo: { owner: 'org', repo: 'student-repo' } },
    report: '1. Question?',
    branchName,
    headSha: 'abcdef1234567890',
    studentLogin: 'student',
  });
}

describe('postIssue duplicate cleanup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates the first matching issue and deletes the other duplicates', async () => {
    const octokit = fakeOctokit([
      issue(1, 'GrillMyCode Questions (feature)'),
      issue(2, 'GrillMyCode Questions (feature)'),
      issue(3, 'GrillMyCode Questions (feature)'),
    ]);
    expect(await post(octokit, 'feature')).toEqual({ number: 1, url: 'https://example.test/1' });
    expect(mutated(octokit, 'updateIssue')).toEqual(['I_1']);
    expect(mutated(octokit, 'deleteIssue')).toEqual(['I_2', 'I_3']);
  });

  it('warns instead of failing when a duplicate cannot be deleted', async () => {
    const octokit = fakeOctokit(
      [
        issue(1, 'GrillMyCode Questions (feature)'),
        issue(2, 'GrillMyCode Questions (feature)'),
        issue(3, 'GrillMyCode Questions (feature)'),
      ],
      { deleteError: new Error('Resource not accessible by integration') },
    );
    expect(await post(octokit, 'feature')).toEqual({ number: 1, url: 'https://example.test/1' });
    // Every duplicate is still attempted after the first failure.
    expect(mutated(octokit, 'deleteIssue')).toEqual(['I_2', 'I_3']);
    expect(core.warning).toHaveBeenCalledTimes(2);
    expect(core.warning).toHaveBeenCalledWith(
      'Could not delete duplicate Issue #2: Resource not accessible by integration',
    );
  });

  it('still fails the run when the update itself fails', async () => {
    const octokit = fakeOctokit([issue(1, 'GrillMyCode Questions (feature)')]);
    octokit.graphql.mockRejectedValueOnce(new Error('update refused'));
    await expect(post(octokit, 'feature')).rejects.toThrow('update refused');
  });
});

describe('postIssue predecessor matching', () => {
  beforeEach(() => vi.clearAllMocks());

  it("never touches other branches' issues when the branch name is empty", async () => {
    const octokit = fakeOctokit([
      issue(1, 'GrillMyCode Questions (main)'),
      issue(2, 'GrillMyCode Questions (feature)'),
    ]);
    expect(await post(octokit, '')).toEqual({ number: 99, url: 'https://example.test/99' });
    expect(octokit.rest.issues.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'GrillMyCode Questions' }),
    );
    expect(mutated(octokit, 'updateIssue')).toEqual([]);
    expect(mutated(octokit, 'deleteIssue')).toEqual([]);
  });

  it('updates a branchless issue when the branch name is empty', async () => {
    const octokit = fakeOctokit([
      issue(1, 'GrillMyCode Questions (main)'),
      issue(2, 'GrillMyCode Questions'),
    ]);
    expect(await post(octokit, '')).toEqual({ number: 2, url: 'https://example.test/2' });
    expect(mutated(octokit, 'deleteIssue')).toEqual([]);
  });

  it('ignores an issue whose title only starts with the expected title', async () => {
    const octokit = fakeOctokit([
      issue(1, 'GrillMyCode Questions (main)'),
      issue(2, 'GrillMyCode Questions (main) — old attempt'),
    ]);
    expect(await post(octokit, 'main')).toEqual({ number: 1, url: 'https://example.test/1' });
    expect(mutated(octokit, 'deleteIssue')).toEqual([]);
  });
});
