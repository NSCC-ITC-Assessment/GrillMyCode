---
sidebar_position: 4.3
sidebar_label: Assess between two tags
---

# Assess the work between two tags

**Use this when** you want to assess one stage of a project, such as the work between `phase1` and `phase2`, and start the run yourself, for example after the deadline.

Students mark each stage by pushing a tag. Pushing one doesn't start a run: the workflow runs only when you start it, and the range is set in the file.

```yaml title=".github/workflows/grill-my-code-phase-2.yml"
name: Phase 2

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
          # Assesses only the work between these tags, whatever starts the run.
          # The run fails if a repository does not have them.
          tag_range: "phase1..phase2"
```

## Change these

- **`tag_range`:** your tag names. Leave out the second, as in `phase1..`, to assess everything since the first tag.
- **`name:`** and the file name, one per range, so each range keeps its own questions.

## Good to know

- Give students the commands, for example `git tag phase2 && git push origin phase2`. Names are case-sensitive.
- A repository without the tags fails its run and is not assessed, so the failed run tells you who hasn't tagged.
- The tag that ends the range must be on the default branch.
- Earlier work isn't assessed again, but is sent to the AI as background.

## Related

[Tag ranges](../reference/triggers.md#tag-ranges) · [Two sets of questions](11-question-sets.md) · [Milestone tags](3-milestone-tags.md)
