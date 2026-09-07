---
sidebar_position: 5
---

# Choosing a Specific Model

Every GrillMyCode workflow runs through [OpenRouter](https://openrouter.ai/), which routes requests to models from a wide range of providers (Anthropic, Google, Meta, Mistral, and more) through a single API key. This example shows a workflow pinned to a specific, higher-capability model rather than the default `google/gemini-3.5-flash-lite` — useful when you want stronger reasoning on complex assignments and are willing to pay more per assessment.

### Setup

1. **Create an OpenRouter account** at [openrouter.ai](https://openrouter.ai/) and add a prepaid credit balance. Suggested start amount - $5
2. **Generate an API key** at [openrouter.ai/keys](https://openrouter.ai/keys).
3. **Store the key as an organisation-level GitHub secret** — Go to your GitHub organisation's **Settings → Secrets and variables → Actions** and create a secret named `OPENROUTER_API_KEY`. This makes the key available to all student repositories for that classroom automatically without any per-repo configuration.

Then copy the workflow file below to `.github/workflows/grill-my-code.yml` in the student repository.
```yaml
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
          ai_model: "anthropic/claude-3-5-sonnet"
          num_questions: "8"
          instructor_context: |
            Web Development — REST API with Express.js. Prioritize
            conceptual questions about route and middleware design,
            execution flow questions that trace a request through the
            pipeline, and at least one error identification question
            about missing error-handling middleware.
```

`ai_provider` is omitted here because `openrouter` is the default. Models are specified in `provider/model-name` format (e.g. `anthropic/claude-3-5-sonnet`, `meta-llama/llama-3.1-70b-instruct`) — see the [OpenRouter model list](https://openrouter.ai/models) for what is available and what it costs.

:::warning[Check pricing before deploying to a class]
Costs vary by orders of magnitude between models. `anthropic/claude-3-5-sonnet` is considerably more expensive per assessment than the [recommended low-cost models](../ai-providers/openrouter.md#recommended-models). Verify the current rate at [openrouter.ai/models](https://openrouter.ai/models) and check it against your class size before rolling this out.
:::

For full provider documentation see [OpenRouter](../ai-providers/openrouter.md).
