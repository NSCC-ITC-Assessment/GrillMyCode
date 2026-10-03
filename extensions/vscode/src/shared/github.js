/**
 * GitHub reads
 *
 * The one request the student side makes: a repository's open issues that
 * carry the questions label.
 */

import { GITHUB_API_URL, GITHUB_API_VERSION, ISSUE_LABEL, ISSUES_PER_PAGE } from './constants.js';

/** A failed GitHub request, with the HTTP status that explains it. */
export class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

/**
 * Lists the repository's open issues labelled for GrillMyCode, as the REST API
 * returns them. `fetch` is passed in so tests can supply their own.
 *
 * Throws GitHubError on any response but 200. GitHub answers 404 for a private
 * repository the token cannot see, not 403, so 404 means "missing, or no
 * access" and callers word it that way.
 */
export async function listLabelledIssues({ owner, repo, token, fetch }) {
  const query = new URLSearchParams({
    state: 'open',
    labels: ISSUE_LABEL,
    per_page: String(ISSUES_PER_PAGE),
  });
  const url = `${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?${query}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
  });
  if (!response.ok) {
    throw new GitHubError(
      response.status,
      `GitHub answered ${response.status} for ${owner}/${repo}`,
    );
  }
  const issues = await response.json();
  return Array.isArray(issues) ? issues : [];
}
