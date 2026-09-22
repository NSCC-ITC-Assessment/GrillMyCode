/**
 * Repository Marker
 *
 * Writes a marker to the *student* repository's own GitHub metadata once an
 * assessment has been generated, so that a repository with a live question set
 * is identifiable at a glance in an organisation's repository list — and,
 * for the topic marker, filterable with `org:<org> topic:grillmycode`.
 *
 * Two surfaces, chosen with the repo_marker input:
 *
 *   - topic       adds `grillmycode` to the repository's topics.
 *   - description appends `· 🔥 GrillMyCode: N questions` to the description,
 *                 which is the only one of the two that can carry the count.
 *
 * They are separate API calls by necessity: GitHub's repository-update endpoint
 * explicitly cannot set topics ("To edit a repository's topics, use the Replace
 * all repository topics endpoint"), so `both` costs two writes, and either can
 * succeed while the other fails.
 *
 * ── Why this needs the instructor PAT ──────────────────────────────────────
 * Neither endpoint is reachable from a student workflow's GITHUB_TOKEN. The
 * `permissions:` key has no `administration` scope to grant — the available
 * scopes are actions, artifact-metadata, attestations, checks, code-quality,
 * contents, deployments, discussions, id-token, issues, packages, pages,
 * pull-requests, security-events, statuses and vulnerability-alerts — so no
 * setting of that key reaches repository metadata. The marker therefore rides
 * on instructor_repo_token, the PAT instructor delivery already uses, and is
 * skipped when that token is absent.
 *
 * ── Why the topic write reads first ────────────────────────────────────────
 * PUT /repos/{owner}/{repo}/topics *replaces* the whole topic set — there is no
 * add-one-topic operation, and an empty array clears every topic. Writing
 * `['grillmycode']` straight out would silently delete any topic the instructor
 * had set on the repository. So the current set is fetched, the marker unioned
 * in, and the union written back. GitHub stores topic names lowercased, which
 * is why the comparison is case-insensitive and REPO_MARKER_TOPIC is already
 * lowercase: any other casing would never match what comes back and the topic
 * list would be rewritten on every single run.
 *
 * ── Why the description write is idempotent, not additive ──────────────────
 * The description marker is appended to text the instructor wrote, and a
 * student pushes many times. Each write therefore strips any previous marker
 * before appending the current one, keyed on the REPO_MARKER_DESCRIPTION_SIGIL
 * sentinel, so ten runs leave one accurate marker rather than ten stale ones.
 *
 * Nothing here is allowed to fail a run: a marker is a convenience, and an
 * assessment the student already received must not be reported as failed
 * because a topic could not be written. Every call is caught and reported.
 */

import * as core from '@actions/core';
import {
  REPO_DESCRIPTION_MAX_CHARS,
  REPO_MARKER_DESCRIPTION_SEPARATOR,
  REPO_MARKER_DESCRIPTION_SIGIL,
  REPO_MARKER_TOPIC,
} from './constants.js';

/** Escapes a string for literal use inside a RegExp. */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches a marker previously written by this module: the sigil, its colon, and
 * everything after it, optionally preceded by the separator. The colon is part
 * of the pattern so that a description merely *mentioning* GrillMyCode is not
 * mistaken for a marker and truncated. Both forms are matched because a
 * repository with no description at all receives the marker with no separator
 * in front of it.
 */
const DESCRIPTION_MARKER_RE = new RegExp(
  `(?:${escapeRegExp(REPO_MARKER_DESCRIPTION_SEPARATOR)})?` +
    `${escapeRegExp(REPO_MARKER_DESCRIPTION_SIGIL)}:[\\s\\S]*$`,
  'u',
);

/**
 * Unions the marker topic into an existing topic set, preserving order and the
 * existing entries exactly. Returns the set to write and whether it differs
 * from what was there, so an unchanged set can skip the write entirely.
 */
export function mergeMarkerTopic(topics, topic = REPO_MARKER_TOPIC) {
  const existing = Array.isArray(topics) ? topics : [];
  const wanted = topic.toLowerCase();
  if (existing.some((name) => String(name).toLowerCase() === wanted)) {
    return { names: existing, changed: false };
  }
  return { names: [...existing, wanted], changed: true };
}

/**
 * Removes the marker topic from a topic set. Used to clear a marker rather than
 * to write one; kept beside the merge so the two stay symmetrical.
 */
export function removeMarkerTopic(topics, topic = REPO_MARKER_TOPIC) {
  const existing = Array.isArray(topics) ? topics : [];
  const wanted = topic.toLowerCase();
  const names = existing.filter((name) => String(name).toLowerCase() !== wanted);
  return { names, changed: names.length !== existing.length };
}

/** The marker text itself, e.g. "🔥 GrillMyCode: 20 questions". */
export function buildDescriptionMarker(questionCount) {
  const noun = questionCount === 1 ? 'question' : 'questions';
  return `${REPO_MARKER_DESCRIPTION_SIGIL}: ${questionCount} ${noun}`;
}

/** Strips any marker this module previously appended, leaving the base text. */
export function stripDescriptionMarker(description) {
  return String(description ?? '')
    .replace(DESCRIPTION_MARKER_RE, '')
    .trimEnd();
}

/**
 * Builds the description to write: the instructor's own text with exactly one
 * current marker appended.
 *
 * Returns `tooLong` rather than a description when the result would exceed
 * GitHub's limit. The alternative — trimming the instructor's words to make
 * room for our marker — destroys more than the marker is worth, so an
 * over-long description is left exactly as it is and the caller reports it.
 */
export function withDescriptionMarker(description, questionCount) {
  const current = String(description ?? '');
  const base = stripDescriptionMarker(current);
  const marker = buildDescriptionMarker(questionCount);
  const next = base ? `${base}${REPO_MARKER_DESCRIPTION_SEPARATOR}${marker}` : marker;

  if (next.length > REPO_DESCRIPTION_MAX_CHARS) {
    return { description: current, changed: false, tooLong: true };
  }
  return { description: next, changed: next !== current, tooLong: false };
}

/**
 * Adds the marker topic to the repository, reading the current set first (see
 * the module comment — the endpoint replaces rather than adds).
 */
async function applyTopicMarker({ octokit, owner, repo }) {
  const { data } = await octokit.rest.repos.getAllTopics({ owner, repo });
  const { names, changed } = mergeMarkerTopic(data.names);
  if (!changed) return 'unchanged';
  await octokit.rest.repos.replaceAllTopics({ owner, repo, names });
  return 'applied';
}

/** Appends the marker to the repository description, replacing any older one. */
async function applyDescriptionMarker({ octokit, owner, repo, questionCount }) {
  const { data } = await octokit.rest.repos.get({ owner, repo });
  const result = withDescriptionMarker(data.description, questionCount);
  if (result.tooLong) return 'too-long';
  if (!result.changed) return 'unchanged';
  await octokit.rest.repos.update({ owner, repo, description: result.description });
  return 'applied';
}

/**
 * Applies the marker selected by `mode` to the student repository.
 *
 * Each surface is attempted independently and never throws: one failing must
 * not stop the other, and neither may fail the run. The returned object carries
 * a status per surface (`applied`, `unchanged`, `too-long`, `failed` or
 * `skipped`) plus any error message, for the job summary to render.
 */
export async function applyRepoMarker({ octokit, owner, repo, mode, questionCount }) {
  const result = { topic: 'skipped', description: 'skipped', error: '' };
  if (mode === 'off') return result;

  if (mode === 'topic' || mode === 'both') {
    try {
      result.topic = await applyTopicMarker({ octokit, owner, repo });
    } catch (err) {
      result.topic = 'failed';
      result.error = err.message;
      core.warning(
        `Could not add the "${REPO_MARKER_TOPIC}" topic to ${owner}/${repo} (${err.message}). ` +
          `The token needs permission to administer the repository. The assessment is unaffected.`,
      );
    }
  }

  if (mode === 'description' || mode === 'both') {
    try {
      result.description = await applyDescriptionMarker({ octokit, owner, repo, questionCount });
      if (result.description === 'too-long') {
        core.warning(
          `The description of ${owner}/${repo} would exceed ${REPO_DESCRIPTION_MAX_CHARS} ` +
            `characters with the marker appended, so it was left unchanged. Shorten the ` +
            `repository description to enable the marker.`,
        );
      }
    } catch (err) {
      result.description = 'failed';
      result.error = result.error || err.message;
      core.warning(
        `Could not update the description of ${owner}/${repo} (${err.message}). ` +
          `The token needs permission to administer the repository. The assessment is unaffected.`,
      );
    }
  }

  return result;
}
