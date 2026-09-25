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
 * Returns the stripped file entries and cumulative character count.
 */
export function stripCommentsFromFiles(rawFiles) {
  const strippedFiles = [];
  let strippedCharCount = 0;

  for (const { filepath, content } of rawFiles) {
    const tmpFile = path.join('/tmp', `rmcm_${process.pid}_${path.basename(filepath)}`);
    let stripped = content;

    try {
      fs.writeFileSync(tmpFile, content, 'utf-8');
      const result = spawnSync(COMMENT_REMOVER_BIN, ['--collapse-whitespace', '1', tmpFile], {
        encoding: 'utf-8',
        timeout: COMMENT_STRIP_TIMEOUT_MS,
      });
      if (result.status === 0) {
        stripped = result.stdout;
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

  return { strippedFiles, strippedCharCount };
}

/**
 * Formats file entries as a series of fenced code blocks, one per file,
 * for inclusion in the AI prompt.
 */
export function buildCodeContent(files) {
  return files.map(codeSection).join('\n\n');
}

function codeSection({ filepath, content }) {
  const ext = path.extname(filepath).slice(1);
  return `### \`${filepath}\`\n\`\`\`${ext}\n${content.trimEnd()}\n\`\`\``;
}

/**
 * Formats the assessed files for the prompt, marking the student's lines in
 * any file that already existed before the assessed range.
 *
 * `baseByPath` maps a file path to its content at the base of the range,
 * processed the same way as `files` (comments stripped or not). A file with no
 * entry there is new in the range — every line is the student's — and is
 * rendered as a plain block. A file with one is rendered in full with a
 * marker column (LINE_MARKERS): lines the student added or changed, lines they
 * removed, and unchanged lines, which are context rather than their work.
 * Without the markers a one-line edit to a starter file would put the whole
 * file up for questions.
 *
 * Returns `{ content, markedFiles, addedLines }`: the files rendered with
 * markers, and how many lines across the whole submission the student wrote
 * (every line of a new file, the added lines of a marked one), which the caller
 * uses to tell a submission with nothing to mark from one that has work in it.
 */
export function buildAssessedCodeContent(files, baseByPath) {
  const sections = [];
  const markedFiles = [];
  let addedLines = 0;

  for (const file of files) {
    if (!baseByPath.has(file.filepath)) {
      sections.push(codeSection(file));
      if (file.content.trim()) addedLines += file.content.trimEnd().split('\n').length;
      continue;
    }

    const lines = diffLines(baseByPath.get(file.filepath), file.content);
    addedLines += lines.filter((l) => l.marker === LINE_MARKERS.added).length;
    markedFiles.push(file.filepath);

    const ext = path.extname(file.filepath).slice(1);
    const body = lines.map((l) => `${l.marker}${l.text}`.trimEnd()).join('\n');
    sections.push(
      `### \`${file.filepath}\` (existed before this submission — student's lines marked)\n` +
        `\`\`\`${ext}\n${body}\n\`\`\``,
    );
  }

  return { content: sections.join('\n\n'), markedFiles, addedLines };
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
 * Returns `{ starterContent, earlierContent, starterFiles, earlierFiles,
 * omitted }` — the formatted blocks for each kind, the paths that made it into
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
    const cost = codeSection(file).length + (used > 0 ? 2 : 0);
    if (used + cost > maxChars) {
      omitted.push(file.filepath);
      continue;
    }
    chosen[file.kind === 'starter' ? 'starter' : 'earlier'].push(file);
    used += cost;
  }

  return {
    starterContent: buildCodeContent(chosen.starter),
    earlierContent: buildCodeContent(chosen.earlier),
    starterFiles: chosen.starter.map((f) => f.filepath),
    earlierFiles: chosen.earlier.map((f) => f.filepath),
    omitted,
  };
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
