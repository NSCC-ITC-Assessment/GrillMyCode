---
sidebar_position: 3
sidebar_label: File filtering
---

# File filtering

GrillMyCode detects each repository's languages and frameworks and excludes the files they generate, with no configuration needed in most cases. This page lists every rule and how patterns are matched. For a plain-language overview, see [Choosing which files are assessed](../guides/choosing-files.md).

## How the decision flow works

For each file in the changed diff, the action applies this logic in order:

```
1. Is it a binary file (contains a null byte)?        → always skip, regardless of everything else
2. Does it match any exclude pattern?                 → skip, UNLESS step 3 applies
3. Does it match an exclude_pattern_overrides entry?  → eligible for assessment (overrides win)
4. None of the above                                  → eligible for assessment
```

The exclude patterns themselves come from three sources, merged in this order:

| Source | Input | Purpose |
|---|---|---|
| Always-excluded | _(hardcoded)_ | Lock files, env files, OS noise, source maps, logs, Markdown, editor and IDE settings, diagrams, tabular data — never relevant to assessment |
| Auto-detected stack | _(automatic)_ | Build artifacts, dependency dirs, generated files for your specific language/framework |
| Instructor additions | `additional_exclude_patterns` | Assignment-specific files the auto-detection wouldn't know about |

The final exclude list is the **union** of all three. `exclude_pattern_overrides` can punch individual files back through after the fact.

## How auto-detection works

When the action runs it performs up to seven lookups using the already-available `github_token`:

1. **GitHub Languages API** — queries `/repos/{owner}/{repo}/languages` to identify all languages present in the repository (the same data shown on the repo's language bar).
2. **Repository root inspection** — checks for well-known config files and directories (`package.json`, `pom.xml`, `Cargo.toml`, `go.mod`, `artisan`, `wp-config.php`, `grails-app/`, `project.godot`, `firebase.json`, `angular.json`, `deno.json`, `.vs/`, `.idea/`, etc.) to detect frameworks and editors. Editor settings themselves are always excluded (see below); an editor detected here only adds its template's extra build-output patterns, such as JetBrains' `out/`.
3. **Root filename suffix scan** — detects frameworks whose project file includes a variable component by checking whether any root entry ends with a known suffix: `.xcodeproj` / `.xcworkspace` → Xcode, `.uproject` → Unreal Engine, `.pro` → Qt, `.ipynb` → Jupyter Notebooks.
4. **`package.json` dependency scan** _(JS/TS repos only)_ — if a `package.json` is found in the root, its `dependencies` and `devDependencies` are read and matched against known framework packages (`next`, `@angular/core`, `svelte`, `vue`, `nuxt`, `@tauri-apps/api`, etc.). This catches the correct framework regardless of which config filename convention the project uses.
5. **`composer.json` dependency scan** _(PHP repos only)_ — if a `composer.json` is found in the root, its `require` and `require-dev` entries are read and matched against known framework packages (`laravel/framework`, `symfony/framework-bundle`, `drupal/core`, `codeigniter4/framework`, `yiisoft/yii2`, `cakephp/cakephp`, WordPress installers like `roots/wordpress`, etc.). Like the `package.json` scan, this identifies the framework even when its config files aren't at the repo root — for example Bedrock relocates `wp-config.php`, and Symfony Flex projects may not commit `symfony.lock`.
6. **`Gemfile` dependency scan** _(Ruby repos only)_ — if a `Gemfile` is found in the root, its `gem` declarations are read and matched against known framework gems (`rails`, `jekyll`, `nanoc`). This is more reliable than inferring the framework from a `Rakefile`, since many non-Rails projects ship a `Rakefile` and many Rails apps don't.
7. **`mix.exs` dependency scan** _(Elixir repos only)_ — if a `mix.exs` is found in the root, its dependency tuples (e.g. `{:phoenix, "~> 1.7"}`) are read and matched against known framework packages (`phoenix`). The base `Elixir` template already covers `_build/` and `deps/`; this adds the Phoenix web artifacts (`priv/static/**`, `tmp/`) on top.

Each detected signal is mapped to one or more [github/gitignore](https://github.com/github/gitignore) templates, or to a set of known artifact paths for frameworks that have no upstream template (e.g. SvelteKit's `.svelte-kit/`, Nuxt's `.nuxt/` and `.output/`). The action ships with all 300+ templates bundled in the Docker image (kept current via a weekly automated PR).

Template patterns are emitted **depth-independently**: `node_modules/` in the upstream template becomes `**/node_modules/**`, so a nested `frontend/node_modules/` is excluded just as a root-level one is. Only patterns the upstream template anchors with a leading slash (e.g. `/build/`) stay root-anchored. The examples below name each template's patterns in their unprefixed form for brevity.

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
- A **Jupyter Notebooks** repo (any `.ipynb` in root) → `Python` + `community/Python/JupyterNotebooks` templates.
- A **Java** repo with a `pom.xml` → `Java` + `Maven` templates: `target/**`, `.gradle/**`, `*.class`, etc.
- A **Grails** repo (has a `grails-app/` directory) → `Java` + `Gradle` + `Grails` templates: adds `web-app/WEB-INF/classes`, `*Db.*`, `stacktrace.log`, etc.
- A **mixed JS + Python** repo → gets the union of all matched template sets.

:::note[Python frameworks need no per-framework detection]

Unlike JavaScript and PHP — where each framework ships its own gitignore template or build directory — Python's upstream `Python` template is a single comprehensive file that already folds in the artifacts for Django (`db.sqlite3`, `local_settings.py`), Flask (`instance/**`, `.webassets-cache`), Scrapy (`.scrapy`), Celery (`celerybeat-*`), Sphinx/MkDocs, and more. A Django or Flask repo is therefore fully covered the moment Python is detected — there is no `requirements.txt` / `pyproject.toml` dependency scan because it would add nothing the `Python` template doesn't already exclude. The only Python tool caches not in that template — `.gradio/**` and `.dvc/cache/**` — are added to the always-excluded list below.

:::

If detection fails (e.g. the GitHub API is unreachable) the action falls back to a broad built-in list covering the most common languages.

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

This section describes the patterns **you** write in `additional_exclude_patterns` and `exclude_pattern_overrides`. The built-in and auto-detected patterns above already carry explicit `**/` prefixes, so they never depend on the `matchBase` behaviour described here.

Patterns use [minimatch](https://github.com/isaacs/minimatch) glob syntax with two options enabled: `dot: true` (matches dotfiles) and `matchBase: true` (a pattern with no `/` matches against the filename only, regardless of directory depth).

| Pattern | What it matches |
|---|---|
| `tests/**` | Everything inside a `tests/` directory at any depth |
| `*.pyc` | Any file ending in `.pyc` in any directory (matchBase) |
| `data/*.csv` | `.csv` files directly inside a `data/` directory |
| `**/*.test.js` | Any `.test.js` file at any depth |
| `provided_starter/**` | All files inside `provided_starter/` |
| `config.json` | Any file named exactly `config.json` at any depth (matchBase) |
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
| `config.json` | `config.json` | ✅ | matchBase — no slash, matches filename anywhere |
| `src/config.json` | `config.json` | ✅ | matchBase applies at any depth |
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

If a file is excluded but you want it assessed, use `exclude_pattern_overrides`. This takes precedence over everything — both auto-detected patterns and `additional_exclude_patterns`.

Each entry can be:

- An **exact pattern** — re-includes all files matching that pattern:
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

## Confirming what was applied

The action logs the full exclude list on every run. Look for these lines in the workflow step output:

```
Detected languages: JavaScript, TypeScript
Scanned package.json — 42 deps
Using gitignore templates: Node, Nextjs, Global/VisualStudioCode
Additional exclude patterns (from input): data/**, tests/fixtures/**
Exclude pattern overrides (re-included): README.md
Exclude patterns applied (94):
  **/.git/**
  **/.gitignore
  **/node_modules/**
  ...
Assessing 3 file(s): src/index.js, src/utils.js, src/api.js
```

The `Scanned …` line reflects whichever manifest matched your stack — `composer.json` for PHP, `Gemfile` for Ruby, `mix.exs` for Elixir — and `Using gitignore templates:` lists the resolved templates accordingly (e.g. `Composer, Laravel`; `Ruby, Rails`; `Elixir, community/Elixir/Phoenix`).

If a file you expected to be assessed is missing from the `Assessing N file(s)` line, it was excluded — the logged pattern list shows exactly which patterns are active so you can identify the culprit and decide whether to add an override.
