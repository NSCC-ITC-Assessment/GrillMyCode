/**
 * Shared constants
 *
 * The values that tie the extension to what the GrillMyCode action writes and
 * to GitHub. Nothing in shared/ imports the VS Code API, so these modules run
 * under the repository's own tests with no editor present.
 */

/**
 * The label the action puts on every questions issue (postIssue in
 * src/delivery/issue.js). test/extension-fixtures.test.js fails if the action
 * stops using it.
 */
export const ISSUE_LABEL = 'assessment';

/**
 * How every questions issue's title starts. The action follows it with the
 * branch, as ` (main)`, or the submission tag pattern, as ` (tag: submit/*)`.
 */
export const ISSUE_TITLE = 'GrillMyCode Questions';

/** GitHub.com's REST API. GitHub Enterprise Server is not supported. */
export const GITHUB_API_URL = 'https://api.github.com';

/** GitHub REST API version sent with every request, as src/constants.js does. */
export const GITHUB_API_VERSION = '2026-03-10';

/**
 * Issues requested per page. One page is read: a repository would need more
 * than this many open issues labelled `assessment` to lose one, and the action
 * reads a single page of the same size when it looks for its own issue.
 */
export const ISSUES_PER_PAGE = 100;

/**
 * The scope asked of VS Code's GitHub sign-in. `repo` is the only scope that
 * lets an OAuth token read issues in a private repository.
 */
export const GITHUB_SCOPES = ['repo'];
