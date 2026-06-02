---
sidebar_position: 1
---

# Pull Request

Generates assessment questions whenever a student opens or updates a pull request. A GitHub Issue is created with the full questions and a PDF download link. A short link comment is also posted on the PR pointing to the issue.

Copy this file to `.github/workflows/grill-my-code.yml` in the student repository.

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
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          num_questions: "20"
          additional_context: "Assignment 3 — Python list comprehensions"
```

## How PR delivery works

When triggered by a pull request, GrillMyCode:

1. Creates or updates the assessment **GitHub Issue** (assigned to the student)
2. Generates a **PDF** and attaches it to the `gmc-assessments` release
3. Posts a short **link comment** on the PR pointing to the issue

The PR comment contains only the link — the full questions live in the issue, keeping the PR timeline clean.

## Update vs recreate

On re-runs (e.g. when a student pushes another commit), the existing assessment issue is updated in place rather than a new one being added, and the PDF asset is replaced at the same stable URL. A note comment is posted to the issue indicating when the questions were regenerated and at which commit SHA.

## Why pull requests?

The pull request trigger works well when:

- Students submit work via pull requests
- The instructor reviews submitted code and wants the assessment questions in a dedicated issue rather than inline on the PR
- `fetch-depth: 0` ensures the full commit history is available for diff resolution
- The diff base is automatically resolved from the PR's base branch
