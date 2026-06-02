---
sidebar_position: 5
---

# OpenRouter Provider

Uses [OpenRouter](https://openrouter.ai/) to route requests to any model from a wide range of providers (Anthropic, Google, Meta, Mistral, and more) through a single API key. Useful when you want to use a model not available on GitHub Models, or want to compare outputs across different models.

### Setup

1. **Create an OpenRouter account** at [openrouter.ai](https://openrouter.ai/) and add a prepaid credit balance. Suggested start amount - $5
2. **Generate an API key** at [openrouter.ai/keys](https://openrouter.ai/keys).
3. **Store the key as an organisation-level GitHub secret** — Go to your GitHub organisation's **Settings → Secrets and variables → Actions** and create a secret named `OPENROUTER_API_KEY`. This makes the key available to all student repositories for that classroom automatically without any per-repo configuration.

Then copy the workflow file below to `.github/workflows/grill-my-code.yml` in the student repository.
```yaml
name: GrillMyCode

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write        # gmc-assessments release + PDF asset
      issues: write          # assessment issue
      pull-requests: write   # PR link comment
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          ai_provider: "openrouter"
          ai_model: "anthropic/claude-3-5-sonnet"
          api_key: ${{ secrets.OPENROUTER_API_KEY }}
          num_questions: "8"
          instructor_context: "Web Development — REST API design with Express.js"
```

See the [OpenRouter model list](https://openrouter.ai/models) for available models and pricing. Models are specified in `provider/model-name` format (e.g. `anthropic/claude-3-5-sonnet`, `meta-llama/llama-3.1-70b-instruct`).

For full provider documentation see [OpenRouter](../ai-providers/openrouter).

OpenRouter gives access to models from many providers through a single API key. See the [OpenRouter model list](https://openrouter.ai/models) for available models.

For full provider documentation see [OpenRouter](../ai-providers/openrouter).
