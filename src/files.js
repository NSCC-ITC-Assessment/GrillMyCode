/**
 * File Collection, Filtering, and Comment Stripping
 *
 * Handles the pipeline from a list of changed file paths through to formatted
 * code content ready for inclusion in the AI prompt: glob-based filtering,
 * fetching file contents from git, stripping comments via rmcm, and rendering
 * fenced code blocks.
 */

import * as core from '@actions/core';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { minimatch } from 'minimatch';
import { extractText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';
import { COMMENT_REMOVER_BIN, COMMENT_STRIP_TIMEOUT_MS, LINE_MARKERS } from './constants.js';
import { diffLines, git, listChangedPaths, listTreeFiles, readFileAt } from './git.js';

/**
 * Filters a list of file paths against exclude glob patterns.
 * Any file that would be excluded but matches an override pattern is re-included.
 * Overrides accept either an exact pattern from the exclude list (e.g. **\/*.md)
 * or a specific file path that would otherwise be excluded (e.g. README.md).
 *
 * matchBase makes a slash-free pattern match on basename alone, at any depth.
 * The built-in patterns no longer rely on it — they carry explicit `**\/`
 * prefixes — but it is what lets an instructor write
 * `additional_exclude_patterns: starter.py` and have it match wherever the file
 * sits. Patterns containing a slash are unaffected by it.
 */
export function filterFiles(files, excludePatterns, overridePatterns = []) {
  const opts = { dot: true, matchBase: true };

  return files.filter((f) => {
    const excluded = excludePatterns.some((p) => minimatch(f, p, opts));
    if (!excluded) return true;
    if (overridePatterns.length === 0) return false;
    return overridePatterns.some((p) => minimatch(f, p, opts));
  });
}

/**
 * Fetches the content of each file at headSha and returns raw file entries.
 * Files that cannot be read (e.g. deleted) or are detected as binary (contain
 * a null byte) are silently skipped.
 */
export function collectRawFiles(files, headSha) {
  const rawFiles = [];
  for (const filepath of files) {
    let content;
    try {
      content = git('show', `${headSha}:${filepath}`);
    } catch {
      // Deleted files or other git errors — skip
      continue;
    }
    // Binary files contain null bytes — skip them rather than sending garbage
    // to the AI. This mirrors the heuristic git itself uses.
    if (content.includes('\0')) {
      core.debug(`Skipping binary file: ${filepath}`);
      continue;
    }
    rawFiles.push({ filepath, content });
  }
  return rawFiles;
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
    if (content === null || content.includes('\0')) continue;
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
 * studentLines }`: `studentLines` is 'all' when every line is the student's
 * work in this submission, and an empty set for `student: false` — codebase
 * context, which is never theirs to be assessed on.
 */
export function buildNumberedCodeContent(files, { student = true } = {}) {
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
    sources.push({ filepath, lines, studentLines: student ? 'all' : new Set() });
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
 * Returns `{ content, sources, markedFiles, addedLines }`: the files rendered
 * with markers, their lines (see buildNumberedCodeContent; a marked file's
 * `studentLines` is the set of its added line numbers), and how many lines
 * across the whole submission the student wrote, which the caller uses to tell
 * a submission with nothing to mark from one that has work in it. Blank lines
 * are never counted as the student's.
 */
export function buildAssessedCodeContent(files, baseByPath) {
  const sections = [];
  const sources = [];
  const markedFiles = [];
  let addedLines = 0;

  for (const file of files) {
    if (!baseByPath.has(file.filepath)) {
      const numbered = buildNumberedCodeContent([file]);
      sections.push(numbered.content);
      sources.push(...numbered.sources);
      addedLines += numbered.sources[0].lines.filter((line) => line.trim()).length;
      continue;
    }

    const lines = [];
    const added = new Set();
    const entries = diffLines(baseByPath.get(file.filepath), file.content).map(
      ({ marker, text }) => {
        if (marker === LINE_MARKERS.removed) return { marker, number: null, text };
        lines.push(text);
        // A blank line is nobody's work: it is often all a changed comment
        // leaves behind once stripped.
        if (marker === LINE_MARKERS.added && text.trim()) added.add(lines.length);
        return { marker, number: lines.length, text };
      },
    );
    addedLines += added.size;
    markedFiles.push(file.filepath);
    sources.push({ filepath: file.filepath, lines, studentLines: added });
    sections.push(
      numberedSection(
        file.filepath,
        entries,
        " (existed before this submission — student's lines marked)",
      ),
    );
  }

  return { content: sections.join('\n\n'), sources, markedFiles, addedLines };
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
 *               student's own work (include_initial_commit), and every file is
 *               'earlier'.
 *   'earlier' — changed before the range but not in it: the student's work
 *               from an earlier submission.
 *
 * A file unchanged in the range is identical at the base and the head, so a
 * starter file read here is byte-for-byte the first commit's copy. Binary
 * files are skipped.
 *
 * `skippedRange` is the { from, to } span of bot commits skip_committers
 * stepped over (see resolveSHAs), or null. Any file those commits touched is
 * left out: skip_committers means "do not send this", and such a file is
 * neither the instructor's starter code nor the student's earlier work.
 */
export function findCodebaseContextFiles({
  baseSha,
  headSha,
  firstCommit,
  excludePatterns,
  excludePatternOverrides,
  assessedFiles,
  skippedRange = null,
}) {
  const changedInRange = new Set(listChangedPaths(baseSha, headSha));
  const skipped = new Set(skippedRange ? listChangedPaths(skippedRange.from, skippedRange.to) : []);
  const paths = filterFiles(
    listTreeFiles(headSha),
    excludePatterns,
    excludePatternOverrides,
  ).filter((p) => !changedInRange.has(p) && !skipped.has(p) && !assessedFiles.includes(p));

  let isStarter = () => false;
  if (firstCommit) {
    const inFirstCommit = new Set(listTreeFiles(firstCommit));
    const changedSinceStart = new Set(listChangedPaths(firstCommit, headSha));
    isStarter = (p) => inFirstCommit.has(p) && !changedSinceStart.has(p);
  }

  return collectFilesAt(paths, headSha).map((f) => ({
    ...f,
    kind: isStarter(f.filepath) ? 'starter' : 'earlier',
  }));
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
 * Returns `{ starterContent, earlierContent, sources, starterFiles,
 * earlierFiles, omitted }` — the numbered blocks for each kind, the chosen
 * files' lines (see buildNumberedCodeContent), the paths that made it into
 * each, and the paths left out for size.
 */
export function selectCodebaseContext(candidates, assessedFiles, maxChars) {
  const distance = (filepath) =>
    assessedFiles.length === 0
      ? 0
      : Math.min(...assessedFiles.map((assessed) => folderDistance(filepath, assessed)));

  const ordered = candidates
    .filter((c) => c.content.trim())
    .map((c) => ({ ...c, distance: distance(c.filepath) }))
    .sort((a, b) => a.distance - b.distance || a.filepath.localeCompare(b.filepath));

  const chosen = { starter: [], earlier: [] };
  const omitted = [];
  let used = 0;

  for (const file of ordered) {
    // Counted as if every file shared one block; split across two, the
    // separators only shrink, so the total never exceeds maxChars.
    const cost = numberedContext([file]).content.length + (used > 0 ? 2 : 0);
    if (used + cost > maxChars) {
      omitted.push(file.filepath);
      continue;
    }
    chosen[file.kind === 'starter' ? 'starter' : 'earlier'].push(file);
    used += cost;
  }

  const starter = numberedContext(chosen.starter);
  const earlier = numberedContext(chosen.earlier);
  return {
    starterContent: starter.content,
    earlierContent: earlier.content,
    sources: [...starter.sources, ...earlier.sources],
    starterFiles: chosen.starter.map((f) => f.filepath),
    earlierFiles: chosen.earlier.map((f) => f.filepath),
    omitted,
  };
}

/** Codebase context files, numbered like the submission but never the student's work. */
function numberedContext(files) {
  return buildNumberedCodeContent(files, { student: false });
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
