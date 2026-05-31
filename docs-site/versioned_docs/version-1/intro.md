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
5. Writes the assessment to a Markdown file, and optionally posts it as a PR comment, GitHub Issue, or GitHub Discussion

## Quick start

Add this to `.github/workflows/grill-my-code.yml` in the student repository:

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
```

No secrets need to be created — the default provider (GitHub Models) authenticates automatically with the built-in `GITHUB_TOKEN`.

## What you get

- **Comprehension questions** written to a Markdown file committed back to the repository under `.assessment/`
- **PR comment** (default on) with the questions posted inline on the pull request
- **GitHub Issue** (optional) — one per branch, updated in place on re-runs
- **GitHub Discussion** (optional) — forum-style record of each assessment

## Designed for GitHub Classroom

GrillMyCode is built for use with [GitHub Classroom](https://classroom.github.com/). The default configuration excludes template/starter code and bot-committed setup files, so only code written by the student after accepting the assignment is eligible for assessment.

See the [GitHub Classroom guide](./guides/github-classroom.md) for details.
