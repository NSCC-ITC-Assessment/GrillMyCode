---
sidebar_position: 4.2
sidebar_label: Two sets of questions
---

# Two sets of questions in one repository

**Use this when** one assignment needs more than one set of questions, each with its own instructions, such as a checkpoint part-way through a lab and a final review at the end, and you run each set by hand.

Each set is a workflow file of its own. The workflow's name is its set, so each one gets its own issue, PDF and instructor-repository folder, and neither replaces the other's questions. This is the checkpoint's file.

```yaml title=".github/workflows/grill-my-code-lab-3-checkpoint.yml"
name: Lab 3 checkpoint

on:
  workflow_dispatch:

# A new run cancels any run of this workflow still in progress for the same
# branch, so only the latest commit is ever assessed.
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
          # The name above is this workflow's set of questions.
          question_set: ${{ github.workflow }}
          num_questions: 10
          instructor_context: |
            This is the checkpoint. Ask about the input parsing only.
```

## Change these

- **`name:`**, in each file. Give every set a different name, such as `Lab 3 checkpoint` and `Lab 3 final`. The name appears in the issue title, so students can tell the sets apart.
- **The file name**, one per set. The Workflow Wizard names it after the set for you.
- **`instructor_context`:** what each set should focus on.

## Good to know

- Students see one issue per set, such as **GrillMyCode Questions: Lab 3 checkpoint (main)**.
- Two files with the same name are one set, and replace each other's questions.
- Renaming a workflow starts a new set from its next run. The old issue and folder are left as they are.

## Related

[Question sets](../reference/triggers.md#question-sets) · [Separate workflow per phase](4-phase-workflows.md) · [Manual run overrides](manual-dispatch.md)
