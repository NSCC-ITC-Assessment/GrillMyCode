---
sidebar_position: 4.5
sidebar_label: Preview the files
---

# Preview the files

**Use this when** you want to check which files a run would assess, in a real repository, before any questions are generated: before the first assessed run, or after changing a pattern.

Start the workflow by hand with **preview_only** set to **true**. Pushes, and manual runs that leave it at **false**, generate questions as usual.

```yaml title=".github/workflows/grill-my-code.yml"
name: GrillMyCode

on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:
    inputs:
      preview_only:
        description: 'preview_only - true lists the files a run would assess and the files left out, then stops: the AI is not called and no questions are produced'
        type: choice
        options: ['false', 'true']
        default: 'false'

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
      contents: write # gmc-assessments release + PDF asset
      issues: write # assessment issue
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0 # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v0
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          api_key: ${{ secrets.OPENROUTER_API_KEY }}
          # Extra files to leave out, and files to bring back. A preview run
          # shows what these do.
          additional_exclude_patterns: "data/, *.sql"
          exclude_pattern_overrides: "README.md"
          # "false" on a push, where the form field doesn't exist.
          preview_only: "${{ github.event.inputs.preview_only || 'false' }}"
```

## Change these

- **`additional_exclude_patterns` and `exclude_pattern_overrides`:** your own patterns, or remove both lines.

## Good to know

- The run summary lists the files that would be assessed, and the files left out with the pattern responsible for each.
- A preview costs nothing and works before the OpenRouter key is set up. It leaves an existing assessment as it is.
- Run it in a repository that holds some work, such as your own solution. Straight after an assignment is accepted there is nothing to assess.
- Keep the `|| 'false'` fallback. With `preview_only: "true"` written into the file, every run is a preview and no student is assessed.

The Wizard builds this for you: `preview_only` is ticked by default on its **Manual runs** step.

## Related

[Choosing which files are assessed](../guides/choosing-files.md#trying-your-patterns-first) · [Previewing in a run](../reference/exclude-patterns.md#previewing-in-a-run) · [Manual run overrides](manual-dispatch.md)
