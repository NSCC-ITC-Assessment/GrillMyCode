// Stack detection — identifies the languages, frameworks, and IDEs in use by
// querying the GitHub Languages API and inspecting the repository root, then
// maps those signals to gitignore template keys and assembles an exclude list.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as core from '@actions/core';
import { FALLBACK_EXCLUDE_PATTERNS, GITHUB_API_VERSION } from './constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_PATH = join(__dirname, 'data', 'gitignore-templates.json');

// These patterns are always excluded regardless of detected stack.
const ALWAYS_EXCLUDE = [
  // VCS / GrillMyCode internals
  '.git/**',
  '.gitignore',
  '.assessment/**',

  // Lock files — always machine-generated, often enormous
  '**/*.lock',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Pipfile.lock',
  'poetry.lock',

  // Minified assets — unreadable by design
  '**/*.min.js',
  '**/*.min.css',

  // Environment files — may contain secrets; never relevant to assessment
  '.env',
  '.env.*',
  '**/.env',
  '**/.env.*',

  // Generated build metadata
  '**/*.tsbuildinfo',

  // OS noise
  '.DS_Store',
  'Thumbs.db',

  // Source maps, logs, docs, and vector assets
  '**/*.map',
  '**/*.log',
  '**/*.md',
  '**/*.svg',
];

// Maps GitHub Languages API names to gitignore template keys when the name
// doesn't directly match a template (e.g. "JavaScript" → "Node").
// Languages whose names match a template key exactly (Python, Ruby, Go, Rust,
// PHP, Swift, R, Elixir, etc.) do not need an entry here.
const LANGUAGE_TO_TEMPLATES = {
  JavaScript: ['Node'],
  TypeScript: ['Node'],
  CoffeeScript: ['Node'],
  Kotlin: ['Java'],
  Scala: ['Java', 'Scala'],
  Groovy: ['Java'],
  Clojure: ['Java'],
  'C#': ['CSharp'],
  'Visual Basic .NET': ['VisualStudio'],
  'F#': ['VisualStudio'],
  'Objective-C': ['Objective-C'],
  'Objective-C++': ['Objective-C'],
  Shell: ['Linux'],
  Bash: ['Linux'],
  Zsh: ['Linux'],
};

// Maps known root-level config file/directory names to template keys.
// Supplements language detection with framework and IDE signals.
const CONFIG_TO_TEMPLATES = {
  'package.json': ['Node'],
  'requirements.txt': ['Python'],
  'pyproject.toml': ['Python'],
  Pipfile: ['Python'],
  'Pipfile.lock': ['Python'],
  'setup.py': ['Python'],
  'setup.cfg': ['Python'],
  Gemfile: ['Ruby'],
  'pom.xml': ['Java', 'Maven'],
  'build.gradle': ['Java', 'Gradle'],
  'build.gradle.kts': ['Java', 'Gradle'],
  'settings.gradle': ['Java', 'Gradle'],
  'settings.gradle.kts': ['Java', 'Gradle'],
  'composer.json': ['PHP'],
  'Cargo.toml': ['Rust'],
  'go.mod': ['Go'],
  'go.sum': ['Go'],
  'mix.exs': ['Elixir'],
  'pubspec.yaml': ['Dart', 'Flutter'],
  Podfile: ['Swift', 'Objective-C'],
  'Package.swift': ['Swift'],
  'CMakeLists.txt': ['CMake'],
  Makefile: ['C', 'C++'],
  '.vscode': ['Global/VisualStudioCode'],
  '.idea': ['Global/JetBrains'],
  '.vs': ['VisualStudio'],
};

function loadTemplates() {
  try {
    return JSON.parse(readFileSync(TEMPLATES_PATH, 'utf-8'));
  } catch {
    core.warning('Could not load bundled gitignore templates — using fallback exclude patterns.');
    return null;
  }
}

function resolveTemplateKeys(detectedLanguages, rootNames, allTemplates) {
  const keys = new Set();

  for (const lang of detectedLanguages) {
    const mapped = LANGUAGE_TO_TEMPLATES[lang];
    if (mapped) {
      mapped.forEach((k) => keys.add(k));
    } else if (allTemplates[lang]) {
      // Language name matches a template key directly (e.g. "Python", "Go")
      keys.add(lang);
    }
  }

  for (const [name, templates] of Object.entries(CONFIG_TO_TEMPLATES)) {
    if (rootNames.has(name)) {
      templates.forEach((k) => keys.add(k));
    }
  }

  return keys;
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

export async function detectExcludePatterns(token, owner, repo) {
  const allTemplates = loadTemplates();
  if (!allTemplates) return FALLBACK_EXCLUDE_PATTERNS;

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  };

  let detectedLanguages = [];
  let rootNames = new Set();

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

  try {
    const contentsData = await fetchJson(
      `https://api.github.com/repos/${owner}/${repo}/contents/`,
      headers,
    );
    if (Array.isArray(contentsData)) {
      rootNames = new Set(contentsData.map((e) => e.name));
    }
  } catch (err) {
    core.warning(`Could not fetch root contents for ${owner}/${repo}: ${err.message}`);
  }

  const templateKeys = resolveTemplateKeys(detectedLanguages, rootNames, allTemplates);

  if (templateKeys.size === 0) {
    core.info('No matching stack templates found — using fallback exclude patterns.');
    return FALLBACK_EXCLUDE_PATTERNS;
  }

  core.info(`Using gitignore templates: ${[...templateKeys].join(', ')}`);

  const patterns = new Set(ALWAYS_EXCLUDE);
  for (const key of templateKeys) {
    const tplPatterns = allTemplates[key];
    if (tplPatterns) {
      for (const p of tplPatterns) patterns.add(p);
    }
  }

  return [...patterns];
}
