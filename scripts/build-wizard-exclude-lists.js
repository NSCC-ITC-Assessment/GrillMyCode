// Writes the exclude patterns the action applies on its own to
// docs-site/docs/_workflow-wizard/excludeLists.json, so the Workflow Wizard's
// Files step can list them in full without importing src/ (the Wizard is
// snapshotted into versioned_docs/, where a path into src/ would not resolve).
//
// Run after changing the lists in src/constants.js or src/file-selection.js,
// or after refreshing src/data/gitignore-templates.json:
//   node scripts/build-wizard-exclude-lists.js
//
// Which templates the GitHub Languages API reaches by name depends on
// Linguist's language names, so the script downloads them. A test checks the
// committed file against src/ with the language names it already lists.
//
// The same download gives languageFiles.json, beside it: the file extensions
// and file names Linguist gives each language. The Wizard's file preview has
// no Languages API result for a folder on the instructor's computer, so it
// works the languages out from these.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import {
  EDITOR_CONFIG_EXCLUDE_GROUPS,
  FALLBACK_EXCLUDE_PATTERNS,
  NON_CODE_ASSET_EXCLUDE_GROUPS,
  WORKFLOWS_EXCLUDE_PATTERN,
} from '../src/constants.js';
import {
  ALWAYS_EXCLUDE_GROUPS,
  COMPOSER_DEP_TO_TEMPLATES,
  CONFIG_TO_PATTERNS,
  CONFIG_TO_TEMPLATES,
  GEMFILE_DEP_TO_TEMPLATES,
  LANGUAGE_TO_TEMPLATES,
  MIX_DEP_TO_TEMPLATES,
  PACKAGE_DEP_TO_PATTERNS,
  PACKAGE_DEP_TO_TEMPLATES,
  ROOT_SUFFIX_TO_TEMPLATES,
} from '../src/file-selection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_PATH = join(__dirname, '..', 'src', 'data', 'gitignore-templates.json');
export const OUT_PATH = join(
  __dirname,
  '..',
  'docs-site',
  'docs',
  '_workflow-wizard',
  'excludeLists.json',
);
export const LANGUAGE_FILES_PATH = join(dirname(OUT_PATH), 'languageFiles.json');
const LINGUIST_URL =
  'https://raw.githubusercontent.com/github-linguist/linguist/main/lib/linguist/languages.yml';

// Templates for an editor or IDE, which the Wizard lists with the editor files
// rather than with the project files that turn them on.
export const IDE_TEMPLATES = [
  'Global/JetBrains',
  'Global/VisualStudioCode',
  'Global/Xcode',
  'VisualStudio',
];

// The language types GitHub counts in a repository's languages. Files in a
// data or prose language (JSON, Markdown) are left out of the Languages API.
const DETECTABLE_TYPES = ['programming', 'markup'];

/**
 * Linguist's languages, from languages.yml: each top-level key with its
 * `type`, its `group` (the language its files are counted under, if not its
 * own) and its `extensions` and `filenames` lists. The file is regular enough
 * to read line by line, which saves a YAML parser.
 */
export function parseLinguistLanguages(yaml) {
  const unquote = (value) => value.trim().replace(/^"(.*)"$/, '$1');
  const languages = [];
  let current = null;
  let list = null;
  for (const line of yaml.split(/\r?\n/)) {
    const top = line.match(/^(?!#)"?([^\s"#][^"\n]*?)"?:\s*$/);
    if (top) {
      current = { name: top[1], type: null, group: null, extensions: [], filenames: [] };
      languages.push(current);
      list = null;
      continue;
    }
    if (!current) continue;
    const item = line.match(/^ {2}- (.*)$/);
    if (item) {
      if (list) current[list].push(unquote(item[1]));
      continue;
    }
    const field = line.match(/^ {2}([a-z_]+):\s*(.*)$/);
    if (!field) continue;
    list = ['extensions', 'filenames'].includes(field[1]) ? field[1] : null;
    if (field[1] === 'type' || field[1] === 'group') current[field[1]] = unquote(field[2]);
  }
  return languages;
}

/** Linguist's language names: the top-level keys of languages.yml. */
export function parseLinguistNames(yaml) {
  return parseLinguistLanguages(yaml).map((l) => l.name);
}

/**
 * The file extensions and file names that tell the Wizard a repository's
 * languages, as { extensions, filenames }. Each maps an extension (lower
 * case, with its dot) or an exact file name to
 *
 *   'Python'          — the language GitHub reports for such a file
 *   ['C', 'C++', …]   — the languages it may report: Linguist shares the
 *                       extension between several and settles each file by
 *                       reading it, which the Wizard cannot
 *
 * An extension several languages list goes to the only one that has it as
 * its primary extension — the first in its list — if there is exactly one:
 * `.cs` is C#, though Smalltalk lists it too.
 *
 * Only the languages the Languages API counts are named (DETECTABLE_TYPES),
 * each by the name it is reported under (its `group`, if it has one). An
 * extension that belongs to a data or prose language is left out, and one
 * shared with such a language stays a list even with a single name in it:
 * `.md` may be GCC Machine Description, and is nearly always Markdown.
 */
export function buildLanguageFiles(languages) {
  const detectable = (l) => DETECTABLE_TYPES.includes(l.type);
  const reported = (list) => [...new Set(list.map((l) => l.group ?? l.name))].sort();
  const settle = ({ candidates, primary }) => {
    const settled = primary.length === 1 ? primary : candidates;
    if (settled.length === 1) return detectable(settled[0]) ? reported(settled)[0] : null;
    const names = reported(settled.filter(detectable));
    if (names.length === 0) return null;
    // Several languages counted under one name are no longer a choice.
    return names.length === 1 && settled.every(detectable) ? names[0] : names;
  };
  const collect = (field, key, hasPrimary) => {
    const byKey = new Map();
    for (const language of languages) {
      language[field].forEach((value, i) => {
        const k = key(value);
        if (!byKey.has(k)) byKey.set(k, { candidates: [], primary: [] });
        const found = byKey.get(k);
        // Two spellings of one extension (.C and .c) are one entry here.
        if (!found.candidates.includes(language)) found.candidates.push(language);
        if (hasPrimary && i === 0) found.primary.push(language);
      });
    }
    return Object.fromEntries(
      [...byKey]
        .map(([k, found]) => [k, settle(found)])
        .filter(([, language]) => language !== null)
        .sort(([a], [b]) => (a < b ? -1 : 1)),
    );
  };

  return {
    extensions: collect('extensions', (ext) => ext.toLowerCase(), true),
    filenames: collect('filenames', (name) => name, false),
  };
}

/**
 * Builds the Wizard's lists from src/. `languageNames` are the GitHub Languages
 * API names to consider; one reaches a template through LANGUAGE_TO_TEMPLATES,
 * or else by having exactly the template's name (see resolveStack).
 */
export function buildExcludeLists(languageNames, allTemplates) {
  // Some lists repeat a pattern; the action applies them as a set, so each is
  // listed once.
  const unique = (patterns) => [...new Set(patterns)];
  const templates = {};
  const use = (key) => {
    if (!allTemplates[key]) return false;
    templates[key] = unique(allTemplates[key]);
    return true;
  };

  // template → languages that reach it
  const byTemplate = new Map();
  const reach = (template, language) => {
    if (!use(template)) return;
    if (!byTemplate.has(template)) byTemplate.set(template, []);
    byTemplate.get(template).push(language);
  };
  for (const [language, keys] of Object.entries(LANGUAGE_TO_TEMPLATES)) {
    keys.forEach((k) => reach(k, language));
  }
  for (const language of languageNames) {
    if (!LANGUAGE_TO_TEMPLATES[language] && allTemplates[language]) reach(language, language);
  }
  const languages = [...byTemplate]
    .map(([template, langs]) => ({ template, languages: [...new Set(langs)].sort() }))
    .sort((a, b) => a.template.localeCompare(b.template));

  // template (or a fixed pattern set) → the project files that turn it on.
  // Each signal is { name, in }: a file or folder in a project folder — the
  // repository root or any folder below it (in: 'folder', with a name ending
  // such as *.ipynb written as a glob) — or a dependency listed in a manifest
  // (in: 'package.json' and so on).
  const bySignal = new Map();
  const signal = (key, sig, patterns) => {
    if (!bySignal.has(key)) bySignal.set(key, { signals: [], patterns });
    bySignal.get(key).signals.push(sig);
  };
  const viaTemplates = (map, where, nameOf = (n) => n) => {
    for (const [name, keys] of Object.entries(map)) {
      for (const key of keys) {
        if (use(key)) signal(`t:${key}`, { name: nameOf(name), in: where }, null);
      }
    }
  };
  const viaPatterns = (map, where) => {
    for (const [name, patterns] of Object.entries(map)) {
      signal(`p:${patterns.join(',')}`, { name, in: where }, patterns);
    }
  };
  viaTemplates(CONFIG_TO_TEMPLATES, 'folder');
  viaTemplates(ROOT_SUFFIX_TO_TEMPLATES, 'folder', (suffix) => `*${suffix}`);
  viaTemplates(PACKAGE_DEP_TO_TEMPLATES, 'package.json');
  viaTemplates(COMPOSER_DEP_TO_TEMPLATES, 'composer.json');
  viaTemplates(GEMFILE_DEP_TO_TEMPLATES, 'Gemfile');
  viaTemplates(MIX_DEP_TO_TEMPLATES, 'mix.exs');
  viaPatterns(CONFIG_TO_PATTERNS, 'folder');
  viaPatterns(PACKAGE_DEP_TO_PATTERNS, 'package.json');

  const projectFiles = [];
  const ideTemplates = [];
  for (const [key, { signals, patterns }] of bySignal) {
    const entry = key.startsWith('t:')
      ? { template: key.slice(2), signals }
      : { template: null, signals, patterns };
    (IDE_TEMPLATES.includes(entry.template) ? ideTemplates : projectFiles).push(entry);
  }
  const byName = (a, b) =>
    (a.template ?? a.signals[0].name).localeCompare(b.template ?? b.signals[0].name);
  projectFiles.sort(byName);
  ideTemplates.sort(byName);

  return {
    always: [
      ...ALWAYS_EXCLUDE_GROUPS,
      { label: 'GitHub Actions workflows', patterns: [WORKFLOWS_EXCLUDE_PATTERN] },
    ],
    editors: EDITOR_CONFIG_EXCLUDE_GROUPS,
    ideTemplates,
    nonCode: NON_CODE_ASSET_EXCLUDE_GROUPS,
    languages,
    projectFiles,
    fallback: unique(FALLBACK_EXCLUDE_PATTERNS),
    templates: Object.fromEntries(
      Object.keys(templates)
        .sort()
        .map((k) => [k, templates[k]]),
    ),
  };
}

async function main() {
  const res = await fetch(LINGUIST_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${LINGUIST_URL}`);
  const languages = parseLinguistLanguages(await res.text());
  const allTemplates = JSON.parse(readFileSync(TEMPLATES_PATH, 'utf-8'));
  const lists = buildExcludeLists(
    languages.map((l) => l.name),
    allTemplates,
  );
  writeFileSync(OUT_PATH, JSON.stringify(lists, null, 2) + '\n', 'utf-8');
  console.log(
    `Wrote ${lists.languages.length} language and ${lists.projectFiles.length} project-file ` +
      `entries (${Object.keys(lists.templates).length} templates) to ${OUT_PATH}.`,
  );

  const languageFiles = buildLanguageFiles(languages);
  writeFileSync(LANGUAGE_FILES_PATH, JSON.stringify(languageFiles, null, 2) + '\n', 'utf-8');
  console.log(
    `Wrote ${Object.keys(languageFiles.extensions).length} extensions and ` +
      `${Object.keys(languageFiles.filenames).length} file names to ${LANGUAGE_FILES_PATH}.`,
  );
}

// Only fetch when the script is run directly; the test suite imports it.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
