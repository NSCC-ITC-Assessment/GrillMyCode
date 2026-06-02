/**
 * Git Utilities
 *
 * Low-level wrappers around git CLI commands using spawnSync (no shell
 * interpolation). These functions have no GitHub Actions or Octokit
 * dependencies and can be used or tested independently.
 */

import { spawnSync } from 'child_process';
import { GIT_EMPTY_TREE_SHA, GIT_MAX_BUFFER } from './constants.js';

/**
 * Runs a git command using spawnSync and returns stdout.
 * Throws on non-zero exit.
 */
export function git(...args) {
  const result = spawnSync('git', args, {
    encoding: 'utf-8',
    maxBuffer: GIT_MAX_BUFFER,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args[0]} failed:\n${result.stderr}`);
  return result.stdout;
}

export function getFirstCommit() {
  return git('rev-list', '--max-parents=0', 'HEAD').trim();
}

export function getChangedFiles(baseSha, headSha) {
  return git('diff', '--name-only', baseSha, headSha)
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);
}

export function getDiff(baseSha, headSha, files) {
  return git('diff', baseSha, headSha, '--', ...files);
}

/**
 * Parses `git log` output produced with the NUL-delimited format
 * `--format=%H%x00%ae%x00%an`. Records are newline-separated; the three fields
 * (SHA, author email, author name) are separated by NUL bytes.
 *
 * NUL can never appear inside a commit SHA, author email, or author name, so
 * this parses correctly even when an author name contains a literal tab — a
 * case that corrupted the previous `\t`-delimited parsing (an attacker controls
 * their own git author name).
 */
function parseCommitLog(raw) {
  return raw
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const [sha = '', email = '', name = ''] = line.split('\0');
      return { sha, email, name };
    });
}

/** True if a commit's author name or email contains any skip substring. */
function matchesSkipCommitter(commit, skipCommitters) {
  return skipCommitters.some((sc) => {
    const scLower = sc.toLowerCase();
    return (
      commit.email.toLowerCase().includes(scLower) || commit.name.toLowerCase().includes(scLower)
    );
  });
}

/**
 * Returns the SHA of the most recent commit in baseSha..headSha whose author
 * is NOT matched by any entry in skipCommitters. This avoids misidentifying a
 * trailing bot commit (e.g. the action's own assessment file commit) as the
 * student's work when resolving the student's GitHub login.
 *
 * NOTE: author name/email are attacker-controlled. This is only a fallback for
 * student-login resolution; the primary path resolves the login from the
 * trusted Actions event payload (see resolveStudentLogin).
 *
 * Falls back to headSha if skipCommitters is empty or no non-bot commit exists
 * in the range (e.g. the range only contains bot commits).
 */
export function findStudentCommitSha(baseSha, headSha, skipCommitters) {
  if (!skipCommitters || skipCommitters.length === 0) return headSha;

  // git log range notation (A..B) requires A to be a commit object.
  // When baseSha is the empty tree, use a plain log up to headSha instead.
  const logRange = baseSha === GIT_EMPTY_TREE_SHA ? [headSha] : [`${baseSha}..${headSha}`];
  const commits = parseCommitLog(git('log', '--format=%H%x00%ae%x00%an', ...logRange));

  // git log is newest-first; find() returns the most recent non-bot commit.
  const studentCommit = commits.find((commit) => !matchesSkipCommitter(commit, skipCommitters));

  return studentCommit?.sha ?? headSha;
}

/**
 * Returns the leading run of commits (oldest-first from baseSha towards headSha)
 * whose author name or email matches a skipCommitters substring. The walk stops
 * at the first non-matching commit, so only a consecutive leading run is
 * returned.
 *
 * This is a cheap, local pre-filter only. Because author name/email are fully
 * attacker-controlled, callers MUST confirm each returned commit against its
 * GitHub-verified account login before trimming it from the assessed diff —
 * otherwise a student could hide their own commits by setting their git author
 * name to a bot's (see resolveSHAs).
 */
export function getLeadingSkipCandidates(baseSha, headSha, skipCommitters) {
  if (!skipCommitters || skipCommitters.length === 0) return [];

  // git log range notation (A..B) requires A to be a commit object.
  // When baseSha is the empty tree, use a plain log up to headSha instead.
  const logRange = baseSha === GIT_EMPTY_TREE_SHA ? [headSha] : [`${baseSha}..${headSha}`];
  const commits = parseCommitLog(git('log', '--format=%H%x00%ae%x00%an', '--reverse', ...logRange));

  const run = [];
  for (const commit of commits) {
    if (!matchesSkipCommitter(commit, skipCommitters)) break;
    run.push(commit);
  }
  return run;
}
