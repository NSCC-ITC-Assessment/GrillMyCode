import { describe, expect, it, vi } from 'vitest';
import { GitHubError, listLabelledIssues } from '../src/shared/github.js';
import {
  chooseIssue,
  describeGroup,
  findQuestionIssues,
  parseIssueTitle,
  whatArrived,
} from '../src/shared/issues.js';
import { parseGitHubRemote, pickGitHubRemote } from '../src/shared/remote.js';

describe('parseGitHubRemote', () => {
  const expected = { owner: 'my-school', repo: 'cs-principles-lab-3-jsmith' };

  it.each([
    'https://github.com/my-school/cs-principles-lab-3-jsmith.git',
    'https://github.com/my-school/cs-principles-lab-3-jsmith',
    'https://github.com/my-school/cs-principles-lab-3-jsmith/',
    'https://jsmith@github.com/my-school/cs-principles-lab-3-jsmith.git',
    'git@github.com:my-school/cs-principles-lab-3-jsmith.git',
    'ssh://git@github.com/my-school/cs-principles-lab-3-jsmith.git',
    'ssh://git@github.com:22/my-school/cs-principles-lab-3-jsmith.git',
    'HTTPS://GitHub.com/my-school/cs-principles-lab-3-jsmith.git',
  ])('reads %s', (url) => {
    expect(parseGitHubRemote(url)).toEqual(expected);
  });

  it.each([
    'https://gitlab.com/my-school/lab.git',
    'https://github.com.example.org/my-school/lab.git',
    'https://example.org/github.com/my-school/lab.git',
    'https://github.com/my-school',
    'https://github.com/my-school/lab/extra',
    '',
    undefined,
  ])('rejects %s', (url) => {
    expect(parseGitHubRemote(url)).toBeUndefined();
  });

  it('keeps a dot that is part of the repository name', () => {
    expect(parseGitHubRemote('git@github.com:my-school/lab.v2.git').repo).toBe('lab.v2');
  });
});

describe('pickGitHubRemote', () => {
  const remote = (name, repo) => ({ name, fetchUrl: `https://github.com/my-school/${repo}.git` });

  it('prefers origin', () => {
    expect(pickGitHubRemote([remote('upstream', 'template'), remote('origin', 'mine')]).repo).toBe(
      'mine',
    );
  });

  it('falls back to the first GitHub remote', () => {
    const remotes = [{ name: 'origin', fetchUrl: 'https://gitlab.com/a/b.git' }, remote('gh', 'x')];
    expect(pickGitHubRemote(remotes).repo).toBe('x');
  });

  it('reads the push URL when there is no fetch URL', () => {
    const remotes = [{ name: 'origin', pushUrl: 'git@github.com:my-school/mine.git' }];
    expect(pickGitHubRemote(remotes).repo).toBe('mine');
  });

  it('returns undefined when no remote is on GitHub', () => {
    expect(pickGitHubRemote([{ name: 'origin', fetchUrl: '/srv/git/lab.git' }])).toBeUndefined();
  });
});

describe('parseIssueTitle', () => {
  it.each([
    ['GrillMyCode Questions (main)', { kind: 'branch', name: 'main' }],
    ['GrillMyCode Questions (feature/checkout)', { kind: 'branch', name: 'feature/checkout' }],
    ['GrillMyCode Questions (fix-(a))', { kind: 'branch', name: 'fix-(a)' }],
    ['GrillMyCode Questions (tag: submit/*)', { kind: 'tag', name: 'submit/*' }],
    ['GrillMyCode Questions', { kind: 'unnamed' }],
  ])('reads %s', (title, group) => {
    expect(parseIssueTitle(title)).toEqual(group);
  });

  it.each([
    'GrillMyCode Questions ()',
    'GrillMyCode Questions (main) and more',
    'GrillMyCode Questions for lab 3',
    'Re: GrillMyCode Questions (main)',
    'grillmycode questions (main)',
    undefined,
  ])('rejects %s', (title) => {
    expect(parseIssueTitle(title)).toBeUndefined();
  });
});

describe('describeGroup', () => {
  it('names a branch, a tag pattern and a run with neither', () => {
    expect(describeGroup({ kind: 'branch', name: 'main' })).toBe('main');
    expect(describeGroup({ kind: 'tag', name: 'submit/*' })).toBe('tag submit/*');
    expect(describeGroup({ kind: 'unnamed' })).toBe('no branch');
  });
});

/** An issue as the REST API lists it. */
const apiIssue = (number, title, overrides = {}) => ({
  number,
  title,
  html_url: `https://github.com/my-school/lab/issues/${number}`,
  updated_at: `2026-01-${String(number).padStart(2, '0')}T12:00:00Z`,
  body: 'body',
  labels: [{ name: 'assessment' }],
  ...overrides,
});

describe('findQuestionIssues', () => {
  it('keeps questions issues, newest update first', () => {
    const found = findQuestionIssues([
      apiIssue(1, 'GrillMyCode Questions (main)'),
      apiIssue(3, 'GrillMyCode Questions (tag: submit/*)'),
      apiIssue(2, 'GrillMyCode Questions (feature)'),
    ]);
    expect(found.map((issue) => issue.number)).toEqual([3, 2, 1]);
    expect(found[0]).toMatchObject({
      url: 'https://github.com/my-school/lab/issues/3',
      group: { kind: 'tag', name: 'submit/*' },
    });
  });

  it('leaves out pull requests, other titles and other labels', () => {
    const found = findQuestionIssues([
      apiIssue(1, 'GrillMyCode Questions (main)', { pull_request: {} }),
      apiIssue(2, 'Assessment feedback'),
      apiIssue(3, 'GrillMyCode Questions (main)', { labels: [{ name: 'bug' }] }),
      apiIssue(4, 'GrillMyCode Questions (main)', { labels: ['assessment'] }),
    ]);
    expect(found.map((issue) => issue.number)).toEqual([4]);
  });

  it('reads a missing body as empty', () => {
    const [found] = findQuestionIssues([
      apiIssue(1, 'GrillMyCode Questions (main)', { body: null }),
    ]);
    expect(found.body).toBe('');
  });
});

describe('chooseIssue', () => {
  const issues = findQuestionIssues([
    apiIssue(1, 'GrillMyCode Questions (main)'),
    apiIssue(2, 'GrillMyCode Questions (feature)'),
    apiIssue(3, 'GrillMyCode Questions (tag: submit/*)'),
  ]);

  it('takes the one for the checked-out branch', () => {
    expect(chooseIssue(issues, { branch: 'feature' }).number).toBe(2);
  });

  it('takes the one chosen by hand over the branch', () => {
    const chosen = chooseIssue(issues, {
      branch: 'feature',
      preferredTitle: 'GrillMyCode Questions (tag: submit/*)',
    });
    expect(chosen.number).toBe(3);
  });

  it('goes back to the branch when the chosen one is gone', () => {
    const chosen = chooseIssue(issues, {
      branch: 'main',
      preferredTitle: 'GrillMyCode Questions (old)',
    });
    expect(chosen.number).toBe(1);
  });

  it('takes the most recently updated when no branch matches', () => {
    expect(chooseIssue(issues, { branch: 'other' }).number).toBe(3);
    expect(chooseIssue(issues).number).toBe(3);
  });

  // A tag pattern is not a branch, even when the names are the same.
  it('does not match a branch to a tag pattern of the same name', () => {
    const tagged = findQuestionIssues([
      apiIssue(1, 'GrillMyCode Questions (tag: main)'),
      apiIssue(2, 'GrillMyCode Questions (main)'),
    ]);
    expect(chooseIssue(tagged.reverse(), { branch: 'main' }).number).toBe(2);
  });

  it('returns undefined when there are none', () => {
    expect(chooseIssue([], { branch: 'main' })).toBeUndefined();
  });
});

describe('whatArrived', () => {
  const loaded = { number: 1, body: 'The report of one run.' };

  it('finds nothing new in the issue that was loaded', () => {
    expect(whatArrived(loaded, { ...loaded })).toBeUndefined();
  });

  it('finds a first set where nothing was loaded', () => {
    expect(whatArrived(undefined, loaded)).toBe('first');
  });

  // The action writes each run's report over the same issue.
  it('finds a newer set in the same issue with another body', () => {
    expect(whatArrived(loaded, { number: 1, body: 'The report of the next run.' })).toBe('newer');
  });

  it('finds a newer set in another issue', () => {
    expect(whatArrived(loaded, { ...loaded, number: 2 })).toBe('newer');
  });

  // Closing the issue is not news, and the questions loaded stay in the list.
  it('finds nothing when the issue is gone', () => {
    expect(whatArrived(loaded, undefined)).toBeUndefined();
    expect(whatArrived(undefined, undefined)).toBeUndefined();
  });
});

describe('listLabelledIssues', () => {
  const request = { owner: 'my-school', repo: 'cs-principles-lab-3-jsmith', token: 'token' };

  it('asks for the open issues with the questions label', async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => [{ number: 1 }] }));
    expect(await listLabelledIssues({ ...request, fetch })).toEqual([{ number: 1 }]);

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(
      'https://api.github.com/repos/my-school/cs-principles-lab-3-jsmith/issues' +
        '?state=open&labels=assessment&per_page=100',
    );
    expect(options.headers.Authorization).toBe('Bearer token');
  });

  it('throws the status of a failed request', async () => {
    const fetch = vi.fn(async () => ({ ok: false, status: 404 }));
    const error = await listLabelledIssues({ ...request, fetch }).catch((err) => err);
    expect(error).toBeInstanceOf(GitHubError);
    expect(error.status).toBe(404);
  });

  it('reads an unexpected reply as no issues', async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ message: 'odd' }) }));
    expect(await listLabelledIssues({ ...request, fetch })).toEqual([]);
  });
});
