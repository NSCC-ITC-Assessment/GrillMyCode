---
sidebar_position: 1
---

# GitHub Classroom

GrillMyCode is designed to work with [GitHub Classroom](https://classroom.github.com/). The default configuration automatically excludes template/starter code and bot-committed setup files, so only code written by the student after accepting the assignment is assessed.

## How it works

By default (`skip_initial_commit: 'true'`), the diff base is pinned to the repository's very first commit — the template/starter code committed by Classroom when the student accepted the assignment. This means only code written **after** the assignment was accepted is included in the diff.

In addition, the `skip_committers` input (defaulting to `github-classroom[bot],github-actions[bot]`) automatically advances the base past any consecutive bot commits that appear immediately after that first commit — for example, the feedback pull request or autograder setup commits that Classroom applies automatically.

## Recommended workflow for Classroom

```yaml
name: Grill My Code
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      models: read
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          num_questions: '20'
          additional_context: 'Assignment 3 — Python list comprehensions'
```

The defaults (`skip_initial_commit: 'true'` and `skip_committers: 'github-classroom[bot],github-actions[bot]'`) handle the Classroom-specific commit structure automatically. No additional configuration is needed.

## Including the initial commit

Set `skip_initial_commit: 'false'` to include the initial commit's eligible files in the diff — the base is pinned to the empty tree regardless of event type, so all files from the very beginning of history are eligible to be assessed.

To include truly everything (including bot-committed starter files), also set `skip_committers: ''` to prevent the base from being advanced past those initial bot commits:

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    skip_initial_commit: 'false'
    skip_committers: ''
```

## Instructor token for higher rate limits

By default, API calls to GitHub Models are authenticated with the student's `GITHUB_TOKEN`, which uses the student's own rate limit quota. For large classes with many simultaneous submissions, you may want to use an instructor's Personal Access Token instead.

See the [GitHub Models section of the AI Providers page](../ai-providers#using-an-instructor-token) for details.

## Assessment issue assignment

When `post_issue: 'true'` is set, the created issue is automatically assigned to the student who authored the head commit. The action resolves the student login by walking the commit range newest-first and skipping commits from `skip_committers` — ensuring the action's own assessment-file commit is never mistaken for a student commit.

## Private instructor repository

The action can automatically store a private copy of every assessment — including both questions and answers — in a repository that only instructors can access. See the [Instructor Setup guide](instructor-setup) for step-by-step instructions on enabling this for your classroom.
