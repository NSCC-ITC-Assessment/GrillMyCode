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
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GITHUB_API = 'https://api.github.com';
const RAW_BASE = 'https://raw.githubusercontent.com/github/gitignore/main';
const OUT_PATH = join(__dirname, '..', 'src', 'data', 'gitignore-templates.json');

// Converts a raw .gitignore file's content into minimatch-compatible glob patterns.
function parseGitignore(content) {
  const patterns = [];
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    // Skip comments, empty lines, and negation entries (those are for re-including,
    // which we handle separately via exclude_pattern_overrides).
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;

    // Strip a leading / that anchors the pattern to the repo root — our paths
    // are already repo-relative so anchoring is unnecessary.
    const pattern = line.startsWith('/') ? line.slice(1) : line;

    if (pattern.endsWith('/')) {
      // Explicit directory marker: convert foo/ → foo/** so minimatch matches
      // all files inside the directory.
      patterns.push(pattern.slice(0, -1) + '/**');
    } else if (!pattern.includes('/') && !/[*?[]/.test(pattern)) {
      // Bare name with no path separator and no glob characters — gitignore
      // uses these to match both files and directories of that name. We emit
      // two patterns: the bare name (matches a file called exactly this) and
      // name/** (matches everything inside a directory of that name).
      patterns.push(pattern);
      patterns.push(pattern + '/**');
    } else {
      patterns.push(pattern);
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

main().catch((err) => {
  console.error(err.message);
  throw err;
});
