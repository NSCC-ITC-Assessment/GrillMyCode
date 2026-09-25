---
sidebar_position: 6
sidebar_label: A more capable model
---

# A more capable model

**Use this when** the default model's questions aren't sharp enough for complex code, and you're willing to pay more per assessment for a stronger model.

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

      - uses: NSCC-ITC-Assessment/GrillMyCode@v0
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          api_key: ${{ secrets.OPENROUTER_API_KEY }}
          # Any model ID from https://openrouter.ai/models
          ai_model: "anthropic/claude-sonnet-5"
          num_questions: "8"
          instructor_context: |
            Web Development — REST API with Express.js. Prioritize
            conceptual questions about route and middleware design,
            execution flow questions that trace a request through the
            pipeline, and at least one error identification question
            about missing error-handling middleware.
```

## Change these

- **`ai_model`:** any model ID from [OpenRouter's catalogue](https://openrouter.ai/models), copied exactly.

:::warning[Check the price first]
A capable model can cost 10 to 100 times as much per assessment as the [recommended models](../ai-providers/openrouter.md#recommended-models). Check its rate at [openrouter.ai/models](https://openrouter.ai/models), and multiply by your class size and how often the workflow runs.
:::

## Good to know

- To make the same model faster or cheaper, add a routing variant: `anthropic/claude-sonnet-5:nitro` tries the fastest providers first, and `:floor` the cheapest. The questions are unchanged. See [Model routing variants](../ai-providers/openrouter.md#model-routing-variants).
- `ai_provider` isn't needed; OpenRouter is the default and only provider.

## Related

[Choosing a model and managing cost](../guides/choosing-a-model.md) · [OpenRouter](../ai-providers/openrouter.md)
