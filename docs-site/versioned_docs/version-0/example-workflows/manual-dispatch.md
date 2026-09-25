---
sidebar_position: 4
sidebar_label: Manual run overrides
---

# Manual run overrides

**Use this when** you want to change a setting for a single run, such as a different number of questions or a different model, from the **Run workflow** form in the Actions tab, without editing the file.

This workflow runs only when started by hand. To also run on every push, add the `push:` trigger from [Push to default branch](pull-request.md); automatic runs then use each setting's default.

```yaml title=".github/workflows/grill-my-code.yml"
name: GrillMyCode

on:
  workflow_dispatch:
    # Manual-run overrides. Starting this workflow from the Actions tab shows a
    # form pre-filled with these defaults; anything changed there applies to
    # that run only. Any run that supplies no value — a cleared field, or any
    # automatic trigger — uses the fallback baked into the matching
    # `${{ ... || '...' }}` expression below.
    #
    # Keep each default here in sync with its fallback below — they are the same
    # value in two places, and if they drift, clearing a field on the form stops
    # matching what leaving it at its default does.
    inputs:
      num_questions:
        description: 'num_questions - Number of comprehension questions to generate (1-50)'
        required: false
        default: '20'
      ai_model:
        description: 'ai_model - OpenRouter model ID in provider/model-name format'
        required: false
        default: 'google/gemini-3.5-flash-lite'
      instructor_context:
        description: 'instructor_context - Assignment context given to the AI (clear the field to use the workflow default unchanged)'
        required: false
        default: 'Assignment 3 - Python list comprehensions'
      keep_comments:
        description: 'keep_comments - Preserve code comments instead of stripping them before analysis'
        type: choice
        options: ['false', 'true']
        default: 'false'

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
          num_questions: "${{ github.event.inputs.num_questions || '20' }}"
          ai_model: "${{ github.event.inputs.ai_model || 'google/gemini-3.5-flash-lite' }}"
          instructor_context: "${{ github.event.inputs.instructor_context || 'Assignment 3 - Python list comprehensions' }}"
          keep_comments: "${{ github.event.inputs.keep_comments || 'false' }}"
```

## Change these

- **Which settings are on the form.** Each one appears **twice**: under `on.workflow_dispatch.inputs` (the form field) and under `with:` (reading the field, with a fallback). Add or remove both together.
- **The defaults.** When you change one, change it in **both** places, or a run with the form left untouched stops matching an automatic run.

## Good to know

- GitHub allows at most 10 fields on the form.
- Anyone who can run the workflow can fill in the form, including the student. Never put secrets, `include_answers`, `base_sha`/`head_sha` or `skip_committers` on it.
- True/false settings use `type: choice` with `'false'` and `'true'`, not `type: boolean`.
- The form can't hold multi-line text; keep a multi-line `instructor_context` in an `env` block.

The Wizard builds this for you: on the **Trigger** step, expand **Manual run overrides**.

## Related

[Running it yourself](../guides/running-manually.md) · [Triggers in depth](../reference/triggers.md#overrides-on-the-run-form), including why each rule above exists
