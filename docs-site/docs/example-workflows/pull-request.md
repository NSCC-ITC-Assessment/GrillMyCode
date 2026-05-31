---
sidebar_position: 1
---

# Pull Request

Generates assessment questions whenever a student opens or updates a pull request. Questions are posted as a PR comment so the instructor can see them inline alongside the submitted code.

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
      contents: read
      pull-requests: write  # required to post the PR comment
      models: read          # required to call GitHub Models API
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          post_pr_comment: "true"
          num_questions: "20"
          additional_context: "Assignment 3 — Python list comprehensions"
```

## Update vs recreate

On re-runs (e.g. when a student pushes another commit), the existing assessment comment is updated in place rather than a new one being added. A follow-up note comment is posted to the PR indicating when the questions were regenerated and at which commit SHA, so the timeline shows when each run occurred.

## Why pull requests?

The pull request trigger works well when:

- Students submit work via pull requests
- The questions appear inline on the PR, visible to both student and instructor
- `fetch-depth: 0` ensures the full commit history is available for diff resolution
- The diff base is automatically resolved from the PR's base branch
