/**
 * Questions issues
 *
 * Picks the GrillMyCode questions issues out of a repository's open issues,
 * chooses which one to show, and tells when a later look finds another.
 *
 * The action keeps one open issue per branch and one per submission tag
 * pattern, told apart by title (postIssue in src/delivery/issue.js):
 *
 *   GrillMyCode Questions (main)
 *   GrillMyCode Questions (tag: submit/*)
 */

import { ISSUE_LABEL, ISSUE_TITLE } from './constants.js';

/** @import { GitHubIssue } from './github.js' */

/**
 * What a questions issue is for, as parseIssueTitle reads it from the title.
 *
 * @typedef {{ kind: 'branch' | 'tag', name: string } | { kind: 'unnamed', name?: undefined }} IssueGroup
 */

/**
 * A questions issue, as findQuestionIssues lists it.
 *
 * @typedef {object} QuestionIssue
 * @property {number} number
 * @property {string} title
 * @property {string} url
 * @property {string} updatedAt
 * @property {string} body
 * @property {IssueGroup} group
 */

/**
 * What a questions issue's title says it is for: `{ kind: 'branch', name }`,
 * `{ kind: 'tag', name }` with the tag pattern, or `{ kind: 'unnamed' }` for a
 * run that had no branch. Undefined for any other title.
 *
 * A colon cannot appear in a branch name, so `(tag: …)` is never a branch.
 *
 * @param {unknown} title
 * @returns {IssueGroup | undefined}
 */
export function parseIssueTitle(title) {
  if (typeof title !== 'string') return undefined;
  if (title === ISSUE_TITLE) return { kind: 'unnamed' };
  if (!title.startsWith(`${ISSUE_TITLE} (`) || !title.endsWith(')')) return undefined;
  const group = title.slice(ISSUE_TITLE.length + 2, -1);
  if (!group) return undefined;
  return group.startsWith('tag: ')
    ? { kind: 'tag', name: group.slice('tag: '.length) }
    : { kind: 'branch', name: group };
}

/**
 * How an issue's group reads in a list: `main`, or `tag submit/*`.
 *
 * @param {IssueGroup} group
 */
export function describeGroup(group) {
  if (group.kind === 'tag') return `tag ${group.name}`;
  return group.kind === 'branch' ? group.name : 'no branch';
}

/**
 * The questions issues among a repository's issues, as the GitHub REST API
 * returns them: labelled, titled as the action titles them, and not a pull
 * request (which the issues endpoint also lists). Newest update first.
 *
 * @param {GitHubIssue[]} issues
 * @returns {QuestionIssue[]}
 */
export function findQuestionIssues(issues) {
  return issues
    .filter((issue) => !issue.pull_request)
    .filter((issue) =>
      (issue.labels ?? []).some(
        (label) => (typeof label === 'string' ? label : label?.name) === ISSUE_LABEL,
      ),
    )
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      updatedAt: issue.updated_at ?? '',
      body: issue.body ?? '',
      group: parseIssueTitle(issue.title),
    }))
    .filter(/** @returns {issue is QuestionIssue} */ (issue) => issue.group !== undefined)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Which questions issue to show, from findQuestionIssues' list:
 *
 *   1. the one the reader last chose by hand (`preferredTitle`), if it is
 *      still open — the title, not the number, since the action may replace
 *      an issue but always titles its successor the same;
 *   2. the one for the branch that is checked out;
 *   3. the most recently updated.
 *
 * Undefined when there are none.
 *
 * @template {QuestionIssue} T
 * @param {T[]} issues
 * @param {{ branch?: string, preferredTitle?: string }} [options]
 * @returns {T | undefined}
 */
export function chooseIssue(issues, { branch, preferredTitle } = {}) {
  return (
    issues.find((issue) => preferredTitle && issue.title === preferredTitle) ??
    issues.find(
      (issue) => branch && issue.group.kind === 'branch' && issue.group.name === branch,
    ) ??
    issues[0]
  );
}

/**
 * What a later look at a repository found, against what was loaded. Both are
 * what chooseIssue picked, from the issues as they were then and as they are
 * now, so this says whether loading again would show other questions:
 *
 *   'first'  nothing was loaded, and there are questions now;
 *   'newer'  the questions loaded have been replaced. The action writes each
 *            run's report over the issue's body, so a body that differs is
 *            another run's, or the same one edited by hand;
 *   undefined  nothing has changed, or the issue is gone.
 *
 * @param {Pick<QuestionIssue, 'number' | 'body'> | undefined} loaded
 * @param {Pick<QuestionIssue, 'number' | 'body'> | undefined} latest
 * @returns {'first' | 'newer' | undefined}
 */
export function whatArrived(loaded, latest) {
  if (!latest) return undefined;
  if (!loaded) return 'first';
  return loaded.number === latest.number && loaded.body === latest.body ? undefined : 'newer';
}
