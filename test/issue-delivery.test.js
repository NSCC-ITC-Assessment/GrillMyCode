import { readFileSync } from 'fs';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as core from '@actions/core';
import { isAssessmentBody, postIssue } from '../src/delivery/issue.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), warning: vi.fn() }));

/** Every fixture's issue body: `current` has the hidden comment, `v0.24` predates it. */
const fixtureBody = (layout) =>
  readFileSync(
    join(import.meta.dirname, '..', 'extensions', 'fixtures', layout, 'default-branch', 'body.md'),
    'utf-8',
  );
const BODY = fixtureBody('current');
const BODY_BEFORE_COMMENT = fixtureBody('v0.24');

/** An open assessment issue as returned by issues.listForRepo. */
function issue(number, title, body = BODY) {
  return { number, title, body, node_id: `I_${number}` };
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

function post(octokit, branchName, { tagPattern } = {}) {
  return postIssue({
    octokit,
    ctx: { repo: { owner: 'org', repo: 'student-repo' } },
    report: '1. Question?',
    branchName,
    tagPattern,
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

describe('postIssue and issues it did not write', () => {
  beforeEach(() => vi.clearAllMocks());

  const TITLE = 'GrillMyCode Questions (main)';
  const SOMEONE_ELSES = 'My notes on the questions.\n\n---\n\nAsk about question 2.';

  it("leaves a person's issue with the same title and label, and opens its own", async () => {
    const octokit = fakeOctokit([issue(1, TITLE, SOMEONE_ELSES)]);
    expect(await post(octokit, 'main')).toEqual({ number: 99, url: 'https://example.test/99' });
    expect(mutated(octokit, 'updateIssue')).toEqual([]);
    expect(mutated(octokit, 'deleteIssue')).toEqual([]);
    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Issue #1 has the title'));
  });

  it("never deletes a person's issue as a duplicate", async () => {
    const octokit = fakeOctokit([
      issue(1, TITLE),
      issue(2, TITLE, SOMEONE_ELSES),
      issue(3, TITLE, null),
      issue(4, TITLE),
    ]);
    expect(await post(octokit, 'main')).toEqual({ number: 1, url: 'https://example.test/1' });
    expect(mutated(octokit, 'updateIssue')).toEqual(['I_1']);
    expect(mutated(octokit, 'deleteIssue')).toEqual(['I_4']);
  });

  it('skips past it to update its own issue', async () => {
    const octokit = fakeOctokit([issue(1, TITLE, SOMEONE_ELSES), issue(2, TITLE)]);
    expect(await post(octokit, 'main')).toEqual({ number: 2, url: 'https://example.test/2' });
    expect(mutated(octokit, 'deleteIssue')).toEqual([]);
  });

  // Issues posted by earlier releases stay open in students' repositories.
  it('updates an issue posted before the hidden comment existed', async () => {
    const octokit = fakeOctokit([issue(1, TITLE, BODY_BEFORE_COMMENT)]);
    expect(await post(octokit, 'main')).toEqual({ number: 1, url: 'https://example.test/1' });
    expect(octokit.rest.issues.create).not.toHaveBeenCalled();
  });
});

describe('isAssessmentBody', () => {
  it('knows a body by its hidden comment', () => {
    expect(BODY).toContain('<!-- gmc:questions ');
    expect(isAssessmentBody(BODY)).toBe(true);
    expect(isAssessmentBody(BODY.replace(/\n/g, '\r\n'))).toBe(true);
  });

  it('knows a body posted before the comment existed by how it opens', () => {
    expect(BODY_BEFORE_COMMENT).not.toContain('gmc:questions');
    expect(isAssessmentBody(BODY_BEFORE_COMMENT)).toBe(true);
    expect(isAssessmentBody(BODY_BEFORE_COMMENT.replace(/\n/g, '\r\n'))).toBe(true);
  });

  it('still knows a body cut short for length', () => {
    expect(isAssessmentBody(BODY.slice(0, 600))).toBe(true);
    expect(isAssessmentBody(BODY_BEFORE_COMMENT.slice(0, 600))).toBe(true);
  });

  it.each([
    ['no body', null],
    ['an empty body', ''],
    ['an ordinary issue', '## Bug\n\nThe cart total is wrong.\n\n---\n\nSteps to reproduce…'],
    ['the heading alone', '## GrillMyCode\n\n---\n\n> **Commits reviewed:** `a` → `b`'],
    ['the comment mid-line', 'See `<!-- gmc:questions {} -->` in the report.'],
  ])('does not take %s for one', (_name, body) => {
    expect(isAssessmentBody(body)).toBe(false);
  });
});

describe('postIssue on a submission tag run', () => {
  beforeEach(() => vi.clearAllMocks());

  it('titles the issue by the matched pattern, not the tag', async () => {
    const octokit = fakeOctokit([]);
    await post(octokit, '', { tagPattern: 'sprint/*' });
    expect(octokit.rest.issues.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'GrillMyCode Questions (tag: sprint/*)' }),
    );
  });

  it("updates its own group's issue and leaves other groups and branches alone", async () => {
    const octokit = fakeOctokit([
      issue(1, 'GrillMyCode Questions (main)'),
      issue(2, 'GrillMyCode Questions (tag: phase1)'),
      issue(3, 'GrillMyCode Questions (tag: phase2)'),
    ]);
    expect(await post(octokit, '', { tagPattern: 'phase2' })).toEqual({
      number: 3,
      url: 'https://example.test/3',
    });
    expect(mutated(octokit, 'deleteIssue')).toEqual([]);
  });

  it('does not collide with a branch named like the pattern', async () => {
    const octokit = fakeOctokit([issue(1, 'GrillMyCode Questions (phase1)')]);
    await post(octokit, '', { tagPattern: 'phase1' });
    expect(mutated(octokit, 'updateIssue')).toEqual([]);
    expect(octokit.rest.issues.create).toHaveBeenCalled();
  });
});
