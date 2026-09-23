---
sidebar_position: 1
sidebar_label: Push to default branch
---

# Push to default branch

**Use this when** you want fresh questions every time a student pushes to their main branch. It's the simplest setup, and a good first choice.

```yaml title=".github/workflows/grill-my-code.yml"
name: GrillMyCode

on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:

# A new push cancels any run still in progress for the same branch,
# so only the latest commit is ever assessed.
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
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          api_key: ${{ secrets.OPENROUTER_API_KEY }}
          # If desired, uncomment this input and edit to use a different one —
          # any model from https://openrouter.ai/models (provider/model-name).
          # ai_model: "google/gemini-3.5-flash-lite"
          num_questions: "20"
          instructor_context: |
            Assignment 3 — Python loops. Prioritize execution flow
            questions that trace what a loop produces for a given input,
            and at least one error identification question about
            off-by-one errors or incorrect loop bounds.
```

## Change these

- **`instructor_context`:** describe your assignment. See [Tailoring the questions](../guides/tailoring-questions.md#tell-the-ai-about-the-assignment).
- **`num_questions`:** anywhere from 1 to 50.

## Good to know

- A pull request merged into `main` counts as a push.
- Every run assesses all of the student's work so far and replaces the questions in the same issue.
- `workflow_dispatch:` adds a **Run workflow** button for manual runs.
- A student who pushes 20 times gets 20 runs. To assess finished work once, use a [submission tag](tag-submission.md) instead.

## Related

[Choosing a trigger](../guides/choosing-a-trigger.md) · [Triggers in depth](../reference/triggers.md#push)
