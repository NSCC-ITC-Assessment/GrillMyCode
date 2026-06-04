---
sidebar_position: 1
---

# Push to Default Branch

Generates assessment questions whenever a commit lands on the default branch (`main` or `master`) — whether pushed directly or merged in via a pull request. A GitHub Issue is created with the full questions and a PDF download link.

Copy this file to `.github/workflows/grill-my-code.yml` in the student repository.

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
          num_questions: "20"
          instructor_context: "Assignment 3 — Python list comprehensions"
```

## How it works

When a commit lands on `main` or `master`, GrillMyCode:

1. Creates or updates the assessment **GitHub Issue** (assigned to the student)
2. Generates a **PDF** and attaches it to the `gmc-assessments` release

Both a direct push and a pull request merge trigger identically — the assessed diff is always the student's full work history on the default branch.

## Every push regenerates the questions

Each push to the default branch triggers a full regeneration. The existing assessment issue body is **overwritten** with the new questions — the issue number and URL stay the same, but the previous questions are replaced. The PDF asset is also replaced at the same stable URL. A note comment is posted to the issue recording when the questions were regenerated and at which commit SHA.

## Manual re-run

To regenerate questions without pushing a new commit, trigger a run from the **Actions** tab — the `workflow_dispatch:` trigger in the workflow enables this.
