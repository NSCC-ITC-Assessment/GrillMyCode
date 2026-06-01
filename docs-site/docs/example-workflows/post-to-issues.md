---
sidebar_position: 3
---

# Assessment Issue & PDF

GrillMyCode always delivers the assessment as a GitHub Issue with a PDF download link — no inputs are required to enable this. This page describes how the delivery works and how to use the action outputs.

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
        id: assess
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          num_questions: "20"
          additional_context: "Assignment 2 — Data structures and algorithms"

      - name: Print issue link
        run: echo "Assessment issue ${{ steps.assess.outputs.issue_url }}"
```

## Issue assignment

The created issue is automatically assigned to the student who authored the head commit.

## Update vs recreate

If an issue already exists for the same branch, its title and body are **updated in place** — preserving the issue number, URL, and comment history. Any duplicate issues are deleted. A note comment is added each time the questions are regenerated, recording when the run occurred and at which commit SHA.

## PR link comment

When triggered by a pull request, a short link comment is automatically posted on the PR pointing to the assessment issue. This keeps the PR timeline clean without duplicating the full question set.

## PDF download

The PDF is attached to a rolling GitHub Release tagged `gmc-assessments` and linked from the issue body. The download URL is stable — re-running the action replaces the asset while keeping the same URL. The `pdf_url` output exposes it for use in downstream steps.
