// Writes the "What's Changed" notes for a release: the commits since the
// previous release, grouped by Conventional Commit type.
//
// Both release workflows call it, each for its own tags and its own files:
//
//   release.yml (the action, v* tags)
//     node scripts/release-notes.js --tag v0.25.0 --match "v[0-9]*" \
//       --path . --path ":(exclude)extensions" --out notes.md
//
//   vscode-extension-release.yml (the VS Code extension, vscode-v* tags)
//     node scripts/release-notes.js --tag vscode-v0.2.0 --match "vscode-v*" \
//       --path extensions/vscode --out notes.md
//
//   --tag    the tag being released
//   --match  a git glob for the tags that count as this product's releases.
//            The repository holds more than one product, so the nearest tag
//            of any name could be another product's.
//   --path   a git pathspec, repeatable: only commits touching these paths
//            are listed. A commit that touches nothing else belongs to
//            another product's notes.
//   --out    the file to write. An empty file means there is nothing to list.

import { spawnSync } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

/** Separates commits in the log. It cannot occur in a commit message. */
const RECORD_SEPARATOR = String.fromCharCode(30);

/** The sections of the notes, in order, and the heading each type is filed under. */
const SECTIONS = [
  ['feat', 'Features'],
  ['fix', 'Bug Fixes'],
  ['docs', 'Documentation'],
  ['perf', 'Performance'],
  ['refactor', 'Refactoring'],
  ['test', 'Tests'],
  ['chore', 'Chores & Maintenance'],
];

/**
 * Types accepted from a line after the header. Restricted to the known set so
 * trailers (Refs:, Closes:, Signed-off-by:) can never turn into entries.
 */
const KNOWN_TYPES = new Set([...SECTIONS.map(([type]) => type), 'build', 'ci', 'style', 'revert']);

const CONVENTIONAL = /^(\w+)(\([\w\-./ ]+\))?: (.+)$/;

/**
 * The snapshot-docs job commits "docs: update vN snapshot" after every action
 * release, so that commit lands in the next release's range. It is release
 * plumbing, not a change worth listing.
 */
const EXCLUDED = /^docs: update v\d+ snapshot$/;

/**
 * Turns a log of commit messages into the release notes, or '' when the log
 * holds nothing to list. `log` is each commit's raw message followed by
 * RECORD_SEPARATOR, as `git log --pretty=format:%B%x1e` prints it.
 *
 * A commit is filed by its header's type, with `build` and `ci` under chores
 * and any other type under "Other". A further conventional-commit line in the
 * body is filed as an entry of its own, so a commit that states more than one
 * change appears under each type.
 */
export function formatReleaseNotes(log) {
  const buckets = Object.fromEntries(SECTIONS.map(([type]) => [type, []]));
  const other = [];
  const push = (type, scope, description) => {
    const prefix = scope ? `**${scope.slice(1, -1)}:** ` : '';
    const key = ['build', 'ci'].includes(type) ? 'chore' : type;
    (buckets[key] ?? other).push(`- ${prefix}${description.trim()}`);
  };

  for (const record of log.split(RECORD_SEPARATOR)) {
    const message = record.trim();
    if (!message) continue;
    const [header, ...rest] = message.split('\n');
    if (EXCLUDED.test(header.trim())) continue;
    const match = header.trim().match(CONVENTIONAL);
    if (match) push(match[1], match[2], match[3]);
    else other.push(`- ${header.trim()}`);

    for (const line of rest) {
      const further = line.trim().match(CONVENTIONAL);
      if (further && KNOWN_TYPES.has(further[1])) push(further[1], further[2], further[3]);
    }
  }

  const sections = SECTIONS.filter(([type]) => buckets[type].length > 0).map(
    ([type, heading]) => `### ${heading}\n\n${buckets[type].join('\n')}`,
  );
  if (other.length > 0) sections.push(`### Other\n\n${other.join('\n')}`);
  return sections.length > 0 ? `### What's Changed\n\n${sections.join('\n\n')}\n` : '';
}

/** Reads `--name value` pairs. A name given more than once collects every value. */
export function parseArgs(argv) {
  const args = { path: [] };
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i]?.replace(/^--/, '');
    const value = argv[i + 1];
    if (!argv[i]?.startsWith('--') || value === undefined) {
      throw new Error(`expected --name value pairs, got "${argv[i]}"`);
    }
    if (name === 'path') args.path.push(value);
    else args[name] = value;
  }
  for (const required of ['tag', 'match', 'out']) {
    if (!args[required]) throw new Error(`--${required} is required`);
  }
  return args;
}

function git(args) {
  return spawnSync('git', args, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
}

function main() {
  const { tag, match, path, out } = parseArgs(process.argv.slice(2));

  // The nearest earlier release of this product. None means this is its first.
  const described = git(['describe', '--tags', '--abbrev=0', '--match', match, `${tag}^`]);
  const previous = described.status === 0 ? described.stdout.trim() : '';

  // %B (the raw message), not %s: git defines the subject as the first
  // paragraph with its newlines folded to spaces, so a commit whose subject is
  // not followed by a blank line arrives as one run-on line.
  const logged = git([
    'log',
    previous ? `${previous}..${tag}` : tag,
    '--pretty=format:%B%x1e',
    '--no-merges',
    ...(path.length > 0 ? ['--', ...path] : []),
  ]);
  if (logged.status !== 0) throw new Error(`git log failed: ${logged.stderr.trim()}`);

  writeFileSync(out, formatReleaseNotes(logged.stdout), 'utf-8');
  console.log(`Wrote the notes for ${previous ? `${previous}..${tag}` : tag} to ${out}.`);
}

// Only run when the script is run directly; the test suite imports it.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
