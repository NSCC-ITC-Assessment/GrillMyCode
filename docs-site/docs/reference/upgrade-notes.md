---
sidebar_position: 11
---

# Upgrade notes

Notes for anyone upgrading a workflow, or an instructor repository, from an earlier GrillMyCode release. The first section covers how releases reach a workflow. The notes follow it, newest changes first.

## Choosing when to upgrade

The `uses:` line of a workflow names the release it runs.

| `uses:` line ends in | Runs | Changes when |
|---|---|---|
| `@v0` | The newest v0 release | Any v0 release is published |
| `@v0.30` | The newest v0.30 release | A fix to v0.30 is published |

**`@v0` is the default.** It is what the Workflow Wizard and every example write. Fixes and new features arrive on their own, and a change that needs action is listed in the notes below.

**Name a minor version to keep an assignment unchanged,** so that every student is assessed the same way from the first push to the last. Find the newest version on the [releases page](https://github.com/NSCC-ITC-Assessment/GrillMyCode/releases) and leave off its last number: release `v0.30.2` is named as `@v0.30`. What it costs:

- **No new features, and in time no fixes.** A minor version normally stops receiving fixes once the next one is released.
- **These pages describe the newest release.** An input added after the version you named is ignored by it.
- **Moving up is yours to do.** Change the line in the template repository. Students who have already accepted get the change as they would a new workflow: see [Students who have already accepted](../getting-started/add-to-assignment.md#students-who-have-already-accepted).

Two limits:

- **An exact version is not held.** `@v0.30.2` runs the newest v0 release, as `@v0` does. Name the minor version instead.
- **Use `v0.30` or later.** An earlier minor version may run the newest v0 release.

## File patterns are more forgiving, and broad overrides no longer bring back protected files

Most workflows need no change. These apply to `additional_exclude_patterns` and `exclude_pattern_overrides`; see [Pattern syntax](exclude-patterns.md#pattern-syntax).

- **Patterns that matched nothing now work.** `data/`, `/data/**`, `./data/**` and `*.{js,ts}` are read as their author meant, and a plain name such as `data` also covers the folder of that name. Patterns may be separated by line breaks as well as commas. If a workflow carries one of these, more files are excluded or re-included than before.
- **Case is ignored** in your patterns and in the patterns always excluded, so `README.MD` and `Data/` are now matched. Auto-detected template patterns are unchanged.
- **A broad override no longer re-includes environment files, lock files or dependency folders.** `frontend/**` used to bring back `frontend/.env` and `frontend/node_modules/`. Name them to assess them: `frontend/.env`, `*.lock`, `node_modules/`. See [Protected files](exclude-patterns.md#protected-files).
- **A leading `!` or `#`** now produces a warning. What the pattern does is unchanged.

## The issue carries hidden data, and only GrillMyCode's own issues are replaced

Nothing to change in a workflow. Each assessment issue now holds its questions' numbers, files and lines as [hidden data](assessment-output.md#hidden-data), which the VS Code extension reads.

- **Issues posted by an earlier release** are still recognized, and the next run updates them as before.
- **An issue a person wrote** with the same title and the `assessment` label used to be overwritten, or deleted as a duplicate. It is now left alone. See [When the questions are regenerated](assessment-output.md#when-the-questions-are-regenerated).
- **GrillMyCode Companion 0.2.0 and earlier** read the new issues as they did the old ones.

## Quizzes are built from `data/questions.json`

Each run now writes a [`questions.json`](instructor-repository.md#questionsjson) in a `data/` subfolder of the student's folder, and the quiz workflow builds the quiz from it alone. `raw-ai-output.md` moved into `data/` too.

- **Folders assessed by an earlier release** have no `data/questions.json`, so the quiz workflow skips them. Their existing quiz files are left as they are. To rebuild a student's quiz, run GrillMyCode for that student again. The old `raw-ai-output.md` at the top of the folder isn't removed; delete it if you like.
- **To correct a question in the quiz**, edit it in `data/questions.json`. Editing `questions.md` doesn't change the quiz.

## The first run after an upgrade regenerates every student's quiz

Expected, once. The quiz workflow decides what to rebuild by comparing a content hash stored inside
each `.imscc` and `.csv`. A repository that has just received an updated workflow has no current hashes on
file, so a single run rebuilds the package for **every** student, serialized by the workflow's
concurrency group. For a class of thirty that is a long run, not a broken one — subsequent pushes
go back to rebuilding only the student who pushed.
