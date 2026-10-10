/**
 * Question model
 *
 * Arranges parsed questions for display and checks them against the folder
 * that is open. Pure functions over the shapes parseReport returns.
 */

import { SHORT_SHA_LENGTH } from './constants.js';

/** @import { Question, Snippet } from './report.js' */

/** @typedef {{ file: string | null, questions: Question[] }} QuestionGroup */

/**
 * A snippet's lines as the report captions them: `line 12` or `lines 28–37`.
 *
 * @param {Pick<Snippet, 'start_line' | 'end_line'>} snippet
 */
export function describeLines(snippet) {
  return snippet.start_line === snippet.end_line
    ? `line ${snippet.start_line}`
    : `lines ${snippet.start_line}–${snippet.end_line}`;
}

/**
 * True when a snippet's file name is a plain path inside the repository. The
 * name comes from the issue, which anyone with write access can edit, so one
 * that is absolute or climbs out with `..` is never opened.
 *
 * @param {unknown} file
 */
export function isSafeRelativePath(file) {
  if (typeof file !== 'string' || !file || file.includes('\0')) return false;
  if (/^[/\\]/.test(file) || /^[A-Za-z]:/.test(file)) return false;
  return !file.split(/[/\\]/).includes('..');
}

/**
 * The snippets of a question that can be opened: a safe path and a real line range.
 *
 * @param {Question} question
 */
export function openableSnippets(question) {
  return question.snippets.filter(
    (snippet) =>
      isSafeRelativePath(snippet.file) &&
      snippet.start_line >= 1 &&
      snippet.end_line >= snippet.start_line,
  );
}

/**
 * Groups questions for the panel: one group per file, in the order the files
 * first appear, each holding the questions whose first snippet is in it; then
 * a last group for the questions that show no code, which the report lists as
 * broader questions.
 *
 * Returns `[{ file, questions }]`, where `file` is null for that last group.
 *
 * @param {Question[]} questions
 * @returns {QuestionGroup[]}
 */
export function groupQuestions(questions) {
  /** @type {Map<string, Question[]>} */
  const groups = new Map();
  /** @type {Question[]} */
  const withoutCode = [];
  for (const question of questions) {
    const [first] = openableSnippets(question);
    if (!first) {
      withoutCode.push(question);
      continue;
    }
    if (!groups.has(first.file)) groups.set(first.file, []);
    groups.get(first.file)?.push(question);
  }
  /** @type {QuestionGroup[]} */
  const result = [...groups].map(([file, grouped]) => ({ file, questions: grouped }));
  if (withoutCode.length > 0) result.push({ file: null, questions: withoutCode });
  return result;
}

/**
 * The question a step from the current one lands on, in the order the panel
 * lists them: file by file, then the questions that show no code. That is not
 * always the order of their numbers.
 *
 * A step past either end goes round to the other, as VS Code's Go to Next
 * Problem does. With no current question, or one that is no longer listed, a
 * step forward lands on the first question and a step back on the last.
 *
 * @param {Question[]} questions
 * @param {number | undefined} current - The number of the question showing.
 * @param {1 | -1} step
 * @returns {Question | undefined} Undefined when there are no questions.
 */
export function adjacentQuestion(questions, current, step) {
  const ordered = groupQuestions(questions).flatMap((group) => group.questions);
  const index = ordered.findIndex((question) => question.number === current);
  if (index === -1) return ordered.at(step === 1 ? 0 : -1);
  return ordered[(index + step + ordered.length) % ordered.length];
}

/**
 * The distinct files the questions' snippets name, in order of first use.
 *
 * @param {Question[]} questions
 */
export function questionFiles(questions) {
  return [...new Set(questions.flatMap((q) => openableSnippets(q).map((s) => s.file)))];
}

/**
 * Says why a question's highlighted lines may no longer be the lines it asks
 * about, or returns '' when the folder still matches the report.
 *
 * The report gives line numbers as they were at `headSha`, the commit it
 * reviewed. They go stale when the folder is at another commit, or when a file
 * the questions point into has changes that are not committed.
 *
 * @param {object} params
 * @param {string} params.headSha        - The SHA the report reviewed: the full
 *   one when the issue carries it, otherwise the short one it prints.
 * @param {string} [params.folderCommit] - The full SHA the folder is at, if known.
 * @param {string[]} params.changedFiles - Repository-relative paths with
 *   uncommitted or unsaved changes, with forward slashes.
 * @param {string[]} params.files        - questionFiles() of the report.
 */
export function describeDrift({ headSha, folderCommit, changedFiles, files }) {
  if (folderCommit && headSha && !folderCommit.startsWith(headSha)) {
    const short = (/** @type {string} */ sha) => sha.slice(0, SHORT_SHA_LENGTH);
    return (
      `These questions were written for commit ${short(headSha)}, and this folder is at ` +
      `${short(folderCommit)}. The highlighted lines may have moved.`
    );
  }
  const edited = files.filter((file) => changedFiles.includes(file));
  if (edited.length === 0) return '';
  const names = edited.length <= 2 ? edited.join(' and ') : `${edited.length} files`;
  return `${names} changed since these questions were written. The highlighted lines may have moved.`;
}
