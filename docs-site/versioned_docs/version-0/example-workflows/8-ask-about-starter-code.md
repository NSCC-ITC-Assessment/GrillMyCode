---
sidebar_position: 3.8
sidebar_label: Ask about starter code
---

# Ask about starter code

**Use this when** students build on substantial starter code, such as a "fill in the TODOs" template, and you want a few questions to check they understand the code they were given, not only the code they wrote.

```yaml title=".github/workflows/grill-my-code.yml"
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
      contents: write # gmc-assessments release + PDF asset
      issues: write # assessment issue
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0 # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v0
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          api_key: ${{ secrets.OPENROUTER_API_KEY }}
          # Send the starter code, and allow up to one in five questions
          # about it. The rest stay on the student's own lines.
          starter_code: "ask"
```

## Change these

- **`starter_code: "context"`** if you want the starter code as background only, with no questions about it.
- **`codebase_context_max_chars`** (default `50000`) to raise or lower how much unchanged starter code is sent.

## Good to know

- Starter lines inside files the student edited count too, even if they edited them in an earlier phase, so the TODO template's surrounding code can be asked about.
- Your starter code is the same for every student, so answers to these questions can be shared.
- Questions about starter code are worded as about "the provided code", and the report header says how many there are.
- Sending the starter code makes each run cost more.

## Related

[Asking about starter code](../reference/code-selection.md#asking-about-starter-code) · [Codebase context](5-codebase-context.md) · [Tailoring the questions](../guides/tailoring-questions.md#let-the-ai-see-the-rest-of-the-project)
