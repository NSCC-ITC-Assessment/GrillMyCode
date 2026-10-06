# File Selection — Rules, Clashes and Plan

> **Recorded:** 2026-10-06 (`35a982c`)
> **Status:** Phases 0 to 2 done (2026-10-06). The rules and clashes below describe the code
> **before** Phase 1; see [What Phase 1 changed](#what-phase-1-changed) and
> [What Phase 2 changed](#what-phase-2-changed). Phases 3 to 5 are not started.

Instructors using the Workflow Wizard often get file selection wrong on the
first run: files they wanted are left out, or files they didn't want are
assessed. This note records the rules as the code applies them, where they
clash, and a plan to fix it.

Related: [non-code-file-filtering-options.md](non-code-file-filtering-options.md).

---

## Why it goes wrong

- The wizard's Files step (`StepFiles.js`) is two text boxes. It never sees a
  repository, so patterns are written from memory.
- The result is only visible after a real run, which costs an AI call. By then
  the workflow may already be copied into student repositories.
- The run summary lists left-out files, but inside the collapsed
  "Configuration used by this run" block. The headline shows only the assessed
  count.

---

## Current rules, in order

1. **Commit range picks the candidates.** Only files that differ between base
   and head are considered (`getChangedFiles`). The base is the first commit
   unless `starter_code: none`, so untouched starter files are never
   candidates.
2. **The exclude list is a union** (`detectExcludePatterns`, `main.js`):
   - always-excluded patterns (`ALWAYS_EXCLUDE_GROUPS`,
     `EDITOR_CONFIG_EXCLUDE_PATTERNS`, `NON_CODE_ASSET_EXCLUDE_PATTERNS`);
   - `WORKFLOWS_EXCLUDE_PATTERN`;
   - templates detected from the student's repository at the head commit:
     GitHub Languages API (root only) plus marker files, suffixes and manifest
     dependencies per project folder;
   - `FALLBACK_EXCLUDE_PATTERNS`, only when nothing at all is detected;
   - `additional_exclude_patterns`.
3. **Excluded unless overridden** (`filterFiles`). A file matching any exclude
   pattern is dropped, unless it matches any `exclude_pattern_overrides` entry.
   Overrides beat everything, including the instructor's own additions.
4. **Deleted and binary files are dropped** (`collectRawFiles`). No override
   brings them back.
5. **Within a surviving file,** only the student's added or changed lines can
   be asked about if the file existed at the base.

Instructor patterns are split on commas (`inputs.js`), matched case-sensitively
with `dot: true`, and passed through `instructorPattern`: no slash means any
depth, a slash means anchored at the repository root. The same rules decide
which files are eligible as codebase context.

---

## Clashes

"Ran" means tested against `filterFiles` and the bundled templates. "Read"
means found in the code but not run.

| #   | Clash                                                                                                                                                              | Evidence |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | A broad override re-includes everything under it. `frontend/**` brought back `frontend/.env`, `node_modules` and the lock file.                                    | Ran      |
| 2   | An override beats the instructor's own exclusion. Override `*.md` plus additional `docs/**` still assesses `docs/notes.md`.                                        | Ran      |
| 3   | Detected templates exclude ordinary folder and file names (table below).                                                                                           | Ran      |
| 4   | The exclude list is rebuilt from each student's repository on each run. It can differ between students, and a student can add a marker file to turn a template on. | Read     |
| 5   | Matching is case-sensitive, built-ins included. `Readme.MD` is assessed; `data/**` misses `Data/`.                                                                 | Ran      |
| 6   | Gitignore habits fail silently (table below).                                                                                                                      | Ran      |
| 7   | Built-ins match at any depth; instructor patterns with a slash don't. `tests/fixtures/**` misses `backend/tests/fixtures/`.                                        | Read     |
| 8   | Excluding a file also removes it from codebase context. There is no "show it, but don't ask about it".                                                             | Read     |
| 9   | Base copies are looked up by path. A starter file the student moves or renames counts as entirely theirs.                                                          | Read     |

### Clash 3: template patterns that hit source code

| Template   | Turned on by                          | Pattern                                                                 |
| ---------- | ------------------------------------- | ----------------------------------------------------------------------- |
| Python     | Python in the language data           | `**/lib/**`, `**/build/**`, `**/env/**`, `**/var/**`, `**/downloads/**` |
| Node       | JavaScript/TypeScript, `package.json` | `**/dist/**`, `**/out/**`                                               |
| Dotnet     | C#                                    | `**/[Bb]in/**`, `**/[Ll]og/**`                                          |
| C++, CMake | `Makefile`, `CMakeLists.txt`          | `**/Makefile`                                                           |
| Dart       | `pubspec.yaml`                        | `**/*.js`                                                               |
| Rust       | `Cargo.toml`                          | `**/debug/**`                                                           |
| WordPress  | `wp-config.php`                       | `index.php` in the project folder                                       |

Most of these match at any depth and across languages: a repository with any
Python gets `**/lib/**`, which also drops JavaScript in `src/lib/`. This is the
likeliest cause of files omitted by accident.

### Clash 6: patterns that silently do the wrong thing

| Written           | Result                                    |
| ----------------- | ----------------------------------------- |
| `data`, `data/`   | Matches nothing under the folder          |
| `./data/**`       | Matches nothing                           |
| `/data/**`        | Matches nothing                           |
| `# starter files` | Matches nothing                           |
| `*.{js,ts}`       | Split at the comma into two dead patterns |
| `!src/**`         | Excludes everything outside `src`         |

### Files included by accident

The always-excluded list has no entry for config and data files:
`package.json`, `tsconfig.json`, `requirements.txt`, `Dockerfile`, `.sql`,
`.txt`, `.json` data, notebooks. Unless a detected template covers one, it is
assessed when the student changes it.

---

## Possible additions

| Addition                                                                                                           | Fixes                | Cost                         |
| ------------------------------------------------------------------------------------------------------------------ | -------------------- | ---------------------------- |
| **Forgiving parsing.** Accept `data/`, `./data`, `/data`; split commas outside braces; warn on `!` and `#`.        | Clash 6              | Small                        |
| **Case-insensitive matching.**                                                                                     | Clash 5              | Small                        |
| **Fixed precedence.** Built-ins, then overrides, then additional patterns, so the instructor's exclusion wins.     | Clashes 1, 2         | Small; breaking, see Phase 0 |
| **Protected set.** Wildcard overrides never re-include `.env*`, lock files or dependency folders.                  | Clash 1              | Small                        |
| **Collision warning.** Flag a source file dropped by a template pattern, in the summary headline.                  | Clash 3              | Small                        |
| **Pinned stack.** The wizard writes the detected templates into the workflow; every student gets the same list.    | Clash 4              | Medium; new input            |
| **Live preview in the wizard.** Pick a solution folder; see assessed and left-out files with the rule responsible. | First-run errors     | Large                        |
| **Preview-only run.** Stop after file selection and write the summary, with no AI call.                            | First-run errors     | Medium; new input            |
| **Context-only list.** Files the AI may read but not ask about.                                                    | Clash 8              | Medium; new input            |
| **Rename detection** for starter files.                                                                            | Clash 9              | Medium                       |
| **Allowlist input** (`include_patterns`).                                                                          | Accidental inclusion | Medium; new input            |

---

## Plan of action

**Phase 0 — Decide.** _(Done.)_ Workflows reference the action as `@v0`, so
any rule change reaches workflows already sitting in student repositories on
the next release. Decisions taken:

| Decision                           | Breaking?                                                                                                     | Outcome                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Forgiving parsing                  | No. Only patterns that matched nothing start working.                                                         | Adopted                                                                                 |
| Case-insensitive matching          | Mildly. More files are excluded.                                                                              | Adopted for instructor and always-excluded patterns only; templates stay case-sensitive |
| Additional patterns beat overrides | **Yes.** "Exclude `tests/**`, override `tests/test_main.py`" would stop working, with no other way to say it. | Rejected                                                                                |
| Protected set                      | Narrowly. Affects only a broad override relied on to re-include protected files.                              | Adopted                                                                                 |
| Pinned stack                       | No. New input, off unless set.                                                                                | Adopted for Phase 5                                                                     |

**Phase 1 — Fix the rules.** _(Done.)_ See
[What Phase 1 changed](#what-phase-1-changed).

**Phase 2 — Share the logic.** _(Done.)_ Move the pure parts
(`instructorPattern`, `filterFiles`, `findProjectFolders`, template selection)
into a module with no `git`, `fs` or `@actions/core` imports, usable by both
the action and the wizard. Add a parity test alongside
`test/wizard-exclude-lists.test.js`. See
[What Phase 2 changed](#what-phase-2-changed).

**Phase 3 — Wizard preview.** In the Files step: pick a solution folder or
paste a file list; show assessed and left-out files with the rule responsible,
updating as patterns change. Include the collision warning and pattern checks.
Label the result as expected, not guaranteed: language detection is
approximated from file extensions, and clash 4 still applies.

**Phase 4 — Preview-only run.** A new input, offered on the manual-run form,
that stops before the AI call. Promote the left-out count to the summary
headline and add the collision warning there too.

**Phase 5 — Pinned stack.** The wizard preview already knows the detected
templates; write them into the workflow so the preview matches every student's
run.

**Later, if still needed:** context-only list, rename detection, allowlist.

Each phase that changes behaviour or adds an input needs the docs, README,
example workflows and wizard updates listed in `AGENTS.md`.

---

## What Phase 1 changed

Code: `splitPatternList`, `instructorPatterns` and `createFileFilter` in
`src/files.js`; `PROTECTED_EXCLUDE_GROUPS` in `src/constants.js`. User-facing
detail: `docs-site/docs/reference/exclude-patterns.md`.

- **Parsing.** Patterns split on commas and line breaks, except commas inside
  closed braces. `assignment_context` uses the same splitter.
- **Forms.** A leading `./` or `/` anchors at the root. A trailing `/` names a
  folder. A plain name or path with no wildcards gets a file form and a folder
  form (`data` → `**/data`, `**/data/**`). `!` and `#` only produce a warning.
- **Case.** Ignored for instructor patterns, overrides, the always-excluded
  list and `.github/workflows/**`.
- **Protected set.** Environment files, lock files and dependency folders come
  back only under an override that names them: every protected pattern
  matching the file must also match the override text read as a path. So
  `frontend/.env`, `*.lock` and `**/node_modules/**` work; `frontend/**` and
  `*.json` do not. This is narrower than "no wildcard override": a wildcard
  that names the protected thing still works.
- **Reporting.** Protected files an override matched but did not name are
  listed in the run log (`Kept out`) and noted in the summary.

Clash status after Phase 1: 1 fixed for protected files; 5 and 6 fixed; 2, 3,
4, 7, 8 and 9 unchanged.

---

## What Phase 2 changed

No change in behaviour. The log lines and the files selected are the same.

- **One module.** `src/file-selection.js` holds every rule: pattern splitting
  and reading, the file filter, the always-excluded list, the detection maps,
  and two new entry points. `detectStack` takes the languages, the file list
  and a function that reads a manifest, and returns the exclude list.
  `buildFileRules` adds the instructor's two lists and returns the verdict
  function. It imports only `minimatch` and `./constants.js`.
- **The action** keeps the reading and logging in `src/stack-detection.js` and
  `src/main.js`.
- **The wizard** gets a generated copy, `fileSelection.js`, written by
  `scripts/build-wizard-file-selection.js` with the constants inlined. It
  cannot import `src/`, because the wizard is snapshotted into
  `versioned_docs/`. Its hand-copied `splitPatternList` is gone.
- **Parity.** `test/wizard-file-selection.test.js` fails if the copy is stale,
  if the two `minimatch` ranges differ, or if sample repositories give
  different answers through the wizard's copy and templates.
- **Found on the way.** The docs site pinned `brace-expansion` to 1.x for every
  package, which `minimatch` 10 cannot load. The pin now applies to 1.x
  requests only.

For Phase 3: the wizard's templates come from `excludeLists.json`; languages
still have to be approximated from file extensions.
