/**
 * File Collection, Filtering, and Comment Stripping
 *
 * Handles the pipeline from a list of assessed file paths through to formatted
 * code content ready for inclusion in the AI prompt: fetching file contents
 * from git, stripping comments via rmcm, and rendering fenced code blocks.
 * Which files are assessed is decided in src/file-selection.js.
 */

import * as core from '@actions/core';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { minimatch } from 'minimatch';
import { extractText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';
import {
  COMMENT_REMOVER_BIN,
  COMMENT_STRIP_TIMEOUT_MS,
  EARLIER_STARTER_HEADING,
  LINE_MARKERS,
} from './constants.js';
import { filterFiles, isBinary } from './file-selection.js';
import { diffLines, git, listChangedPaths, listTreeFiles, readFileAt } from './git.js';

/**
 * Fetches the content of each file at headSha and returns the raw file entries
 * as `rawFiles`. Files with no text to assess are left out of it and returned
 * as `skipped`, each with why: 'deleted' (not readable at headSha) or 'binary'
 * (contains a null byte). Only the files in `rawFiles` are assessed.
 */
export function collectRawFiles(files, headSha) {
  const rawFiles = [];
  const skipped = [];
  for (const filepath of files) {
    let content;
    try {
      content = git('show', `${headSha}:${filepath}`);
    } catch {
      // Deleted files or other git errors — skip
      skipped.push({ filepath, reason: 'deleted' });
      continue;
    }
    // Skip binary files rather than sending garbage to the AI.
    if (isBinary(content)) {
      skipped.push({ filepath, reason: 'binary' });
      continue;
    }
    rawFiles.push({ filepath, content });
  }
  return { rawFiles, skipped };
}

/**
 * Like collectRawFiles, for files that may not exist at `sha`: the base of the
 * assessed range, or the first commit. A path absent there, or binary, is
 * skipped.
 */
export function collectFilesAt(paths, sha) {
  const found = [];
  for (const filepath of paths) {
    const content = readFileAt(sha, filepath);
    if (content === null || isBinary(content)) continue;
    found.push({ filepath, content });
  }
  return found;
}

/**
 * Accepts pre-fetched raw file entries, runs rmcm on each, and returns
 * stripped entries. Falls back silently to the original content when the
 * file type is unsupported or the binary is unavailable.
 *
 * Every line stays where it was: rmcm is run without collapsing blank lines,
 * so a removed comment leaves its lines behind empty, and the line numbers the
 * AI names snippets by are the student's own. A file whose stripped copy fails
 * that check (see keepsLinePositions) is sent with its comments, with a warning.
 *
 * Returns the stripped file entries, cumulative character count, and
 * `commentsKept`, the paths that failed the check.
 */
export function stripCommentsFromFiles(rawFiles) {
  const strippedFiles = [];
  const commentsKept = [];
  let strippedCharCount = 0;

  for (const { filepath, content } of rawFiles) {
    const tmpFile = path.join('/tmp', `rmcm_${process.pid}_${path.basename(filepath)}`);
    let stripped = content;

    try {
      fs.writeFileSync(tmpFile, content, 'utf-8');
      const result = spawnSync(COMMENT_REMOVER_BIN, [tmpFile], {
        encoding: 'utf-8',
        timeout: COMMENT_STRIP_TIMEOUT_MS,
      });
      if (result.status === 0) {
        if (keepsLinePositions(content, result.stdout)) {
          stripped = result.stdout;
        } else {
          commentsKept.push(filepath);
          core.warning(
            `Comments were kept in ${filepath}: removing them moved its lines, and the ` +
              `line numbers the questions are built from must match the student's file.`,
          );
        }
      }
      // Non-zero exit means unsupported/unrecognised type — silently use original
    } catch {
      // Binary unavailable or other error — silently use original
    } finally {
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        /* ignore */
      }
    }

    strippedCharCount += stripped.length;
    strippedFiles.push({ filepath, content: stripped });
  }

  return { strippedFiles, strippedCharCount, commentsKept };
}

/** A text's lines, splitting at every line break an editor would: CRLF, LF or a lone CR. */
function splitLines(text) {
  return text.split(/\r\n|\r|\n/);
}

/**
 * Whether `stripped` keeps every line of `original` where it was: as many
 * lines, each one the original line with only characters taken out. A final
 * line break on one and not the other is ignored.
 */
export function keepsLinePositions(original, stripped) {
  const lines = (text) => splitLines(text.replace(/(\r\n|\r|\n)$/, ''));
  const before = lines(original);
  const after = lines(stripped);
  return after.length === before.length && after.every((line, i) => isSubsequence(line, before[i]));
}

/** Whether every character of `part` appears in `whole`, in order. */
function isSubsequence(part, whole) {
  let j = 0;
  for (const ch of part) {
    j = whole.indexOf(ch, j);
    if (j === -1) return false;
    j += ch.length;
  }
  return true;
}

/**
 * Formats file entries as a series of fenced code blocks, one per file: the
 * code as it is, for the code_after_strip output and size counts. The prompt
 * numbers its lines instead (see buildNumberedCodeContent).
 */
export function buildCodeContent(files) {
  return files.map(codeSection).join('\n\n');
}

function codeSection({ filepath, content }) {
  const ext = path.extname(filepath).slice(1);
  return `### \`${filepath}\`\n\`\`\`${ext}\n${content.trimEnd()}\n\`\`\``;
}

/** A file's lines as the prompt numbers them, with no trailing blank lines. */
function splitFileLines(content) {
  const text = content.replace(/\s+$/, '');
  return text ? splitLines(text) : [];
}

/**
 * One file as a fenced block for the prompt, every line led by its line number
 * and `| `, so the model names the lines a snippet shows rather than copying
 * them. `entries` are `{ number, text }`, plus `marker` in a marked file, where
 * the marker column (LINE_MARKERS) comes first and a removed line, no longer in
 * the file, has no number.
 *
 * Only the first of a run of blank lines is shown — the lines a removed
 * comment leaves behind — and a removed blank line not at all. The numbers
 * skip over them, so each line keeps its number in the student's file.
 */
function numberedSection(filepath, entries, heading = '') {
  const width = String(Math.max(1, ...entries.map((e) => e.number ?? 0))).length;
  let previousBlank = false;
  const shown = entries.filter(({ number, text }) => {
    const blank = !text.trim();
    const show = !blank || (number !== null && !previousBlank);
    if (show) previousBlank = blank;
    return show;
  });
  const body = shown
    .map(({ marker, number, text }) => {
      const lead = marker === undefined ? '' : `${marker} `;
      const num = number === null ? ' '.repeat(width) : String(number).padStart(width);
      return `${lead}${num} | ${text}`.trimEnd();
    })
    .join('\n');
  const ext = path.extname(filepath).slice(1);
  return `### \`${filepath}\`${heading}\n\`\`\`${ext}\n${body}\n\`\`\``;
}

/**
 * Formats files for the prompt with numbered lines (see numberedSection), and
 * returns each file's lines so the snippets the model names by line number can
 * be read back out (see resolveSnippets in postprocess.js).
 *
 * Returns `{ content, sources }`. Each source is `{ filepath, lines,
 * studentLines, starterLines }`: `studentLines` is 'all' when every line is the
 * student's work in this submission, and an empty set for `student: false` —
 * codebase context, which is never theirs to be assessed on. `starterLines` is
 * 'all' for `starter: true` — starter code that may be asked about
 * (starter_code: ask) — and otherwise an empty set.
 */
export function buildNumberedCodeContent(files, { student = true, starter = false } = {}) {
  const sections = [];
  const sources = [];
  for (const { filepath, content } of files) {
    const lines = splitFileLines(content);
    sections.push(
      numberedSection(
        filepath,
        lines.map((text, i) => ({ number: i + 1, text })),
      ),
    );
    sources.push({
      filepath,
      lines,
      studentLines: student ? 'all' : new Set(),
      starterLines: starter ? 'all' : new Set(),
    });
  }
  return { content: sections.join('\n\n'), sources };
}

/**
 * Formats the assessed files for the prompt, marking the student's lines in
 * any file that already existed before the assessed range.
 *
 * `baseByPath` maps a file path to its content at the base of the range,
 * processed the same way as `files` (comments stripped or not). A file with no
 * entry there is new in the range — every line is the student's — and is
 * rendered as a plain numbered block. A file with one is rendered in full with
 * a marker column (LINE_MARKERS): lines the student added or changed, lines
 * they removed, and unchanged lines, which are context rather than their work.
 * Without the markers a one-line edit to a starter file would put the whole
 * file up for questions. Line numbers count the file as it is now, so a
 * removed line has none.
 *
 * `starterByPath` is given under starter_code: ask only. It maps a path to its
 * content at the first commit, processed the same way. An unchanged line that
 * is also unchanged since the first commit is starter code the student was
 * given, and is marked LINE_MARKERS.starter so the AI may ask about it; the
 * other unchanged lines are the student's own earlier work. When the base is
 * the first commit, the caller passes `baseByPath` again, and every unchanged
 * line is starter code.
 *
 * Returns `{ content, sources, markedFiles, addedLines, starterLines }`: the
 * files rendered with markers, their lines (see buildNumberedCodeContent; a
 * marked file's `studentLines` is the set of its added line numbers and its
 * `starterLines` the set of its starter line numbers), how many lines across
 * the whole submission the student wrote, which the caller uses to tell a
 * submission with nothing to mark from one that has work in it, and how many
 * starter lines were marked. Blank lines are never counted as either.
 *
 * @param {{ filepath: string, content: string }[]} files
 * @param {Map<string, string>} baseByPath
 * @param {Map<string, string> | null} [starterByPath]
 */
export function buildAssessedCodeContent(files, baseByPath, starterByPath = null) {
  const sections = [];
  const sources = [];
  const markedFiles = [];
  let addedLines = 0;
  let starterLineCount = 0;

  for (const file of files) {
    if (!baseByPath.has(file.filepath)) {
      const numbered = buildNumberedCodeContent([file]);
      sections.push(numbered.content);
      sources.push(...numbered.sources);
      addedLines += numbered.sources[0].lines.filter((line) => line.trim()).length;
      continue;
    }

    const sinceStart = starterByPath?.has(file.filepath)
      ? unchangedLineNumbers(starterByPath.get(file.filepath), file.content)
      : new Set();
    const lines = [];
    const added = new Set();
    const starter = new Set();
    const entries = diffLines(baseByPath.get(file.filepath), file.content).map(
      ({ marker, text }) => {
        if (marker === LINE_MARKERS.removed) return { marker, number: null, text };
        lines.push(text);
        const number = lines.length;
        // A blank line is nobody's work: it is often all a changed comment
        // leaves behind once stripped.
        if (!text.trim()) return { marker, number, text };
        if (marker === LINE_MARKERS.added) added.add(number);
        else if (sinceStart.has(number)) {
          starter.add(number);
          return { marker: LINE_MARKERS.starter, number, text };
        }
        return { marker, number, text };
      },
    );
    addedLines += added.size;
    starterLineCount += starter.size;
    markedFiles.push(file.filepath);
    sources.push({ filepath: file.filepath, lines, studentLines: added, starterLines: starter });
    sections.push(
      numberedSection(
        file.filepath,
        entries,
        " (existed before this submission — student's lines marked)",
      ),
    );
  }

  return {
    content: sections.join('\n\n'),
    sources,
    markedFiles,
    addedLines,
    starterLines: starterLineCount,
  };
}

/** The line numbers of `newText` that are unchanged from `oldText`. */
function unchangedLineNumbers(oldText, newText) {
  const unchanged = new Set();
  let number = 0;
  for (const { marker } of diffLines(oldText, newText)) {
    if (marker === LINE_MARKERS.removed) continue;
    number += 1;
    if (marker === LINE_MARKERS.unchanged) unchanged.add(number);
  }
  return unchanged;
}

/** Directory segments of a path's parent folder ('' for a root-level file). */
function dirSegments(filepath) {
  const dir = path.posix.dirname(filepath.replace(/\\/g, '/'));
  return dir === '.' ? [] : dir.split('/');
}

/**
 * How many folder steps separate two files' folders: 0 for the same folder,
 * 1 for a parent or child folder, and so on through their nearest shared
 * ancestor.
 */
export function folderDistance(a, b) {
  const da = dirSegments(a);
  const db = dirSegments(b);
  let shared = 0;
  while (shared < da.length && shared < db.length && da[shared] === db[shared]) shared++;
  return da.length - shared + (db.length - shared);
}

/**
 * Finds the codebase context candidates: every file at `headSha` that passes
 * the exclude patterns and did not change between `baseSha` and `headSha` —
 * the files the assessment itself leaves out. Each is returned as
 * `{ filepath, content, kind }`:
 *
 *   'starter' — also unchanged since `firstCommit`, so code the student was
 *               given. Pass firstCommit as null when the first commit is the
 *               student's own work (starter_code: none), and every file is
 *               'earlier'.
 *   'earlier' — changed before the range but not in it: the student's work
 *               from an earlier submission.
 *
 * An earlier file that was also in the first commit began as starter code the
 * student then changed, so it mixes the two. It stays 'earlier' — it holds the
 * student's writing, so it is never passed off as the instructor's — and
 * carries `starterCopy`, its content at the first commit, so its lines still
 * as given can be told apart (see selectCodebaseContext).
 *
 * A file unchanged in the range is identical at the base and the head, so a
 * starter file read here is byte-for-byte the first commit's copy. Binary
 * files are skipped.
 *
 * `skippedRange` is the { from, to } span of bot commits skip_committers
 * stepped over (see resolveSHAs), or null. Any file those commits touched is
 * left out: skip_committers means "do not send this", and such a file is
 * neither the instructor's starter code nor the student's earlier work.
 *
 * @param {object} range
 * @param {string} range.baseSha
 * @param {string} range.headSha
 * @param {string | null} range.firstCommit
 * @param {string[]} range.excludePatterns
 * @param {string[]} range.excludePatternOverrides
 * @param {string[]} [range.caseInsensitivePatterns]
 * @param {string[]} range.assessedFiles
 * @param {{ from: string, to: string } | null} [range.skippedRange]
 * @returns {{ filepath: string, content: string, kind: string, starterCopy?: string }[]}
 */
export function findCodebaseContextFiles({
  baseSha,
  headSha,
  firstCommit,
  excludePatterns,
  excludePatternOverrides,
  caseInsensitivePatterns = [],
  assessedFiles,
  skippedRange = null,
}) {
  const changedInRange = new Set(listChangedPaths(baseSha, headSha));
  const skipped = new Set(skippedRange ? listChangedPaths(skippedRange.from, skippedRange.to) : []);
  const paths = filterFiles(
    listTreeFiles(headSha),
    excludePatterns,
    excludePatternOverrides,
    caseInsensitivePatterns,
  ).filter((p) => !changedInRange.has(p) && !skipped.has(p) && !assessedFiles.includes(p));

  let inFirstCommit = new Set();
  let changedSinceStart = new Set();
  if (firstCommit) {
    inFirstCommit = new Set(listTreeFiles(firstCommit));
    changedSinceStart = new Set(listChangedPaths(firstCommit, headSha));
  }

  return collectFilesAt(paths, headSha).map((f) => {
    if (!inFirstCommit.has(f.filepath)) return { ...f, kind: 'earlier' };
    if (!changedSinceStart.has(f.filepath)) return { ...f, kind: 'starter' };
    const starterCopy = readFileAt(firstCommit, f.filepath);
    // A binary first-commit copy has no lines to compare.
    return starterCopy === null || isBinary(starterCopy)
      ? { ...f, kind: 'earlier' }
      : { ...f, kind: 'earlier', starterCopy };
  });
}

/**
 * Chooses which codebase files go to the AI as context, within maxChars.
 *
 * Each candidate is `{ filepath, content, kind }`, where kind is 'starter'
 * (unchanged since the first commit, so not the student's) or 'earlier' (the
 * student's own work from before the assessed range). Both compete for the one
 * budget, nearest the student's assessed files first — a file in the same
 * folder as the code the student changed is the likeliest to be what that code
 * calls or extends — with ties broken by path so the choice is stable from run
 * to run. Files are added whole: a file cut off part-way would show the AI half
 * a class or function, which is worse than not showing it. One that does not
 * fit is left out and the next, smaller one is still tried.
 *
 * With `askStarter` (starter_code: ask) the starter files' lines may be asked
 * about, and their sources say so (see buildNumberedCodeContent). So may the
 * lines still as given in an earlier file that began as starter code (see
 * numberedEarlierContext), or whether starter code could be asked about would
 * hang on whether the student happened to edit its file this submission.
 *
 * Returns `{ starterContent, earlierContent, sources, starterFiles,
 * earlierFiles, omitted, earlierFromStarter, earlierStarterLines }` — the
 * numbered blocks for each kind, the chosen files' lines (see
 * buildNumberedCodeContent), the paths that made it into each, the paths left
 * out for size, whether any chosen earlier file began as starter code, and how
 * many of its lines are marked as starter code (0 without `askStarter`).
 *
 * @param {{ filepath: string, content: string, kind?: string, starterCopy?: string }[]} candidates
 * @param {string[]} assessedFiles
 * @param {number} maxChars
 * @param {{ askStarter?: boolean }} [options]
 */
export function selectCodebaseContext(
  candidates,
  assessedFiles,
  maxChars,
  { askStarter = false } = {},
) {
  const distance = (filepath) =>
    assessedFiles.length === 0
      ? 0
      : Math.min(...assessedFiles.map((assessed) => folderDistance(filepath, assessed)));

  const ordered = candidates
    .filter((c) => c.content.trim())
    .map((c) => ({ ...c, distance: distance(c.filepath) }))
    .sort((a, b) => a.distance - b.distance || a.filepath.localeCompare(b.filepath));

  /** @type {{ starter: typeof ordered, earlier: typeof ordered }} */
  const chosen = { starter: [], earlier: [] };
  const omitted = [];
  let used = 0;

  const render = (files, kind) =>
    kind === 'starter'
      ? numberedContext(files, askStarter)
      : numberedEarlierContext(files, askStarter);

  for (const file of ordered) {
    const kind = file.kind === 'starter' ? 'starter' : 'earlier';
    // Counted as if every file shared one block; split across two, the
    // separators only shrink, so the total never exceeds maxChars.
    const cost = render([file], kind).content.length + (used > 0 ? 2 : 0);
    if (used + cost > maxChars) {
      omitted.push(file.filepath);
      continue;
    }
    chosen[kind].push(file);
    used += cost;
  }

  const starter = render(chosen.starter, 'starter');
  const earlier = render(chosen.earlier, 'earlier');
  return {
    starterContent: starter.content,
    earlierContent: earlier.content,
    sources: [...starter.sources, ...earlier.sources],
    starterFiles: chosen.starter.map((f) => f.filepath),
    earlierFiles: chosen.earlier.map((f) => f.filepath),
    omitted,
    earlierFromStarter: chosen.earlier.some((f) => f.starterCopy !== undefined),
    earlierStarterLines: earlier.starterLines,
  };
}

/** Codebase context files, numbered like the submission but never the student's work. */
function numberedContext(files, starter = false) {
  return buildNumberedCodeContent(files, { student: false, starter });
}

/**
 * The starter lines of each earlier file, by candidate object. A file is
 * rendered once to weigh it against the budget and again in its block, and
 * working the lines out runs git diff.
 */
const starterLinesCache = new WeakMap();

/**
 * Earlier work, numbered like numberedContext. A file that began as starter
 * code — one carrying `starterCopy`, its content at the first commit — is
 * headed EARLIER_STARTER_HEADING, since it mixes the instructor's code with the
 * student's. With `askStarter`, a line of it still as given is marked
 * LINE_MARKERS.starter and may be asked about, and every other line
 * LINE_MARKERS.unchanged. A file with no such line keeps no marker column.
 *
 * Returns `{ content, sources, starterLines }`, where starterLines counts the
 * marked lines.
 */
function numberedEarlierContext(files, askStarter) {
  const sections = [];
  const sources = [];
  let starterLineCount = 0;
  for (const file of files) {
    if (file.starterCopy === undefined) {
      const numbered = numberedContext([file]);
      sections.push(numbered.content);
      sources.push(...numbered.sources);
      continue;
    }
    const lines = splitFileLines(file.content);
    let starter = new Set();
    if (askStarter) {
      if (!starterLinesCache.has(file)) {
        // A blank line is nobody's code, as in buildAssessedCodeContent.
        const sinceStart = unchangedLineNumbers(file.starterCopy, file.content);
        starterLinesCache.set(file, new Set([...sinceStart].filter((n) => lines[n - 1]?.trim())));
      }
      starter = starterLinesCache.get(file);
    }
    const marked = starter.size > 0;
    const entries = lines.map((text, i) => {
      const number = i + 1;
      if (!marked) return { number, text };
      const marker = starter.has(number) ? LINE_MARKERS.starter : LINE_MARKERS.unchanged;
      return { marker, number, text };
    });
    starterLineCount += starter.size;
    sources.push({
      filepath: file.filepath,
      lines,
      studentLines: new Set(),
      starterLines: starter,
    });
    sections.push(numberedSection(file.filepath, entries, EARLIER_STARTER_HEADING));
  }
  return { content: sections.join('\n\n'), sources, starterLines: starterLineCount };
}

/**
 * Reads files from GITHUB_WORKSPACE (or cwd as fallback) that match any of
 * the provided glob patterns. Returns their combined contents formatted as
 * headed sections, capped at the maxChars argument (default: DEFAULT_ASSIGNMENT_CONTEXT_MAX_CHARS).
 *
 * Always returns `{ content, matchedFiles }` — every exit, including the ones
 * that find nothing. The caller destructures the result, so an exit returning a
 * bare string silently hands it `undefined` for both names and takes the whole
 * job summary down with it when something later reads `.length`.
 *
 * `matchedFiles` lists the files whose content actually reached `content`, not
 * every file the globs matched: the report names these to the instructor, and
 * naming a file that the maxChars cap dropped would be a lie.
 */
export async function readAssignmentContextFiles(globs, maxChars) {
  if (!globs || globs.length === 0) return { content: '', matchedFiles: [] };

  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const opts = { dot: true };

  // Walk the workspace directory recursively to get all candidate paths.
  let allFiles;
  try {
    allFiles = fs.readdirSync(workspace, { recursive: true, encoding: 'utf-8' });
  } catch {
    return { content: '', matchedFiles: [] };
  }

  // Keep only regular files that match at least one glob.
  const matched = allFiles.filter((rel) => {
    const normalised = rel.replace(/\\/g, '/');
    try {
      const stat = fs.statSync(path.join(workspace, normalised));
      if (!stat.isFile()) return false;
    } catch {
      return false;
    }
    return globs.some((g) => minimatch(normalised, g, opts));
  });

  if (matched.length === 0) return { content: '', matchedFiles: [] };

  let combined = '';
  let truncated = false;
  const consumed = [];

  for (const rel of matched) {
    const normalised = rel.replace(/\\/g, '/');
    let content;
    try {
      if (normalised.toLowerCase().endsWith('.pdf')) {
        const buffer = fs.readFileSync(path.join(workspace, normalised));
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const { text } = await extractText(pdf, { mergePages: true });
        content = text;
      } else if (/\.docx?$/i.test(normalised)) {
        const buffer = fs.readFileSync(path.join(workspace, normalised));
        const result = await mammoth.extractRawText({ buffer });
        content = result.value;
      } else {
        content = fs.readFileSync(path.join(workspace, normalised), 'utf-8');
      }
    } catch (err) {
      core.warning(
        `assignment_context: failed to read "${normalised}" — ${err.message}. Skipping.`,
      );
      continue;
    }

    const header = `### \`${normalised}\`\n`;
    const section = `${header}${content.trimEnd()}\n`;

    if (combined.length + section.length > maxChars) {
      const remaining = maxChars - combined.length;
      if (remaining > 0) {
        combined += section.substring(0, remaining);
        // Claim the file as context only if the cap left room past the header
        // for some of its actual content. A fragment of the heading is not
        // context, and the files after this one never reached the prompt at all.
        if (remaining > header.length) consumed.push(normalised);
      }
      truncated = true;
      break;
    }

    combined += section + '\n';
    consumed.push(normalised);
  }

  if (truncated) {
    combined += '\n[assignment context truncated due to size]';
  }

  return { content: combined.trim(), matchedFiles: consumed };
}
