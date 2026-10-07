// Stack detection — identifies the languages, frameworks, and IDEs in use by
// querying the GitHub Languages API and scanning the commit's tree for project
// folders, then assembles an exclude list from the gitignore templates those
// signals turn on.
//
// This module does the reading and the logging. The rules — which files mark
// a project folder, which templates they reach, and how a template's patterns
// are applied inside its folder — are in src/file-selection.js (see
// detectStack), where the Workflow Wizard can share them.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as core from '@actions/core';
import { GITHUB_API_VERSION, MAX_PROJECT_FOLDERS } from './constants.js';
import { detectStack } from './file-selection.js';
import { listTreeFiles, readFileAt } from './git.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_PATH = join(__dirname, 'data', 'gitignore-templates.json');
const LANGUAGE_FILES_PATH = join(__dirname, 'data', 'language-files.json');

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

/** A file's text at headSha, or null when it is absent or can't be read. */
function readTextAt(headSha, path) {
  try {
    return readFileAt(headSha, path);
  } catch {
    return null;
  }
}

/**
 * The file extensions and file names Linguist gives each language (see
 * fileLanguage), or null when the bundled copy can't be read. Only the note
 * about source files a detected pattern left out depends on it, so a run
 * goes on without.
 */
export function loadLanguageFiles() {
  try {
    return JSON.parse(readFileSync(LANGUAGE_FILES_PATH, 'utf-8'));
  } catch {
    core.debug('Could not load the bundled language file names.');
    return null;
  }
}

/**
 * The exclude list for the repository at headSha, as { patterns, origins }:
 * the patterns, and where each comes from (see detectStack).
 */
export async function detectExcludePatterns(token, owner, repo, headSha) {
  let allTemplates;
  try {
    allTemplates = JSON.parse(readFileSync(TEMPLATES_PATH, 'utf-8'));
  } catch {
    core.warning('Could not load bundled gitignore templates — using fallback exclude patterns.');
    // With nothing to detect from, the rules give the fallback list.
    const { patterns, origins } = detectStack({
      languages: [],
      paths: [],
      readText: () => null,
      allTemplates: {},
    });
    return { patterns, origins };
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  };

  let detectedLanguages = [];
  try {
    const langData = await fetchJson(
      `https://api.github.com/repos/${owner}/${repo}/languages`,
      headers,
    );
    detectedLanguages = Object.keys(langData);
    core.info(`Detected languages: ${detectedLanguages.join(', ') || '(none)'}`);
  } catch (err) {
    core.warning(`Could not fetch languages for ${owner}/${repo}: ${err.message}`);
  }

  let paths = [];
  try {
    paths = listTreeFiles(headSha);
  } catch (err) {
    core.warning(`Could not list the files at ${headSha}: ${err.message}`);
  }

  const { patterns, origins, detected, manifests, foldersFound } = detectStack({
    languages: detectedLanguages,
    paths,
    readText: (path) => readTextAt(headSha, path),
    allTemplates,
  });

  if (foldersFound > MAX_PROJECT_FOLDERS) {
    core.warning(
      `Found ${foldersFound} project folders; scanning the ${MAX_PROJECT_FOLDERS} shallowest. ` +
        `Deeper folders get only the patterns that apply at any depth — add any build output ` +
        `they commit with additional_exclude_patterns.`,
    );
  }
  for (const { path, count, noun } of manifests) {
    core.info(`Scanned ${path} — ${count} ${noun}`);
  }

  if (detected.size === 0) {
    core.info('No matching stack templates found — using fallback exclude patterns.');
    return { patterns, origins };
  }

  for (const [folder, { keys }] of detected) {
    const list = [...keys].join(', ') || '(none)';
    core.info(
      folder === ''
        ? `Using gitignore templates: ${list}`
        : `Using gitignore templates in ${folder}/: ${list}`,
    );
  }

  return { patterns, origins };
}
