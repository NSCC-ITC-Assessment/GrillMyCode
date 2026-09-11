/**
 * Submission Identity
 *
 * Works out which assignment a student repository belongs to and whose
 * submission it is — the two names instructor delivery files an assessment under
 * ({assignment}-grillmycode-instructor/{submitter}/questions.md).
 *
 * Classroom 50 names every student repository `<classroom>-<assignment>-<owner>`
 * (lowercased), where <owner> is the accepting student's login, or `group-<n>`
 * for a team-mode assignment, and adds the accepting student to it as a direct
 * collaborator. Both happen when the repository is created and neither depends
 * on anything inside it, so the identity is read from those two facts alone:
 *
 *   - Student repo: the one direct collaborator whose login ends the repository
 *     name after a hyphen. The assignment is everything before that hyphen.
 *   - Team repo: no collaborator matches and the name ends in `-group-<n>`. The
 *     submitter is `group-<n>`, and there is no single student login.
 *   - Anything else (no match, or more than one) is unresolved. Callers skip
 *     instructor delivery rather than guess: a wrong guess files the assessment
 *     under the wrong student or creates a stray instructor repository.
 *
 * Deliberately not consulted, because each names the wrong thing in ordinary use:
 * the event sender and run actor (whoever pushed or pressed Run workflow — often
 * the instructor), commit authors (instructor commits sit in the assessed range,
 * and author emails can be unlinked or borrowed), the repository's template
 * (hidden from GITHUB_TOKEN when private, and shared between classrooms), and
 * `.classroom50.yaml` (a file the student can edit).
 */

import { COLLABORATORS_PER_PAGE } from './constants.js';

/** `<assignment>-group-<n>` — Classroom 50's team-mode repository name. */
const TEAM_REPO_NAME_RE = /^(.+)-(group-\d+)$/i;

/**
 * Resolves the submission identity from a repository name and the logins of its
 * direct collaborators. Pure; see the module comment for the rules.
 *
 * Returns `{ assignment, submitter, studentLogin }` — studentLogin is '' for a
 * team repo — or `{ error }` describing why the identity could not be resolved.
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

  const team = repoName.match(TEAM_REPO_NAME_RE);
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
 * Lists the repository's direct collaborators and resolves the submission
 * identity from them. Direct affiliation excludes access inherited from the
 * organisation or a team, so an instructor or classmate whose login happens to
 * appear in the repository name is never mistaken for the student.
 *
 * Needs only the Metadata read permission every GITHUB_TOKEN carries.
 */
export async function resolveSubmissionIdentity({ octokit, owner, repo }) {
  let collaborators;
  try {
    collaborators = await octokit.paginate(octokit.rest.repos.listCollaborators, {
      owner,
      repo,
      affiliation: 'direct',
      per_page: COLLABORATORS_PER_PAGE,
    });
  } catch (err) {
    return { error: `could not list the repository's collaborators (${err.message})` };
  }
  return matchSubmissionIdentity(
    repo,
    collaborators.map((collaborator) => collaborator.login),
  );
}
