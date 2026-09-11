---
sidebar_position: 2
---

# Manual Run Overrides

Settings you choose in a workflow file are fixed until you edit and commit the file again. Exposing them as `workflow_dispatch` inputs adds a form to the **Run workflow** button in the Actions tab, so you can change them for a single manual run — a different question count, a different model, a retargeted instructor context — without touching the repository.

This workflow runs on manual dispatch only. To also run automatically, add the `push:` trigger from [Push to Default Branch](pull-request.md); the overrides work the same way, and pushed runs simply use each input's default.

:::tip
The [Workflow Wizard](../workflow-wizard.mdx) builds this for you. On the **Trigger** step, expand **Manual run overrides** and tick the settings you want on the form.
:::

```yaml
name: GrillMyCode

on:
  workflow_dispatch:
    # Manual-run overrides. Starting this workflow from the Actions tab shows a
    # form pre-filled with these defaults; anything changed there applies to
    # that run only. Any run that supplies no value — a cleared field, or any
    # automatic trigger — uses the fallback baked into the matching
    # `${{ ... || '...' }}` expression below.
    #
    # Keep each default here in sync with its fallback below — they are the same
    # value in two places, and if they drift, clearing a field on the form stops
    # matching what leaving it at its default does.
    inputs:
      num_questions:
        description: 'num_questions - Number of comprehension questions to generate (1-50)'
        required: false
        default: '20'
      ai_model:
        description: 'ai_model - OpenRouter model ID in provider/model-name format'
        required: false
        default: 'google/gemini-3.5-flash-lite'
      instructor_context:
        description: 'instructor_context - Assignment context given to the AI (clear the field to use the workflow default unchanged)'
        required: false
        default: 'Assignment 3 - Python list comprehensions'
      keep_comments:
        description: 'keep_comments - Preserve code comments instead of stripping them before analysis'
        type: choice
        options: ['false', 'true']
        default: 'false'

concurrency:
  group: grillmycode-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write # gmc-assessments release + PDF asset
      issues: write # assessment issue
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0 # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          api_key: ${{ secrets.OPENROUTER_API_KEY }}
          num_questions: "${{ github.event.inputs.num_questions || '20' }}"
          ai_model: "${{ github.event.inputs.ai_model || 'google/gemini-3.5-flash-lite' }}"
          instructor_context: "${{ github.event.inputs.instructor_context || 'Assignment 3 - Python list comprehensions' }}"
          keep_comments: "${{ github.event.inputs.keep_comments || 'false' }}"
```

:::note Who the assessment is attributed to
A manually dispatched run is started by you, not by the student, so the action ignores the event's actor and resolves the student from the assessed commits — the newest non-bot commit in the range, using the GitHub account linked to its author. The assessment is filed under that student's login, and the assignment name (and therefore the instructor repository) resolves the same way it does on a pushed run.

This needs `fetch-depth: 0` on the checkout, which the workflow above already sets. If the head commit's author email is not linked to a GitHub account the action cannot identify the student, warns, and falls back to your own login — check the run's warnings before trusting the result.
:::

## How it works

Each overridable setting appears twice.

The entry under `on.workflow_dispatch.inputs` defines the form field: its label, its type, and the value the box is pre-filled with. The expression under `with:` reads that field and falls back to the same value when nothing was supplied — which is what happens on an automatic run, where the field does not exist at all.

Because the two must agree, **edit both when you change a default**. If they drift, a manual run with the form left untouched stops matching what an automatic run does.

## Choosing which settings to expose

GitHub allows at most **10** `workflow_dispatch` inputs; a workflow declaring more fails to parse. Expose only what you expect to vary between runs — a form with four fields is easier to use than one with ten.

These are the settings worth considering:

| Input | Why expose it |
| --- | --- |
| `num_questions` | Re-run with a shorter or longer question set |
| `ai_model` | Try a different model when one produces weak questions |
| `instructor_context` | Retarget the questions for one run |
| `keep_comments` | Assess a submission where the comments are themselves the work |
| `additional_exclude_patterns` | Exclude a data dump you only noticed after the first run |
| `exclude_pattern_overrides` | Pull back a file the default exclusions removed |
| `include_initial_commit` | Recover a run where the student committed everything at once |
| `ai_temperature` | Rarely useful — most instructors should leave this fixed |

## Settings to keep out of the form

Anyone who can run the workflow can set a dispatch input, and in a Classroom repository that includes the student whose work is being assessed. Some inputs should therefore stay in the file, where changing them takes a commit that is visible in the history being assessed:

- **`api_key`, `github_token`, `instructor_repo_token`** — a dispatch input is typed in plaintext and recorded in the run's metadata. Never expose a secret this way.
- **`include_answers`** — would put a "show me the answers" button on the run form.
- **`base_sha` / `head_sha`** — a range collapsed to a single commit produces an empty diff, and the run reports it and succeeds, so nothing looks wrong at a glance.
- **`skip_committers`** — the action verifies a commit's GitHub account login before skipping it, which stops someone impersonating a bot; it cannot stop someone naming their *own* login in the list and having their leading commits trimmed out of the assessment.

`assignment_context` sits near this line and is offered, but unticked by default. Its globs are matched against the student's own working tree, so a student running the workflow could point it at a file they wrote. What it cannot do is empty the assessment — it only steers which topics the questions favour, and the action treats the files it reads as reference data that cannot override the rubric or surface answers. The paths it matched appear in the run summary, so a re-pointed glob is visible on the run page. Tick it when you want to retarget a single run at a different brief; leave it off for normal cohort runs, where it should stay fixed in the file.

## Booleans need `type: choice`

A boolean setting is declared with `type: choice` and `options: ['false', 'true']` rather than `type: boolean`, and read through `github.event.inputs.*` rather than the `inputs` context.

With a real boolean, `inputs.keep_comments` is the value `false`, and `false || 'true'` evaluates to the fallback — silently discarding a choice the instructor made. `github.event.inputs.*` always returns a string, and GitHub casts the non-empty string `'false'` to true, so the `||` fallback fires only when the field genuinely was not supplied.

## Multi-line instructor context

GitHub has no multi-line dispatch input, so the form gives `instructor_context` a single-line text box.

If your context spans several lines, keep the full version in a job-level `env` block — the `env` context is available in a step's `with:`, so automatic runs and any run that clears the field get it with its formatting intact:

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

The single-line limit belongs to the web form, not to the input itself — the API accepts newlines, so the CLI can pass multi-line text on a manual run:

```bash
gh workflow run grill-my-code.yml -f instructor_context="$(cat docs/brief.md)"
```
