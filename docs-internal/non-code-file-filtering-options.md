# Non-Code Files in Assessments — Options

> **Recorded:** 2026-09-23 (`50cef60`)
> **Status:** #1 and #6 implemented (`EDITOR_CONFIG_EXCLUDE_PATTERNS`,
> `NON_CODE_ASSET_EXCLUDE_PATTERNS`, `dropQuestionsOnUnassessedFiles`). The
> rest are options only.

Students sometimes commit files that aren't part of the solution but get
through every existing filter. For example, a `diagram.drawio` sketching what
they built. The AI then writes questions about that file. This note records
how filtering works today, why such files get through, and the options for
stopping that.

---

## Why these files get through

File filtering is a **denylist**. A changed file is assessed unless one of
these removes it:

1. **Stack-detected patterns.** Gitignore templates chosen from the repo's
   languages, root config files and dependencies (`src/stack-detection.js`,
   `resolveStack`). When detection fails, `FALLBACK_EXCLUDE_PATTERNS` in
   `src/constants.js` is used instead.
2. **`additional_exclude_patterns`.** Extra globs the instructor sets in the
   workflow. `exclude_pattern_overrides` can bring files back.
3. **Binary check.** `collectRawFiles` in `src/files.js` skips any file
   containing a null byte.

A `.drawio` file is plain XML, so it passes the binary check. No language's
gitignore template lists it either. Unless the instructor predicted it and
excluded it, the AI sees it and may write questions about it. The same applies
to `.excalidraw`, `.svg`, `.csv`, logs, editor settings and similar files.

### Editor settings before #1

Common editor files were run through `filterFiles` with the bundled templates.
Before #1, stack detection enabled an editor template only when the editor's
folder sat at the repo root, and never on the fallback list:

- **VS Code, Visual Studio:** excluded only at the root.
  `app/.vscode/settings.json` was assessed.
- **JetBrains:** only per-user files (`workspace.xml`) were excluded. The shared
  project files (`.idea/misc.xml`, `modules.xml`, `vcs.xml`, `*.iml`) were
  assessed, because the upstream template keeps them on purpose.
- **Zed, Fleet, Cursor, Eclipse, NetBeans, Sublime, `.editorconfig`,
  `.devcontainer/`:** never excluded. Bundled templates existed for most of
  them, but nothing enabled them.
- **Fallback list:** had no editor patterns at all.

---

## Options

Listed from simplest to most involved.

### 1. Always exclude common non-code file types _(Done)_

A fixed list of file types that are never solution code, applied whatever the
stack:

- Diagrams: `*.drawio`, `*.dio`, `*.excalidraw`, `*.bpmn`
- Data and logs: `*.csv`, `*.tsv`, `*.log`
- Graphics: `*.svg`
- Editor settings: `.vscode/**`, `.idea/**`

Instructors can bring any back with `exclude_pattern_overrides`. Implemented
as two named lists in `src/constants.js`, spread into both `ALWAYS_EXCLUDE`
and `FALLBACK_EXCLUDE_PATTERNS` so a failed stack detection still applies
them.

- _Pro:_ cheap, predictable, no instructor setup.
- _Con:_ always one new file type behind.

### 2. `include_patterns` input — list what counts

Instructors say what _should_ be assessed (e.g. `src/**, **/*.py`). Anything
outside that list is dropped. Unexpected files are excluded by default rather
than caught after the fact.

- _Pro:_ the most reliable fix when an assignment has a known shape.
- _Con:_ more setup per assignment. A new input touches all six locations
  listed in AGENTS.md.

### 3. Keep only files in recognised languages (automatic)

GitHub's language data classifies each language as programming, markup, data
or prose. Stack detection already calls the GitHub Languages API. An opt-in
mode could keep only files whose extension maps to a programming or markup
language and drop unknown extensions. `.drawio` isn't a recognised language,
so it would be dropped.

- _Pro:_ catches file types nobody thought to list.
- _Con:_ may drop config that matters to the assignment (`Dockerfile`, CI
  YAML, SQL), so it needs overrides.

### 4. Detect generated or non-authored content

Hand-written code has recognisable statistics. Diagrams, minified bundles and
serialised data don't. Signals:

- very long average line length
- high entropy (e.g. base64-compressed `.drawio` diagrams)
- low whitespace ratio
- known root markers such as `<mxfile`
- headers saying the file was generated

GitHub's generated-file heuristics are a good model. This would run next to
the binary check in `collectRawFiles`, logging why each file was skipped.

- _Pro:_ works without knowing the extension.
- _Con:_ heuristics need tuning; false positives on unusual but real code.

### 5. Show as reference, but never ask about it

Some of these files are useful context — a diagram can help the AI understand
the architecture. Put them in a separate prompt block marked "reference only,
do not write questions about these files", the way assignment context is
handled now. Enforce it in post-processing (see #6).

- _Pro:_ keeps the context and removes the questions. Best for question
  quality.
- _Con:_ the largest change to the prompt and post-processing.

### 6. Filter questions after generation _(Done)_

Every question must start with a bold filename header (`src/prompt.js`),
which `src/postprocess.js` already recognises. Reject or regenerate any
question whose filename isn't an assessable file.

- _Pro:_ cheap backstop for questions about files the model saw but that
  aren't assessed (assignment context, instructor context) or invented.
- _Con:_ it does **not** catch a non-code file that got past the input filters.
  That file is in the assessed set, so questions about it pass. Those cases
  still need #1's list, #2, #3 or #5.
- _Con:_ dropping leaves fewer than `num_questions`; it does not regenerate.
  It fails open (drops nothing) when every question would go, since that more
  likely means an unrecognised header format.

### 7. Let a cheap AI model sort the files first

Send a small model the changed files with sizes and the first few lines of
each. Ask it to label each one "solution code", "supporting artifact" or
"noise".

- _Pro:_ flexible; handles cases no rule covers.
- _Con:_ extra cost and run-to-run variation. Decisions must be listed in the
  job summary so instructors can check them.

### 8. List the included files in the job summary too

The job summary already lists excluded files. An "assessed files" table with
suspicious entries flagged (unknown extension, large size, very long lines)
lets instructors spot a `.drawio` after the first run and add it to
`additional_exclude_patterns`.

- _Pro:_ makes every other option easier to tune.
- _Con:_ fixes nothing on its own.

---

## What to avoid: student-controlled exclusion

Don't let students decide what is excluded — for example, by honouring their
`.gitattributes` `linguist-generated` or `linguist-documentation` settings. A
student could mark their hardest (or AI-written) code as generated and avoid
being questioned on it. The prompt already treats the student repo as
untrusted input; exclusion rules should follow the same rule. Only the
instructor's workflow inputs or instructor repo should control them.

---

## Recommendation

Start with **#1 and #6**:

- #1 fixes the `.drawio` case and similar ones immediately, with no instructor
  setup.
- #6 is a cheap backstop for questions about unassessed material. It does not
  cover file types #1 misses (see #6).

Then add **#2 or #3** as opt-in modes for instructors who want tighter
control. **#5** improves question quality the most but is the biggest change,
so leave it until the others are in place.
