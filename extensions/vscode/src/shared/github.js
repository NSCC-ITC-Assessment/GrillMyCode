/**
 * GitHub reads
 *
 * The requests the extension makes. The student side makes one: a
 * repository's open issues that carry the questions label. Looking for an
 * answer key adds two: a repository's direct collaborators, and one file.
 *
 * `fetch` is passed in to each so tests can supply their own.
 */

import {
  COLLABORATORS_PER_PAGE,
  GITHUB_API_URL,
  GITHUB_API_VERSION,
  ISSUE_LABEL,
  ISSUES_PER_PAGE,
} from './constants.js';

/** A failed GitHub request, with the HTTP status that explains it. */
export class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

/**
 * Sends one GET to the REST API and returns the response. `what` names the
 * thing asked for, for the error.
 *
 * Throws GitHubError on any response but 200. GitHub answers 404 for a private
 * repository the token cannot see, not 403, so 404 means "missing, or no
 * access" and callers word it that way.
 */
async function get({ path, accept = 'application/vnd.github+json', what, token, fetch }) {
  const response = await fetch(`${GITHUB_API_URL}${path}`, {
    headers: {
      Accept: accept,
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
  });
  if (!response.ok) {
    throw new GitHubError(response.status, `GitHub answered ${response.status} for ${what}`);
  }
  return response;
}

const repoPath = (owner, repo) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

/**
 * Lists the repository's open issues labelled for GrillMyCode, as the REST API
 * returns them.
 */
export async function listLabelledIssues({ owner, repo, token, fetch }) {
  const query = new URLSearchParams({
    state: 'open',
    labels: ISSUE_LABEL,
    per_page: String(ISSUES_PER_PAGE),
  });
  const response = await get({
    path: `${repoPath(owner, repo)}/issues?${query}`,
    what: `${owner}/${repo}`,
    token,
    fetch,
  });
  const issues = await response.json();
  return Array.isArray(issues) ? issues : [];
}

/**
 * The logins of the repository's direct collaborators, which leaves out access
 * that comes from the organization or a team. GitHub answers 403 or 404 to an
 * account that may not list them.
 */
export async function listDirectCollaborators({ owner, repo, token, fetch }) {
  const query = new URLSearchParams({
    affiliation: 'direct',
    per_page: String(COLLABORATORS_PER_PAGE),
  });
  const response = await get({
    path: `${repoPath(owner, repo)}/collaborators?${query}`,
    what: `the collaborators of ${owner}/${repo}`,
    token,
    fetch,
  });
  const collaborators = await response.json();
  return Array.isArray(collaborators)
    ? collaborators.map((collaborator) => collaborator?.login).filter((login) => login)
    : [];
}

/** The text of one file on the repository's default branch. */
export async function readFile({ owner, repo, path, token, fetch }) {
  const response = await get({
    path: `${repoPath(owner, repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`,
    // The file itself, not a description of it with the content in Base64.
    accept: 'application/vnd.github.raw+json',
    what: `${owner}/${repo}/${path}`,
    token,
    fetch,
  });
  return response.text();
}
