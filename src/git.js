/**
 * Git Utilities
 *
 * Low-level wrappers around git CLI commands using spawnSync (no shell
 * interpolation). These functions have no GitHub Actions or Octokit
 * dependencies and can be used or tested independently.
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GIT_EMPTY_TREE_SHA, GIT_MAX_BUFFER, LINE_MARKERS } from './constants.js';

/**
 * Runs a git command using spawnSync and returns stdout.
 * Throws on non-zero exit.
 */
export function git(...args) {
  const result = spawnSync('git', args, {
    encoding: 'utf-8',
    maxBuffer: GIT_MAX_BUFFER,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args[0]} failed:\n${result.stderr}`);
  return result.stdout;
}

export function getFirstCommit() {
  return git('rev-list', '--max-parents=0', 'HEAD').trim();
}

export function getChangedFiles(baseSha, headSha) {
  return git('diff', '--name-only', baseSha, headSha)
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);
}

export function getDiff(baseSha, headSha, files) {
  return git('diff', baseSha, headSha, '--', ...files);
}

/**
 * Every file path in a commit's tree. NUL-delimited so a path git would
 * otherwise quote (non-ASCII, embedded quotes) comes back exactly as written.
 */
export function listTreeFiles(sha) {
  return git('ls-tree', '-r', '--name-only', '-z', sha).split('\0').filter(Boolean);
}

/** Paths that differ between two commits, NUL-delimited like listTreeFiles. */
export function listChangedPaths(fromSha, toSha) {
  return git('diff', '--name-only', '-z', fromSha, toSha).split('\0').filter(Boolean);
}

/**
 * A file's content at a commit, or null when the file does not exist there.
 * The empty tree has no files, so it answers null without asking git.
 */
export function readFileAt(sha, filepath) {
  if (sha === GIT_EMPTY_TREE_SHA) return null;
  const result = spawnSync('git', ['show', `${sha}:${filepath}`], {
    encoding: 'utf-8',
    maxBuffer: GIT_MAX_BUFFER,
  });
  if (result.error) throw result.error;
  return result.status === 0 ? result.stdout : null;
}

/**
 * Line-by-line comparison of two texts, returned as the whole of the new text
 * interleaved with the removed lines of the old: `[{ marker, text }]`, where
 * marker is one of LINE_MARKERS.
 *
 * The texts are compared rather than two commits because the caller compares
 * them after comment stripping — marking lines of the unstripped file would
 * point the AI at lines it never sees. git does the diffing (`--no-index`
 * works on any two files), with enough context lines that the whole file
 * lands in a single hunk, so everything after the first @@ header is the file.
 */
export function diffLines(oldRaw, newRaw) {
  // A missing final newline or a switch to CRLF line endings would otherwise
  // mark lines the student never touched as theirs.
  const normalise = (text) => text.replace(/\r\n/g, '\n').replace(/\n?$/, '\n');
  const oldText = normalise(oldRaw);
  const newText = normalise(newRaw);
  const splitLines = (text) => text.replace(/\n$/, '').split('\n');
  if (oldText === newText) {
    return splitLines(newText).map((text) => ({ marker: LINE_MARKERS.unchanged, text }));
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmc-diff-'));
  try {
    const oldFile = path.join(dir, 'old');
    const newFile = path.join(dir, 'new');
    fs.writeFileSync(oldFile, oldText, 'utf-8');
    fs.writeFileSync(newFile, newText, 'utf-8');
    const context = splitLines(oldText).length + splitLines(newText).length;
    const result = spawnSync(
      'git',
      [
        'diff',
        '--no-index',
        '--no-color',
        '--no-ext-diff',
        '--diff-algorithm=histogram',
        `-U${context}`,
        oldFile,
        newFile,
      ],
      { encoding: 'utf-8', maxBuffer: GIT_MAX_BUFFER },
    );
    if (result.error) throw result.error;
    // --no-index exits 1 when the files differ; only 2 and above are errors.
    if (result.status > 1) throw new Error(`git diff --no-index failed:\n${result.stderr}`);

    const lines = result.stdout.split('\n');
    const start = lines.findIndex((line) => line.startsWith('@@'));
    if (start === -1) {
      return splitLines(newText).map((text) => ({ marker: LINE_MARKERS.unchanged, text }));
    }
    const markers = new Set(Object.values(LINE_MARKERS));
    return lines
      .slice(start + 1)
      .filter((line) => line.length > 0 && markers.has(line[0]))
      .map((line) => ({ marker: line[0], text: line.slice(1) }));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Parses `git log` output produced with the NUL-delimited format
 * `--format=%H%x00%ae%x00%an`. Records are newline-separated; the three fields
 * (SHA, author email, author name) are separated by NUL bytes.
 *
 * NUL can never appear inside a commit SHA, author email, or author name, so
 * this parses correctly even when an author name contains a literal tab — a
 * case that corrupted the previous `\t`-delimited parsing (an attacker controls
 * their own git author name).
 */
function parseCommitLog(raw) {
  return raw
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const [sha = '', email = '', name = ''] = line.split('\0');
      return { sha, email, name };
    });
}

/** True if a commit's author name or email contains any skip substring. */
function matchesSkipCommitter(commit, skipCommitters) {
  return skipCommitters.some((sc) => {
    const scLower = sc.toLowerCase();
    return (
      commit.email.toLowerCase().includes(scLower) || commit.name.toLowerCase().includes(scLower)
    );
  });
}

/**
 * Returns the leading run of commits (oldest-first from baseSha towards headSha)
 * whose author name or email matches a skipCommitters substring. The walk stops
 * at the first non-matching commit, so only a consecutive leading run is
 * returned.
 *
 * This is a cheap, local pre-filter only. Because author name/email are fully
 * attacker-controlled, callers MUST confirm each returned commit against its
 * GitHub-verified account login before trimming it from the assessed diff —
 * otherwise a student could hide their own commits by setting their git author
 * name to a bot's (see resolveSHAs).
 */
export function getLeadingSkipCandidates(baseSha, headSha, skipCommitters) {
  if (!skipCommitters || skipCommitters.length === 0) return [];

  // git log range notation (A..B) requires A to be a commit object.
  // When baseSha is the empty tree, use a plain log up to headSha instead.
  const logRange = baseSha === GIT_EMPTY_TREE_SHA ? [headSha] : [`${baseSha}..${headSha}`];
  const commits = parseCommitLog(git('log', '--format=%H%x00%ae%x00%an', '--reverse', ...logRange));

  const run = [];
  for (const commit of commits) {
    if (!matchesSkipCommitter(commit, skipCommitters)) break;
    run.push(commit);
  }
  return run;
}

/**
 * Returns per-file line counts for the assessed range as
 * `[{ filepath, added, removed }]`, using `git diff --numstat`.
 *
 * Binary files are reported by git as `-` for both counts; they surface here as
 * null so the caller can render them as binary rather than as "0 lines changed".
 */
export function getDiffStat(baseSha, headSha, files) {
  return git('diff', '--numstat', baseSha, headSha, '--', ...files)
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [added = '', removed = '', filepath = ''] = line.split('\t');
      return {
        filepath,
        added: added === '-' ? null : Number(added),
        removed: removed === '-' ? null : Number(removed),
      };
    })
    .filter((entry) => entry.filepath);
}

/**
 * Resolves a SHA to the commit it names, peeling an annotated tag object to
 * the commit it tags. A lightweight tag's SHA is already the commit and passes
 * through unchanged.
 */
export function peelToCommit(sha) {
  return git('rev-parse', '--verify', `${sha}^{commit}`).trim();
}

/**
 * True when `ancestor` is reachable from `descendant` (a commit counts as its
 * own ancestor). `git merge-base --is-ancestor` answers through its exit code —
 * 1 means "no" and anything else is a real error — so it cannot go through
 * git(), which treats every non-zero exit as a failure.
 */
export function isAncestor(ancestor, descendant) {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
    encoding: 'utf-8',
  });
  if (result.error) throw result.error;
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error(`git merge-base failed:\n${result.stderr}`);
}

/**
 * The commit a tag points at (peeled, so an annotated tag gives its commit), or
 * '' when no such tag exists locally. The name is looked up under `refs/tags/`
 * explicitly, so a branch of the same name is never picked up instead.
 */
export function resolveTagCommit(name) {
  const result = spawnSync(
    'git',
    ['rev-parse', '--verify', '--quiet', `refs/tags/${name}^{commit}`],
    { encoding: 'utf-8' },
  );
  if (result.error) throw result.error;
  return result.status === 0 ? result.stdout.trim() : '';
}

/** True when `ref` resolves to a commit in the local repository. */
export function refExists(ref) {
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
    encoding: 'utf-8',
  });
  return result.status === 0;
}

/**
 * Lists every tag in the repository as `[{ name, commit }]`, with annotated
 * tags peeled to the commit they point at. `%(*objectname)` is the peeled
 * target and is empty for a lightweight tag, whose own object is the commit.
 */
export function listTags() {
  return git(
    'for-each-ref',
    '--format=%(refname:strip=2)%00%(objectname)%00%(*objectname)',
    'refs/tags',
  )
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name = '', object = '', peeled = ''] = line.split('\0');
      return { name, commit: peeled || object };
    })
    .filter((tag) => tag.name && tag.commit);
}

/** Commits reachable from `headSha`, nearest first. */
export function listAncestors(headSha) {
  return git('rev-list', '--topo-order', headSha).split('\n').filter(Boolean);
}
