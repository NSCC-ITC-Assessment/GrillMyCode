---
sidebar_position: 3
---

# Assessment Issue & PDF

GrillMyCode always delivers the assessment as a GitHub Issue with a PDF download link — no inputs are required to enable this. This page describes how the delivery works and how to use the action outputs.

Copy this file to `.github/workflows/grill-my-code.yml` in the student repository.

```yaml
name: GrillMyCode

on:
  push:
    branches: [main, master]

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
        id: assess
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          num_questions: "20"
          instructor_context: "Assignment 2 — Data structures and algorithms"

      - name: Print issue link
        run: echo "Assessment issue ${{ steps.assess.outputs.issue_url }}"
```

## Issue assignment

The created issue is automatically assigned to the student who authored the head commit.

## Every push regenerates the questions

Each push to the default branch triggers a full regeneration. The existing issue body is **overwritten** with the new questions — the issue number and URL stay the same, preserving comment history. Any duplicate issues are deleted. A note comment is added each time, recording when the run occurred and at which commit SHA.

## PDF download

The PDF is attached to a rolling GitHub Release tagged `gmc-assessments` and linked from the issue body. The download URL is stable — re-running the action replaces the asset while keeping the same URL. The `pdf_url` output exposes it for use in downstream steps.
