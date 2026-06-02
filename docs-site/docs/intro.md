---
sidebar_position: 1
slug: /
---

# Introduction

**GrillMyCode** is a GitHub Action that analyses code changes and uses AI to generate targeted comprehension questions for conversational or written assessments.

## How it works

1. Detects the commit range from the triggering event (push, pull request, etc.)
2. Collects the git diff of changed files, applying include/exclude filters
3. Strips inline and block comments from the code before sending it to the AI
4. Sends the code to an AI provider to generate comprehension questions
5. Creates or updates a GitHub Issue with the questions, generates a PDF, and posts a link comment on the PR if triggered by a pull request

## Quick start

Add this to `.github/workflows/grill-my-code.yml` in the student repository:

```yaml
name: GrillMyCode
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    permissions:
      contents: write        # gmc-assessments release + PDF asset
      issues: write          # assessment issue
      pull-requests: write   # PR link comment
      models: read           # GitHub Models API
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

No secrets need to be created — the default provider (GitHub Models) authenticates automatically with the built-in `GITHUB_TOKEN`.

## What you get

- **GitHub Issue** — one per branch, automatically created and assigned to the student. Updated in place on re-runs. Pinned in the repository on first create.
- **PDF download** — a PDF of the assessment is generated and attached to a rolling `gmc-assessments` release. A download link appears at the top of the issue.
- **PR link comment** — when triggered by a pull request, a short comment is posted on the PR linking to the assessment issue.
- **Instructor copy** (optional) — a private instructor-only repository receives the full assessment including answers.

## Designed for GitHub Classroom

GrillMyCode is built for use with [GitHub Classroom](https://classroom.github.com/). The default configuration excludes template/starter code and bot-committed setup files, so only code written by the student after accepting the assignment is eligible for assessment.

See the [GitHub Classroom guide](./guides/github-classroom.md) for details.
