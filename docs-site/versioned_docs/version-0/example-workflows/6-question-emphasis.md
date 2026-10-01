---
sidebar_position: 5.5
sidebar_label: Research or tracing questions
---

# Research or tracing questions

**Use this when** you want every question to send students to the documentation, or every question to be answered by running the code in their head. Research questions ask why a line is needed, what a library call does here, or what happens on an edge case. Tracing questions ask for the value a function returns, how many times a loop runs, or the order things happen in.

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
          # "research": only questions that need documentation or edge cases.
          # "tracing": only questions answered by running the code in your head.
          # "balanced" (the default): a mix.
          question_emphasis: "research"
```

## Change these

- **`question_emphasis`:** `research` or `tracing`. Remove the line to go back to a balanced mix.

## Good to know

- It's all-or-nothing. When the code is too small or too simple to supply enough good questions of that kind, the AI writes easier or repetitive ones of the same kind rather than switching.
- Every question still has one checkable answer, and one in every three is still short-answer.
- To try another emphasis on a single run, tick it in the Workflow Wizard's **Manual runs** step. It's ticked by default.

## Related

[Tailoring the questions](../guides/tailoring-questions.md#research-or-tracing) · [Question emphasis](../reference/inputs-outputs.md#question-emphasis) · [Manual dispatch](manual-dispatch.md)
