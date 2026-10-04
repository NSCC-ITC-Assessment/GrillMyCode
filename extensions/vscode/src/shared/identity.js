/**
 * Submission identity
 *
 * Works out which assignment a student repository belongs to and whose it is,
 * by the rules the action files an answer key under (src/submission-identity.js
 * and tagGroupSlug in src/context.js). test/identity.test.js fails when these
 * stop agreeing with the action's.
 *
 * Classroom 50 names every student repository `<classroom>-<assignment>-<owner>`,
 * where <owner> is the student's login, or `group-<n>` for a team.
 */

import { TAG_GROUP_FALLBACK } from './constants.js';

/** `<assignment>-group-<n>`: Classroom 50's name for a team's repository. */
const TEAM_REPO_NAME = /^(.+)-(group-\d+)$/i;

/**
 * The assignment and the student, from a repository's name and the logins of
 * its direct collaborators: `{ assignment, submitter, studentLogin }`, or
 * `{ error }` saying why they could not be told.
 *
 * The student is the one direct collaborator whose login ends the name after a
 * hyphen. A name that ends in `-group-<n>` with no such collaborator is a
 * team's: the submitter is `group-<n>` and `studentLogin` is ''.
 */
export function matchSubmissionIdentity(repoName, collaboratorLogins) {
  const lowerRepo = repoName.toLowerCase();
  const matches = collaboratorLogins.filter((login) => {
    const suffix = `-${login.toLowerCase()}`;
    return lowerRepo.length > suffix.length && lowerRepo.endsWith(suffix);
  });

  if (matches.length === 1) {
    const [login] = matches;
    return {
      assignment: repoName.slice(0, -(login.length + 1)),
      submitter: login,
      studentLogin: login,
    };
  }
  if (matches.length > 1) {
    return {
      error:
        `more than one direct collaborator's login ends the repository name ` +
        `(${matches.join(', ')}), so the student is ambiguous`,
    };
  }

  const team = repoName.match(TEAM_REPO_NAME);
  if (team) {
    return { assignment: team[1], submitter: team[2].toLowerCase(), studentLogin: '' };
  }

  return {
    error:
      `no direct collaborator's login ends the repository name, so it does not follow ` +
      `Classroom 50's <classroom>-<assignment>-<username> naming`,
  };
}

/**
 * The identity of a repository that is the signed-in account's own, which is
 * one whose name ends with that account's login: the same
 * `{ assignment, submitter, studentLogin }`, or undefined when the name ends
 * some other way. It needs no request, so an ordinary student's collaborators
 * are never listed.
 */
export function ownSubmissionIdentity(repoName, login) {
  const identity = login ? matchSubmissionIdentity(repoName, [login]) : {};
  return identity.studentLogin ? identity : undefined;
}

/**
 * The folder a submission tag pattern's answer key is filed under: `submit/*`
 * gives `submit`.
 */
export function tagGroupSlug(pattern) {
  const slug = String(pattern ?? '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  return slug || TAG_GROUP_FALLBACK;
}
