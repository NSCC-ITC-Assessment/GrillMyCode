---
sidebar_position: 9
sidebar_label: Using the action's outputs
---

# Using the action's outputs

**Use this when** a later step in your workflow needs the results, for example to post the issue link somewhere else or keep a copy of the questions.

Give the GrillMyCode step an `id`, then read its outputs as `steps.<id>.outputs.<name>`:

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

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        id: assess
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          api_key: ${{ secrets.OPENROUTER_API_KEY }}

      - name: Print the assessment links
        env:
          ISSUE_URL: ${{ steps.assess.outputs.issue_url }}
          PDF_URL: ${{ steps.assess.outputs.pdf_url }}
        run: |
          echo "Issue: $ISSUE_URL"
          echo "PDF:   $PDF_URL"
```

## The outputs

| Output | Contains |
|---|---|
| `issue_url` | URL of the assessment issue |
| `issue_number` | Number of the assessment issue |
| `pdf_url` | Download URL of the PDF; empty if PDF generation failed |
| `questions` | The questions as text, without the instructor note |
| `code_before_strip` | All assessed code, before comments were removed |
| `code_after_strip` | All assessed code, after comments were removed |

## Good to know

- Pass outputs to a script through `env:`, as above, rather than writing `${{ … }}` directly inside `run:`. The questions and code contain student-written text, and putting that straight into a shell command can break the script or run something unintended.
- `questions` has no answers unless `include_answers` is on.
- A run with nothing to assess ends early, and its outputs are empty.

## Related

[Inputs and outputs](../reference/inputs-outputs.md#outputs) · [The assessment issue and PDF](../reference/assessment-output.md)
