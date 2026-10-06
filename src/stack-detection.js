// Stack detection — identifies the languages, frameworks, and IDEs in use by
// querying the GitHub Languages API and scanning the commit's tree for project
// folders, then maps those signals to gitignore template keys and assembles an
// exclude list.
//
// A project folder is the repository root, or any folder holding one of the
// files or folders the maps below look for (package.json, artisan, pom.xml…).
// A template's root-anchored patterns are applied inside each project folder
// that turned it on, so a Laravel app in myapp/ gets myapp/vendor/** — the
// meaning the upstream template gives /vendor/, relative to the project rather
// than the repository. Patterns that already match at any depth (`**/…`) are
// unaffected.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as core from '@actions/core';
import { Minimatch } from 'minimatch';
import {
  EDITOR_CONFIG_EXCLUDE_PATTERNS,
  FALLBACK_EXCLUDE_PATTERNS,
  GITHUB_API_VERSION,
  MAX_PROJECT_FOLDERS,
  NON_CODE_ASSET_EXCLUDE_PATTERNS,
} from './constants.js';
import { listTreeFiles, readFileAt } from './git.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_PATH = join(__dirname, 'data', 'gitignore-templates.json');

// These patterns are always excluded regardless of detected stack. Each one
// carries an explicit `**/` prefix so it matches at any depth — a bare
// `node_modules/**` is root-anchored under minimatch and would leave
// frontend/node_modules in the assessment. Grouped under labels the Workflow
// Wizard shows (see scripts/build-wizard-exclude-lists.js).
export const ALWAYS_EXCLUDE_GROUPS = [
  {
    label: 'Git files',
    patterns: [
      '**/.git/**',
      '**/.gitignore',
      '**/.gitattributes',
      '**/.gitmodules',
      '**/.mailmap',
      '**/.git-blame-ignore-revs',
    ],
  },
  {
    // Classroom 50 accept-time metadata, not student-authored.
    label: 'Classroom 50 setup file',
    patterns: ['**/.classroom50.yaml'],
  },
  {
    // Always machine-generated, often enormous.
    label: 'Lock files',
    patterns: [
      '**/*.lock',
      '**/package-lock.json',
      '**/yarn.lock',
      '**/pnpm-lock.yaml',
      '**/Pipfile.lock',
      '**/poetry.lock',
    ],
  },
  {
    label: 'Minified files',
    patterns: ['**/*.min.js', '**/*.min.css'],
  },
  {
    // May contain secrets; never relevant to assessment.
    label: 'Environment files',
    patterns: ['**/.env', '**/.env.*'],
  },
  {
    label: 'Generated build metadata',
    patterns: ['**/*.tsbuildinfo'],
  },
  {
    // Not covered by the bundled Python gitignore template, which already
    // handles Django, Flask, Scrapy, Celery, etc. artifacts.
    label: 'Python tool caches',
    patterns: ['**/.gradio/**', '**/.dvc/cache/**'],
  },
  {
    label: 'Operating system files',
    patterns: ['**/.DS_Store', '**/Thumbs.db'],
  },
  {
    label: 'Source maps, logs, Markdown and SVG files',
    patterns: ['**/*.map', '**/*.log', '**/*.md', '**/*.svg'],
  },
];

// Every pattern excluded whatever the stack. These are matched ignoring case
// (see createFileFilter in src/files.js); the detected templates are not.
export const ALWAYS_EXCLUDE = [
  ...ALWAYS_EXCLUDE_GROUPS.flatMap((g) => g.patterns),
  ...EDITOR_CONFIG_EXCLUDE_PATTERNS,
  ...NON_CODE_ASSET_EXCLUDE_PATTERNS,
];

// What a run gets when the stack can't be detected: the fallback list, plus
// the always-excluded patterns, so "always" holds on that path too.
const FALLBACK_WITH_ALWAYS_EXCLUDE = [
  ...new Set([...ALWAYS_EXCLUDE, ...FALLBACK_EXCLUDE_PATTERNS]),
];

// Maps GitHub Languages API names to gitignore template keys when the name
// doesn't directly match a template (e.g. "JavaScript" → "Node").
// Languages whose names match a template key exactly (Python, Ruby, Go, Rust,
// PHP, Swift, R, Elixir, etc.) do not need an entry here.
export const LANGUAGE_TO_TEMPLATES = {
  JavaScript: ['Node'],
  TypeScript: ['Node'],
  CoffeeScript: ['Node'],
  Kotlin: ['Java'],
  Scala: ['Java', 'Scala'],
  Groovy: ['Java'],
  Clojure: ['Java'],
  'C#': ['Dotnet'],
  'Visual Basic .NET': ['VisualStudio'],
  'F#': ['VisualStudio'],
  'Objective-C': ['Objective-C'],
  'Objective-C++': ['Objective-C'],
  Shell: ['Global/Linux'],
  Bash: ['Global/Linux'],
  Zsh: ['Global/Linux'],
};

// Maps known config file/directory names to template keys. Each one found
// marks the folder holding it as a project folder. Supplements language
// detection with framework and IDE signals.
export const CONFIG_TO_TEMPLATES = {
  // Language package managers / build tools
  'package.json': ['Node'],
  'requirements.txt': ['Python'],
  'pyproject.toml': ['Python'],
  Pipfile: ['Python'],
  'Pipfile.lock': ['Python'],
  'setup.py': ['Python'],
  'setup.cfg': ['Python'],
  Gemfile: ['Ruby'],
  Rakefile: ['Rails'],
  'pom.xml': ['Java', 'Maven'],
  'build.gradle': ['Java', 'Gradle'],
  'build.gradle.kts': ['Java', 'Gradle'],
  'settings.gradle': ['Java', 'Gradle'],
  'settings.gradle.kts': ['Java', 'Gradle'],
  // Grails — detected by its signature project directory; adds web-app artifacts
  // (web-app/WEB-INF/classes, *Db.*, stacktrace.log) on top of Java + Gradle.
  'grails-app': ['Grails'],
  'composer.json': ['Composer'],
  'Cargo.toml': ['Rust'],
  'go.mod': ['Go'],
  'go.sum': ['Go'],
  'mix.exs': ['Elixir'],
  'pubspec.yaml': ['Dart', 'Flutter'],
  Podfile: ['Swift', 'Objective-C'],
  'Package.swift': ['Swift'],
  'CMakeLists.txt': ['CMake'],
  Makefile: ['C', 'C++'],
  'configure.ac': ['Autotools'],
  'configure.in': ['Autotools'],
  // JS frameworks with unambiguous config files
  'angular.json': ['Angular'],
  'nest-cli.json': ['Nestjs'],
  'next.config.js': ['Nextjs'],
  'next.config.ts': ['Nextjs'],
  'next.config.mjs': ['Nextjs'],
  // Deno and Bun have their own lockfile/config conventions
  'deno.json': ['Deno'],
  'deno.jsonc': ['Deno'],
  'bun.lockb': ['bun'],
  'bun.lock': ['bun'],
  // PHP frameworks
  artisan: ['Laravel'],
  'wp-config.php': ['WordPress'],
  'symfony.lock': ['Symfony'],
  // Mobile / game engines
  'local.properties': ['Android'],
  'project.godot': ['Godot'],
  ProjectSettings: ['Unity'],
  'src-tauri': ['community/Tauri'],
  // Static sites
  '_config.yml': ['Jekyll'],
  'hugo.toml': ['community/Golang/Hugo'],
  'hugo.yaml': ['community/Golang/Hugo'],
  'hugo.json': ['community/Golang/Hugo'],
  // Infrastructure / cloud
  'cdk.json': ['community/AWS/CDK'],
  'samconfig.toml': ['community/AWS/SAM'],
  'terraform.tfvars': ['Terraform'],
  '.terraform': ['Terraform'],
  // Nix
  'flake.nix': ['Nix'],
  'default.nix': ['Nix'],
  // Firebase
  'firebase.json': ['Firebase'],
  // IDEs
  '.vscode': ['Global/VisualStudioCode'],
  '.idea': ['Global/JetBrains'],
  '.vs': ['VisualStudio'],
};

// Maps config files to exclude patterns directly, for frameworks that have no
// upstream gitignore template. Applied inside the project folder holding them.
export const CONFIG_TO_PATTERNS = {
  'svelte.config.js': ['.svelte-kit/**'],
  'svelte.config.ts': ['.svelte-kit/**'],
  'nuxt.config.js': ['.nuxt/**', '.output/**'],
  'nuxt.config.ts': ['.nuxt/**', '.output/**'],
};

// Maps filename suffixes to template keys, for frameworks where the project
// file includes a variable component (e.g. MyApp.xcodeproj).
export const ROOT_SUFFIX_TO_TEMPLATES = {
  '.xcodeproj': ['Global/Xcode'],
  '.xcworkspace': ['Global/Xcode'],
  '.uproject': ['UnrealEngine'],
  '.pro': ['Qt'],
  '.ipynb': ['community/Python/JupyterNotebooks'],
};

// Maps package.json dependency/devDependency names to gitignore template keys.
// This catches frameworks reliably regardless of which config filename they use,
// and requires no maintenance as new config filename conventions emerge.
export const PACKAGE_DEP_TO_TEMPLATES = {
  next: ['Nextjs'],
  '@angular/core': ['Angular'],
  '@nestjs/core': ['Nestjs'],
  vue: ['community/JavaScript/Vue'],
  expo: ['community/JavaScript/Expo'],
  '@tauri-apps/api': ['community/Tauri'],
  '@strapi/strapi': ['community/Strapi'],
};

// Maps package.json dependency names to exclude patterns for frameworks with
// no upstream gitignore template.
export const PACKAGE_DEP_TO_PATTERNS = {
  svelte: ['.svelte-kit/**'],
  nuxt: ['.nuxt/**', '.output/**'],
  '@nuxt/kit': ['.nuxt/**', '.output/**'],
};

// Maps composer.json require/require-dev package names to gitignore template keys.
// Catches PHP frameworks reliably even when their config files aren't beside
// composer.json (e.g. Bedrock relocates wp-config.php; Symfony Flex may not
// commit symfony.lock).
export const COMPOSER_DEP_TO_TEMPLATES = {
  'laravel/framework': ['Laravel'],
  'laravel/lumen-framework': ['Laravel'],
  'symfony/framework-bundle': ['Symfony'],
  'symfony/symfony': ['Symfony'],
  'roots/wordpress': ['WordPress'],
  'johnpbloch/wordpress': ['WordPress'],
  'johnpbloch/wordpress-core': ['WordPress'],
  'drupal/core': ['Drupal'],
  'drupal/core-recommended': ['Drupal'],
  'codeigniter4/framework': ['CodeIgniter'],
  'yiisoft/yii2': ['Yii'],
  'cakephp/cakephp': ['CakePHP'],
};

// Maps Gemfile gem names to gitignore template keys. The Gemfile lists the
// framework reliably, unlike the Rakefile heuristic in CONFIG_TO_TEMPLATES —
// many Ruby projects ship a Rakefile without being Rails apps, and many Rails
// apps lean on the Gemfile instead.
export const GEMFILE_DEP_TO_TEMPLATES = {
  rails: ['Rails'],
  jekyll: ['Jekyll'],
  nanoc: ['Nanoc'],
};

// Maps mix.exs dependency atoms to gitignore template keys. The base Elixir
// template (from the mix.exs config signal) covers _build/, deps/, etc.; the
// Phoenix template adds web-specific artifacts like priv/static/** and tmp/.
export const MIX_DEP_TO_TEMPLATES = {
  phoenix: ['community/Elixir/Phoenix'],
};

// A folder inside one of these is a dependency or build output, not a project:
// node_modules/ and vendor/ hold a package.json or composer.json per package,
// and treating each as a project would only add noise. These are the directory
// patterns of the fallback list and the always-excluded list.
const NOT_A_PROJECT_FOLDER = FALLBACK_WITH_ALWAYS_EXCLUDE.filter((p) => p.endsWith('/**')).map(
  (p) => new Minimatch(p, { dot: true }),
);

const MARKER_SUFFIXES = Object.keys(ROOT_SUFFIX_TO_TEMPLATES);

/** Whether a file or folder name is one the detection maps look for. */
function isMarker(name) {
  return (
    Object.hasOwn(CONFIG_TO_TEMPLATES, name) ||
    Object.hasOwn(CONFIG_TO_PATTERNS, name) ||
    MARKER_SUFFIXES.some((suffix) => name.endsWith(suffix))
  );
}

/**
 * The project folders in a tree, as a Map from folder ('' for the repository
 * root) to the marker names found directly in it. The root is always present,
 * since language detection applies there. Folders are ordered shallowest
 * first, then by name, and capped at MAX_PROJECT_FOLDERS.
 */
export function findProjectFolders(paths) {
  const folders = new Map([['', new Set()]]);
  const skipped = new Map();
  const isSkipped = (folder) => {
    if (!skipped.has(folder)) {
      // Any child name will do: a directory pattern matches on the folder part.
      skipped.set(
        folder,
        NOT_A_PROJECT_FOLDER.some((m) => m.match(`${folder}/x`)),
      );
    }
    return skipped.get(folder);
  };

  for (const path of paths) {
    const parts = path.split('/');
    for (let i = 0; i < parts.length; i++) {
      if (!isMarker(parts[i])) continue;
      const folder = parts.slice(0, i).join('/');
      if (folder && isSkipped(folder)) continue;
      if (!folders.has(folder)) folders.set(folder, new Set());
      folders.get(folder).add(parts[i]);
    }
  }

  const depth = (folder) => (folder ? folder.split('/').length : 0);
  const ordered = [...folders.keys()].sort(
    (a, b) => depth(a) - depth(b) || (a < b ? -1 : a > b ? 1 : 0),
  );
  if (ordered.length > MAX_PROJECT_FOLDERS) {
    core.warning(
      `Found ${ordered.length} project folders; scanning the ${MAX_PROJECT_FOLDERS} shallowest. ` +
        `Deeper folders get only the patterns that apply at any depth — add any build output ` +
        `they commit with additional_exclude_patterns.`,
    );
  }
  return new Map(ordered.slice(0, MAX_PROJECT_FOLDERS).map((f) => [f, folders.get(f)]));
}

/** Templates reached through the GitHub Languages API, which apply at the root. */
function templatesForLanguages(detectedLanguages, allTemplates) {
  const keys = new Set();
  for (const lang of detectedLanguages) {
    const mapped = LANGUAGE_TO_TEMPLATES[lang];
    if (mapped) {
      mapped.forEach((k) => keys.add(k));
    } else if (allTemplates[lang]) {
      keys.add(lang);
    }
  }
  return keys;
}

/** Templates and extra patterns one project folder's markers and manifests turn on. */
function templatesForFolder(names, { packageDeps, composerDeps, gemfileDeps, mixDeps }) {
  const keys = new Set();
  const extraPatterns = new Set();

  for (const [name, templates] of Object.entries(CONFIG_TO_TEMPLATES)) {
    if (names.has(name)) {
      templates.forEach((k) => keys.add(k));
    }
  }

  for (const [name, patterns] of Object.entries(CONFIG_TO_PATTERNS)) {
    if (names.has(name)) {
      patterns.forEach((p) => extraPatterns.add(p));
    }
  }

  for (const [suffix, templates] of Object.entries(ROOT_SUFFIX_TO_TEMPLATES)) {
    if ([...names].some((name) => name.endsWith(suffix))) {
      templates.forEach((k) => keys.add(k));
    }
  }

  for (const dep of packageDeps) {
    const templates = PACKAGE_DEP_TO_TEMPLATES[dep];
    if (templates) templates.forEach((k) => keys.add(k));

    const patterns = PACKAGE_DEP_TO_PATTERNS[dep];
    if (patterns) patterns.forEach((p) => extraPatterns.add(p));
  }

  for (const dep of composerDeps) {
    const templates = COMPOSER_DEP_TO_TEMPLATES[dep];
    if (templates) templates.forEach((k) => keys.add(k));
  }

  for (const dep of gemfileDeps) {
    const templates = GEMFILE_DEP_TO_TEMPLATES[dep];
    if (templates) templates.forEach((k) => keys.add(k));
  }

  for (const dep of mixDeps) {
    const templates = MIX_DEP_TO_TEMPLATES[dep];
    if (templates) templates.forEach((k) => keys.add(k));
  }

  return { keys, extraPatterns };
}

/**
 * A folder path as a literal glob prefix. Every character minimatch would
 * read as syntax is backslash-escaped — minimatch's own escape() leaves
 * braces and a leading `!` or `#` alone, which would expand, negate or
 * comment out the pattern.
 */
function escapeGlob(text) {
  return text.replace(/[\\*?[\](){}!+@#,]/g, '\\$&');
}

/**
 * A pattern applied inside a project folder. Root-anchored patterns are
 * prefixed with the folder; patterns that already match at any depth, and
 * every pattern of the root folder, are returned unchanged.
 */
export function underFolder(folder, pattern) {
  if (!folder || pattern.startsWith('**/')) return pattern;
  return `${escapeGlob(folder)}/${pattern}`;
}

function parsePackageDeps(text) {
  try {
    const pkg = JSON.parse(text);
    return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  } catch {
    return [];
  }
}

function parseComposerDeps(text) {
  try {
    const pkg = JSON.parse(text);
    return Object.keys({ ...pkg.require, ...pkg['require-dev'] });
  } catch {
    return [];
  }
}

function parseGemfileDeps(text) {
  // Gemfile is a Ruby DSL, not structured data — match `gem 'name'` / `gem "name"`
  // declarations. The leading `\s*` (no `#`) skips commented-out lines.
  const deps = [];
  for (const m of text.matchAll(/^\s*gem\s+['"]([^'"]+)['"]/gm)) {
    deps.push(m[1]);
  }
  return deps;
}

function parseMixDeps(text) {
  // mix.exs is Elixir code — deps are tuples like `{:phoenix, "~> 1.7"}`.
  // Match the leading atom of each tuple; unknown atoms are simply ignored.
  const deps = [];
  for (const m of text.matchAll(/\{\s*:([a-z_][a-zA-Z0-9_]*)\s*,/g)) {
    deps.push(m[1]);
  }
  return deps;
}

const MANIFESTS = [
  ['package.json', 'packageDeps', parsePackageDeps, 'deps'],
  ['composer.json', 'composerDeps', parseComposerDeps, 'deps'],
  ['Gemfile', 'gemfileDeps', parseGemfileDeps, 'gems'],
  ['mix.exs', 'mixDeps', parseMixDeps, 'deps'],
];

/**
 * Reads the dependency manifests in a project folder at headSha. A leading
 * byte-order mark, which some Windows editors write, is dropped: JSON.parse
 * rejects it, and the parsers' catch would otherwise return no deps and hide
 * the framework.
 */
function readFolderDeps(headSha, folder, names) {
  const deps = { packageDeps: [], composerDeps: [], gemfileDeps: [], mixDeps: [] };
  for (const [file, key, parse, noun] of MANIFESTS) {
    if (!names.has(file)) continue;
    const path = folder ? `${folder}/${file}` : file;
    let text = null;
    try {
      text = readFileAt(headSha, path);
    } catch {
      // Unreadable — treated as no deps, like a manifest that fails to parse.
    }
    if (text === null) continue;
    deps[key] = parse(text.replace(/^\uFEFF/, ''));
    if (deps[key].length > 0) core.info(`Scanned ${path} — ${deps[key].length} ${noun}`);
  }
  return deps;
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

export async function detectExcludePatterns(token, owner, repo, headSha) {
  let allTemplates;
  try {
    allTemplates = JSON.parse(readFileSync(TEMPLATES_PATH, 'utf-8'));
  } catch {
    core.warning('Could not load bundled gitignore templates — using fallback exclude patterns.');
    return FALLBACK_WITH_ALWAYS_EXCLUDE;
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
  const folders = findProjectFolders(paths);

  // folder → { keys, extraPatterns }; languages apply at the repository root.
  const detected = new Map();
  for (const [folder, names] of folders) {
    const found = templatesForFolder(names, readFolderDeps(headSha, folder, names));
    if (folder === '') {
      templatesForLanguages(detectedLanguages, allTemplates).forEach((k) => found.keys.add(k));
    }
    if (found.keys.size > 0 || found.extraPatterns.size > 0) detected.set(folder, found);
  }

  if (detected.size === 0) {
    core.info('No matching stack templates found — using fallback exclude patterns.');
    return FALLBACK_WITH_ALWAYS_EXCLUDE;
  }

  for (const [folder, { keys }] of detected) {
    const list = [...keys].join(', ') || '(none)';
    core.info(
      folder === ''
        ? `Using gitignore templates: ${list}`
        : `Using gitignore templates in ${folder}/: ${list}`,
    );
  }

  const patterns = new Set(ALWAYS_EXCLUDE);
  for (const [folder, { keys, extraPatterns }] of detected) {
    for (const key of keys) {
      for (const p of allTemplates[key] ?? []) patterns.add(underFolder(folder, p));
    }
    for (const p of extraPatterns) patterns.add(underFolder(folder, p));
  }

  return [...patterns];
}
