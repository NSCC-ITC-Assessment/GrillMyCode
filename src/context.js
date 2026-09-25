/**
 * GitHub Actions Context Helpers
 *
 * Interprets the GitHub Actions event context to resolve commit SHAs, branch
 * names, and output file paths. All functions in this module depend on the
 * Actions context (ctx / GITHUB_REF) or the Octokit client.
 */

import * as core from '@actions/core';
import {
  GIT_EMPTY_TREE_SHA,
  GIT_SHA_SHORT_LENGTH,
  SUBMISSION_TAG_GROUP_FALLBACK,
} from './constants.js';
import {
  getLeadingSkipCandidates,
  getFirstCommit,
  isAncestor,
  listAncestors,
  listTags,
  peelToCommit,
  refExists,
  resolveTagCommit,
} from './git.js';
import { findMatchingTagPattern, namedDiffBaseTag, pickPreviousSubmissionTag } from './tags.js';

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
 *
 * tagName is set for a run started by a submission tag (see resolveTagName).
 * The tagged commit is then the head — peeled, because an annotated tag's push
 * names the tag object rather than the commit — and with tag_diff_base set to
 * previous-tag the base moves up to the nearest earlier submission tag, and
 * with tag:<name> to that tag, failing the run if it cannot be used.
 *
 * Returns { baseSha, headSha, previousTag, skippedRange }, where previousTag is
 * the { name, commit } the base was moved to, or null, and skippedRange is the
 * { from, to } span of leading bot commits skip_committers stepped over, or
 * null. The span is kept even when a later base supersedes it, so the files
 * those commits wrote can be kept out of the codebase context as well as out
 * of the assessment.
 */
export async function resolveSHAs(ctx, octokit, inputs, { tagName = '' } = {}) {
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
      previousTag: null,
      skippedRange: null,
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
  if (tagName) {
    // A tag push or a manual run started on a tag. Push payloads carry the
    // pushed object in `after`; a dispatch carries the commit in ctx.sha.
    const eventSha = event === 'push' ? ctx.payload.after : ctx.sha;
    headSha = overrideHead ?? sanitiseSha(peelToCommit(sanitiseSha(eventSha)));
    baseSha = getFirstCommit();
  } else if (event === 'push') {
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

  // ── Apply tag_diff_base: previous-tag ──────────────────────────────────────
  // Replaces the base chosen above rather than combining with it: an earlier
  // submission tag is always later in history than the first commit or the
  // empty tree, so it is the tighter of the two whenever one exists.
  let previousTag = null;
  if (tagName && inputs.tagDiffBase === 'previous-tag') {
    previousTag = pickPreviousSubmissionTag({
      tags: listTags(),
      ancestors: listAncestors(headSha),
      patterns: inputs.submissionTags,
      headSha,
    });
    if (previousTag) {
      core.info(
        `tag_diff_base is previous-tag: base set to ${previousTag.commit.substring(0, GIT_SHA_SHORT_LENGTH)} ` +
          `(tag ${previousTag.name}), so only work since that submission is assessed.`,
      );
      baseSha = sanitiseSha(previousTag.commit);
    } else {
      core.info(
        `tag_diff_base is previous-tag, but no earlier submission tag is an ancestor of ` +
          `${headSha.substring(0, GIT_SHA_SHORT_LENGTH)}; using the cumulative base instead.`,
      );
    }
  }

  // ── Apply tag_diff_base: tag:<name> ────────────────────────────────────────
  // The instructor named the tag to diff from, so there is no fallback: a tag
  // that is missing, sits on another line of history or is on the assessed
  // commit itself fails the run rather than quietly assessing a wider or empty
  // range. Skipped when base_sha is set, since that override wins anyway and a
  // missing tag should not fail a run that would never use it.
  const namedTag = namedDiffBaseTag(inputs.tagDiffBase);
  if (tagName && namedTag && !inputs.baseSha) {
    const commit = resolveTagCommit(namedTag);
    if (!commit) {
      throw new Error(
        `tag_diff_base is "${inputs.tagDiffBase}", but there is no tag "${namedTag}" in this ` +
          `repository. Check the tag name, that the student has pushed it, and that the ` +
          `checkout step sets fetch-depth: 0 so tags are fetched.`,
      );
    }
    if (commit === headSha) {
      throw new Error(
        `tag_diff_base is "${inputs.tagDiffBase}", but tag "${namedTag}" is on the commit being ` +
          `assessed (${headSha.substring(0, GIT_SHA_SHORT_LENGTH)}), so there is no work since ` +
          `it to assess.`,
      );
    }
    if (!isAncestor(commit, headSha)) {
      throw new Error(
        `tag_diff_base is "${inputs.tagDiffBase}", but tag "${namedTag}" ` +
          `(${commit.substring(0, GIT_SHA_SHORT_LENGTH)}) is not an earlier commit in the history ` +
          `of ${headSha.substring(0, GIT_SHA_SHORT_LENGTH)}, so the work since it cannot be ` +
          `worked out.`,
      );
    }
    previousTag = { name: namedTag, commit: sanitiseSha(commit) };
    baseSha = previousTag.commit;
    core.info(
      `tag_diff_base is ${inputs.tagDiffBase}: base set to ` +
        `${commit.substring(0, GIT_SHA_SHORT_LENGTH)}, so only work since that tag is assessed.`,
    );
  }

  // ── Apply skip_committers ────────────────────────────────────────────────
  let skippedRange = null;
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
      skippedRange = { from: baseSha, to: advancedBase };
      baseSha = advancedBase;
    }
  }

  // Apply a manual base_sha-only override (head still auto-detected).
  if (inputs.baseSha) {
    baseSha = sanitiseSha(inputs.baseSha);
  }

  return { baseSha, headSha, previousTag, skippedRange };
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
 * Returns the tag name when the run was started by a tag — a tag push, or a
 * manual run with a tag chosen on the Run workflow form — and '' otherwise.
 */
export function resolveTagName(ctx) {
  const ref = process.env.GITHUB_REF || ctx.ref || '';
  const match = ref.match(/^refs\/tags\/(.+)$/);
  return match ? match[1] : '';
}

/**
 * Matches a run's tag against submission_tags and returns the pattern it files
 * under, plus that pattern's filename-safe slug.
 *
 * Throws when nothing matches. The workflow's `on.push.tags` and the
 * submission_tags input are two copies of one list; a tag that fired the first
 * but is absent from the second means they have drifted, and guessing a group
 * for it would file the assessment somewhere the instructor is not looking.
 */
export function resolveSubmissionTag(tagName, patterns) {
  if (patterns.length === 0) {
    throw new Error(
      `This run was started by tag "${tagName}", but submission_tags is not set. ` +
        `List the same tag patterns in submission_tags as in the workflow's on.push.tags.`,
    );
  }
  const pattern = findMatchingTagPattern(patterns, tagName);
  if (!pattern) {
    throw new Error(
      `Tag "${tagName}" does not match any submission_tags pattern (${patterns.join(', ')}). ` +
        `Keep submission_tags in sync with the workflow's on.push.tags.`,
    );
  }
  return { pattern, slug: tagGroupSlug(pattern) };
}

/**
 * The filesystem-safe name a tag group's PDF and instructor-repository folder
 * are filed under. Derived from the pattern, not the tag, so every tag matching
 * `phase*` shares one set of files while `phase1` and `phase2` keep their own.
 */
export function tagGroupSlug(pattern) {
  return safeFilePart(pattern) || SUBMISSION_TAG_GROUP_FALLBACK;
}

/**
 * Throws unless headSha is reachable from the repository's default branch.
 *
 * A submission tag declares "this is my finished work". A tag on a commit that
 * never reached the default branch is almost always an experiment tagged by
 * hand, and assessing it would replace the group's assessment with questions
 * about code that was never submitted. Failing the run puts a red check beside
 * the tag, which tells the student the submission did not register.
 */
export async function assertOnDefaultBranch(ctx, octokit, headSha, tagName) {
  let defaultBranch = ctx.payload?.repository?.default_branch;
  if (!defaultBranch) {
    const { data } = await octokit.rest.repos.get({ owner: ctx.repo.owner, repo: ctx.repo.repo });
    defaultBranch = data.default_branch;
  }
  const ref = `refs/remotes/origin/${defaultBranch}`;
  if (!refExists(ref)) {
    throw new Error(
      `Cannot check that tag "${tagName}" is on the default branch: ${ref} is not in the ` +
        `checkout. Set fetch-depth: 0 on actions/checkout so every branch is fetched.`,
    );
  }
  if (!isAncestor(headSha, ref)) {
    throw new Error(
      `Tag "${tagName}" points at ${headSha.substring(0, GIT_SHA_SHORT_LENGTH)}, which is not on ` +
        `the default branch (${defaultBranch}). Merge the work into ${defaultBranch}, then ` +
        `re-tag the merged commit and push the tag again (git push --force origin ${tagName}).`,
    );
  }
}

/**
 * Returns a filesystem-safe version of an arbitrary string for use as part
 * of a filename. All non-empty input produces non-empty output.
 */
export function safeFilePart(str) {
  if (!str) return '';
  return str
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}
