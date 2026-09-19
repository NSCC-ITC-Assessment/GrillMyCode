---
sidebar_position: 1.5
---

# Tag Submission

Generates assessment questions only when the student says they are done, by pushing a tag you name. Ordinary pushes do not run the workflow, so a student is grilled on their finished submission rather than on every work-in-progress commit — and each assessment costs one AI call per submission instead of one per push.

Not sure whether a tag is the right trigger for your assignment? See [Choosing a Trigger](../guides/choosing-a-trigger.md).

Copy this file to `.github/workflows/grill-my-code.yml` in the student repository.

```yaml
name: GrillMyCode

on:
  push:
    # Only tags fire the workflow — there is no branches: line, so an
    # ordinary push never starts a run. Keep this list identical to
    # submission_tags below.
    tags: ["complete"]
  workflow_dispatch:

# Re-pushing a tag cancels any run still in progress for that tag,
# so only its latest commit is ever assessed (see FAQ).
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
          # Must list the same patterns as on.push.tags above — a tag that
          # fires the workflow but is missing here fails the run.
          submission_tags: "complete"
```

:::tip
The [Workflow Wizard](../workflow-wizard.mdx) builds this for you. On the **Trigger** step, choose **Submission tag or Manual** and enter your tag names.
:::

## How a student submits

The student commits their finished work to the default branch, then tags that commit and pushes the tag:

```bash
git push
git tag complete
git push origin complete
```

To resubmit under the same tag after further changes, they move the tag to the new commit and force-push it:

```bash
git tag -f complete
git push --force origin complete
```

The re-pushed tag runs the workflow again and updates the same assessment issue.

## The two lists must match

A tag appears twice: in `on.push.tags`, which decides whether GitHub starts the workflow at all, and in the `submission_tags` input, which tells the action what a submission tag looks like. Keep them identical. If a tag fires the workflow but matches nothing in `submission_tags`, the run fails with a message saying the two lists have drifted — rather than guessing where to file the assessment.

Patterns use GitHub's filter syntax: `*` matches anything except `/`, `**` matches anything including `/`, `?` makes the preceding character optional, `+` repeats it, and `[0-9]` is a character class. `!` negation is not supported.

## The tagged commit must be on the default branch

A tag on a commit that never reached the default branch — usually an experiment on a side branch, tagged by hand — **fails the run** instead of being assessed. The red check beside the tag tells the student their submission did not register; the fix is to merge the work into the default branch, re-tag the merged commit and push the tag again.

This check applies only to tag runs. Push-triggered and manual runs on a branch behave as before.

## Milestones: several tags, one assessment each

List several tags to assess an assignment in stages:

```yaml
on:
  push:
    tags: ["phase1", "phase2", "complete"]
# ...
          submission_tags: "phase1, phase2, complete"
```

Each pattern is its own **delivery group**, with its own:

| Output | Push run | Tag run (`phase1`) |
|---|---|---|
| Assessment issue | `GrillMyCode Questions (main)` | `GrillMyCode Questions (tag: phase1)` |
| PDF asset | `grill-my-code-{repo}.pdf` | `grill-my-code-{repo}-phase1.pdf` |
| Instructor repository | `{student}/questions.md` | `{student}/phase1/questions.md` |

So `phase1`'s assessment is kept when `phase2` arrives. The group is named after the **pattern**, not the tag, so every tag matching a wildcard pattern shares one group: with `submit/*`, each new `submit/…` tag updates the same issue. When a tag matches more than one pattern, the first one listed wins.

### Assessing only the work since the previous tag

By default each tag assesses **all** of the student's work to date, exactly as a push-triggered run would (`tag_diff_base: 'cumulative'`). To assess only what changed since the previous milestone, set:

```yaml
          tag_diff_base: "previous-tag"
```

The diff then starts at the nearest earlier commit carrying any `submission_tags` tag, so `phase2` assesses only the work since `phase1`. The first tag — with nothing earlier to compare against — assesses all work to date. A manual `base_sha` still takes precedence over both.

Expose `tag_diff_base` as a [manual run override](manual-dispatch.md) to re-run a milestone the other way: pick the tag in the **Run workflow** form's *Use workflow from* list, choose the mode, and run it. A manual run started on a tag behaves exactly like that tag being pushed — same checks, same delivery group.

## Classroom 50 submission modes

Classroom 50 lets an instructor set each assignment's **submission type**, and it decides which tags a student's actions produce:

| Classroom 50 submission type | What grades | `submit/*` tags GrillMyCode can see |
|---|---|---|
| **Every push** (default) | Every push to the default branch | None. Classroom 50 tags each push itself, using the workflow's `github.token`, and GitHub never starts another workflow from such a push. |
| **Tagged commit** | Only a pushed `submit/*` tag | One per submission: `gh student submit` pushes the work, then pushes `submit/<UTC-timestamp>-<short-sha>` with the student's own credentials. |

For a **tagged commit** assignment, add `submit/*` to both lists and every `gh student submit` is assessed, all sharing one issue:

```yaml
    tags: ["submit/*"]
# ...
          submission_tags: "submit/*"
```

Students resubmit freely until the due date, and each submission is a new run, so expect one AI call per submission.

For an **every push** assignment, `gh student submit` pushes no tag of its own and so never starts a tag-triggered GrillMyCode workflow. Use instructor-named tags there instead — and if you register the same names as Classroom 50 milestone tags, one `git push origin complete` both grades and grills the student.
