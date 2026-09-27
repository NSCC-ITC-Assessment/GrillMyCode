---
sidebar_position: 6
sidebar_label: Capable model, lower reasoning
---

# Capable model, lower reasoning

**Use this when** you want a more capable model than the default, but not the cost of the reasoning it does unless told otherwise. Some models reason at a high level by default, and on one 20-question run that reasoning was about nine-tenths of the output billed.

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
          # Any model that reasons; check its reasoning levels in the Wizard.
          ai_model: "anthropic/claude-sonnet-5"
          # Less thinking before answering. Reasoning is billed as output.
          ai_reasoning_effort: "low"
```

## Change these

- **`ai_model`:** any model from [OpenRouter's catalogue](https://openrouter.ai/models).
- **`ai_reasoning_effort`:** `none` to switch reasoning off, or a higher level if the questions at `low` fall short. Leave it out to use the model's own default.

## Good to know

- Not every model supports every level. The [Workflow Wizard](../workflow-wizard.mdx) lists only the ones your model has, and shows its price.
- `none` fails the run on a model that always reasons.
- `raw-ai-output.md` in the instructor repository shows how many output tokens were reasoning, so you can compare levels.

## Related

[Reasoning](../ai-providers/openrouter.md#reasoning) · [Choosing a model and managing cost](../guides/choosing-a-model.md)
