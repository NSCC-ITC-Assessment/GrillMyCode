---
sidebar_position: 3.7
sidebar_label: Codebase context
---

# Codebase context

**Use this when** the code being assessed builds on other code in the repository, and you want questions about how the pieces fit together. The AI is given the rest of the project as background: every eligible file left once the usual exclusions are applied and the assessed files are set aside. In practice that's your unchanged starter code and, when each milestone is assessed on its own, the student's earlier milestones. Every question is still about the code being assessed.

```yaml title=".github/workflows/grill-my-code.yml"
name: GrillMyCode

on:
  push:
    # One tag per milestone. Keep this list identical to submission_tags below.
    tags: ["phase1", "phase2", "final"]
  workflow_dispatch:

# Re-pushing a tag cancels any run still in progress for that tag,
# so only its latest commit is ever assessed.
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
          submission_tags: "phase1, phase2, final"
          # Each milestone asks only about the work since the previous one.
          tag_diff_base: "previous-tag"
          # Give the AI the rest of the project as background: every eligible
          # file left after the exclusions and the assessed files. Here that's
          # unchanged starter code, plus earlier milestones' files this one
          # didn't touch.
          include_codebase_context: "true"
          # Maximum characters of background per run (default 50000).
          # Files nearest the assessed code are sent first.
          codebase_context_max_chars: "50000"
```

## Change these

- **The tag names**, in **both** `tags:` and `submission_tags`.
- **`codebase_context_max_chars`:** raise it for a large project, or lower it to reduce what each run costs. Leave it out to use the default.

## Good to know

- On a push trigger, or with `tag_diff_base: "cumulative"`, all of the student's work is already being assessed, so the background is your unchanged starter code only.
- Earlier work that the new milestone edited isn't background. It is assessed, with the new lines marked for questions and the earlier lines shown around them.
- A question that shows only background code is dropped. A question may show a background snippet beside the assessed code.
- The issue header shows how many background files were used; the run summary shows how many were left out for size.

## Related

[Tailoring the questions](../guides/tailoring-questions.md#let-the-ai-see-the-rest-of-the-project) · [Codebase context](../reference/code-selection.md#codebase-context) · [Milestone tags](3-milestone-tags.md)
