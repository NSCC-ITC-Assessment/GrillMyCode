// Downloads every .gitignore template from github/gitignore and writes the
// parsed patterns to src/data/gitignore-templates.json.
//
// Run once to populate or refresh the bundled templates:
//   node scripts/fetch-gitignore-templates.js
//
// The output file is committed to the repo so the Docker image does not need
// network access at runtime. The Dockerfile also runs this script during the
// image build as a safety net to ensure freshness.

import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GITHUB_API = 'https://api.github.com';
const RAW_BASE = 'https://raw.githubusercontent.com/github/gitignore/main';
const OUT_PATH = join(__dirname, '..', 'src', 'data', 'gitignore-templates.json');

// Converts a raw .gitignore file's content into minimatch-compatible glob patterns.
//
// gitignore anchoring is preserved, because dropping it is what let nested
// vendor directories through: a separator at the beginning or in the middle of
// a pattern anchors it to the repository root, while a pattern with no
// separator — or only a trailing one, which merely marks a directory — matches
// at any depth. Emitting `node_modules/**` for both collapses the distinction
// and leaves `frontend/node_modules/**` in the assessment, so unanchored
// patterns are emitted with an explicit `**/` prefix instead.
export function parseGitignore(content) {
  const patterns = [];
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    // Skip comments, empty lines, and negation entries (those are for re-including,
    // which we handle separately via exclude_pattern_overrides).
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;

    const anchored = line.startsWith('/');
    const isDir = line.endsWith('/');
    // Strip the leading / that anchors the pattern and the trailing / that
    // marks it as a directory — both are recorded above, and neither belongs
    // in the emitted glob.
    const body = (anchored ? line.slice(1) : line).replace(/\/+$/, '');
    if (!body) continue;

    // A separator left in the body is a mid-pattern separator, which anchors
    // the pattern just as a leading one does.
    const prefix = anchored || body.includes('/') ? '' : '**/';

    if (isDir) {
      // Explicit directory marker: convert foo/ → foo/** so minimatch matches
      // all files inside the directory.
      patterns.push(`${prefix}${body}/**`);
    } else if (!/[*?[]/.test(body)) {
      // No glob characters — gitignore uses these to match both files and
      // directories of that name. We emit two patterns: the path itself
      // (matches a file called exactly this) and path/** (matches everything
      // inside a directory of that name).
      patterns.push(`${prefix}${body}`);
      patterns.push(`${prefix}${body}/**`);
    } else {
      patterns.push(`${prefix}${body}`);
    }
  }
  return patterns;
}

async function fetchText(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function listAllTemplates(headers) {
  // Use the git trees API with recursive=1 to list every file in the repo
  // in a single request, then filter for .gitignore files.
  const treeUrl = `${GITHUB_API}/repos/github/gitignore/git/trees/HEAD?recursive=1`;
  const res = await fetch(treeUrl, { headers });
  if (!res.ok) throw new Error(`Failed to fetch repo tree: HTTP ${res.status}`);
  const { tree } = await res.json();

  // Extract template names, preserving the Global/ prefix for IDE templates.
  // e.g. "Python.gitignore" → "Python"
  //      "Global/JetBrains.gitignore" → "Global/JetBrains"
  return tree
    .filter((node) => node.type === 'blob' && node.path.endsWith('.gitignore'))
    .map((node) => node.path.replace(/\.gitignore$/, ''));
}

async function main() {
  // Use a token if available to avoid rate-limiting during CI/Docker builds.
  const token = process.env.GITHUB_TOKEN || process.env.INPUT_GITHUB_TOKEN || '';
  const headers = token
    ? { Authorization: `Bearer ${token}`, 'User-Agent': 'GrillMyCode-template-fetcher' }
    : { 'User-Agent': 'GrillMyCode-template-fetcher' };

  console.log('Discovering gitignore templates from github/gitignore…');
  const names = await listAllTemplates(headers);
  console.log(`Found ${names.length} templates.`);

  const templates = {};
  let fetched = 0;
  let skipped = 0;

  for (const name of names) {
    const url = `${RAW_BASE}/${name}.gitignore`;
    try {
      const content = await fetchText(url, headers);
      const patterns = parseGitignore(content);
      if (patterns.length > 0) {
        templates[name] = patterns;
        fetched++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.warn(`  Warning: skipping ${name} — ${err.message}`);
      skipped++;
    }
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(templates, null, 2) + '\n', 'utf-8');
  console.log(
    `\nWrote ${fetched} templates to src/data/gitignore-templates.json (${skipped} skipped).`,
  );
}

// Only fetch when the script is run directly. The test suite imports this
// module for parseGitignore and must not reach the network to do it.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    throw err;
  });
}
