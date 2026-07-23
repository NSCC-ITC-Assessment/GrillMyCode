---
sidebar_position: 1
---

# Classroom 50

GrillMyCode was originally built for [GitHub Classroom](https://classroom.github.com/). GitHub has discontinued Classroom — new classrooms stopped being accepted in May 2026, and the product fully shuts down on **August 28, 2026** (with Classroom-specific data deleted September 4, 2026). GrillMyCode now targets [Classroom 50](https://github.com/foundation50/classroom50), the free, open-source replacement built by the Fifty Foundation.

The default configuration automatically excludes template/starter code and setup files, so only code written by the student after accepting the assignment is eligible for assessment.

## How it works

By default (`include_initial_commit: 'false'`), the diff base is pinned to the repository's very first commit. For a templated Classroom 50 assignment, that first commit is the copy of the template made by `gh student accept` (via `POST /repos/{template_owner}/{template_repo}/generate`) — so template/starter code is excluded from the diff the same way it was under GitHub Classroom.

`gh student accept` then makes a **second** commit immediately afterwards that writes `.classroom50.yaml` and `.github/workflows/autograde.yaml` to the repo. This commit is authored under the **student's own GitHub identity** — Classroom 50 has no bot account for accept-time setup, so there is no committer name for `skip_committers` to match. GrillMyCode instead excludes these two files by pattern regardless of which commit they land in:

- `.github/workflows/autograde.yaml` is covered by the always-on `.github/workflows/**` exclude.
- `.classroom50.yaml` is excluded by default.

`skip_committers` (defaulting to `github-actions[bot]`) is therefore not needed for this leading setup commit at all. It still matters for the *trailing* end of the commit range, where it's used to avoid misattributing GrillMyCode's own commits to the student when resolving who to assign the assessment issue to.

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
      models: read     # GitHub Models API
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
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

## Instructor token for higher rate limits

By default, API calls to GitHub Models are authenticated with the student's `GITHUB_TOKEN`, which uses the student's own rate limit quota. For large classes with many simultaneous submissions, you may want to use an instructor's Personal Access Token instead.

See the [GitHub Models provider](../ai-providers/github-models#using-an-instructor-token) for details.

## Assessment issue assignment

The assessment issue is automatically assigned to the student who authored the head commit. The action resolves the student login by walking the commit range newest-first and skipping commits from `skip_committers`.

## Private instructor repository

The action can automatically store a private copy of every assessment — including both questions and answers — in a repository that only instructors can access. See the [Instructor Setup guide](instructor-setup) for step-by-step instructions on enabling this for your classroom, and the [Assignment Templates and instructor-repo naming](instructor-setup#assignments-without-a-starter-repo) notes for how the assignment name is resolved on Classroom 50's `<classroom>-<assignment>-<username>` repo naming scheme.
