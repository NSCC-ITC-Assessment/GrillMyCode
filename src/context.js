/**
 * GitHub Actions Context Helpers
 *
 * Interprets the GitHub Actions event context to resolve commit SHAs, branch
 * names, and output file paths. All functions in this module depend on the
 * Actions context (ctx / GITHUB_REF) or the Octokit client.
 */

import * as core from '@actions/core';
import {
  DEFAULT_QUESTION_SET_SLUG,
  GIT_EMPTY_TREE_SHA,
  GIT_SHA_SHORT_LENGTH,
  SUBMISSION_TAG_GROUP_FALLBACK,
  TAG_RANGE_SEPARATOR,
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
 * starter_code controls the diff base regardless of event type:
 *   none            — base is set to the empty tree SHA; the initial commit is
 *                     the student's own work and its files are in the diff.
 *   any other value — base is pinned to the first commit; the initial
 *                     commit's starter files are excluded from the assessed
 *                     diff.
 *
 * Manual base_sha / head_sha overrides always take precedence over this.
 *
 * tagName is set for a run started by a submission tag (see resolveTagName).
 * The tagged commit is then the head — peeled, because an annotated tag's push
 * names the tag object rather than the commit — and with tag_diff_base set to
 * previous-tag the base moves up to the nearest earlier submission tag, and
 * with tag:<name> to that tag, failing the run if it cannot be used.
 *
 * tag_range applies whatever started the run and takes precedence over
 * tag_diff_base: the base is its first tag, and the head its second, or the
 * commit the run started on when it names none. A tag it needs and cannot use
 * fails the run.
 *
 * Returns { baseSha, headSha, previousTag, skippedRange }, where previousTag is
 * the { name, commit } the base was moved to, or null, and skippedRange is the
 * { from, to } span of leading bot commits skip_committers stepped over, or
 * null. The span is kept even when a later base supersedes it, so the files
 * those commits wrote can be kept out of the codebase context as well as out
 * of the assessment.
 *
 * @param {typeof import('@actions/github').context} ctx
 * @param {ReturnType<typeof import('@actions/github').getOctokit>} octokit
 * @param {import('./inputs.js').Inputs} inputs
 * @param {{ tagName?: string }} [options]
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
  // SHA (workflow_dispatch on some runners leaves ctx.sha undefined), and
  // parsing it anyway would throw before reaching an override that had already
  // answered the question.
  if (inputs.baseSha && overrideHead) {
    return {
      baseSha: sanitiseSha(inputs.baseSha),
      headSha: overrideHead,
      previousTag: null,
      skippedRange: null,
    };
  }

  // A submission's tag ends its range, so a second tag naming another commit
  // would file that commit's work under this tag's group.
  if (tagName && inputs.tagRange?.to && inputs.tagRange.to !== tagName && !overrideHead) {
    throw new Error(
      `tag_range is "${tagRangeText(inputs.tagRange)}", but this run is a submission under tag ` +
        `"${tagName}", which ends the range. Leave out the second tag, as in ` +
        `"${inputs.tagRange.from}${TAG_RANGE_SEPARATOR}".`,
    );
  }

  const event = ctx.eventName;
  let baseSha, headSha;

  // ── Determine the event-specific head SHA ────────────────────────────────
  // Only the head depends on the event. The base never does: every run
  // assesses all work to date, from the base starter_code picks below, so a
  // push's `before` is never read.
  //
  // A manual head_sha is resolved here rather than in a tail beside the
  // base_sha override below, for two reasons. It keeps the event SHA
  // unparsed — see above — and it means skip_committers walks the range the
  // caller actually asked for instead of advancing the base against a head
  // that is about to be discarded. base_sha cannot move up here in the same
  // way: it is documented as taking precedence over starter_code,
  // so it has to be applied after that block has had its say.
  if (inputs.tagRange?.to) {
    headSha = overrideHead ?? resolveRangeTag(inputs.tagRange, inputs.tagRange.to);
  } else if (tagName || inputs.tagRange) {
    // A tag push or a manual run started on a tag. Push payloads carry the
    // pushed object in `after`; a dispatch carries the commit in ctx.sha. A
    // tag_range with no end tag comes here too, since its run may have started
    // on a tag, and peeling a commit gives that commit.
    const eventSha = event === 'push' ? ctx.payload.after : ctx.sha;
    headSha = overrideHead ?? sanitiseSha(peelToCommit(sanitiseSha(eventSha)));
  } else if (event === 'push') {
    headSha = overrideHead ?? sanitiseSha(ctx.payload.after);
  } else {
    // workflow_dispatch and all other events: HEAD of the current branch.
    headSha = overrideHead ?? sanitiseSha(ctx.sha);
  }

  // ── Apply starter_code ────────────────────────────────────────────────────
  if (inputs.starterCode !== 'none') {
    baseSha = getFirstCommit();
    core.info(
      `starter_code is ${inputs.starterCode}: base is the initial commit ` +
        `${baseSha.substring(0, GIT_SHA_SHORT_LENGTH)}, so the starter files are left out of the diff.`,
    );
  } else {
    core.info(
      `starter_code is none: using empty tree as base so the initial commit's eligible files are included in the diff.`,
    );
    baseSha = GIT_EMPTY_TREE_SHA;
  }

  // ── Apply tag_diff_base: previous-tag ──────────────────────────────────────
  // Replaces the base chosen above rather than combining with it: an earlier
  // submission tag is always later in history than the first commit or the
  // empty tree, so it is the tighter of the two whenever one exists.
  /** @type {{ name: string, commit: string } | null} */
  let previousTag = null;
  if (tagName && !inputs.tagRange && inputs.tagDiffBase === 'previous-tag') {
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
  if (tagName && namedTag && !inputs.tagRange && !inputs.baseSha) {
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

  // ── Apply tag_range ────────────────────────────────────────────────────────
  // As with tag:<name>, there is no fallback, and base_sha skips it so a missing
  // tag does not fail a run that would never use it.
  if (inputs.tagRange && !inputs.baseSha) {
    const { from } = inputs.tagRange;
    const commit = resolveRangeTag(inputs.tagRange, from);
    const range = tagRangeText(inputs.tagRange);
    if (commit === headSha) {
      throw new Error(
        `tag_range is "${range}", but tag "${from}" is on the commit being assessed ` +
          `(${headSha.substring(0, GIT_SHA_SHORT_LENGTH)}), so there is no work since it to assess.`,
      );
    }
    if (!isAncestor(commit, headSha)) {
      throw new Error(
        `tag_range is "${range}", but tag "${from}" (${commit.substring(0, GIT_SHA_SHORT_LENGTH)}) ` +
          `is not an earlier commit in the history of ${headSha.substring(0, GIT_SHA_SHORT_LENGTH)}, ` +
          `so the work since it cannot be worked out.`,
      );
    }
    previousTag = { name: from, commit };
    baseSha = commit;
    core.info(
      `tag_range is ${range}: assessing ${commit.substring(0, GIT_SHA_SHORT_LENGTH)}..` +
        `${headSha.substring(0, GIT_SHA_SHORT_LENGTH)}.`,
    );
  }

  // ── Apply skip_committers ────────────────────────────────────────────────
  /** @type {{ from: string, to: string } | null} */
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
          .filter(/** @returns {l is string} */ (l) => Boolean(l))
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

/** A parsed tag_range as the workflow wrote it, for messages. */
export function tagRangeText({ from, to }) {
  return `${from}${TAG_RANGE_SEPARATOR}${to}`;
}

/**
 * The commit one of tag_range's tags points at. Throws when there is no such
 * tag: an assessment of a wider range than the workflow names would look like
 * the one it asked for.
 *
 * @param {{ from: string, to: string }} tagRange
 * @param {string} name
 */
function resolveRangeTag(tagRange, name) {
  const commit = resolveTagCommit(name);
  if (!commit) {
    throw new Error(
      `tag_range is "${tagRangeText(tagRange)}", but there is no tag "${name}" in this ` +
        `repository. Check the tag name, that the student has pushed it, and that the checkout ` +
        `step sets fetch-depth: 0 so tags are fetched.`,
    );
  }
  return sanitiseSha(commit);
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
 * The tag that makes this run a submission, or '' when it is not one. A run
 * started on a tag is a submission when the tag is in submission_tags. Without a
 * tag_range it must be, and resolveSubmissionTag fails the run if not; with one,
 * the range says what to assess, so any other tag leaves an ordinary run.
 *
 * @param {string} startedOnTag
 * @param {import('./inputs.js').Inputs} inputs
 */
export function resolveSubmissionRunTag(startedOnTag, inputs) {
  if (!startedOnTag) return '';
  if (inputs.tagRange && !findMatchingTagPattern(inputs.submissionTags, startedOnTag)) return '';
  return startedOnTag;
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
 * The filesystem-safe name a question set's PDF and instructor-repository
 * folder are filed under, or '' for no set: for an empty question_set, and for
 * "GrillMyCode" (DEFAULT_QUESTION_SET_SLUG). Lower case, so that a clone on a
 * file system that ignores case, as Windows and macOS do, never meets `Lab-3/`
 * beside `lab-3/`: the two are one set. Unlike tagGroupSlug there is no
 * fallback, because two sets that both fell back would share one folder; a
 * value with nothing filename-safe in it gives null, for the caller to reject.
 *
 * @param {string} name - question_set, trimmed.
 * @returns {string | null}
 */
export function questionSetSlug(name) {
  if (!name) return '';
  const slug = safeFilePart(name).toLowerCase();
  if (!slug) return null;
  return slug === DEFAULT_QUESTION_SET_SLUG ? '' : slug;
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
  const defaultBranch = await resolveDefaultBranch(ctx, octokit);
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
 * The branch a run with a tag_range files under, when it is not a submission
 * (see resolveSubmissionRunTag). A range that ends at a tag
 * files under the default branch, and that tag must be on it, so a range's
 * assessment goes to the same place whichever ref the run was started from.
 * That tag is the range's own, or the one the run started on when it names none.
 * A range that ends on a branch files under that branch, as any run there does.
 *
 * A head_sha replaces the tag as the end of the range, so it skips the check.
 *
 * @param {typeof import('@actions/github').context} ctx
 * @param {ReturnType<typeof import('@actions/github').getOctokit>} octokit
 * @param {import('./inputs.js').Inputs} inputs
 * @param {string} headSha
 */
export async function resolveTagRangeBranch(ctx, octokit, inputs, headSha) {
  const endTag = inputs.tagRange?.to || resolveTagName(ctx);
  if (!endTag) return resolveBranch(ctx);
  if (!inputs.headSha) await assertOnDefaultBranch(ctx, octokit, headSha, endTag);
  return resolveDefaultBranch(ctx, octokit);
}

/** The repository's default branch, from the event when it says. */
async function resolveDefaultBranch(ctx, octokit) {
  const named = ctx.payload?.repository?.default_branch;
  if (named) return named;
  const { data } = await octokit.rest.repos.get({ owner: ctx.repo.owner, repo: ctx.repo.repo });
  return data.default_branch;
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
