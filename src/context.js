/**
 * GitHub Actions Context Helpers
 *
 * Interprets the GitHub Actions event context to resolve commit SHAs, branch
 * names, and output file paths. All functions in this module depend on the
 * Actions context (ctx / GITHUB_REF) or the Octokit client.
 */

import * as core from '@actions/core';
import { GIT_EMPTY_TREE_SHA, GIT_SHA_SHORT_LENGTH } from './constants.js';
import { getLeadingSkipCandidates, getFirstCommit } from './git.js';

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
  // Validate both overrides up front so a malformed SHA is rejected with the
  // same message whatever the event, rather than only on the paths that happen
  // to reach sanitiseSha.
  const overrideHead = inputs.headSha ? sanitiseSha(inputs.headSha) : null;

  // Manual override: both SHAs explicitly provided — honour them as-is.
  //
  // This is a short-circuit, not a duplicate of the tails below: with both ends
  // named there is nothing left to detect, so we skip event parsing entirely.
  // That is load-bearing. The event payload is not guaranteed to hold a usable
  // SHA (workflow_dispatch on some runners leaves ctx.sha undefined, and
  // ctx.payload.before is absent outside push), and parsing it anyway would
  // throw before reaching an override that had already answered the question.
  if (inputs.baseSha && overrideHead) {
    return {
      baseSha: sanitiseSha(inputs.baseSha),
      headSha: overrideHead,
    };
  }

  const event = ctx.eventName;
  let baseSha, headSha;

  // ── Determine the event-specific head SHA ────────────────────────────────
  // A manual head_sha is resolved here rather than in a tail beside the
  // base_sha override below, for two reasons. It keeps the event SHA
  // unparsed — see above — and it means skip_committers walks the range the
  // caller actually asked for instead of advancing the base against a head
  // that is about to be discarded. base_sha cannot move up here in the same
  // way: it is documented as taking precedence over include_initial_commit,
  // so it has to be applied after that block has had its say.
  if (event === 'push') {
    headSha = overrideHead ?? sanitiseSha(ctx.payload.after);
    const before = ctx.payload.before;
    // All-zero SHA means this is the very first push to a new branch.
    baseSha = /^0+$/.test(before) ? getFirstCommit() : sanitiseSha(before);
  } else {
    // workflow_dispatch and all other events: HEAD of the current branch.
    baseSha = getFirstCommit();
    headSha = overrideHead ?? sanitiseSha(ctx.sha);
  }

  // ── Apply include_initial_commit ──────────────────────────────────────────
  // Always override baseSha based on this flag, regardless of event type.
  if (!inputs.includeInitialCommit) {
    const initialCommit = getFirstCommit();
    if (baseSha !== initialCommit) {
      core.info(
        `include_initial_commit is disabled: overriding base SHA from ` +
          `${baseSha.substring(0, GIT_SHA_SHORT_LENGTH)} to initial commit ${initialCommit.substring(0, GIT_SHA_SHORT_LENGTH)} ` +
          `to exclude Classroom 50 starter files from the diff.`,
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
  //
  // A leading commit is only trimmed when its GitHub-VERIFIED account login
  // (resolved server-side, which a student cannot forge) matches a skip entry.
  // The cheap local name/email pre-filter just bounds how many commits we
  // verify; matching solely on those attacker-controlled strings would let a
  // student hide their own commits by setting their git author name to a bot's.
  if (inputs.skipCommitters && inputs.skipCommitters.length > 0) {
    const candidates = getLeadingSkipCandidates(baseSha, headSha, inputs.skipCommitters);
    const skipLower = inputs.skipCommitters.map((s) => s.toLowerCase());
    let advancedBase = baseSha;
    for (const candidate of candidates) {
      let verified = false;
      try {
        const { data } = await octokit.rest.repos.getCommit({
          owner: ctx.repo.owner,
          repo: ctx.repo.repo,
          ref: candidate.sha,
        });
        const logins = [data.author?.login, data.committer?.login]
          .filter(Boolean)
          .map((l) => l.toLowerCase());
        verified = logins.some((login) => skipLower.some((sc) => login.includes(sc)));
      } catch (err) {
        core.warning(
          `skip_committers: could not verify commit ${candidate.sha.substring(0, GIT_SHA_SHORT_LENGTH)} ` +
            `via the GitHub API (${err.message}); leaving it in the assessed diff.`,
        );
      }
      // Stop at the first commit not confirmed as a skip-listed account — a
      // student impersonating a bot fails here and their commit stays assessed.
      if (!verified) break;
      advancedBase = candidate.sha;
    }
    if (advancedBase !== baseSha) {
      core.info(
        `skip_committers: advanced base SHA from ${baseSha.substring(0, GIT_SHA_SHORT_LENGTH)} to ` +
          `${advancedBase.substring(0, GIT_SHA_SHORT_LENGTH)} past GitHub-verified bot commits.`,
      );
      baseSha = advancedBase;
    }
  }

  // Apply a manual base_sha-only override (head still auto-detected).
  if (inputs.baseSha) {
    baseSha = sanitiseSha(inputs.baseSha);
  }

  return { baseSha, headSha };
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
  const ref = process.env.GITHUB_REF || ctx.ref || '';
  const match = ref.match(/^refs\/heads\/(.+)$/);
  return match ? match[1] : ref;
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
