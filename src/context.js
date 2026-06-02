/**
 * GitHub Actions Context Helpers
 *
 * Interprets the GitHub Actions event context to resolve commit SHAs, branch
 * names, and output file paths. All functions in this module depend on the
 * Actions context (ctx / GITHUB_REF) or the Octokit client.
 */

import * as core from '@actions/core';
import { GIT_EMPTY_TREE_SHA, GIT_SHA_SHORT_LENGTH } from './constants.js';
import { advanceBasePastBotCommits, getFirstCommit } from './git.js';

/**
 * Determines the base and head commit SHAs for the diff based on the
 * GitHub Actions event type. Manual overrides take precedence.
 *
 * include_initial_commit controls the diff base regardless of event type:
 *   false (default) — base is pinned to the first commit; the initial
 *                     commit's files are excluded from the assessed diff.
 *   true            — base is set to the empty tree SHA; the initial commit's
 *                     files are included in the diff.
 *
 * Manual base_sha / head_sha overrides always take precedence over this flag.
 */
export async function resolveSHAs(ctx, octokit, inputs) {
  // Manual override: both SHAs explicitly provided — honour them as-is.
  if (inputs.baseSha && inputs.headSha) {
    return {
      baseSha: sanitiseSha(inputs.baseSha),
      headSha: sanitiseSha(inputs.headSha),
      prNumber: null,
    };
  }

  const event = ctx.eventName;
  let baseSha,
    headSha,
    prNumber = null;

  // ── Determine the event-specific head SHA and PR number ─────────────────
  if (event === 'pull_request' || event === 'pull_request_target') {
    baseSha = ctx.payload.pull_request.base.sha;
    headSha = ctx.payload.pull_request.head.sha;
    prNumber = ctx.payload.pull_request.number;
  } else if (event === 'push') {
    headSha = sanitiseSha(ctx.payload.after);
    const before = ctx.payload.before;
    // All-zero SHA means this is the very first push to a new branch.
    baseSha = /^0+$/.test(before) ? getFirstCommit() : sanitiseSha(before);
  } else if (event === 'issue_comment') {
    const prNum = ctx.payload.issue.number;
    const { data: pr } = await octokit.rest.pulls.get({
      owner: ctx.repo.owner,
      repo: ctx.repo.repo,
      pull_number: prNum,
    });
    baseSha = pr.base.sha;
    headSha = pr.head.sha;
    prNumber = prNum;
  } else {
    // workflow_dispatch and all other events: HEAD of the current branch.
    baseSha = getFirstCommit();
    headSha = sanitiseSha(ctx.sha);
  }

  // ── Apply include_initial_commit ──────────────────────────────────────────
  // Always override baseSha based on this flag, regardless of event type.
  if (!inputs.includeInitialCommit) {
    const initialCommit = getFirstCommit();
    if (baseSha !== initialCommit) {
      core.info(
        `include_initial_commit is disabled: overriding base SHA from ` +
          `${baseSha.substring(0, GIT_SHA_SHORT_LENGTH)} to initial commit ${initialCommit.substring(0, GIT_SHA_SHORT_LENGTH)} ` +
          `to exclude GitHub Classroom starter files from the diff.`,
      );
    }
    baseSha = initialCommit;
  } else {
    core.info(
      `include_initial_commit is enabled: using empty tree as base so the initial commit's eligible files are included in the diff.`,
    );
    baseSha = GIT_EMPTY_TREE_SHA;
  }

  // ── Apply skip_committers ────────────────────────────────────────────────
  // Advance baseSha past any consecutive leading commits by bot accounts so
  // that automated Classroom/Actions commits are excluded from the diff.
  if (inputs.skipCommitters && inputs.skipCommitters.length > 0) {
    const advancedBase = advanceBasePastBotCommits(baseSha, headSha, inputs.skipCommitters);
    if (advancedBase !== baseSha) {
      core.info(
        `skip_committers: advanced base SHA from ${baseSha.substring(0, GIT_SHA_SHORT_LENGTH)} to ` +
          `${advancedBase.substring(0, GIT_SHA_SHORT_LENGTH)} to exclude consecutive bot commits from the diff.`,
      );
      baseSha = advancedBase;
    }
  }

  // Apply a manual base_sha-only override (head still auto-detected).
  if (inputs.baseSha) {
    baseSha = sanitiseSha(inputs.baseSha);
  }

  return { baseSha, headSha, prNumber };
}

/**
 * Validates that a string looks like a git SHA to prevent shell injection.
 */
export function sanitiseSha(sha) {
  if (!/^[0-9a-f]{4,64}$/i.test(sha)) {
    throw new Error(`Invalid git commit SHA: "${sha}"`);
  }
  return sha;
}

/**
 * Returns the branch name for the current event.
 * Falls back to parsing GITHUB_REF when context properties are absent.
 */
export function resolveBranch(ctx) {
  // pull_request / pull_request_target: the head branch of the PR
  if (ctx.payload.pull_request) {
    return ctx.payload.pull_request.head.ref;
  }
  // issue_comment: branch isn't directly available; return a placeholder
  if (ctx.eventName === 'issue_comment') {
    return '';
  }
  // push / workflow_dispatch / schedule / etc: parse from GITHUB_REF
  const ref = process.env.GITHUB_REF || ctx.ref || '';
  const match = ref.match(/^refs\/heads\/(.+)$/);
  return match ? match[1] : ref;
}

/**
 * Resolves the assignment name for the instructor repository.
 *
 * For GitHub Classroom repos, the student's repository is created from a
 * template whose name is the assignment slug (e.g. "assignment-1"). The
 * GitHub API exposes this via `template_repository.name`. For non-Classroom
 * repos (where no template was used), the source repository name is used as
 * the assignment name.
 */
/**
 * Strips the student login suffix from a GitHub Classroom repo name.
 *
 * Classroom repos follow the pattern {assignment-slug}-{student-login}.
 * Because we have the confirmed student login we can strip it unambiguously
 * even when the login itself contains hyphens.
 *
 * Returns the stripped name, or the original if no match is found.
 */
function stripStudentLoginSuffix(repoName, studentLogin) {
  if (studentLogin && repoName.toLowerCase().endsWith('-' + studentLogin.toLowerCase())) {
    return repoName.slice(0, -(studentLogin.length + 1));
  }
  return repoName;
}

/**
 * Resolves the assignment name for the instructor repository.
 *
 * Resolution order (first match wins):
 *   1. template_repository.name — set by GitHub Classroom when the assignment
 *      has a starter code repository. This is the cleanest source.
 *   2. Strip "-{studentLogin}" suffix from the repo name — handles Classroom
 *      assignments created without starter code (template_repository is null
 *      in that case). Because studentLogin is already confirmed, this is
 *      unambiguous even for logins that contain hyphens.
 *   3. Full source repo name — generic fallback for non-Classroom repos.
 */
export async function resolveAssignmentName(ctx, octokit, studentLogin) {
  try {
    const { data } = await octokit.rest.repos.get({
      owner: ctx.repo.owner,
      repo: ctx.repo.repo,
    });
    if (data.template_repository?.name) {
      return data.template_repository.name;
    }
    // template_repository is null — GitHub Classroom does not reliably populate
    // this field even for template-based assignments; it depends on how Classroom
    // internally created the repo. Fall back to stripping the student login suffix.
    // Only warn when the suffix strip doesn't match (i.e. the login wasn't found
    // at the end of the repo name), since in that case the inferred name is the
    // full repo name and may be wrong.
    const inferred = stripStudentLoginSuffix(ctx.repo.repo, studentLogin);
    if (inferred === ctx.repo.repo) {
      core.warning(
        `Instructor repo: could not strip student login suffix from "${ctx.repo.repo}" — ` +
          `student login "${studentLogin}" was not found at the end of the repo name. ` +
          `Using the full repository name as the assignment name. ` +
          `Verify the instructor repository name is correct after the first run.`,
      );
    } else {
      core.info(
        `Instructor repo: inferred assignment name "${inferred}" by stripping student login suffix from "${ctx.repo.repo}".`,
      );
    }
    return inferred;
  } catch (err) {
    core.warning(
      `Could not fetch repository metadata to resolve assignment name: ${err.message}. ` +
        `Falling back to source repository name.`,
    );
    return stripStudentLoginSuffix(ctx.repo.repo, studentLogin);
  }
}

/**
 * Returns a filesystem-safe version of a branch name for use in filenames.
 * Returns an empty string for default branches (main/master) or when the
 * branch is unknown, so callers can use it as an optional suffix.
 */
export function safeBranchName(branchName) {
  if (!branchName || branchName === 'main' || branchName === 'master') return '';
  return branchName
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Returns a filesystem-safe version of an arbitrary string for use as part
 * of a filename. Unlike safeBranchName, never returns an empty string for
 * specific values — all non-empty input produces non-empty output.
 */
export function safeFilePart(str) {
  if (!str) return '';
  return str
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}
