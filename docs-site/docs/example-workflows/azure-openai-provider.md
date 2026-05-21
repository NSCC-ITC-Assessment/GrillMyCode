---
sidebar_position: 6
---

# Azure OpenAI Provider

Uses an Azure OpenAI deployment for question generation. Suitable when institutional policy requires data to stay within an Azure tenant, or when a specific Azure deployment is already provisioned.

## Required secrets

Add these in **Settings → Secrets and variables → Actions** on the student repository:

| Secret name | Description |
|---|---|
| `AZURE_OPENAI_API_KEY` | API key for your Azure OpenAI resource |
| `AZURE_OPENAI_ENDPOINT` | Full endpoint URL, e.g. `https://my-resource.openai.azure.com/openai/deployments/my-deployment` |

Copy this file to `.github/workflows/grill-my-code.yml` in the student repository.

```yaml
name: Code Assessment

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
          ai_provider: "azure-openai"
          ai_model: "my-gpt4o-deployment"  # replace with your deployment name
          api_key: ${{ secrets.AZURE_OPENAI_API_KEY }}
          azure_endpoint: ${{ secrets.AZURE_OPENAI_ENDPOINT }}
          num_questions: "5"
          additional_context: "Cloud Computing — Azure services and deployment"
```

## Notes

- `ai_model` must be your **deployment name** (what you named it in Azure), not the underlying model name (e.g. not `gpt-4o`)
- `azure_endpoint` must be the full deployment URL including the deployment path
- The `models: read` permission is not required for Azure OpenAI — the API key is used directly

For full provider documentation see [AI Providers](../ai-providers).
