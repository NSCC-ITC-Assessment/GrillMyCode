---
sidebar_position: 8
---

# Assignment Context

Automatically injects assignment files (README, brief, rubric, style guide, etc.) into the AI prompt so questions are targeted to the specific requirements of the assignment — without manually copying content into `instructor_context`.

:::note Globs match the student's checked-out files
`assignment_context` globs are matched against the **student's checked-out working tree**. A path like `README.md` or `**/*.md` may pick up files the student has edited, which affects which topics the questions focus on. Prefer instructor-maintained paths (a `docs/` directory, a PDF brief, a file only the instructor commits) where possible, and use [`instructor_context`](../reference/inputs-outputs.md) for any instruction that must take effect regardless.
:::

Copy this file to `.github/workflows/grill-my-code.yml` in the student repository.

```yaml
name: GrillMyCode

on:
  push:
    branches-ignore:
      - main
      - master

# A new push cancels any run still in progress for the same branch,
# so only the latest commit is ever assessed (see FAQ).
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
          fetch-depth: 0  # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          num_questions: "20"
          # Read files from the repository and inject their contents into the
          # AI prompt automatically. Globs are matched against the full relative
          # path from the repo root, so subdirectory paths and wildcards work.
          # Prefer instructor-maintained paths — see the note above.
          assignment_context: "docs/assignment.md, docs/rubric.md"
```

## Notes

- `assignment_context` accepts a comma-separated list of glob patterns — all matching files are concatenated and injected before `instructor_context` in the prompt
- Supported file types: plain text and source files (any UTF-8 text), PDF (`.pdf` — text layer only, images ignored), Microsoft Word (`.doc`/`.docx` — text content only, images ignored)
- If a file cannot be read or parsed, a workflow warning is emitted for that file and the action continues with the remaining files
- Combined file contents are capped at `assignment_context_max_chars` characters (default `20000`) to prevent extremely large files from flooding the prompt
- Common files to include: an assignment brief, rubric, or any instructor-maintained requirements document — prefer paths the student hasn't edited
- Assignment context only influences which topics the questions target. For instructions that must take effect regardless, use `instructor_context`
