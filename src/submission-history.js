/**
 * Submission History
 *
 * Keeps count of how many times a student has submitted under one submission
 * tag, so a resubmission can be flagged to the instructor. Pure: parsing and
 * rendering the log, and working out the count. The instructor-repository
 * reads and writes live in delivery/instructor-repo.js.
 *
 * The record is `{student}/{tagGroup}/submissions.md` in the instructor
 * repository — out of the student's reach, and keyed on assessments actually
 * delivered rather than git events, so deleting a tag and pushing it again
 * does not reset the count the way a check on the push payload would.
 *
 * Why it matters: a student sees their questions (never the answers), so
 * re-pushing a tag is also a way to draw a fresh set. The earlier sets are
 * archived beside the log, so the instructor can see what was replaced.
 */

import { GIT_SHA_SHORT_LENGTH } from './constants.js';

/** Log file name inside a tag group's folder. */
export const SUBMISSION_LOG_FILE = 'submissions.md';

/** Folder, inside a tag group's folder, that holds replaced question sets. */
export const SUBMISSION_HISTORY_DIR = 'history';

/** Trigger labels written to the log. */
export const TRIGGER_TAG_PUSH = 'tag push';
export const TRIGGER_MANUAL_RUN = 'manual run';

/**
 * A log row: `| 3 | 2026-09-18 14:03 | tag push | @jsmith | `phase1` | `a1b2c3d` | yes |`.
 * Only the leading number, trigger, commit and counted cells are read back;
 * the rest is for the reader.
 */
const LOG_ROW_RE =
  /^\|\s*(\d+)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*`?([0-9a-f]*)`?\s*\|\s*(yes|no)\s*\|/i;

/**
 * Makes a value safe for a table cell: a `|` would split the cell, and a
 * backtick would break the code span the tag is rendered in.
 */
function cell(value) {
  return String(value).replace(/\|/g, '¦').replace(/`/g, "'").replace(/\r?\n/g, ' ');
}

/** Parses a submissions.md log into its rows, oldest first. Unknown lines are ignored. */
export function parseSubmissionLog(markdown) {
  if (!markdown) return [];
  const entries = [];
  for (const line of markdown.split('\n')) {
    const m = line.match(LOG_ROW_RE);
    if (!m) continue;
    entries.push({
      number: Number(m[1]),
      date: m[2],
      trigger: m[3],
      actor: m[4].replace(/^@/, ''),
      tag: m[5].replace(/^`|`$/g, ''),
      commit: m[6],
      counted: m[7].toLowerCase() === 'yes',
    });
  }
  return entries;
}

/**
 * Decides whether a run counts as a submission by the student.
 *
 * A tag push always counts: pushing the tag is the act of submitting. A manual
 * run counts too unless it was provably started by someone else — the student
 * can dispatch the workflow in their own repository, so excluding every manual
 * run would give them an uncounted way to draw new questions. In a team repo
 * there is no single student login to compare against, so every run counts:
 * over-flagging an instructor's re-run is the safer failure.
 */
export function isCountedSubmission({ trigger, actor, studentLogin }) {
  if (trigger !== TRIGGER_MANUAL_RUN) return true;
  if (!studentLogin) return true;
  return !!actor && actor.toLowerCase() === studentLogin.toLowerCase();
}

/**
 * Builds the log row for this run.
 *
 * @param {object} params
 * @param {Array}  params.entries      Rows already in the log.
 * @param {string} params.trigger      TRIGGER_TAG_PUSH or TRIGGER_MANUAL_RUN.
 * @param {string} params.actor        Login that started the run.
 * @param {string} params.studentLogin The student's login ('' for a team repo).
 * @param {string} params.tagName      The tag that started the run.
 * @param {string} params.headSha      The commit assessed.
 * @param {Date}   [params.now]
 */
export function buildSubmissionEntry({
  entries,
  trigger,
  actor,
  studentLogin,
  tagName,
  headSha,
  now = new Date(),
}) {
  return {
    number: entries.reduce((max, e) => Math.max(max, e.number), 0) + 1,
    date: now.toISOString().replace('T', ' ').substring(0, 16),
    trigger,
    actor: actor || '',
    tag: tagName,
    commit: headSha.substring(0, GIT_SHA_SHORT_LENGTH),
    counted: isCountedSubmission({ trigger, actor, studentLogin }),
  };
}

/**
 * Summarises where this run sits in the tag group's history.
 *
 * Returns `{ submissions, previous, counted }`:
 *   submissions — student submissions so far, including this run if it counts
 *   previous    — the most recent earlier counted row, or null
 *   counted     — whether this run is itself a submission
 */
export function summariseSubmissions(entries, entry) {
  const earlier = entries.filter((e) => e.counted);
  return {
    submissions: earlier.length + (entry.counted ? 1 : 0),
    previous: earlier.length > 0 ? earlier[earlier.length - 1] : null,
    counted: entry.counted,
  };
}

/** 1 → "1st", 2 → "2nd", 11 → "11th", 23 → "23rd". */
export function ordinal(n) {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
  return `${n}${suffix}`;
}

/**
 * The one-line note placed in the instructor copy's header. Empty for a first
 * submission, which needs no flag.
 */
export function submissionNote(summary, tagPattern, entry) {
  const tag = `\`${cell(tagPattern)}\``;
  const prev = summary.previous
    ? `previous: ${summary.previous.date} UTC, \`${summary.previous.commit}\``
    : '';
  if (!summary.counted) {
    return (
      `manual run by @${cell(entry.actor || 'unknown')} — not counted as a submission ` +
      `(${summary.submissions} student submission${summary.submissions === 1 ? '' : 's'} of ${tag} so far` +
      `${prev ? `; ${prev}` : ''}). See ${SUBMISSION_LOG_FILE}.`
    );
  }
  if (summary.submissions < 2) return '';
  return (
    `⚠️ **resubmitted** — this is the ${ordinal(summary.submissions)} submission of ${tag}` +
    ` (${prev}). Earlier question sets are in ${SUBMISSION_HISTORY_DIR}/; see ${SUBMISSION_LOG_FILE}.`
  );
}

/** Renders the whole log. Rows are kept in the order they were written. */
export function renderSubmissionLog({ student, tagGroup, entries }) {
  const rows = entries.map(
    (e) =>
      `| ${e.number} | ${cell(e.date)} | ${cell(e.trigger)} | ${e.actor ? `@${cell(e.actor)}` : '—'} | ` +
      `\`${cell(e.tag)}\` | \`${e.commit}\` | ${e.counted ? 'yes' : 'no'} |`,
  );
  const counted = entries.filter((e) => e.counted).length;
  return [
    `# Submissions — ${cell(student)} · ${cell(tagGroup)}`,
    '',
    `Every GrillMyCode run for this tag, oldest first. **${counted}** counted as a student submission.`,
    '',
    `Each run replaces \`questions.md\`; the set it replaced is kept as ` +
      `\`${SUBMISSION_HISTORY_DIR}/<#>-questions.md\`, numbered by the row that produced it. ` +
      `A manual run started by someone other than the student is listed but not counted.`,
    '',
    '| # | Date (UTC) | Trigger | Started by | Tag | Commit | Counted |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}
