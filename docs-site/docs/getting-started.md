---
sidebar_position: 3
---

# Getting Started

## Installation

GrillMyCode is a GitHub Action — there is nothing to install. Add a workflow file to the student or assessment repository to get started.

:::tip
Not sure which inputs to use? The [Workflow Wizard](/workflow-wizard) walks you through each option and generates the YAML for you.
:::

## Minimal workflow

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
      models: read          # required to call GitHub Models API
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

Copy this file to `.github/workflows/grill-my-code.yml` in the student repository. No secrets need to be created — [GitHub Models](https://github.com/marketplace/models) (the default AI provider) authenticates with the built-in `GITHUB_TOKEN`.

## Choosing a trigger event

| Trigger | When to use |
|---|---|
| `pull_request` | Students submit work via pull requests |
| `push` | Students work directly on a branch without opening a PR |
| `issue_comment` | Re-trigger from a PR comment |

See [Example Workflows](example-workflows/pull-request) for ready-to-use files for each scenario.

## Customising the questions

Use `additional_context` to give the AI assignment-specific instructions:

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    num_questions: '8'
    additional_context: 'Assignment 3 — Python list comprehensions. Focus on when list comprehensions are appropriate versus when a regular loop should be preferred.'
```

## Choosing an AI provider

The default provider is **GitHub Models** — no setup required. To use OpenRouter instead, see the [AI Providers](ai-providers) page.

## Next steps

- Generate a custom workflow with the [Workflow Wizard](/workflow-wizard)
- Review all available [inputs and outputs](reference/inputs-outputs)
- Set up [GitHub Classroom](/docs/guides/github-classroom) integration
- Browse [example workflows](/docs/example-workflows/pull-request) for ready-to-use configurations
