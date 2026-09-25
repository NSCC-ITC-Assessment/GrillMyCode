---
sidebar_position: 3.5
sidebar_label: Separate workflow per phase
---

# Separate workflow per phase

**Use this when** each stage of a project needs its own instructions for the AI, and each stage should be asked only about the work since the one before it. Each phase gets its own workflow file. This is the `phase2` one.

```yaml title=".github/workflows/grill-my-code-phase2.yml"
name: GrillMyCode phase 2

on:
  push:
    # This workflow runs for phase2 only. Each phase has its own file.
    tags: ["phase2"]
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
          fetch-depth: 0 # full history and tags, so phase1 can be found

      - uses: NSCC-ITC-Assessment/GrillMyCode@v0
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          api_key: ${{ secrets.OPENROUTER_API_KEY }}
          submission_tags: "phase2"
          # Assess only the work since the phase1 tag. The run fails if the
          # student hasn't pushed phase1, rather than assessing everything.
          tag_diff_base: "tag:phase1"
          instructor_context: |
            Phase 2 adds the API routes. Focus on routing and error handling.
```

## Change these

- **The tag**, in `tags:` and `submission_tags`. Each phase's file names only its own tag.
- **`tag_diff_base`:** the tag this phase compares against, spelled exactly as students push it: tag names are case-sensitive. Leave it out of the first phase's file, which has nothing earlier to compare against.
- **`instructor_context`:** what this phase should focus on.

## Good to know

- Each phase still gets its own issue, PDF and instructor-repository folder, exactly as in [Milestone tags](3-milestone-tags.md).
- Never list the same tag in two workflow files. Both would run and write to the same issue.
- To choose the tag when running a phase by hand, pick it in the branch/tag menu on the Run workflow form. Choosing `main` files the questions under the branch instead.

## Related

[Milestone tags](3-milestone-tags.md) · [Triggers in depth](../reference/triggers.md#what-each-tag-assesses)
