---
sidebar_position: 5
---

# Third-Party AI Provider (OpenAI / OpenRouter)

Uses an external AI provider instead of GitHub Models. Useful when a higher question count, a specific model, or a different provider is required.

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
          ai_provider: "openai"
          ai_model: "gpt-4o"
          api_key: ${{ secrets.OPENAI_API_KEY }}
          num_questions: "8"
          additional_context: "Web Development — REST API design with Express.js"
```

## Using OpenRouter instead

Replace `ai_provider` and `api_key` to switch to OpenRouter:

```yaml
ai_provider: "openrouter"
ai_model: "anthropic/claude-3-5-sonnet"
api_key: ${{ secrets.OPENROUTER_API_KEY }}
```

OpenRouter gives access to models from many providers through a single API key. See the [OpenRouter model list](https://openrouter.ai/models) for available models.

For full provider documentation see [AI Providers](../ai-providers).
