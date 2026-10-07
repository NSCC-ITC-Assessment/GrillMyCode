// GENERATED FILE — do not edit. This is src/file-selection.js with the constants
// it imports from src/constants.js written in. To change it, edit those files
// and run: node scripts/build-wizard-file-selection.js

/**
 * File Selection Rules
 *
 * The rules that decide which files are assessed: how a pattern list is split
 * and read, how a file is matched against the exclude list and the overrides,
 * and which exclude patterns a repository's languages and project files turn
 * on.
 *
 * Everything here works on its arguments alone — no git, no file system, no
 * network and no @actions/core. The action does the reading and the logging
 * around it (src/stack-detection.js, src/main.js). The Workflow Wizard runs a
 * generated copy of this file, so it applies the same rules to a folder the
 * instructor picks: after changing this file, or a constant it imports, run
 *   node scripts/build-wizard-file-selection.js
 * That script inlines the constants, so the only imports this file may have
 * are minimatch and ./constants.js.
 */

import { braceExpand, Minimatch } from 'minimatch';
const EDITOR_CONFIG_EXCLUDE_GROUPS = [
  {
    "label": "VS Code and its forks",
    "patterns": [
      "**/.vscode/**",
      "**/.vscode-test/**",
      "**/*.code-workspace",
      "**/.history/**"
    ]
  },
  {
    "label": "Visual Studio",
    "patterns": [
      "**/.vs/**"
    ]
  },
  {
    "label": "JetBrains IDEs and Fleet",
    "patterns": [
      "**/.idea/**",
      "**/*.iml",
      "**/*.ipr",
      "**/*.iws",
      "**/.fleet/**"
    ]
  },
  {
    "label": "Eclipse",
    "patterns": [
      "**/.project",
      "**/.classpath",
      "**/.factorypath",
      "**/.settings/**"
    ]
  },
  {
    "label": "NetBeans",
    "patterns": [
      "**/nbproject/**"
    ]
  },
  {
    "label": "Xcode project bundles",
    "patterns": [
      "**/*.xcodeproj/**",
      "**/*.xcworkspace/**",
      "**/xcuserdata/**"
    ]
  },
  {
    "label": "Sublime Text, Zed, Nova, Theia",
    "patterns": [
      "**/*.sublime-project",
      "**/*.sublime-workspace",
      "**/.zed/**",
      "**/.nova/**",
      "**/.theia/**"
    ]
  },
  {
    "label": "Vim and Emacs swap, backup and session files",
    "patterns": [
      "**/*.swp",
      "**/*.swo",
      "**/*~",
      "**/.#*",
      "**/#*#",
      "**/.netrwhist",
      "**/Session.vim"
    ]
  },
  {
    "label": "AI coding assistants",
    "patterns": [
      "**/.cursor/**",
      "**/.cursorrules",
      "**/.cursorignore",
      "**/.windsurf/**",
      "**/.windsurfrules",
      "**/.claude/**",
      "**/.continue/**"
    ]
  },
  {
    "label": "EditorConfig and dev containers",
    "patterns": [
      "**/.editorconfig",
      "**/.devcontainer/**"
    ]
  }
];
const EDITOR_CONFIG_EXCLUDE_PATTERNS = [
  "**/.vscode/**",
  "**/.vscode-test/**",
  "**/*.code-workspace",
  "**/.history/**",
  "**/.vs/**",
  "**/.idea/**",
  "**/*.iml",
  "**/*.ipr",
  "**/*.iws",
  "**/.fleet/**",
  "**/.project",
  "**/.classpath",
  "**/.factorypath",
  "**/.settings/**",
  "**/nbproject/**",
  "**/*.xcodeproj/**",
  "**/*.xcworkspace/**",
  "**/xcuserdata/**",
  "**/*.sublime-project",
  "**/*.sublime-workspace",
  "**/.zed/**",
  "**/.nova/**",
  "**/.theia/**",
  "**/*.swp",
  "**/*.swo",
  "**/*~",
  "**/.#*",
  "**/#*#",
  "**/.netrwhist",
  "**/Session.vim",
  "**/.cursor/**",
  "**/.cursorrules",
  "**/.cursorignore",
  "**/.windsurf/**",
  "**/.windsurfrules",
  "**/.claude/**",
  "**/.continue/**",
  "**/.editorconfig",
  "**/.devcontainer/**"
];
const FALLBACK_EXCLUDE_PATTERNS = [
  "**/node_modules/**",
  "**/*.lock",
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
  "**/*.min.js",
  "**/*.min.css",
  "**/dist/**",
  "**/build/**",
  "**/out/**",
  "**/coverage/**",
  "**/.nyc_output/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.output/**",
  "**/.svelte-kit/**",
  "**/.astro/**",
  "**/.expo/**",
  "**/.parcel-cache/**",
  "**/.turbo/**",
  "**/__pycache__/**",
  "**/*.pyc",
  "**/.venv/**",
  "**/venv/**",
  "**/.pytest_cache/**",
  "**/*.egg-info/**",
  "**/.tox/**",
  "**/target/**",
  "**/.gradle/**",
  "**/.bundle/**",
  "**/vendor/**",
  "**/obj/**",
  "**/CMakeFiles/**",
  "**/cmake-build-*/**",
  "**/CMakeCache.txt",
  "**/CMakeCache.txt.dir/**",
  "**/.git/**",
  "**/.gitignore",
  "**/.classroom50.yaml",
  "**/.env",
  "**/.env.*",
  "**/*.tsbuildinfo",
  "**/.DS_Store",
  "**/Thumbs.db",
  "**/*.svg",
  "**/*.map",
  "**/*.log",
  "**/*.md",
  "**/.vscode/**",
  "**/.vscode-test/**",
  "**/*.code-workspace",
  "**/.history/**",
  "**/.vs/**",
  "**/.idea/**",
  "**/*.iml",
  "**/*.ipr",
  "**/*.iws",
  "**/.fleet/**",
  "**/.project",
  "**/.classpath",
  "**/.factorypath",
  "**/.settings/**",
  "**/nbproject/**",
  "**/*.xcodeproj/**",
  "**/*.xcworkspace/**",
  "**/xcuserdata/**",
  "**/*.sublime-project",
  "**/*.sublime-workspace",
  "**/.zed/**",
  "**/.nova/**",
  "**/.theia/**",
  "**/*.swp",
  "**/*.swo",
  "**/*~",
  "**/.#*",
  "**/#*#",
  "**/.netrwhist",
  "**/Session.vim",
  "**/.cursor/**",
  "**/.cursorrules",
  "**/.cursorignore",
  "**/.windsurf/**",
  "**/.windsurfrules",
  "**/.claude/**",
  "**/.continue/**",
  "**/.editorconfig",
  "**/.devcontainer/**",
  "**/*.drawio",
  "**/*.dio",
  "**/*.excalidraw",
  "**/*.bpmn",
  "**/*.puml",
  "**/*.plantuml",
  "**/*.mmd",
  "**/*.csv",
  "**/*.tsv"
];
const MAX_PROJECT_FOLDERS = 100;
const NON_CODE_ASSET_EXCLUDE_GROUPS = [
  {
    "label": "Diagrams (draw.io, Excalidraw, BPMN, PlantUML, Mermaid)",
    "patterns": [
      "**/*.drawio",
      "**/*.dio",
      "**/*.excalidraw",
      "**/*.bpmn",
      "**/*.puml",
      "**/*.plantuml",
      "**/*.mmd"
    ]
  },
  {
    "label": "Tabular data",
    "patterns": [
      "**/*.csv",
      "**/*.tsv"
    ]
  }
];
const NON_CODE_ASSET_EXCLUDE_PATTERNS = [
  "**/*.drawio",
  "**/*.dio",
  "**/*.excalidraw",
  "**/*.bpmn",
  "**/*.puml",
  "**/*.plantuml",
  "**/*.mmd",
  "**/*.csv",
  "**/*.tsv"
];
const PROTECTED_EXCLUDE_PATTERNS = [
  "**/.env",
  "**/.env.*",
  "**/*.lock",
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
  "**/Pipfile.lock",
  "**/poetry.lock",
  "**/node_modules/**",
  "**/bower_components/**",
  "**/vendor/**",
  "**/.venv/**",
  "**/venv/**"
];
const STACK_TEMPLATE_FOLDER_SEPARATOR = "@";
const WORKFLOWS_EXCLUDE_PATTERN = ".github/workflows/**";

/**
 * Options for every exclude and override match. matchBase is deliberately
 * off: under it a pattern with no slash matches on the file name at any
 * depth, which turned a template's root-anchored `index.php` (WordPress) or
 * `Makefile` (Perl) into every index.php or Makefile in the repository.
 * Instructor patterns keep that any-depth meaning through instructorPatterns.
 */
export const PATTERN_MATCH_OPTIONS = { dot: true };

/**
 * The same, ignoring case. The instructor's patterns and the always-excluded
 * list are matched this way, so `data/**` covers a student's `Data/` and
 * `**\/*.md` covers `README.MD`. The detected templates are not: several name
 * folders by words a student also uses for source (`build`, `lib`, `debug`),
 * and ignoring case there would exclude more of it.
 */
const CASE_INSENSITIVE_MATCH_OPTIONS = { ...PATTERN_MATCH_OPTIONS, nocase: true };

/** Splits one line of a pattern list on its commas, leaving those inside a closed pair of braces. */
function splitPatternLine(line) {
  const open = [];
  const pairs = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\') i++;
    else if (line[i] === '{') open.push(i);
    else if (line[i] === '}' && open.length > 0) pairs.push([open.pop(), i]);
  }
  const inBraces = (i) => pairs.some(([start, end]) => start < i && i < end);

  const parts = [];
  let start = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\') i++;
    else if (line[i] === ',' && !inBraces(i)) {
      parts.push(line.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(line.slice(start));
  return parts;
}

/**
 * Splits a pattern list input into its patterns. Commas and line breaks
 * separate patterns, except a comma inside a closed pair of braces, which is
 * part of the pattern (`*.{js,ts}`); an unclosed brace protects nothing.
 * Spaces around a comma inside braces are dropped, so `*.{js, ts}` means what
 * it looks like. A backslash keeps the character after it out of all this.
 */
export function splitPatternList(text) {
  return text
    .split(/[\r\n]+/)
    .flatMap(splitPatternLine)
    .map((p) => p.trim().replace(/\s*,\s*/g, ','))
    .filter(Boolean);
}

/**
 * The .gitignore habit a pattern shows that means something else here, if
 * any: 'negated' for a leading `!`, which inverts the pattern instead of
 * re-including a file, and 'comment' for a leading `#`, which is read as a
 * file name. The pattern is applied as written either way; callers warn.
 */
export function patternProblem(pattern) {
  if (pattern.startsWith('!')) return 'negated';
  if (pattern.startsWith('#')) return 'comment';
  return null;
}

/**
 * Whether a file's content is binary: it contains a null byte, the test git
 * itself uses. A binary file, such as an image, has no text to assess, and no
 * pattern brings it back.
 */
export function isBinary(content) {
  return content.includes('\0');
}

/** Whether a pattern is a plain name or path: nothing in it is glob syntax. */
function isPlainPath(pattern) {
  return !new Minimatch(pattern, { ...PATTERN_MATCH_OPTIONS, magicalBraces: true }).hasMagic();
}

/**
 * An exclude or override pattern the instructor wrote, in the forms it is
 * matched — usually one, sometimes two, none for a pattern that names nothing.
 *
 * One with no slash matches by file name at any depth, so it is written as
 * `**\/pattern` (`starter.py` → `**\/starter.py`); one with a slash is anchored
 * at the repository root and kept as it is. Brace alternatives are judged one
 * by one, so `{*.sql,data/**}` still matches `.sql` files anywhere. A leading
 * `!` stays in front.
 *
 * The ways a path is commonly written all work. A leading `./` or `/` anchors
 * the pattern at the root and is dropped (`/data/**` → `data/**`), as in a
 * .gitignore. A trailing `/` names a folder and matches everything in it
 * (`data/` → `**\/data/**`). A plain name or path, with no wildcards, may be
 * either a file or a folder, so it gets both forms (`data` → `**\/data` and
 * `**\/data/**`).
 */
export function instructorPatterns(pattern) {
  const negation = pattern.match(/^!*/)[0];
  const written = pattern.slice(negation.length);
  const rooted = /^\.?\//.test(written);
  const folder = written.endsWith('/');
  const body = written.replace(/^(\.\/)*\/*/, '').replace(/\/+$/, '');
  if (!body) return [];

  const alternatives = braceExpand(body);
  let anchored;
  if (rooted || alternatives.every((a) => a.includes('/'))) {
    anchored = body;
  } else if (alternatives.every((a) => !a.includes('/'))) {
    anchored = `**/${body}`;
  } else {
    anchored = `{${alternatives.map((a) => (a.includes('/') ? a : `**/${a}`)).join(',')}}`;
  }

  const matched = `${negation}${anchored}`;
  if (folder) return [`${matched}/**`];
  return !negation && isPlainPath(body) ? [matched, `${matched}/**`] : [matched];
}

/**
 * Builds the test that decides whether a file is assessed. Returns a function
 * from a path to its verdict:
 *
 *   { assessed: true }                      — no exclude pattern matched it
 *   { assessed: true, pattern }             — an override brought it back;
 *                                             `pattern` is the first exclude
 *                                             pattern that matched
 *   { assessed: false, pattern }            — excluded by `pattern`
 *   { assessed: false, pattern, guard }     — as above, though an override
 *                                             matched it: `guard` is the
 *                                             protected pattern the override
 *                                             does not name
 *
 * Exclude patterns are matched as written — the caller passes the instructor's
 * through instructorPatterns — and those also listed in
 * `caseInsensitivePatterns` are matched ignoring case. Overrides are always
 * the instructor's, so they are converted here and always ignore case.
 *
 * An override wins over every exclude pattern, with one exception: a file
 * matching PROTECTED_EXCLUDE_PATTERNS comes back only when each protected
 * pattern matching it also matches the override itself, read as a path. So
 * `frontend/.env`, `.env` and `**\/.env` re-include frontend/.env and
 * `frontend/**` does not. A brace override is judged one alternative at a
 * time, as it is matched; a negated one never names anything.
 */
export function createFileFilter({
  excludePatterns,
  overridePatterns = [],
  caseInsensitivePatterns = [],
}) {
  const ignoreCase = new Set(caseInsensitivePatterns);
  const isProtected = new Set(PROTECTED_EXCLUDE_PATTERNS);
  // Protected patterns are tried first, so a file in node_modules is reported
  // under the pattern an override has to name rather than, say, `**/*.md`.
  // Each keeps the pattern as written: Minimatch drops a leading `!` from its
  // own copy, and a file is reported under the pattern the instructor wrote.
  const excludes = [
    ...excludePatterns.filter((p) => isProtected.has(p)),
    ...excludePatterns.filter((p) => !isProtected.has(p)),
  ].map((p) => ({
    pattern: p,
    matcher: new Minimatch(
      p,
      ignoreCase.has(p) ? CASE_INSENSITIVE_MATCH_OPTIONS : PATTERN_MATCH_OPTIONS,
    ),
  }));
  const guards = PROTECTED_EXCLUDE_PATTERNS.map(
    (p) => new Minimatch(p, CASE_INSENSITIVE_MATCH_OPTIONS),
  );
  const overrides = overridePatterns
    .flatMap(instructorPatterns)
    .flatMap((p) => (p.startsWith('!') ? [p] : braceExpand(p)))
    .map((p) => ({
      matcher: new Minimatch(p, CASE_INSENSITIVE_MATCH_OPTIONS),
      names: new Set(guards.filter((g) => g.match(p))),
    }));

  return (filepath) => {
    const excludedBy = excludes.find((e) => e.matcher.match(filepath));
    if (!excludedBy) return { assessed: true };
    const excluded = { assessed: false, pattern: excludedBy.pattern };

    const matching = overrides.filter((o) => o.matcher.match(filepath));
    if (matching.length === 0) return excluded;
    const guarding = guards.filter((g) => g.match(filepath));
    if (matching.some((o) => guarding.every((g) => o.names.has(g)))) {
      return { assessed: true, pattern: excludedBy.pattern };
    }
    // Every matching override leaves at least one guard unnamed; report one.
    const unnamed = guarding.find((g) => !matching[0].names.has(g));
    return { ...excluded, guard: unnamed.pattern };
  };
}

/**
 * Filters a list of file paths against exclude glob patterns, keeping the
 * files that are assessed (see createFileFilter).
 *
 * Overrides accept either an exact pattern from the exclude list (e.g. **\/*.md)
 * or a specific file path that would otherwise be excluded (e.g. README.md).
 */
export function filterFiles(
  files,
  excludePatterns,
  overridePatterns = [],
  caseInsensitivePatterns = [],
) {
  const verdict = createFileFilter({ excludePatterns, overridePatterns, caseInsensitivePatterns });
  return files.filter((f) => verdict(f).assessed);
}

// The files an override must name (see createFileFilter), for callers that
// report on them.
export { PROTECTED_EXCLUDE_PATTERNS };

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
// (see createFileFilter); the detected templates are not.
export const ALWAYS_EXCLUDE = [
  ...ALWAYS_EXCLUDE_GROUPS.flatMap((g) => g.patterns),
  ...EDITOR_CONFIG_EXCLUDE_PATTERNS,
  ...NON_CODE_ASSET_EXCLUDE_PATTERNS,
];

// The workflows folder, which every run leaves out as well (see
// buildFileRules), under the label it is listed by.
export const WORKFLOWS_EXCLUDE_GROUP = {
  label: 'GitHub Actions workflows',
  patterns: [WORKFLOWS_EXCLUDE_PATTERN],
};

// The always-excluded patterns in their labelled groups, in ALWAYS_EXCLUDE's
// order, for saying which list left a file out (see detectStack).
const ALWAYS_EXCLUDE_LABELLED = [
  ...ALWAYS_EXCLUDE_GROUPS,
  ...EDITOR_CONFIG_EXCLUDE_GROUPS,
  ...NON_CODE_ASSET_EXCLUDE_GROUPS,
];

// What a run gets when the stack can't be detected: the fallback list, plus
// the always-excluded patterns, so "always" holds on that path too.
export const FALLBACK_WITH_ALWAYS_EXCLUDE = [
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

// The pattern sets of frameworks that have no upstream gitignore template,
// under the name stack_templates knows each by (see pinnedStack).
export const OWN_TEMPLATES = {
  SvelteKit: ['.svelte-kit/**'],
  Nuxt: ['.nuxt/**', '.output/**'],
};

// Maps config files to exclude patterns directly, for frameworks that have no
// upstream gitignore template. Applied inside the project folder holding them.
export const CONFIG_TO_PATTERNS = {
  'svelte.config.js': OWN_TEMPLATES.SvelteKit,
  'svelte.config.ts': OWN_TEMPLATES.SvelteKit,
  'nuxt.config.js': OWN_TEMPLATES.Nuxt,
  'nuxt.config.ts': OWN_TEMPLATES.Nuxt,
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
  svelte: OWN_TEMPLATES.SvelteKit,
  nuxt: OWN_TEMPLATES.Nuxt,
  '@nuxt/kit': OWN_TEMPLATES.Nuxt,
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
 * The project folders in a tree. `folders` is a Map from folder ('' for the
 * repository root) to the marker names found directly in it. The root is
 * always present, since language detection applies there. Folders are ordered
 * shallowest first, then by name, and capped at MAX_PROJECT_FOLDERS; `found`
 * is how many the tree holds, which is more than `folders.size` when the cap
 * cut some off.
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
  return {
    folders: new Map(ordered.slice(0, MAX_PROJECT_FOLDERS).map((f) => [f, folders.get(f)])),
    found: ordered.length,
  };
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
 * Reads the dependency manifests in a project folder through `readText`, which
 * returns a file's text, or null when it can't be read. Returns the `deps` of
 * each kind, and `scanned`, the manifests that listed any: [{ path, count,
 * noun }]. A leading byte-order mark, which some Windows editors write, is
 * dropped: JSON.parse rejects it, and the parsers' catch would otherwise
 * return no deps and hide the framework.
 */
function readFolderDeps(folder, names, readText) {
  const deps = { packageDeps: [], composerDeps: [], gemfileDeps: [], mixDeps: [] };
  const scanned = [];
  for (const [file, key, parse, noun] of MANIFESTS) {
    if (!names.has(file)) continue;
    const path = folder ? `${folder}/${file}` : file;
    const text = readText(path);
    // Unreadable — treated as no deps, like a manifest that fails to parse.
    if (text === null) continue;
    deps[key] = parse(text.replace(/^\uFEFF/, ''));
    if (deps[key].length > 0) scanned.push({ path, count: deps[key].length, noun });
  }
  return { deps, scanned };
}

/**
 * Works out a repository's stack and the exclude patterns it turns on.
 *
 *   languages     — the GitHub Languages API's names for the repository; the
 *                   templates they reach apply at the root
 *   paths         — every file path in the tree
 *   readText      — (path) => the file's text, or null when it can't be read;
 *                   asked for the dependency manifests in each project folder
 *   allTemplates  — template key → patterns (src/data/gitignore-templates.json)
 *
 * Returns
 *
 *   patterns      — the exclude list: the always-excluded patterns, plus each
 *                   detected template's patterns applied in its project
 *                   folder, or plus the fallback list when nothing was detected
 *   detected      — Map from project folder to the { keys, extraPatterns } it
 *                   turned on; empty when the fallback list was used
 *   origins       — Map from each of those patterns to where it comes from:
 *                     { kind: 'always', label }              an always-excluded list
 *                     { kind: 'template', template, folder } a detected template,
 *                                                            applied in a project
 *                                                            folder ('' is the root)
 *                     { kind: 'project', folder }            a pattern a project
 *                                                            file adds without a
 *                                                            template
 *                     { kind: 'fallback' }                   the fallback list
 *                   A pattern two sources share is credited to the first, in
 *                   that order
 *   manifests     — the dependency manifests that listed anything:
 *                   [{ path, count, noun }]
 *   foldersFound  — project folders in the tree; above MAX_PROJECT_FOLDERS,
 *                   only that many of the shallowest were scanned
 */
export function detectStack({ languages, paths, readText, allTemplates }) {
  const { folders, found: foldersFound } = findProjectFolders(paths);

  // folder → { keys, extraPatterns }; languages apply at the repository root.
  const detected = new Map();
  const manifests = [];
  for (const [folder, names] of folders) {
    const { deps, scanned } = readFolderDeps(folder, names, readText);
    manifests.push(...scanned);
    const found = templatesForFolder(names, deps);
    if (folder === '') {
      templatesForLanguages(languages, allTemplates).forEach((k) => found.keys.add(k));
    }
    if (found.keys.size > 0 || found.extraPatterns.size > 0) detected.set(folder, found);
  }

  return { ...stackPatterns(detected, allTemplates), detected, manifests, foldersFound };
}

/**
 * The exclude list a stack turns on, as { patterns, origins } (see
 * detectStack): the always-excluded patterns, plus each template's patterns
 * applied in its project folder, or plus the fallback list for an empty stack.
 */
function stackPatterns(detected, allTemplates) {
  const origins = new Map();
  const credit = (pattern, origin) => {
    if (!origins.has(pattern)) origins.set(pattern, origin);
  };
  for (const { label, patterns } of ALWAYS_EXCLUDE_LABELLED) {
    patterns.forEach((p) => credit(p, { kind: 'always', label }));
  }

  if (detected.size === 0) {
    FALLBACK_WITH_ALWAYS_EXCLUDE.forEach((p) => credit(p, { kind: 'fallback' }));
    return { patterns: FALLBACK_WITH_ALWAYS_EXCLUDE, origins };
  }

  for (const [folder, { keys, extraPatterns }] of detected) {
    for (const template of keys) {
      for (const p of allTemplates[template] ?? []) {
        credit(underFolder(folder, p), { kind: 'template', template, folder });
      }
    }
    for (const p of extraPatterns) credit(underFolder(folder, p), { kind: 'project', folder });
  }

  return { patterns: [...origins.keys()], origins };
}

/** Splits a stack_templates input into its entries, at commas and line breaks. */
export function splitStackTemplates(text) {
  return text
    .split(/[,\r\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

// A project folder as stack_templates writes it: no `./` or `/` in front and
// no `/` behind, so `./api/` and `api` name the same folder, and `.` the root.
const pinnedFolder = (written) =>
  written
    .trim()
    .replace(/^(\.\/)*\/*/, '')
    .replace(/\/+$/, '')
    .replace(/^\.$/, '');

// A folder stack_templates can't name: an entry ends at a comma or a line
// break, and the spaces around it are dropped.
const cannotBePinned = (folder) => /[,\r\n]/.test(folder) || folder !== folder.trim();

/**
 * A detected stack as the stack_templates entries that pin it (see
 * pinnedStack): `Template` for one at the repository root, `Template@folder`
 * for one in a project folder. Returns
 *
 *   entries  — in the order pinnedStack turns back into the same exclude list
 *   unnamed  — the project folders left out because an entry can't name them:
 *              a comma, a line break or a space at either end is in the way
 */
export function stackTemplateEntries(detected) {
  const entries = [];
  const unnamed = [];
  for (const [folder, { keys, extraPatterns }] of detected) {
    if (cannotBePinned(folder)) {
      unnamed.push(folder);
      continue;
    }
    const own = Object.keys(OWN_TEMPLATES).filter((name) =>
      OWN_TEMPLATES[name].every((p) => extraPatterns.has(p)),
    );
    for (const name of [...keys, ...own]) {
      entries.push(folder ? `${name}${STACK_TEMPLATE_FOLDER_SEPARATOR}${folder}` : name);
    }
  }
  return { entries, unnamed };
}

/**
 * The stack an instructor set with stack_templates, in place of the one
 * detectStack would find: every repository gets the same templates, whatever
 * its languages and project files.
 *
 *   entries       — the input's entries (see splitStackTemplates)
 *   allTemplates  — template key → patterns
 *
 * A template is named by its key (`Node`, `Global/Linux`) or, for a framework
 * with no upstream template, its name in OWN_TEMPLATES, in any case.
 *
 * Returns what detectStack does — `manifests` empty and `foldersFound` 0,
 * since nothing is scanned — and
 *
 *   unknown       — the entries that name no template, which are left out:
 *                   [{ written, name, language }]. `language` is the templates
 *                   the name reaches as a language (`JavaScript` → Node), or
 *                   null. Unknown names don't fail a run: a template can leave
 *                   the upstream collection after a workflow was written
 *
 * With no entry that names a template, the exclude list is the fallback one,
 * as it is when nothing is detected.
 */
export function pinnedStack({ entries, allTemplates }) {
  const byName = new Map(
    [...Object.keys(allTemplates), ...Object.keys(OWN_TEMPLATES)].map((key) => [
      key.toLowerCase(),
      key,
    ]),
  );
  const languageByName = new Map(
    Object.entries(LANGUAGE_TO_TEMPLATES).map(([language, keys]) => [language.toLowerCase(), keys]),
  );

  const detected = new Map();
  const unknown = [];
  for (const written of entries) {
    const at = written.indexOf(STACK_TEMPLATE_FOLDER_SEPARATOR);
    const name = (at === -1 ? written : written.slice(0, at)).trim();
    const folder = at === -1 ? '' : pinnedFolder(written.slice(at + 1));
    const key = byName.get(name.toLowerCase());
    if (!key) {
      unknown.push({ written, name, language: languageByName.get(name.toLowerCase()) ?? null });
      continue;
    }
    if (!detected.has(folder)) detected.set(folder, { keys: new Set(), extraPatterns: new Set() });
    // A name both collections hold is the upstream template.
    if (Object.hasOwn(allTemplates, key)) detected.get(folder).keys.add(key);
    else OWN_TEMPLATES[key].forEach((p) => detected.get(folder).extraPatterns.add(p));
  }

  return {
    ...stackPatterns(detected, allTemplates),
    detected,
    manifests: [],
    foldersFound: 0,
    unknown,
  };
}

/**
 * The language Linguist's tables give a file, as { language, via }: `language`
 * is a name, or a list of names when the extension is shared (see
 * buildLanguageFiles in scripts/build-wizard-exclude-lists.js), and `via` is
 * the file name or extension that decided. null for a file in no counted
 * language. A file name is tried before an extension, and a longer extension
 * before a shorter one (`.d.ts` before `.ts`), as Linguist does.
 */
export function fileLanguage(path, { extensions, filenames }) {
  const name = path.slice(path.lastIndexOf('/') + 1);
  if (Object.hasOwn(filenames, name)) return { language: filenames[name], via: name };
  const lower = name.toLowerCase();
  for (let dot = lower.indexOf('.'); dot !== -1; dot = lower.indexOf('.', dot + 1)) {
    const extension = lower.slice(dot);
    if (Object.hasOwn(extensions, extension)) {
      return { language: extensions[extension], via: extension };
    }
  }
  return null;
}

// The origins that depend on the stack — detected in the repository, or set
// with stack_templates — where a pattern can take a source file by surprise.
const DETECTED_ORIGINS = ['template', 'project', 'fallback'];

const protectedVerdictOn = createFileFilter({
  excludePatterns: PROTECTED_EXCLUDE_PATTERNS,
  caseInsensitivePatterns: PROTECTED_EXCLUDE_PATTERNS,
});

/**
 * The rules one run applies to its files, from the exclude list of the
 * detected stack (see detectStack) and the instructor's two pattern lists.
 *
 *   excludePatterns          — every exclude pattern applied: the detected
 *                              ones, the instructor's in the forms they are
 *                              matched, and the workflows folder
 *   caseInsensitivePatterns  — those of them matched ignoring case: all but
 *                              the detected templates
 *   verdictOn                — (filepath) => the file's verdict (see
 *                              createFileFilter)
 *   origins                  — Map from each exclude pattern to where it comes
 *                              from: `detectedOrigins` (see detectStack), and
 *                              { kind: 'yours', written } for an additional
 *                              exclude pattern, as the instructor wrote it. A
 *                              pattern of theirs the detected list already
 *                              holds stays credited to that list
 *   mayBeOwnWork             — (filepath, verdict, languageFiles) => whether
 *                              a file left out may be the student's own work
 *                              all the same; see below
 *
 * A file may be the student's own work when the pattern that left it out
 * comes from the detected stack or the fallback list, not from a list that
 * never changes, and the file is source code by its name (`languageFiles`,
 * see fileLanguage). `**\/lib/**` from the Python template leaving out
 * `src/lib/util.js` is the usual case. A file in a dependency folder is code
 * too, and nobody's own work, so it never counts; nor does one the
 * instructor's own exclude patterns match, which they meant to leave out
 * whichever pattern got to it first.
 *
 * It is a prompt to look, not a verdict: build output such as `dist/app.js`
 * is rightly left out, and reads the same from here.
 */
export function buildFileRules({
  detectedPatterns,
  detectedOrigins = new Map(),
  additionalExcludePatterns = [],
  excludePatternOverrides = [],
}) {
  const instructorExcludes = additionalExcludePatterns.flatMap(instructorPatterns);
  const origins = new Map(detectedOrigins);
  const credit = (pattern, origin) => {
    if (!origins.has(pattern)) origins.set(pattern, origin);
  };
  WORKFLOWS_EXCLUDE_GROUP.patterns.forEach((p) =>
    credit(p, { kind: 'always', label: WORKFLOWS_EXCLUDE_GROUP.label }),
  );
  for (const written of additionalExcludePatterns) {
    instructorPatterns(written).forEach((p) => credit(p, { kind: 'yours', written }));
  }
  const excludePatterns = [
    ...new Set([...detectedPatterns, ...instructorExcludes, WORKFLOWS_EXCLUDE_PATTERN]),
  ];
  const caseInsensitivePatterns = [
    ...ALWAYS_EXCLUDE,
    ...instructorExcludes,
    WORKFLOWS_EXCLUDE_PATTERN,
  ];
  const verdictOn = createFileFilter({
    excludePatterns,
    overridePatterns: excludePatternOverrides,
    caseInsensitivePatterns,
  });
  const instructorVerdictOn = createFileFilter({
    excludePatterns: instructorExcludes,
    caseInsensitivePatterns: instructorExcludes,
  });
  const mayBeOwnWork = (filepath, verdict, languageFiles) =>
    !verdict.assessed &&
    DETECTED_ORIGINS.includes(origins.get(verdict.pattern)?.kind) &&
    fileLanguage(filepath, languageFiles) !== null &&
    protectedVerdictOn(filepath).assessed &&
    instructorVerdictOn(filepath).assessed;

  return { excludePatterns, caseInsensitivePatterns, verdictOn, origins, mayBeOwnWork };
}
