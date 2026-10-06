---
sidebar_position: 3
sidebar_label: File filtering
---

# File filtering

GrillMyCode detects each repository's languages and frameworks and excludes the files they generate, with no configuration needed in most cases. This page lists every rule and how patterns are matched. For a plain-language overview, see [Choosing which files are assessed](../guides/choosing-files.md).

## How the decision flow works

For each file in the changed diff, the action applies this logic in order:

![On the left, three lists (always excluded, detected for the repo's stack, and additional_exclude_patterns) combine into the exclude patterns. On the right, each changed file goes through three questions. Binary, with a null byte? If yes, skipped, and nothing brings it back. If no: matches an exclude pattern? If no, assessed. If yes: matches an entry in exclude_pattern_overrides? If yes, assessed, unless it is protected. If no, skipped.](/img/exclude-decision.svg)

The exclude patterns themselves come from three sources, merged in this order:

| Source | Input | Purpose |
|---|---|---|
| Always-excluded | _(hardcoded)_ | Lock files, env files, OS noise, source maps, logs, Markdown, editor and IDE settings, diagrams, tabular data — never relevant to assessment |
| Auto-detected stack | _(automatic)_ | Build artifacts, dependency dirs, generated files for your specific language/framework |
| Instructor additions | `additional_exclude_patterns` | Assignment-specific files the auto-detection wouldn't know about |

The final exclude list is the **union** of all three. `exclude_pattern_overrides` can punch individual files back through after the fact, with one limit: see [Protected files](#protected-files).

## How auto-detection works

When the action runs it combines two sources:

1. **GitHub Languages API** — queries `/repos/{owner}/{repo}/languages` with the already-available `github_token` to identify all languages present in the repository (the same data shown on the repo's language bar). The data covers the whole repository, so the templates it selects apply at the repository root.
2. **Project folder scan** — lists every file in the commit being assessed and looks for well-known config files and directories (`package.json`, `pom.xml`, `Cargo.toml`, `go.mod`, `artisan`, `wp-config.php`, `grails-app/`, `project.godot`, `ProjectSettings/`, `firebase.json`, `angular.json`, `deno.json`, `.vs/`, `.idea/`, etc.) to detect frameworks and editors. The repository root is always a project folder, and any folder below it that holds one of these files becomes one too (see [Monorepos and nested projects](#monorepos-and-nested-projects)). Editor settings themselves are always excluded (see below); an editor detected here only adds its template's extra build-output patterns, such as JetBrains' `out/`.

Within each project folder, the scan also checks:

3. **Filename suffixes** — detects frameworks whose project file includes a variable component by checking whether any entry ends with a known suffix: `.xcodeproj` / `.xcworkspace` → Xcode, `.uproject` → Unreal Engine, `.pro` → Qt, `.ipynb` → Jupyter Notebooks.
4. **`package.json` dependencies** — its `dependencies` and `devDependencies` are matched against known framework packages (`next`, `@angular/core`, `svelte`, `vue`, `nuxt`, `@tauri-apps/api`, etc.). This catches the correct framework regardless of which config filename convention the project uses.
5. **`composer.json` dependencies** — its `require` and `require-dev` entries are matched against known framework packages (`laravel/framework`, `symfony/framework-bundle`, `drupal/core`, `codeigniter4/framework`, `yiisoft/yii2`, `cakephp/cakephp`, WordPress installers like `roots/wordpress`, etc.). Like the `package.json` scan, this identifies the framework even when its config files aren't beside `composer.json` — for example Bedrock relocates `wp-config.php`, and Symfony Flex projects may not commit `symfony.lock`.
6. **`Gemfile` gems** — its `gem` declarations are matched against known framework gems (`rails`, `jekyll`, `nanoc`). This is more reliable than inferring the framework from a `Rakefile`, since many non-Rails projects ship a `Rakefile` and many Rails apps don't.
7. **`mix.exs` dependencies** — its dependency tuples (e.g. `{:phoenix, "~> 1.7"}`) are matched against known framework packages (`phoenix`). The base `Elixir` template already covers `_build/` and `deps/`; this adds the Phoenix web artifacts (`priv/static/**`, `tmp/`) on top.

Manifests are read from the commit being assessed, so a framework the student added in this push is detected in the same run.

Each detected signal is mapped to one or more [github/gitignore](https://github.com/github/gitignore) templates, or to a set of known artifact paths for frameworks that have no upstream template (e.g. SvelteKit's `.svelte-kit/`, Nuxt's `.nuxt/` and `.output/`). The action ships with all 300+ templates bundled in the Docker image (kept current via a weekly automated PR).

Template patterns are emitted **depth-independently**: `node_modules/` in the upstream template becomes `**/node_modules/**`, so a nested `frontend/node_modules/` is excluded just as a root-level one is. Only patterns the upstream template anchors, with a leading slash (`/vendor/`) or a slash in the middle (`build/Release`), stay anchored — to the project folder that turned the template on. The examples below name each template's patterns in their unprefixed form for brevity.

**Examples:**

- A **plain Node** repo → `Node` template: `node_modules/**`, `dist/**`, `coverage/**`, etc.
- A **Next.js** repo → `Node` + `Nextjs` templates: adds `.next/**` on top of the Node exclusions.
- A **SvelteKit** repo → `Node` template + `.svelte-kit/**` (no upstream template exists for Svelte).
- A **Angular** repo → `Node` + `Angular` templates: adds `.angular/**`.
- A **plain PHP** repo with a `composer.json` → `Composer` template: `vendor/**`, `composer.phar`, etc.
- A **Laravel** repo → `Composer` template + `Laravel` template: `vendor/**`, `bootstrap/compiled.php`, storage cache dirs, etc.
- A **Symfony / Drupal / CodeIgniter / Yii / CakePHP / WordPress** repo → `Composer` template + the matching framework template, detected from the `composer.json` dependency scan.
- A **Unity** repo → `Dotnet` template + `Unity` template: `Library/**`, `Temp/**`, `obj/**`, etc.
- A **Godot** repo → `Godot` template: `.godot/**`, `*.import`, export presets, etc.
- A **plain Ruby** repo with a `Gemfile` → `Ruby` template: `*.gem`, `/.bundle/`, `/vendor/bundle`, etc.
- A **Rails** repo → `Ruby` + `Rails` templates: adds `/log/**`, `/tmp/**`, `storage/**`, `public/assets`, etc., detected from the `Gemfile` gem scan.
- A **Jekyll** repo → `Ruby` + `Jekyll` templates: adds `_site/`, `.jekyll-cache/`, `.jekyll-metadata`.
- A **plain Elixir** repo with a `mix.exs` → `Elixir` template: `_build/**`, `deps/**`, `*.beam`, `erl_crash.dump`, etc.
- A **Phoenix** repo → `Elixir` + `community/Elixir/Phoenix` templates: adds `priv/static/**`, `tmp/**`, `assets/node_modules`, detected from the `mix.exs` dependency scan.
- A **Python** repo → `Python` template: `__pycache__/**`, `*.pyc`, `.venv/**`, `*.egg-info/**`, etc.
- A **Jupyter Notebooks** repo (any `.ipynb` file) → `Python` + `community/Python/JupyterNotebooks` templates.
- A **Java** repo with a `pom.xml` → `Java` + `Maven` templates: `target/**`, `.gradle/**`, `*.class`, etc.
- A **Grails** repo (has a `grails-app/` directory) → `Java` + `Gradle` + `Grails` templates: adds `web-app/WEB-INF/classes`, `*Db.*`, `stacktrace.log`, etc.
- A **mixed JS + Python** repo → gets the union of all matched template sets.

:::note[Python frameworks need no per-framework detection]

Unlike JavaScript and PHP — where each framework ships its own gitignore template or build directory — Python's upstream `Python` template is a single comprehensive file that already folds in the artifacts for Django (`db.sqlite3`, `local_settings.py`), Flask (`instance/**`, `.webassets-cache`), Scrapy (`.scrapy`), Celery (`celerybeat-*`), Sphinx/MkDocs, and more. A Django or Flask repo is therefore fully covered the moment Python is detected — there is no `requirements.txt` / `pyproject.toml` dependency scan because it would add nothing the `Python` template doesn't already exclude. The only Python tool caches not in that template — `.gradio/**` and `.dvc/cache/**` — are added to the always-excluded list below.

:::

If nothing is detected (for example, the GitHub API is unreachable and no project folder holds a known file) the action falls back to a broad built-in list covering the most common languages, together with the [patterns always excluded](#patterns-always-excluded).

### Monorepos and nested projects

The project doesn't have to sit at the repository root. A repository can hold one app in a subfolder, a `frontend/` and a `backend/`, or one folder per lab, and each project folder gets the templates its own files turn on. A template's anchored patterns are applied inside the folder that turned it on — the meaning the upstream template gives them, relative to the project instead of the repository:

| Layout | Patterns applied (examples) |
|---|---|
| Laravel at the root (`artisan`) | `vendor/**`, `bootstrap/compiled.php` |
| Laravel in `myapp/` (`myapp/artisan`) | `myapp/vendor/**`, `myapp/bootstrap/compiled.php` |
| Next.js in `frontend/`, Laravel in `backend/` | `frontend/.next/**`, `backend/vendor/**` |

- A folder inside a dependency or build folder — `node_modules/`, `vendor/`, `dist/`, `build/`, `target/` and the other dependency and build folders in the built-in fallback list — is never a project folder, so a library's own `package.json` or `composer.json` adds nothing.
- Templates selected by the Languages API apply at the repository root only, since language data has no folder. Patterns that match at any depth (`**/node_modules/**`, `**/__pycache__/**`) cover every folder however they were selected.
- Up to 100 project folders are scanned, shallowest first. Beyond that the run logs a warning, and deeper folders get only the patterns that match at any depth; add anything else they commit with `additional_exclude_patterns`.
- A folder name containing glob characters is escaped in the pattern, e.g. `lab \[1\]/vendor/**`. Pass the pattern exactly as the run log shows it to `exclude_pattern_overrides`.

## Patterns always excluded

The following are excluded from every run regardless of detected stack:

| Pattern | Reason |
|---|---|
| `**/.git/**` | Git internals |
| `**/.gitignore`, `**/.gitattributes`, `**/.gitmodules`, `**/.mailmap`, `**/.git-blame-ignore-revs` | VCS config, not student code |
| `**/.classroom50.yaml` | Classroom 50 accept-time metadata, written by `gh student accept` under the student's own commit identity — not student-authored code |
| `.github/workflows/**` | GitHub Actions workflow files — usually not student-authored code. You can override certain files for evaluation if needed. |
| `**/*.lock`, `**/package-lock.json`, `**/yarn.lock`, `**/pnpm-lock.yaml`, `**/Pipfile.lock`, `**/poetry.lock` | Lock files — machine-generated, often enormous |
| `**/*.min.js`, `**/*.min.css` | Minified assets — unreadable by design |
| `**/.env`, `**/.env.*` | Environment files — may contain secrets |
| `**/*.tsbuildinfo` | TypeScript incremental build metadata |
| `**/.gradio/**`, `**/.dvc/cache/**` | Python tool caches (Gradio, DVC) not covered by the bundled `Python` template |
| `**/.DS_Store`, `**/Thumbs.db` | OS-generated noise |
| `**/*.map` | Source maps (generated, not authored) |
| `**/*.log` | Log output |
| `**/*.md` | Markdown docs — pass assignment briefs via [`assignment_context`](../reference/inputs-outputs.md) instead |
| `**/*.svg` | SVG assets |

### Editor and IDE settings

Editor configuration is excluded at any depth, so a project nested one folder down (`app/.vscode/`) is covered as well as one at the root. This applies even when stack detection falls back to the built-in list.

| Editor | Patterns |
|---|---|
| VS Code and its forks | `**/.vscode/**`, `**/.vscode-test/**`, `**/*.code-workspace`, `**/.history/**` |
| Visual Studio | `**/.vs/**` |
| JetBrains IDEs, Fleet | `**/.idea/**`, `**/*.iml`, `**/*.ipr`, `**/*.iws`, `**/.fleet/**` |
| Eclipse | `**/.project`, `**/.classpath`, `**/.factorypath`, `**/.settings/**` |
| NetBeans | `**/nbproject/**` |
| Xcode | `**/*.xcodeproj/**`, `**/*.xcworkspace/**`, `**/xcuserdata/**` |
| Sublime Text, Zed, Nova, Theia | `**/*.sublime-project`, `**/*.sublime-workspace`, `**/.zed/**`, `**/.nova/**`, `**/.theia/**` |
| Vim, Emacs | `**/*.swp`, `**/*.swo`, `**/*~`, `**/.#*`, `**/#*#`, `**/.netrwhist`, `**/Session.vim` |
| AI coding assistants | `**/.cursor/**`, `**/.cursorrules`, `**/.cursorignore`, `**/.windsurf/**`, `**/.windsurfrules`, `**/.claude/**`, `**/.continue/**` |
| Editor-agnostic | `**/.editorconfig`, `**/.devcontainer/**` |

If an assignment asks students to write one of these — a dev container definition in a containers course, for example — re-include it with `exclude_pattern_overrides: '**/.devcontainer/**'`.

### Diagrams and data

Students sometimes commit a diagram of what they built, or a data file their program reads. These are plain text, so the binary check lets them through, but questions about a diagram's XML or a CSV's rows don't test the student's code.

| Pattern | Reason |
|---|---|
| `**/*.drawio`, `**/*.dio` | draw.io / diagrams.net diagrams |
| `**/*.excalidraw` | Excalidraw drawings |
| `**/*.bpmn` | BPMN process diagrams |
| `**/*.puml`, `**/*.plantuml`, `**/*.mmd` | PlantUML and Mermaid diagram sources |
| `**/*.csv`, `**/*.tsv` | Tabular data |

Re-include any of them with `exclude_pattern_overrides` when they are the deliverable (e.g. `'**/*.puml'` for a UML assignment).

## Pattern syntax

This section describes the patterns **you** write in `additional_exclude_patterns` and `exclude_pattern_overrides`.

Separate patterns with commas or line breaks. A comma inside braces belongs to its pattern, so `*.{js,ts}` is one pattern.

Patterns use [minimatch](https://github.com/isaacs/minimatch) glob syntax with `dot: true`, so they match dotfiles. A pattern **with no `/`** matches by file name at any depth: the action writes it as `**/` plus the pattern, and that is the form the run log's `Exclude patterns applied` list shows (`*.sql` appears as `**/*.sql`). A pattern **with a `/`** is matched from the repository root.

The usual ways of writing a path all work:

| You write | Read as | Meaning |
|---|---|---|
| `data` | `**/data` and `**/data/**` | A plain name or path, with no wildcards, covers the file of that name and everything in a folder of that name |
| `data/` | `**/data/**` | A trailing `/` names a folder only |
| `/data/**` or `./data/**` | `data/**` | A leading `/` or `./` means the repository root |
| `/config.json` | `config.json` and `config.json/**` | Only at the root, not at any depth |

**Case is ignored** in your patterns and in the [patterns always excluded](#patterns-always-excluded): `data/**` covers `Data/`, and `README.MD` is excluded like `README.md`. The auto-detected template patterns are matched as written, case included. A template pattern with no slash, such as WordPress's `index.php`, also applies only in the project folder that turned the template on, not to every `index.php` in the repository.

Two `.gitignore` habits don't carry over, and the run warns about both:

- A leading `!` doesn't re-include a file. It inverts the pattern, so `!src/**` excludes everything outside `src/`. To re-include a file, use `exclude_pattern_overrides`.
- A line starting with `#` isn't a comment. It is read as a file name.

| Pattern | What it matches |
|---|---|
| `tests/**` | Everything inside the top-level `tests/` directory |
| `*.pyc` | Any file ending in `.pyc` in any directory (no `/`, so any depth) |
| `data/*.csv` | `.csv` files directly inside a `data/` directory |
| `**/*.test.js` | Any `.test.js` file at any depth |
| `provided_starter/**` | All files inside `provided_starter/` |
| `provided_starter/` | All files inside any folder named `provided_starter` |
| `config.json` | Any file named exactly `config.json` at any depth (no `/`) |
| `src/config.json` | Only `src/config.json` specifically (has a `/`, so anchored) |

**Worked examples:**

| File path | Pattern | Match? | Why |
|---|---|---|---|
| `src/index.js` | `src/**` | ✅ | `**` covers all descendants |
| `src/utils/helper.js` | `src/**` | ✅ | nested path, still under `src/` |
| `src/utils/helper.js` | `src/*.js` | ❌ | `*` doesn't cross `/` — only direct children of `src/` |
| `tests/unit/auth.test.js` | `**/*.test.js` | ✅ | `**` matches any prefix path |
| `tests/fixtures/users.json` | `tests/fixtures/**` | ✅ | anchored subfolder glob |
| `e2e/fixtures/users.json` | `tests/fixtures/**` | ❌ | anchored — wrong top-level dir |
| `config.json` | `config.json` | ✅ | no slash — matches the file name anywhere |
| `src/config.json` | `config.json` | ✅ | no slash — any depth |
| `src/config.json` | `src/config.json` | ✅ | anchored exact path |
| `lib/config.json` | `src/config.json` | ❌ | anchored — path doesn't match |
| `provided_code/solution.py` | `provided_code/**` | ✅ | everything under the dir |
| `src/provided_code/solution.py` | `provided_code/**` | ❌ | anchored — not at root level |
| `src/provided_code/solution.py` | `**/provided_code/**` | ✅ | leading `**` matches any prefix |

## Additional patterns

Use `additional_exclude_patterns` for files specific to your assignment that the auto-detected templates wouldn't know about:

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v0
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    api_key: ${{ secrets.OPENROUTER_API_KEY }}
    additional_exclude_patterns: 'data/**, tests/fixtures/**, provided_starter/**'
```

Common use cases for instructors:

| Scenario | Pattern |
|---|---|
| Exclude provided starter files | `provided_starter/**` |
| Exclude test fixtures or sample data | `tests/fixtures/**, data/**` |
| Exclude a specific config file you provided | `config.json` |
| Exclude everything in a specific subdirectory | `src/lib/**` |
| Exclude all SQL migration files | `**/*.sql` |

## Override exclude patterns

If a file is excluded but you want it assessed, use `exclude_pattern_overrides`. This takes precedence over both auto-detected patterns and `additional_exclude_patterns`, except for [protected files](#protected-files). Entries follow the same [pattern syntax](#pattern-syntax) and always ignore case.

Each entry can be:

- A **pattern** — re-includes all files matching that pattern:
  ```yaml
  exclude_pattern_overrides: '**/*.md'   # re-includes all Markdown files
  ```
- A **specific file path** — only that one file passes through:
  ```yaml
  exclude_pattern_overrides: 'README.md' # only README.md; other .md files stay excluded
  ```

Both forms can be combined:

```yaml
exclude_pattern_overrides: 'README.md, SOLUTION.md'
```

:::tip[When to use overrides vs additional patterns]

Use `additional_exclude_patterns` to narrow what gets assessed (exclude more).
Use `exclude_pattern_overrides` to widen what gets assessed (re-include something excluded by default).

:::

### Protected files

A broad override is usually written to bring back something else, so three kinds of file come back only when an override **names** them:

| Kind | Patterns |
|---|---|
| Environment files | `.env`, `.env.*` |
| Lock files | `*.lock`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Pipfile.lock`, `poetry.lock` |
| Dependency folders | `node_modules/`, `bower_components/`, `vendor/`, `.venv/`, `venv/` |

An override names a protected file when the protected pattern also fits the override itself:

| Override | `frontend/.env` | `frontend/node_modules/…` | Why |
|---|---|---|---|
| `frontend/**` | Kept out | Kept out | Names neither |
| `*.json` | — | Kept out | Doesn't name `node_modules` |
| `frontend/.env` or `.env` | Assessed | — | Names the file |
| `node_modules/` or `**/node_modules/**` | — | Assessed | Names the folder |
| `vendor/` | — | — | Brings back `vendor/`, but not a `.env` or lock file inside it; name those too |

A file kept out this way stays in the `Excluded` list, and the run log lists it again under `Kept out`, with the protected pattern to name.

## Confirming what was applied

The action logs the full exclude list on every run. Look for these lines in the workflow step output:

```
Detected languages: JavaScript, TypeScript, PHP
Scanned package.json — 42 deps
Scanned api/composer.json — 6 deps
Using gitignore templates: Node, Nextjs, Global/VisualStudioCode
Using gitignore templates in api/: Composer, Laravel
Additional exclude patterns (from input): data/**, tests/fixtures/**
Exclude pattern overrides (re-included): README.md
Exclude patterns applied (94):
  **/.git/**
  **/.gitignore
  **/node_modules/**
  ...
Excluded 2 file(s):
  package-lock.json  (**/package-lock.json)
  README.md  (**/*.md)
Kept out 1 file(s) that an override matched but did not name. Environment files, lock files and dependency folders are re-included only by an override that names them, such as the file's own path:
  frontend/.env  (**/.env)
Left out 1 file(s) with no text to assess:
  public/logo.png  (binary)
Assessing 3 file(s): src/index.js, src/utils.js, src/api.js
```

There is one `Scanned …` line per manifest read — `package.json`, `composer.json` for PHP, `Gemfile` for Ruby, `mix.exs` for Elixir — named by its path. `Using gitignore templates:` lists the templates applied at the repository root (e.g. `Composer, Laravel`; `Ruby, Rails`; `Elixir, community/Elixir/Phoenix`), and each `Using gitignore templates in <folder>/:` line lists those of a [nested project folder](#monorepos-and-nested-projects).

If a file you expected to be assessed is missing from the `Assessing N file(s)` line, it was excluded. The `Excluded N file(s)` list names the first pattern that matched each file, so you can decide whether to add an override for the path or the pattern. The `Kept out N file(s)` list appears only when an override matched a [protected file](#protected-files) without naming it. The `Left out N file(s)` list names the files no pattern matched that are binary or were deleted; see [Filtering the files](code-selection.md#2-filtering-the-files).

The run summary shows the same lists in its **Configuration used by this run** table, under **Excluded files**: one collapsed group per pattern, largest first, then one for binary files and one for deleted files. Each list shows at most 1,000 paths in total, shared so that small groups are always listed in full; the run log always has every path. The **Codebase context** row lists the files sent as context the same way.
