---
sidebar_position: 3
---

# Exclude Patterns

GrillMyCode automatically detects your repository's language and framework stack and applies the appropriate exclude patterns at runtime — no manual configuration required in most cases.

:::info[Binary files are never assessed]

Regardless of any include or exclude settings, **binary files are always skipped** before being sent to the AI. Any file whose content contains a null byte is automatically filtered out. Only text-based source files are eligible for assessment.

:::

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
| Always-excluded | _(hardcoded)_ | Lock files, env files, OS noise, source maps, logs, Markdown — never relevant to assessment |
| Auto-detected stack | _(automatic)_ | Build artifacts, dependency dirs, generated files for your specific language/framework |
| Instructor additions | `additional_exclude_patterns` | Assignment-specific files the auto-detection wouldn't know about |

The final exclude list is the **union** of all three. `exclude_pattern_overrides` can punch individual files back through after the fact.

## How auto-detection works

When the action runs it performs up to three lookups using the already-available `github_token`:

1. **GitHub Languages API** — queries `/repos/{owner}/{repo}/languages` to identify all languages present in the repository (the same data shown on the repo's language bar).
2. **Repository root inspection** — checks for well-known config files and directories (`package.json`, `pom.xml`, `Cargo.toml`, `go.mod`, `artisan`, `wp-config.php`, `project.godot`, `firebase.json`, `angular.json`, `deno.json`, `.vscode/`, `.idea/`, etc.) to detect frameworks and editors.
3. **Root filename suffix scan** — detects frameworks whose project file includes a variable component by checking whether any root entry ends with a known suffix: `.xcodeproj` / `.xcworkspace` → Xcode, `.uproject` → Unreal Engine, `.pro` → Qt, `.ipynb` → Jupyter Notebooks.
4. **`package.json` dependency scan** _(JS/TS repos only)_ — if a `package.json` is found in the root, its `dependencies` and `devDependencies` are read and matched against known framework packages (`next`, `@angular/core`, `svelte`, `vue`, `nuxt`, `@tauri-apps/api`, etc.). This catches the correct framework regardless of which config filename convention the project uses.

Each detected signal is mapped to one or more [github/gitignore](https://github.com/github/gitignore) templates, or to a set of known artifact paths for frameworks that have no upstream template (e.g. SvelteKit's `.svelte-kit/`, Nuxt's `.nuxt/` and `.output/`). The action ships with all 300+ templates bundled in the Docker image (kept current via a weekly automated PR).

**Examples:**

- A **plain Node** repo → `Node` template: `node_modules/**`, `dist/**`, `coverage/**`, etc.
- A **Next.js** repo → `Node` + `Nextjs` templates: adds `.next/**` on top of the Node exclusions.
- A **SvelteKit** repo → `Node` template + `.svelte-kit/**` (no upstream template exists for Svelte).
- A **Angular** repo → `Node` + `Angular` templates: adds `.angular/**`.
- A **Laravel** repo → `PHP` template + `Laravel` template: `vendor/**`, storage cache dirs, etc.
- A **Unity** repo → `Dotnet` template + `Unity` template: `Library/**`, `Temp/**`, `obj/**`, etc.
- A **Godot** repo → `Godot` template: `.godot/**`, `*.import`, export presets, etc.
- A **Python** repo → `Python` template: `__pycache__/**`, `*.pyc`, `.venv/**`, `*.egg-info/**`, etc.
- A **Jupyter Notebooks** repo (any `.ipynb` in root) → `Python` + `community/Python/JupyterNotebooks` templates.
- A **Java** repo with a `pom.xml` → `Java` + `Maven` templates: `target/**`, `.gradle/**`, `*.class`, etc.
- A **mixed JS + Python** repo → gets the union of all matched template sets.

If detection fails (e.g. the GitHub API is unreachable) the action falls back to a broad built-in list covering the most common languages.

## Patterns always excluded

The following are excluded from every run regardless of detected stack:

| Pattern | Reason |
|---|---|
| `.git/**` | Git internals |
| `.gitignore`, `.gitattributes`, `.gitmodules`, `.mailmap`, `.git-blame-ignore-revs` | VCS config, not student code |
| `.github/workflows/**` | GitHub Actions workflow files — usually not student-authored code. You can override certain files for evaluation if needed. |
| `**/*.lock`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Pipfile.lock`, `poetry.lock` | Lock files — machine-generated, often enormous |
| `**/*.min.js`, `**/*.min.css` | Minified assets — unreadable by design |
| `.env`, `.env.*`, `**/.env`, `**/.env.*` | Environment files — may contain secrets |
| `**/*.tsbuildinfo` | TypeScript incremental build metadata |
| `.DS_Store`, `Thumbs.db` | OS-generated noise |
| `**/*.map` | Source maps (generated, not authored) |
| `**/*.log` | Log output |
| `**/*.md` | Markdown docs — pass assignment briefs via [`assignment_context`](../reference/inputs-outputs.md) instead |
| `**/*.svg` | SVG assets |

## Pattern syntax

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

**Key behaviours to know:**

- Patterns with no `/` in them match on filename only — `*.log` matches `logs/server.log`, not just `server.log` at the root.
- Patterns with a `/` are matched against the full path — `src/*.js` only matches JS files directly in `src/`, not `src/utils/helper.js`.
- `**` matches across directory separators — `tests/**` matches `tests/unit/foo.test.js`.

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
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
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

## Workflow files

GitHub Actions workflow files (`.github/workflows/**`) are always excluded. This prevents questions from being generated about the GrillMyCode workflow file itself.

## Confirming what was applied

The action logs the full exclude list on every run. Look for these lines in the workflow step output:

```
Detected languages: JavaScript, TypeScript
Scanned package.json — 42 deps
Using gitignore templates: Node, Nextjs, Global/VisualStudioCode
Additional exclude patterns (from input): data/**, tests/fixtures/**
Exclude pattern overrides (re-included): README.md
Exclude patterns applied (94):
  .git/**
  .gitignore
  node_modules/**
  ...
Assessing 3 file(s): src/index.js, src/utils.js, src/api.js
```

If a file you expected to be assessed is missing from the `Assessing N file(s)` line, it was excluded — the logged pattern list shows exactly which patterns are active so you can identify the culprit and decide whether to add an override.

## Troubleshooting

**A file I want assessed isn't showing up.**

Check the `Exclude patterns applied` list in the log. Find the pattern that matches your file and either:
- Add it to `exclude_pattern_overrides` if you want just that file through.
- Add the specific pattern to `exclude_pattern_overrides` if you want all files of that type through.

**More files are being assessed than I want.**

Add the unwanted files or directories to `additional_exclude_patterns`.

**The auto-detected language looks wrong.**

The Languages API reflects GitHub's language detection, which is based on file extensions and heuristics. If the wrong templates are applied you can verify by checking the `Using gitignore templates:` log line. Use `additional_exclude_patterns` to fill any gaps, or `exclude_pattern_overrides` to recover files incorrectly excluded by a mismatched template.

**No files are being assessed at all.**

The action logs a warning — `No assessable files found after applying include/exclude filters` — when the filtered file list is empty. This usually means all changed files matched an exclude pattern. Check the `Exclude patterns applied` list, identify the over-broad pattern, and use `exclude_pattern_overrides` to recover the files you need.
