---
sidebar_position: 1
---

# Pull Request

Generates assessment questions whenever a student opens or updates a pull request. Questions are posted as a PR comment so the instructor can see them inline alongside the submitted code.

Copy this file to `.github/workflows/grill-my-code.yml` in the student repository.

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
      pull-requests: write  # required to post the PR comment
      models: read          # required to call GitHub Models API
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

## Why pull requests?

The pull request trigger works well when:

- Students submit work via pull requests
- The questions appear inline on the PR, visible to both student and instructor
- `fetch-depth: 0` ensures the full commit history is available for diff resolution
- The diff base is automatically resolved from the PR's base branch
