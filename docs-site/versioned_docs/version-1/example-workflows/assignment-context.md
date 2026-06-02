---
sidebar_position: 8
---

# Assignment Context

Automatically injects assignment files (README, brief, rubric, style guide, etc.) into the AI prompt so questions are targeted to the specific requirements of the assignment — without manually copying content into `instructor_context`.

:::warning Point this only at instructor-controlled paths
`assignment_context` globs are matched against the **student's checked-out working tree**. A glob like `README.md` or `**/*.md` can therefore pick up files the student is able to edit. The action treats assignment context as **untrusted reference data** — it can only steer which topics the questions cover, and cannot override the rubric, change the number of questions, or reveal answers — but a student could still nudge question _focus_ by editing a matched file. Prefer paths the student does not control (an instructor-maintained `docs/` directory, or a file only the instructor commits), and use [`instructor_context`](../reference/inputs-outputs.md) for any instruction that must actually take effect.
:::

Copy this file to `.github/workflows/grill-my-code.yml` in the student repository.

```yaml
name: GrillMyCode

on:
  push:
    branches-ignore:
      - main
      - master

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write  # required to commit the output file back to the repo
      models: read     # required to call GitHub Models API
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
          # Prefer instructor-controlled paths the student cannot edit — see the
          # security note above.
          assignment_context: "docs/assignment.md, docs/rubric.md"
```

## Notes

- `assignment_context` accepts a comma-separated list of glob patterns — all matching files are concatenated and injected before `instructor_context` in the prompt
- Supported file types: plain text and source files (any UTF-8 text), PDF (`.pdf` — text layer only, images ignored), Microsoft Word (`.doc`/`.docx` — text content only, images ignored)
- If a file cannot be read or parsed, a workflow warning is emitted for that file and the action continues with the remaining files
- Combined file contents are capped at `assignment_context_max_chars` characters (default `20000`) to prevent extremely large files from flooding the prompt
- Common files to include: an assignment brief, rubric, or any instructor-maintained requirements document — prefer paths the student cannot edit (see the security note above)
- Assignment context only influences which topics the questions target; it is never treated as instructions and cannot override the assessment rules or reveal answers. For instructions that must take effect, use `instructor_context`
