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
  '.gitattributes',
  '.gitmodules',
  '.mailmap',
  '.git-blame-ignore-revs',

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

  // Python tool caches not covered by the bundled Python gitignore template
  // (which already handles Django, Flask, Scrapy, Celery, etc. artifacts).
  '.gradio/**',
  '.dvc/cache/**',

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
  'C#': ['Dotnet'],
  'Visual Basic .NET': ['VisualStudio'],
  'F#': ['VisualStudio'],
  'Objective-C': ['Objective-C'],
  'Objective-C++': ['Objective-C'],
  Shell: ['Global/Linux'],
  Bash: ['Global/Linux'],
  Zsh: ['Global/Linux'],
};

// Maps known root-level config file/directory names to template keys.
// Supplements language detection with framework and IDE signals.
const CONFIG_TO_TEMPLATES = {
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

// Maps root-level config files to exclude patterns directly, for frameworks
// that have no upstream gitignore template.
const CONFIG_TO_PATTERNS = {
  'svelte.config.js': ['.svelte-kit/**'],
  'svelte.config.ts': ['.svelte-kit/**'],
  'nuxt.config.js': ['.nuxt/**', '.output/**'],
  'nuxt.config.ts': ['.nuxt/**', '.output/**'],
};

// Maps root-level filename suffixes to template keys, for frameworks where the
// project file includes a variable component (e.g. MyApp.xcodeproj).
const ROOT_SUFFIX_TO_TEMPLATES = {
  '.xcodeproj': ['Global/Xcode'],
  '.xcworkspace': ['Global/Xcode'],
  '.uproject': ['UnrealEngine'],
  '.pro': ['Qt'],
  '.ipynb': ['community/Python/JupyterNotebooks'],
};

// Maps package.json dependency/devDependency names to gitignore template keys.
// This catches frameworks reliably regardless of which config filename they use,
// and requires no maintenance as new config filename conventions emerge.
const PACKAGE_DEP_TO_TEMPLATES = {
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
const PACKAGE_DEP_TO_PATTERNS = {
  svelte: ['.svelte-kit/**'],
  nuxt: ['.nuxt/**', '.output/**'],
  '@nuxt/kit': ['.nuxt/**', '.output/**'],
};

// Maps composer.json require/require-dev package names to gitignore template keys.
// Catches PHP frameworks reliably even when their config files aren't at the repo
// root (e.g. Bedrock relocates wp-config.php; Symfony Flex may not commit symfony.lock).
const COMPOSER_DEP_TO_TEMPLATES = {
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
const GEMFILE_DEP_TO_TEMPLATES = {
  rails: ['Rails'],
  jekyll: ['Jekyll'],
  nanoc: ['Nanoc'],
};

function resolveStack(
  detectedLanguages,
  rootNames,
  packageDeps,
  composerDeps,
  gemfileDeps,
  allTemplates,
) {
  const keys = new Set();
  const extraPatterns = new Set();

  for (const lang of detectedLanguages) {
    const mapped = LANGUAGE_TO_TEMPLATES[lang];
    if (mapped) {
      mapped.forEach((k) => keys.add(k));
    } else if (allTemplates[lang]) {
      keys.add(lang);
    }
  }

  for (const [name, templates] of Object.entries(CONFIG_TO_TEMPLATES)) {
    if (rootNames.has(name)) {
      templates.forEach((k) => keys.add(k));
    }
  }

  for (const [name, patterns] of Object.entries(CONFIG_TO_PATTERNS)) {
    if (rootNames.has(name)) {
      patterns.forEach((p) => extraPatterns.add(p));
    }
  }

  for (const [suffix, templates] of Object.entries(ROOT_SUFFIX_TO_TEMPLATES)) {
    if ([...rootNames].some((name) => name.endsWith(suffix))) {
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

  return { keys, extraPatterns };
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

async function fetchComposerDeps(owner, repo, headers) {
  try {
    const data = await fetchJson(
      `https://api.github.com/repos/${owner}/${repo}/contents/composer.json`,
      headers,
    );
    const text = atob(data.content.replace(/\n/g, ''));
    const pkg = JSON.parse(text);
    return Object.keys({ ...pkg.require, ...pkg['require-dev'] });
  } catch {
    return [];
  }
}

async function fetchGemfileDeps(owner, repo, headers) {
  try {
    const data = await fetchJson(
      `https://api.github.com/repos/${owner}/${repo}/contents/Gemfile`,
      headers,
    );
    const text = atob(data.content.replace(/\n/g, ''));
    // Gemfile is a Ruby DSL, not structured data — match `gem 'name'` / `gem "name"`
    // declarations. The leading `\s*` (no `#`) skips commented-out lines.
    const deps = [];
    for (const m of text.matchAll(/^\s*gem\s+['"]([^'"]+)['"]/gm)) {
      deps.push(m[1]);
    }
    return deps;
  } catch {
    return [];
  }
}

async function fetchPackageDeps(owner, repo, headers) {
  try {
    const data = await fetchJson(
      `https://api.github.com/repos/${owner}/${repo}/contents/package.json`,
      headers,
    );
    const text = atob(data.content.replace(/\n/g, ''));
    const pkg = JSON.parse(text);
    return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  } catch {
    return [];
  }
}

export async function detectExcludePatterns(token, owner, repo) {
  let allTemplates;
  try {
    allTemplates = JSON.parse(readFileSync(TEMPLATES_PATH, 'utf-8'));
  } catch {
    core.warning('Could not load bundled gitignore templates — using fallback exclude patterns.');
    return FALLBACK_EXCLUDE_PATTERNS;
  }

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

  let packageDeps = [];
  if (rootNames.has('package.json')) {
    packageDeps = await fetchPackageDeps(owner, repo, headers);
    if (packageDeps.length > 0) {
      core.info(`Scanned package.json — ${packageDeps.length} deps`);
    }
  }

  let composerDeps = [];
  if (rootNames.has('composer.json')) {
    composerDeps = await fetchComposerDeps(owner, repo, headers);
    if (composerDeps.length > 0) {
      core.info(`Scanned composer.json — ${composerDeps.length} deps`);
    }
  }

  let gemfileDeps = [];
  if (rootNames.has('Gemfile')) {
    gemfileDeps = await fetchGemfileDeps(owner, repo, headers);
    if (gemfileDeps.length > 0) {
      core.info(`Scanned Gemfile — ${gemfileDeps.length} gems`);
    }
  }

  const { keys: templateKeys, extraPatterns } = resolveStack(
    detectedLanguages,
    rootNames,
    packageDeps,
    composerDeps,
    gemfileDeps,
    allTemplates,
  );

  if (templateKeys.size === 0 && extraPatterns.size === 0) {
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
  for (const p of extraPatterns) patterns.add(p);

  return [...patterns];
}
