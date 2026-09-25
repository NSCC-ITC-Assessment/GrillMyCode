---
sidebar_position: 2
---

# What code is assessed

This page describes exactly which code GrillMyCode sends to the AI, and what happens to the questions before anyone sees them. For a non-technical overview, see [How GrillMyCode works](../how-gmc-works.md).

Each run works through these stages in order:

1. Choose a **commit range**: a base commit and a head commit.
2. List the files that changed between them, and **filter** them.
3. Read the full content of each remaining file at the head commit, **strip comments**, and **mark the student's lines** in any file that existed at the base.
4. Send the code to the AI, with the remaining eligible files as [codebase context](#codebase-context) if you turned it on, and **post-process** its reply.

## 1. The commit range

### Head

The head is the commit the run is about:

| Run started by | Head |
|---|---|
| A push to a branch | The pushed commit (`after` in the push event) |
| A submission tag, pushed or run manually | The commit the tag points to |
| A manual run on a branch | The branch's latest commit |

`head_sha` overrides all of these.

### Base

The base does **not** depend on what was pushed. Every run assesses all of the student's work to date, whether it's the first push or the fiftieth.

| `include_initial_commit` | Base | Effect |
|---|---|---|
| `false` (default) | The repository's first commit | The first commit, usually the template copy, is left out |
| `true` | The empty tree | Every commit counts, including the first |

Two things can move the base later than that:

- **`tag_diff_base: previous-tag`** (tag runs only). The base becomes the nearest earlier commit carrying one of your `submission_tags`, so a tag assesses only the work since the previous one. With no earlier tag, the base above is used. **`tag_diff_base: tag:<name>`** moves it to the tag you name instead, and fails the run if it can't. See [Triggers in depth](triggers.md#what-each-tag-assesses).
- **`skip_committers`**. See [Skipping bot commits](#skipping-bot-commits).

`base_sha` overrides everything above. When both `base_sha` and `head_sha` are set, the run uses them as given and skips all other resolution.

### How this excludes Classroom 50 template code

When a student accepts a templated Classroom 50 assignment, `gh student accept` creates their repository by copying the template (`POST /repos/{template_owner}/{template_repo}/generate`). That copy is the repository's **first commit**. With the default `include_initial_commit: 'false'` it is the base, so the template's starter code is never assessed, just as under GitHub Classroom. A starter file the student hasn't changed isn't in the diff at all. In one they have changed, only their own lines are open to questions; see [Files that existed at the base](#files-that-existed-at-the-base).

`gh student accept` then adds one or two more commits straight away:

- the setup commit that writes `.classroom50.yaml` and `.github/workflows/autograde.yaml`
- an empty commit on the default branch, if the Feedback PR is opened at accept time

Neither is authored by a bot. Classroom 50 has no bot account for accept-time setup, so `skip_committers` has nothing to match. The setup files are excluded by pattern instead, whichever commit they land in:

- `.github/workflows/autograde.yaml` is covered by the always-on `.github/workflows/**` exclude.
- `.classroom50.yaml` is excluded by default.

See [Classroom 50 internals](classroom50-internals.md) for every commit Classroom 50 can make in a student repository.

### Empty-repository assignments

With `--empty-repo` the first commit is the **student's own first push**, which the default base leaves out. Set `include_initial_commit: 'true'`; see [Empty-repository assignments](../guides/classroom50.md#empty-repository-assignments).

An assignment created *without* `--empty-repo` but also without a template is seeded with a README. Its first commit is that README, so the default is correct for it.

### Including the first commit on purpose

`include_initial_commit: 'true'` pins the base to the empty tree for every event type, so all files from the very beginning of history are eligible. To also include setup files that are excluded by pattern, such as `.classroom50.yaml`, add them to `exclude_pattern_overrides`; see [File filtering](exclude-patterns.md).

### Skipping bot commits

`skip_committers` (default `github-actions[bot]`) advances the base past a **leading, unbroken run** of commits made by the listed accounts. Commits by those accounts later in history are not skipped.

A commit is skipped only when its **GitHub-verified account login** matches an entry. Author name and email are used only to find candidates cheaply; matching on them alone would let a student hide their own commits by setting their Git author name to a bot's.

Files those commits touched are also kept out of [codebase context](#codebase-context).

Set `skip_committers: ''` to turn it off.

## 2. Filtering the files

The changed files between base and head are filtered in this order:

1. **Binary files** (any file containing a null byte) are always dropped. Nothing can bring them back.
2. Files matching an **exclude pattern** are dropped, unless
3. they also match an **override** in `exclude_pattern_overrides`, which always wins.

The exclude patterns combine the always-excluded list, the patterns detected for the repository's stack, and `additional_exclude_patterns`. See [File filtering](exclude-patterns.md) for all of them.

## 3. Comment stripping and line marking

The AI is given the **full content** of each remaining file at the head commit, not only the changed lines. In a file that already existed at the base, the student's lines are marked; see [Files that existed at the base](#files-that-existed-at-the-base).

Unless `keep_comments` is `'true'`, comments are removed first, and runs of blank lines are collapsed. Stripping is done per file by a comment remover in the action's Docker image. A file type the remover doesn't support is sent unchanged, as is any file it can't process within 10 seconds.

If processing leaves no code at all, the run falls back to sending the raw diff, and says so in the run summary.

### Files that existed at the base

A file that already existed at the base commit, such as a starter file the student edited, mixes their work with code they didn't write in this range. The AI is still sent the whole file, so it can see what the student's lines do, but every line carries a marker:

| Marker | Meaning | Used for |
|---|---|---|
| `+` | Added or changed by the student in the range | Questions: every question about the file must be about at least one of these lines |
| (space) | Unchanged since the base | Context only |
| `-` | Removed by the student | Context only. It shows what the student replaced, and never appears in a question's snippet |

Files that are new in the range have no markers: every line is the student's.

The comparison is made **after** comment stripping, between the base and head versions processed the same way. Differences in line endings (CRLF and LF) and a missing final newline are ignored. So an edit that only touches comments or whitespace marks nothing.

If no file in the submission has a single added or changed line, for example because the student only edited comments, the files are sent whole without markers, and the run summary says so.

What counts as "before the range" follows the base. By default that is the first commit, so the unmarked lines are starter code. With `tag_diff_base: previous-tag` or `tag:<name>`, the unmarked lines also include the student's own work from before that tag, and the questions cover only what changed since. Earlier files the submission didn't touch at all can be sent as [codebase context](#codebase-context). With `include_initial_commit: 'true'` the base is the empty tree, so nothing is marked.

The run summary's **Files assessed** section says how many files were marked. Keeping questions to marked lines relies on the AI following its instructions: the file-name check in [After the AI replies](#4-after-the-ai-replies) can't tell lines apart within a file.

## Codebase context

By default the AI sees only the code being assessed. With `include_codebase_context: 'true'` it is also sent **the rest of the project** as background: every eligible file that's left once the exclusions are applied and the assessed files are set aside. It can then ask how the assessed code fits with the code around it: what it calls, extends or overrides, what calls it, and how data passes between them.

### What is sent

"Eligible" means exactly the same rules as for the assessment. Every file at the head commit that:

- passes the same [exclude patterns and overrides](exclude-patterns.md) as the assessed files,
- is **not** being assessed, because it didn't change between the base and the head, and
- wasn't touched by a bot commit that [`skip_committers`](#skipping-bot-commits) skipped.

A file left out of the assessment by a rule (an exclude pattern, the always-on `.github/workflows/**`, `skip_committers`, or being binary) is never sent as context either. Only files left out by the commit range are.

In practice these files come in two kinds, and which ones exist depends on the commit range:

| Kind | What it is | When there is any |
|---|---|---|
| **Starter code** | Files from the first commit that the student has never changed | Whenever `include_initial_commit` is `'false'` (the default) |
| **Earlier work** | The student's own files from before the range that this submission didn't touch | Only when the base is later than the first commit: `tag_diff_base: previous-tag` or `tag:<name>`, or a manual `base_sha` |

Some examples:

| Setup | The AI is given as context |
|---|---|
| Default: every push assesses all work to date | Unchanged starter files only. Every file the student has touched is being assessed already |
| Tag run with `tag_diff_base: previous-tag`, assessing `phase2` | Unchanged starter files, plus phase 1 files that phase 2 didn't touch |
| `include_initial_commit: 'true'`, with no later base | Nothing: the whole history is being assessed. The run log says so |
| `include_initial_commit: 'true'` with `previous-tag` | Earlier work only. The first commit is the student's, so nothing counts as starter code |

A phase 1 file that phase 2 **did** edit isn't sent as context. It is assessed, with the phase 2 lines marked and the phase 1 lines visible around them; see [Files that existed at the base](#files-that-existed-at-the-base).

Comments are stripped unless `keep_comments` is `'true'`. Binary files are skipped.

### How the AI is told to use it

- **Never a question target on its own.** Every question must show, and be about, code being assessed. A question may also show a context snippet when the answer depends on it. A question that shows **only** context files is dropped after the reply (see step 3 of [After the AI replies](#4-after-the-ai-replies)).
- **Starter code** is sent in its own block, marked as reference data. Its content is identical to the first commit, which the student can't rewrite.
- **Earlier work** is the student's own writing, so it is held to the same untrusted-input rules as the submission: the AI analyses it but never follows any instruction in it.

### Size limit

`codebase_context_max_chars` (default `50000`) caps the total. Starter code and earlier work share the limit. Files are added whole, in this order:

1. Files in the same folder as one of the assessed files.
2. Then the rest, by how many folders separate them from the nearest assessed file.
3. Ties by path, alphabetically.

A file that would go over the limit is left out, and smaller files after it are still tried. Files left out are named in the run log and counted in the run summary. Context is sent on every run, so a large limit adds to the cost of each assessment.

### Where it shows

- **Report header:** **Codebase context**, with the number of files used.
- **Run summary:** the configuration table shows the starter and earlier-work counts, the size, and how many files were left out.
- **Run log:** every file sent, by kind.

## When there is nothing to assess

A run ends early, without calling the AI or creating an issue, in two cases:

| Run summary says | Cause | What to check |
|---|---|---|
| The commit range contains no changed files | Base and head are the same commit, so nothing was compared | `include_initial_commit` for empty-repository assignments; any `base_sha`/`head_sha` override |
| All N changed files were removed by the exclude patterns | Files changed, but every one was filtered out | The summary lists the excluded files; use `exclude_pattern_overrides` to bring back the ones you need |

Both are normal straight after an assignment is accepted, so by default such a run **succeeds**. Set `fail_on_empty_assessment: 'true'` to have it fail instead, once students have started work.

## 4. After the AI replies

The reply goes through these steps before anything is delivered:

1. **Code fences repaired.** A code block the model left unopened is fixed, so the rest of the report isn't rendered as code.
2. **Extra questions cut.** Questions beyond `num_questions` are removed, and the rest are renumbered.
3. **Questions about files outside the assessment dropped.** Every question starts with the name of the file it's about. A question naming a file that wasn't assessed, such as an `assignment_context` file or a file that doesn't exist, is dropped. A [codebase context](#codebase-context) file may be named only alongside an assessed file. A name matches when it is the file's path or the end of it (`app.py` matches `src/app.py`), ignoring case. Dropped questions are logged as a warning and listed in the run summary, so a report can hold fewer than `num_questions`. If every question would be dropped, none are, and a warning asks you to check the file name headers in `raw-ai-output.md`.
4. **Answers removed for the student.** The student's copy loses its answers and multiple-choice distractors. Any question that can't be cleanly separated from its answer, or whose text would reveal it, is **withheld** from the student's copy, and the report says how many were withheld. The instructor repository copy is never affected.

The instructor repository keeps the model's reply exactly as it arrived, before any of these steps, as `raw-ai-output.md`; see [Instructor repository internals](instructor-repository.md).

This filename check can't catch a file that *is* being assessed but shouldn't be, for example a file type none of the patterns knows about. Add such files to `additional_exclude_patterns`.

## Repositories not created by Classroom 50

Everything on this page works in any GitHub repository. Only the [instructor repository](instructor-repository.md), and the features that depend on it, need Classroom 50's repository naming. In other repositories that step is skipped with a warning, and the student's issue and PDF are produced as normal.
