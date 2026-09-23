---
sidebar_position: 5
sidebar_label: Assignment brief as context
---

# Assignment brief as context

**Use this when** you want the questions to follow what the assignment asked for. GrillMyCode reads your brief, rubric or requirements from the repository and gives them to the AI along with the student's code.

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
          fetch-depth: 0  # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          api_key: ${{ secrets.OPENROUTER_API_KEY }}
          num_questions: "20"
          # Files read from the student's repository and added to the prompt.
          # Comma-separated globs, matched against the path from the repo root.
          # Prefer files students have no reason to edit.
          assignment_context: "docs/brief.pdf, docs/rubric.docx"
```

## Change these

- **`assignment_context`:** the paths to your files. Plain text, PDF (`.pdf`, text only) and Word (`.doc`/`.docx`, text only) are supported.

## Good to know

- **It reads the student's copy.** A student who edits a listed file changes what the questions focus on. Keep these files somewhere students don't work, such as a `docs/` folder in your template.
- **It steers topics; it doesn't give orders.** Put anything that must happen in `instructor_context`, which takes precedence.
- Files are read in full up to 20,000 characters in total. Raise `assignment_context_max_chars` for longer documents.
- A file that can't be read produces a warning, and the run carries on without it. The files used are listed at the top of the student's issue.

## Related

[Tailoring the questions](../guides/tailoring-questions.md#share-the-assignment-brief-or-rubric) · [Inputs and outputs](../reference/inputs-outputs.md)
