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
      models: read     # GitHub Models API
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

Copy this file to `.github/workflows/grill-my-code.yml` in the student repository. No secrets need to be created — [GitHub Models](https://github.com/marketplace/models) (the default AI provider) authenticates with the built-in `GITHUB_TOKEN`.

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
    num_questions: '8'
    instructor_context: |
      Assignment 3 — Python loops. Prioritize execution flow questions
      that trace what a loop produces for a given input, conceptual
      questions about loop design choices, and at least one error
      identification question about off-by-one errors.
```

## Choosing an AI provider

The default provider is **GitHub Models** — no setup required. To use OpenRouter instead, see the [AI Providers](./ai-providers/github-models) and [OpenRouter](./ai-providers/openrouter) pages.

## Next steps

- Generate a custom workflow with the [Workflow Wizard](./workflow-wizard.mdx)
- Review all available [inputs and outputs](reference/inputs-outputs)
- Set up [GitHub Classroom](./guides/github-classroom.md) integration
- Browse [example workflows](./example-workflows/pull-request.md) for ready-to-use configurations
