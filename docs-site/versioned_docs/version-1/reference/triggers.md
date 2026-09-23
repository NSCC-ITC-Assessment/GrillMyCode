---
sidebar_position: 4
---

# Triggers in depth

The workflow's `on:` block decides when GrillMyCode runs. This page covers how each trigger behaves in detail. To choose between them, see [Choosing a trigger](../guides/choosing-a-trigger.md).

## Push

```yaml
on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:
```

The workflow runs whenever a commit lands on a listed branch, whether pushed directly or merged in through a pull request. Both are treated the same, and each run assesses the student's full work to date (see [What code is assessed](code-selection.md#base)).

Listing both `main` and `master` covers either default branch name.

## Submission tags

```yaml
on:
  push:
    tags: ["phase1", "phase2", "complete"]
  workflow_dispatch:
# ...
          submission_tags: "phase1, phase2, complete"
```

With no `branches:` line, an ordinary push never starts a run. Only pushing one of the listed tags does.

### The two lists must match

A tag appears twice. `on.push.tags` decides whether GitHub starts the workflow at all. The `submission_tags` input tells the action which tags count as a submission. Keep them identical: if a tag starts the workflow but matches nothing in `submission_tags`, the run **fails** with a message saying the two lists have drifted, rather than guessing where to file the assessment.

No tag is ever inferred. Tags created by other tools, including Classroom 50's `submit/<UTC-timestamp>-<short-sha>` grading tags, never produce an assessment.

### Pattern syntax

Plain names such as `complete` or `phase1` match exactly. Wildcards use GitHub's filter syntax:

| Syntax | Matches |
|---|---|
| `*` | Any characters except `/` |
| `**` | Any characters, including `/` |
| `?` | The preceding character, optionally |
| `+` | One or more of the preceding character |
| `[0-9]` | One character from the class |

`!` negation is not supported. Patterns may use letters, digits, `.`, `_`, `/` and `-` plus the wildcards above; the Wizard rejects anything else.

A wildcard is useful when one stage can be tagged more than once. `revision*` catches `revision1`, `revision2` and so on, and files them all together.

### The tagged commit must be on the default branch

A tag on a commit that never reached the default branch, usually an experiment on a side branch, **fails the run** instead of being assessed. The red check beside the tag tells the student their submission didn't register. The fix is to merge the work into the default branch, re-tag the merged commit with `git tag -f <name>`, and push it with `git push --force origin <name>`.

This check applies only to tag runs.

### Delivery groups

Each `submission_tags` entry is its own **delivery group**, with its own issue, PDF and instructor-repository folder:

| Output | Push or manual run on a branch | Tag run (`phase1`) |
|---|---|---|
| Assessment issue | `GrillMyCode Questions (main)` | `GrillMyCode Questions (tag: phase1)` |
| PDF asset | `grill-my-code-{repo}.pdf` | `grill-my-code-{repo}-phase1.pdf` |
| Instructor repository | `{student}/questions.md` | `{student}/phase1/questions.md` |

So `phase1`'s assessment is kept when `phase2` arrives, and re-pushing `phase1` updates its own issue rather than creating a new one.

The group is named after the **entry in your list**, not the tag that matched it. Every tag matching a wildcard entry shares one group: with `revision*`, each new `revision…` tag updates the same issue. When a tag matches more than one entry, the first one listed wins.

### What each tag assesses

| `tag_diff_base` | Each tag assesses |
|---|---|
| `cumulative` (default) | All of the student's work to date, exactly like a push-triggered run |
| `previous-tag` | Only the work since the nearest earlier commit carrying any `submission_tags` tag. The first tag, with nothing earlier to compare against, assesses all work to date |

A manual `base_sha` takes precedence over both.

### Resubmitting

A student resubmits by moving the tag and force-pushing it:

```bash
git tag -f complete
git push --force origin complete
```

The re-pushed tag runs the workflow again and updates the same issue. With the instructor repository configured, every resubmission is recorded; see [Instructor repository internals](instructor-repository.md#spotting-resubmissions).

### Classroom 50 and tags

- **On a *tagged commit* assignment,** `gh student submit` grades the work in Classroom 50 but does **not** run GrillMyCode, because its `submit/…` tags are ignored. Students must also push your tag.
- **On an *every push* assignment,** nothing changes. Classroom 50 pushes its own tags with the workflow's `github.token`, which never starts another workflow.
- **Classroom 50 milestone tags** (names such as `phase1`, pushed with plain Git) fit naturally. Use the same names in `on.push.tags` and `submission_tags`, and one `git push origin phase1` both grades the milestone and generates its questions.

### Push and tags in one workflow

The Wizard offers one or the other, because a student who pushes and then tags would be assessed twice for the same work. If you want both, for example practice questions on every push plus a formal assessment at the end, use two separate workflow files, each with its own settings.

## Manual runs

`workflow_dispatch:` adds a **Run workflow** button to the Actions tab. It works alongside either trigger above.

A manual run on a branch behaves like a push to it. A manual run started on a tag, chosen in the **Use workflow from** list, behaves exactly like that tag being pushed: same checks, same delivery group.

The assessment is always attributed to the repository's owner, not to whoever started the run. See [how the assignment and student are identified](instructor-repository.md#how-the-assignment-and-student-are-identified).

### Overrides on the run form

Exposing a setting as a `workflow_dispatch` input puts it on the **Run workflow** form, so it can be changed for one run without editing the file. Each overridable setting appears twice:

```yaml
on:
  workflow_dispatch:
    inputs:
      num_questions:
        description: 'num_questions - Number of comprehension questions to generate (1-50)'
        required: false
        default: '20'
# ...
          num_questions: "${{ github.event.inputs.num_questions || '20' }}"
```

The entry under `on.workflow_dispatch.inputs` defines the form field: its label, type and pre-filled value. The expression under `with:` reads the field and falls back to the same value when nothing was supplied, which is what happens on an automatic run, where the field doesn't exist.

The two must agree, so **edit both when you change a default**. If they drift, a manual run with the form left untouched stops matching what an automatic run does.

GitHub allows at most **10** `workflow_dispatch` inputs; a workflow declaring more fails to parse.

### Which settings to expose

| Input | Why expose it |
|---|---|
| `num_questions` | Re-run with a shorter or longer question set |
| `ai_model` | Try a different model when one produces weak questions |
| `instructor_context` | Retarget the questions for one run |
| `keep_comments` | Assess a submission where the comments are themselves the work |
| `additional_exclude_patterns` | Exclude a data dump you only noticed after the first run |
| `exclude_pattern_overrides` | Bring back a file the default exclusions removed |
| `include_initial_commit` | Recover a run where the student committed everything at once |
| `tag_diff_base` | Tag-triggered workflows only: re-run a milestone cumulatively, or only since the previous tag |
| `ai_temperature` | Rarely useful; most instructors should leave this fixed |

The Wizard ticks the first six by default.

### Settings to keep out of the form

Anyone who can run the workflow can set a dispatch input, and in a Classroom 50 repository that includes the student whose work is being assessed. Some inputs should therefore stay in the file, where changing them takes a commit that is visible in the history being assessed:

- **`api_key`, `github_token`, `instructor_repo_token`.** A dispatch input is typed in plain text and recorded in the run's metadata. Never expose a secret this way.
- **`include_answers`.** It would put a "show me the answers" button on the run form.
- **`base_sha` / `head_sha`.** A range collapsed to a single commit produces an empty assessment, and the run reports it and succeeds, so nothing looks wrong at a glance.
- **`skip_committers`.** The action verifies a commit's GitHub account login before skipping it, which stops anyone impersonating a bot. It can't stop someone naming their *own* login in the list and having their leading commits trimmed out of the assessment.

`assignment_context` sits near this line. It is offered, but not ticked by default. Its globs match the student's own working tree, so a student running the workflow could point it at a file they wrote. What it can't do is empty the assessment: it only steers which topics the questions favour, and the action treats the files it reads as reference data that can't override the rubric or surface answers. The paths it matched appear in the run summary, so a re-pointed glob is visible on the run page.

### Booleans need `type: choice`

A boolean setting is declared with `type: choice` and `options: ['false', 'true']` rather than `type: boolean`, and read through `github.event.inputs.*` rather than the `inputs` context.

With a real boolean, `inputs.keep_comments` is the value `false`, and `false || 'true'` evaluates to the fallback, silently discarding a choice the instructor made. `github.event.inputs.*` always returns a string, and the non-empty string `'false'` is truthy, so the `||` fallback fires only when the field genuinely wasn't supplied.

### Multi-line instructor context

GitHub has no multi-line dispatch input, so the form gives `instructor_context` a single-line text box.

To keep a multi-line default, put it in a job-level `env` block. The `env` context is available in a step's `with:`, so automatic runs, and any run that clears the field, get it with its formatting intact:

```yaml
jobs:
  generate-questions:
    runs-on: ubuntu-latest
    env:
      GMC_DEFAULT_INSTRUCTOR_CONTEXT: |
        Assignment 3 — Python loops.
        Prioritize execution flow questions that trace what a loop produces.
        Include at least one question about off-by-one errors.
    steps:
      # ...
      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          instructor_context: '${{ github.event.inputs.instructor_context || env.GMC_DEFAULT_INSTRUCTOR_CONTEXT }}'
```

The single-line limit belongs to the web form, not to the input itself. The API accepts newlines, so the GitHub CLI can pass multi-line text on a manual run:

```bash
gh workflow run grill-my-code.yml -f instructor_context="$(cat docs/brief.md)"
```

## Overlapping runs

Every recipe includes this `concurrency` block:

```yaml
concurrency:
  group: grillmycode-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

When a new push arrives for the same branch while an earlier run is still going, GitHub **cancels the earlier run** and starts a fresh one on the latest commit:

- **Only the latest code is assessed.** The superseded run stops before it publishes, so no stale assessment is produced.
- **No duplicate or conflicting output.** Runs never overlap, so there are no duplicate issues, clashing PDF uploads or competing commits to the instructor repository.
- **A cancelled run may stop part-way.** If it had already written some output, the replacement run overwrites it, so the final state reflects the latest push. A cancelled run in the Actions tab is expected.
- **AI cost isn't spent twice, but Actions minutes are.** The cancelled run stops before it finishes generating, so OpenRouter doesn't bill for a discarded assessment. The runner time it used still counts. On public repositories runner minutes are free; on private repositories, which includes most Classroom 50 repositories, they count against your plan's allowance.

The group is per workflow **and** per ref, so pushes to different branches run independently. For a tag-triggered workflow the ref is the tag, so only a re-push of the *same* tag cancels a run; `phase1` and `phase2` pushed together both finish.

To let a running run finish and queue the newer one instead, set `cancel-in-progress: false`. It assesses the older commit first, and pays for both runs.
