---
sidebar_position: 3
---

# Getting Started

## Installation

GrillMyCode is a GitHub Action — there is nothing to install. Add a workflow file to the student or assessment repository to get started.

:::tip
Not sure which inputs to use? The [Workflow Wizard](./workflow-wizard.mdx) walks you through each option and generates the YAML for you.
:::

## Minimal workflow

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
          # If desired, uncomment this input and edit to use a different one —
          # any model from https://openrouter.ai/models (provider/model-name).
          # ai_model: "google/gemini-3.5-flash-lite"
```

Copy this file to `.github/workflows/grill-my-code.yml` in the student repository.

This workflow needs one secret: `OPENROUTER_API_KEY`. Question generation runs through [OpenRouter](./ai-providers/openrouter.md), which requires its own API key — the built-in `GITHUB_TOKEN` cannot be used for it. Add the key once as an **organisation-level** Actions secret and every student repository inherits it automatically. See the [OpenRouter setup guide](./ai-providers/openrouter.md#instructor-setup-guide) for the one-time steps.

## Trigger event

The `push` trigger fires whenever a commit lands on `main` or `master` — whether pushed directly or merged in via a pull request. Both paths are treated identically; the assessed diff is always the student's full work history on the default branch.

`workflow_dispatch:` allows a manual re-run from the **Actions** tab without pushing a new commit.

See [Example Workflows](example-workflows/pull-request) for ready-to-use files.

## Customising the questions

Use `instructor_context` to give the AI assignment-specific instructions:

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    api_key: ${{ secrets.OPENROUTER_API_KEY }}
    num_questions: '8'
    instructor_context: |
      Assignment 3 — Python loops. Prioritize execution flow questions
      that trace what a loop produces for a given input, conceptual
      questions about loop design choices, and at least one error
      identification question about off-by-one errors.
```

## Choosing a model

[OpenRouter](./ai-providers/openrouter.md) is the only supported provider, so `ai_provider` can be left out entirely. What you *can* choose is the model: `ai_model` accepts any OpenRouter model in `provider/model-name` format, and defaults to `google/gemini-3.5-flash-lite`. See [recommended models](./ai-providers/openrouter.md#recommended-models) for tested, low-cost options.

## Next steps

- Generate a custom workflow with the [Workflow Wizard](./workflow-wizard.mdx)
- Review all available [inputs and outputs](reference/inputs-outputs)
- Set up [Classroom 50](./guides/classroom50.md) integration
- Browse [example workflows](./example-workflows/pull-request.md) for ready-to-use configurations
