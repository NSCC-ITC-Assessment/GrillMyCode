import { describe, expect, it, vi } from 'vitest';
import { matchSubmissionIdentity, resolveSubmissionIdentity } from '../src/submission-identity.js';

describe('matchSubmissionIdentity', () => {
  it('names the student whose login ends the repository name, whoever else collaborates', () => {
    expect(
      matchSubmissionIdentity('appd5000-700-ica-coat-or-no-coat-frank5428', [
        'w0244079',
        'frank5428',
      ]),
    ).toEqual({
      assignment: 'appd5000-700-ica-coat-or-no-coat',
      submitter: 'frank5428',
      studentLogin: 'frank5428',
    });
  });

  it('handles logins that contain hyphens', () => {
    expect(matchSubmissionIdentity('cs-principles-lab-3-john-smith', ['john-smith'])).toEqual({
      assignment: 'cs-principles-lab-3',
      submitter: 'john-smith',
      studentLogin: 'john-smith',
    });
  });

  it('matches case-insensitively but keeps the canonical login casing', () => {
    expect(matchSubmissionIdentity('cs-lab-jsmith', ['JSmith'])).toEqual({
      assignment: 'cs-lab',
      submitter: 'JSmith',
      studentLogin: 'JSmith',
    });
  });

  it('only matches a whole hyphen-delimited suffix', () => {
    expect(matchSubmissionIdentity('cs-lab-xjsmith', ['jsmith'])).toHaveProperty('error');
  });

  it('does not treat a login equal to the whole repository name as a match', () => {
    expect(matchSubmissionIdentity('jsmith', ['jsmith'])).toHaveProperty('error');
  });

  it('refuses to guess when more than one login ends the repository name', () => {
    const result = matchSubmissionIdentity('cs-lab-john-smith', ['smith', 'john-smith']);
    expect(result.error).toContain('smith, john-smith');
  });

  it('files a team-mode repository under its group', () => {
    expect(matchSubmissionIdentity('cs-lab-group-3', ['alice', 'bob'])).toEqual({
      assignment: 'cs-lab',
      submitter: 'group-3',
      studentLogin: '',
    });
  });

  it('prefers a matching collaborator over the team pattern', () => {
    expect(matchSubmissionIdentity('cs-lab-group-3', ['group-3'])).toMatchObject({
      submitter: 'group-3',
      studentLogin: 'group-3',
    });
  });

  it('leaves a repository not named by Classroom 50 unresolved', () => {
    expect(matchSubmissionIdentity('my-project', ['alice'])).toHaveProperty('error');
    expect(matchSubmissionIdentity('cs-lab-jsmith', [])).toHaveProperty('error');
  });
});

describe('resolveSubmissionIdentity', () => {
  const listCollaborators = () => {};

  it('lists only direct collaborators', async () => {
    const paginate = vi.fn().mockResolvedValue([{ login: 'w0244079' }, { login: 'jsmith' }]);
    const octokit = { paginate, rest: { repos: { listCollaborators } } };

    const result = await resolveSubmissionIdentity({
      octokit,
      owner: 'org',
      repo: 'cs-lab-jsmith',
    });

    expect(paginate).toHaveBeenCalledWith(
      listCollaborators,
      expect.objectContaining({ owner: 'org', repo: 'cs-lab-jsmith', affiliation: 'direct' }),
    );
    expect(result).toMatchObject({ assignment: 'cs-lab', submitter: 'jsmith' });
  });

  it('reports an API failure as unresolved rather than throwing', async () => {
    const paginate = vi.fn().mockRejectedValue(new Error('Resource not accessible by integration'));
    const octokit = { paginate, rest: { repos: { listCollaborators } } };

    const result = await resolveSubmissionIdentity({
      octokit,
      owner: 'org',
      repo: 'cs-lab-jsmith',
    });

    expect(result.error).toContain('Resource not accessible by integration');
  });
});
