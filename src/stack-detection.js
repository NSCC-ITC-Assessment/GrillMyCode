// Stack detection — identifies the languages, frameworks, and IDEs in use by
// querying the GitHub Languages API and scanning the commit's tree for project
// folders, then assembles an exclude list from the gitignore templates those
// signals turn on. With stack_templates set, the instructor has named the
// templates, and nothing is queried or scanned.
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
import { detectStack, pinnedStack, stackTemplateEntries } from './file-selection.js';
import { listTreeFiles, readFileAt } from './git.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_PATH = join(__dirname, 'data', 'gitignore-templates.json');
const LANGUAGE_FILES_PATH = join(__dirname, 'data', 'language-files.json');

/** @returns {Promise<any>} */
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

/** Logs the templates of a stack, one line per project folder. */
function logTemplates(detected) {
  for (const [folder, { keys }] of detected) {
    const list = [...keys].join(', ') || '(none)';
    core.info(
      folder === ''
        ? `Using gitignore templates: ${list}`
        : `Using gitignore templates in ${folder}/: ${list}`,
    );
  }
}

/**
 * The exclude list stack_templates sets (see pinnedStack), in the form
 * detectExcludePatterns returns. The repository is not looked at.
 */
function pinnedExcludePatterns(stackTemplates, allTemplates) {
  const { patterns, origins, detected, unknown } = pinnedStack({
    entries: stackTemplates,
    allTemplates,
  });
  core.info(
    'Stack set by stack_templates — the languages and project files of this repository were ' +
      'not checked.',
  );
  for (const { written, name, language } of unknown) {
    core.warning(
      `stack_templates: "${written}" was ignored, because "${name}" is not a template the ` +
        'action knows.' +
        (language ? ` It is a language; its template is ${language.join(' and ')}.` : ''),
    );
  }
  if (detected.size === 0) {
    core.warning(
      'No entry in stack_templates names a known template — using fallback exclude patterns.',
    );
  } else {
    logTemplates(detected);
  }
  return {
    patterns,
    origins,
    stack: { pinned: true, entries: stackTemplateEntries(detected).entries },
  };
}

/**
 * The exclude list for the repository at headSha, as { patterns, origins,
 * stack }: the patterns, where each comes from (see detectStack), and the
 * stack behind them, as { pinned, entries } — whether `stackTemplates`, the
 * stack_templates input, set it, and the stack_templates entries that name it
 * (see stackTemplateEntries; none when the fallback list was used).
 */
export async function detectExcludePatterns(token, owner, repo, headSha, stackTemplates = []) {
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
    return { patterns, origins, stack: { pinned: stackTemplates.length > 0, entries: [] } };
  }

  if (stackTemplates.length > 0) return pinnedExcludePatterns(stackTemplates, allTemplates);

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
    return { patterns, origins, stack: { pinned: false, entries: [] } };
  }

  logTemplates(detected);

  return {
    patterns,
    origins,
    stack: { pinned: false, entries: stackTemplateEntries(detected).entries },
  };
}
