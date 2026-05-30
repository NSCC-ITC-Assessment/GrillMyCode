---
sidebar_position: 5
---

# OpenRouter Provider

Uses [OpenRouter](https://openrouter.ai/) to route requests to any model from a wide range of providers (Anthropic, Google, Meta, Mistral, and more) through a single API key. Useful when you want to use a model not available on GitHub Models, or want to compare outputs across different models.

Store the API key as a secret in **Settings → Secrets and variables → Actions** on the student repository.

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
          additional_context: "Web Development — REST API design with Express.js"
```

See the [OpenRouter model list](https://openrouter.ai/models) for available models and pricing. Models are specified in `provider/model-name` format (e.g. `anthropic/claude-3-5-sonnet`, `meta-llama/llama-3.1-70b-instruct`).

For full provider documentation see [AI Providers](../ai-providers).

OpenRouter gives access to models from many providers through a single API key. See the [OpenRouter model list](https://openrouter.ai/models) for available models.

For full provider documentation see [AI Providers](../ai-providers).
