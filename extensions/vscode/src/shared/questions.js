/**
 * Question model
 *
 * Arranges parsed questions for display and checks them against the folder
 * that is open. Pure functions over the shapes parseReport returns.
 */

/** A snippet's lines as the report captions them: `line 12` or `lines 28–37`. */
export function describeLines(snippet) {
  return snippet.start_line === snippet.end_line
    ? `line ${snippet.start_line}`
    : `lines ${snippet.start_line}–${snippet.end_line}`;
}

/**
 * True when a snippet's file name is a plain path inside the repository. The
 * name comes from the issue, which anyone with write access can edit, so one
 * that is absolute or climbs out with `..` is never opened.
 */
export function isSafeRelativePath(file) {
  if (typeof file !== 'string' || !file || file.includes('\0')) return false;
  if (/^[/\\]/.test(file) || /^[A-Za-z]:/.test(file)) return false;
  return !file.split(/[/\\]/).includes('..');
}

/** The snippets of a question that can be opened: a safe path and a real line range. */
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
 */
export function groupQuestions(questions) {
  const groups = new Map();
  const withoutCode = [];
  for (const question of questions) {
    const [first] = openableSnippets(question);
    if (!first) {
      withoutCode.push(question);
      continue;
    }
    if (!groups.has(first.file)) groups.set(first.file, []);
    groups.get(first.file).push(question);
  }
  const result = [...groups].map(([file, grouped]) => ({ file, questions: grouped }));
  if (withoutCode.length > 0) result.push({ file: null, questions: withoutCode });
  return result;
}

/** The distinct files the questions' snippets name, in order of first use. */
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
 * @param {string} params.headSha        - The short SHA the report reviewed.
 * @param {string} [params.folderCommit] - The full SHA the folder is at, if known.
 * @param {string[]} params.changedFiles - Repository-relative paths with
 *   uncommitted or unsaved changes, with forward slashes.
 * @param {string[]} params.files        - questionFiles() of the report.
 */
export function describeDrift({ headSha, folderCommit, changedFiles, files }) {
  if (folderCommit && headSha && !folderCommit.startsWith(headSha)) {
    return (
      `These questions were written for commit ${headSha}, and this folder is at ` +
      `${folderCommit.slice(0, headSha.length)}. The highlighted lines may have moved.`
    );
  }
  const edited = files.filter((file) => changedFiles.includes(file));
  if (edited.length === 0) return '';
  const names = edited.length <= 2 ? edited.join(' and ') : `${edited.length} files`;
  return `${names} changed since these questions were written. The highlighted lines may have moved.`;
}
