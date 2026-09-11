---
sidebar_position: 1
---

# Classroom 50

GrillMyCode was originally built for [GitHub Classroom](https://classroom.github.com/). GitHub has discontinued Classroom — new classrooms stopped being accepted in May 2026, and the product fully shuts down on **August 28, 2026** (with Classroom-specific data deleted September 4, 2026). GrillMyCode now targets [Classroom 50](https://github.com/foundation50/classroom50), the free, open-source replacement built by the Fifty Foundation.

The default configuration automatically excludes template/starter code and setup files, so only code written by the student after accepting the assignment is eligible for assessment.

## How it works

By default (`include_initial_commit: 'false'`), the diff base is pinned to the repository's very first commit. For a templated Classroom 50 assignment, that first commit is the copy of the template made by `gh student accept` (via `POST /repos/{template_owner}/{template_repo}/generate`) — so template/starter code is excluded from the diff the same way it was under GitHub Classroom.

`gh student accept` then lands one or two further commits immediately afterwards — the setup commit that writes `.classroom50.yaml` and `.github/workflows/autograde.yaml`, and (when the Feedback PR is opened at accept time) an empty commit on the default branch. Neither is bot-authored: Classroom 50 has no bot account for accept-time setup, so there is no committer name for `skip_committers` to match. GrillMyCode excludes the setup files by pattern instead, regardless of which commit they land in:

- `.github/workflows/autograde.yaml` is covered by the always-on `.github/workflows/**` exclude.
- `.classroom50.yaml` is excluded by default.

`skip_committers` (defaulting to `github-actions[bot]`) is therefore not needed for the leading setup commits at all. It remains available for any other bot account whose commits open the assessed range.

## Classroom 50's own commits

Every commit Classroom 50's tooling makes is prefixed with `[Classroom 50]` (the `CommitPrefix` constant in the Classroom 50 CLI's shared contract). Most of them are written to the classroom's *config* repository and never reach a student repo. These are the ones that can appear in a student assignment repo:

| Commit subject | Authored by | Carries `[skip ci]` | Files touched |
| --- | --- | --- | --- |
| `Initialize .classroom50.yaml and autograde workflow (gh student accept)` | the student's own token | No | `.classroom50.yaml`, `.github/workflows/autograde.yaml`, and on a README-seeded repo the removal of that seeded `README.md` |
| `Open Feedback PR (gh student accept)` | whichever side opens the PR first — the student's token, the instructor's token, or `github-actions[bot]` in the autograde runner | Yes | None: an empty commit fast-forwarding the default branch so a zero-diff Feedback PR has a commit to exist on |
| `Submit <assignment>` | **the student** — this is their work | No | The student's full working tree, plus a refresh of the instructor's `.gitignore` and `.github` from the template |
| `Update autograder trigger to <mode> (submission-mode)` | the instructor's token, retrofitted into every existing student repo | Yes | `.github/workflows/autograde.yaml` |
| `Update assignment slug to <slug> (gh teacher assignment rename)` | the instructor's token | Yes | `.classroom50.yaml` |

None of these contaminate an assessment. Every file they touch is already excluded (`.classroom50.yaml`, `.gitignore`, and everything under `.github/workflows/**`), the Feedback-PR commit is empty, and the two instructor-side commits carry `[skip ci]`, so they never trigger a GrillMyCode run in the first place.

The last two rows are worth knowing about for a different reason: an instructor who changes an assignment's submission mode or renames it after students have accepted will see `[Classroom 50]` commits appear in student repos under their **own** name, days after accept. That is expected, and GrillMyCode ignores them.

:::caution Never filter Classroom 50 commits by their message prefix
It is tempting to treat `[Classroom 50]` as a marker for "not the student's work". It is not. `gh student submit` prefixes the student's own submission — the very code you want assessed — with `[Classroom 50] Submit <assignment>`. Filtering on the prefix would silently discard the work of every student who submits through the CLI rather than a plain `git push`. GrillMyCode deliberately filters by **file pattern** and by GitHub-verified committer identity, never by commit message.
:::

## Recommended workflow

```yaml
name: GrillMyCode

on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:

# A new push cancels any run still in progress for the same branch,
# so only the latest commit is ever assessed (see FAQ).
# Do not modify this setting unless you have a compelling reason to.
concurrency:
  group: grillmycode-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write  # gmc-assessments release + PDF asset
      issues: write    # assessment issue
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          api_key: ${{ secrets.OPENROUTER_API_KEY }}
          # If desired, uncomment this input and edit to use a different one —
          # any model from https://openrouter.ai/models (provider/model-name).
          # ai_model: "google/gemini-3.5-flash-lite"
          num_questions: '20'
          instructor_context: |
            Assignment 3 — Python loops. Prioritize execution flow
            questions that trace what a loop produces for a given input,
            and at least one error identification question about
            off-by-one errors or incorrect loop bounds.
```

Add this file to your Classroom 50 assignment's **template repository** (see [Assignment Templates](https://github.com/foundation50/classroom50/wiki/Assignment-Templates) in the Classroom 50 wiki) under `.github/workflows/`, alongside any linters or formatters — just not `.github/workflows/autograde.yaml` itself, which `gh student accept` writes and which would be clobbered by the template re-fetch on every `gh student submit` if you shipped your own copy.

The trigger fires on every push to `main` or `master` — whether the student pushes via `gh student submit` or a plain `git push`. Both paths are treated identically.

## Including the initial commit

Set `include_initial_commit: 'true'` to include the initial commit's eligible files in the diff — the base is pinned to the empty tree regardless of event type, so all files from the very beginning of history are eligible to be assessed.

To include the setup files as well, add an `exclude_pattern_overrides` entry for the specific files you want re-included (e.g. `.classroom50.yaml`) — see [Exclude Patterns](../reference/exclude-patterns).

## Empty-repository assignments

An assignment registered with `gh teacher assignment add --empty-repo` creates **bare** student repositories: no template, no README, no autograde shim, no `.classroom50.yaml` — literally zero commits. Students on these assignments don't use `gh student submit`; they commit and `git push` directly.

:::warning Set `include_initial_commit: 'true'` for empty-repository assignments
With the default `include_initial_commit: 'false'`, the diff base is pinned to the repository's first commit — and on a bare repo that first commit is **the student's own first push**, not instructor starter code. A student who commits their whole assignment at once therefore has all of it excluded, and GrillMyCode ends the run reporting that the commit range contains no changed files. The run's job summary names this case and points at `include_initial_commit`; note that by default the run still **succeeds**, so it appears as a green tick unless you open it — see [`fail_on_empty_assessment`](../reference/inputs-outputs.md).

Set `include_initial_commit: 'true'` in the workflow for any `--empty-repo` assignment. There is no template to exclude, so nothing is lost by doing so.
:::

Because there is no template repository to ship the workflow from, the GrillMyCode workflow file has to be added to each student repo directly (or pushed to them in bulk) — see [Instructor Setup](instructor-setup#assignments-without-a-starter-repo). Assignments created *without* `--empty-repo` but also without a template are seeded with a README, so their first commit is that README commit and the default `include_initial_commit: 'false'` is correct for them.

## One API key for the whole class

Question generation runs through [OpenRouter](../ai-providers/openrouter.md), and every student repository authenticates with the same instructor-owned key. Add `OPENROUTER_API_KEY` once as an **organisation-level** Actions secret and every repository Classroom 50 creates inherits it automatically — students never see or manage the key.

Because the whole class shares one key, rate limits and costs are pooled rather than per-student. Fund the OpenRouter account with a small prepaid balance and pick one of the [recommended low-cost models](../ai-providers/openrouter.md#recommended-models); at typical classroom scale these run well under a cent per assessment.

## Assessment issue assignment

The assessment issue is automatically assigned to the student the repository belongs to: the direct collaborator whose login ends the repository name (see [how the assignment and student are identified](instructor-setup#how-the-assignment-and-student-are-identified)). Who pushed or who started the run makes no difference. A team-mode repository (`…-group-<n>`) has no single owner, so its issue is left unassigned.

## Private instructor repository

The action can automatically store a private copy of every assessment — including both questions and answers — in a repository that only instructors can access. See the [Instructor Setup guide](instructor-setup) for step-by-step instructions on enabling this for your classroom, and [How the assignment and student are identified](instructor-setup#how-the-assignment-and-student-are-identified) for how both names are read from Classroom 50's `<classroom>-<assignment>-<username>` repo naming scheme.
