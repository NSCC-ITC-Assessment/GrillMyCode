---
sidebar_position: 1
slug: /
---

# Introduction

**GrillMyCode** is a GitHub Action that analyses code changes and uses AI to generate targeted comprehension questions for conversational or written assessments.

## How it works

1. Detects the commit range from the triggering event (push or manual dispatch)
2. Collects the git diff of changed files, applying include/exclude filters
3. Strips inline and block comments from the code before sending it to the AI
4. Sends the code to an AI provider to generate comprehension questions
5. Creates or updates a GitHub Issue with the questions and generates a PDF

## Quick start

Add this to `.github/workflows/grill-my-code.yml` in the student repository:

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
```

No secrets need to be created — the default provider (GitHub Models) authenticates automatically with the built-in `GITHUB_TOKEN`.

## What you get

- **GitHub Issue** — one per branch, automatically created and assigned to the student. The issue body is overwritten with new questions on every push — the issue number and URL stay stable. Pinned in the repository on first create.
- **PDF download** — a PDF of the assessment is generated and attached to a rolling `gmc-assessments` release. A download link appears at the top of the issue.
- **Instructor copy** (optional) — a private instructor-only repository receives the full assessment including answers.

## Designed for Classroom 50

GrillMyCode was originally built for [GitHub Classroom](https://classroom.github.com/), which GitHub is discontinuing (full shutdown August 28, 2026). It now targets [Classroom 50](https://github.com/foundation50/classroom50), the open-source replacement. The default configuration excludes template/starter code and setup files, so only code written by the student after accepting the assignment is eligible for assessment.

See the [Classroom 50 guide](./guides/classroom50.md) for details.
