---
sidebar_position: 3
sidebar_label: Milestone tags
---

# Milestone tags

**Use this when** a project is handed in over several stages, and each stage should get its own assessment. Each tag gets its own issue, PDF and instructor-repository folder, so earlier stages are kept when later ones arrive.

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

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          api_key: ${{ secrets.OPENROUTER_API_KEY }}
          submission_tags: "phase1, phase2, final"
          # "cumulative" (default): each milestone asks about all work to date.
          # "previous-tag": each milestone asks only about work since the
          # previous milestone's tag.
          tag_diff_base: "cumulative"
```

## Change these

- **The tag names**, in **both** `tags:` and `submission_tags`. They must match.
- **`tag_diff_base`:** choose what later milestones ask about.

| `tag_diff_base` | `phase2` asks about | Good for |
|---|---|---|
| `cumulative` | Everything, including phase 1 | Checking the student still understands the whole project |
| `previous-tag` | Only what changed after `phase1` | Keeping each stage's questions on that stage's new code |

## Good to know

- Students submit each stage with `git tag phase1 && git push origin phase1`.
- If the assignment uses Classroom 50 milestone tags, use the same names here, and one push does both jobs.
- A wildcard such as `revision*` groups every matching tag into one issue.
- For different instructions per stage, see [Separate workflow per phase](4-phase-workflows.md).

## Related

[Submission tag](tag-submission.md) · [Triggers in depth](../reference/triggers.md#delivery-groups)
