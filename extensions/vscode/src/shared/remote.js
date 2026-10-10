/**
 * Git remotes
 *
 * Reads the GitHub owner and repository out of a Git remote URL.
 */

/**
 * A remote, as the Git extension reports it.
 *
 * @typedef {{ name: string, fetchUrl?: string, pushUrl?: string }} GitRemote
 */

/**
 * A remote that points at GitHub, with the repository it names.
 *
 * @typedef {{ name: string, owner: string, repo: string }} GitHubRemote
 */

/**
 * The `{ owner, repo }` a GitHub.com remote URL names, or undefined for any
 * other host or shape. Accepts the forms Git and GitHub hand out:
 *
 *   https://github.com/my-school/cs-principles-lab-3-jsmith.git
 *   https://jsmith@github.com/my-school/cs-principles-lab-3-jsmith
 *   git@github.com:my-school/cs-principles-lab-3-jsmith.git
 *   ssh://git@github.com/my-school/cs-principles-lab-3-jsmith.git
 *
 * @param {unknown} url
 */
export function parseGitHubRemote(url) {
  if (typeof url !== 'string') return undefined;
  const match = url
    .trim()
    .match(
      /^(?:(?:https?|ssh|git):\/\/(?:[^@/\s]+@)?github\.com(?::\d+)?\/|(?:[^@/\s]+@)?github\.com:)([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i,
    );
  return match ? { owner: match[1], repo: match[2] } : undefined;
}

/**
 * The repository to read questions for, from a clone's remotes: `origin` when
 * it points at GitHub, otherwise the first remote that does. Each remote is
 * `{ name, fetchUrl, pushUrl }`, as the Git extension reports them.
 *
 * @param {GitRemote[]} remotes
 * @returns {GitHubRemote | undefined}
 */
export function pickGitHubRemote(remotes) {
  const parsed = remotes
    .map((remote) => ({
      name: remote.name,
      ...parseGitHubRemote(remote.fetchUrl ?? remote.pushUrl),
    }))
    .filter(/** @returns {remote is GitHubRemote} */ (remote) => Boolean(remote.owner));
  return parsed.find((remote) => remote.name === 'origin') ?? parsed[0];
}
