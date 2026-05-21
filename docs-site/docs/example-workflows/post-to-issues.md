---
sidebar_position: 3
---

# Post to GitHub Issues

Creates a GitHub Issue for each assessment run. Each issue title includes the branch name and head commit SHA so runs are distinct and searchable.

If an issue already exists for the same branch, its title and body are **updated in place** — the issue number, URL, and comment history are preserved. Any duplicate issues are deleted.

Copy this file to `.github/workflows/grill-my-code.yml` in the student repository.

```yaml
name: Code Assessment

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: write         # required to create the GitHub Issue
      models: read          # required to call GitHub Models API
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          post_issue: "true"
          post_pr_comment: "false"
          num_questions: "5"
          additional_context: "Assignment 2 — Data structures and algorithms"
```

## Issue assignment

The created issue is automatically assigned to the student who authored the head commit. The action resolves the student login by walking the commit range newest-first, skipping any commit whose author matches `skip_committers` — ensuring the action's own file-commit is never mistakenly attributed to a student.

## Update vs recreate

Issues are updated in place rather than deleted and recreated. This preserves:
- The issue number (stable URL)
- Instructor comments on the issue
- Issue history and activity timeline
