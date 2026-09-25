---
sidebar_position: 2
sidebar_label: Submission tag
---

# Submission tag

**Use this when** you want to assess finished work once, when the student says they're done, rather than on every push. Ordinary pushes don't run it, and it costs one AI call per submission.

```yaml title=".github/workflows/grill-my-code.yml"
name: GrillMyCode

on:
  push:
    # Only tags start the workflow — there is no branches: line, so an
    # ordinary push never starts a run. Keep this list identical to
    # submission_tags below.
    tags: ["complete"]
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
          # Must list the same tags as on.push.tags above — a tag that
          # starts the workflow but is missing here fails the run.
          submission_tags: "complete"
```

## Change these

- **The tag name**, in **both** `tags:` and `submission_tags`. They must match.

## How a student submits

```bash
git tag complete
git push origin complete
```

To resubmit after further changes:

```bash
git tag -f complete
git push --force origin complete
```

[What your students see](../guides/what-students-see.md#what-to-tell-your-students) has wording you can copy into your assignment instructions.

## Good to know

- The tagged commit must be on the default branch, or the run fails.
- `gh student submit` alone doesn't run this. Classroom 50's own `submit/…` tags are ignored, so students must push your tag.
- Resubmissions are allowed, and recorded in the [private answer key](../guides/tracking-repositories.md#spotting-resubmissions).
- For several stages, see [Milestone tags](3-milestone-tags.md).

## Related

[Choosing a trigger](../guides/choosing-a-trigger.md#submission-tag) · [Triggers in depth](../reference/triggers.md#submission-tags)
