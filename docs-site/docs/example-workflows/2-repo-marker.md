---
sidebar_position: 10
---

# Repository Marker

Marks each **student repository** in GitHub's own metadata once an assessment has been generated, so that an instructor scanning an organisation's repository list can tell at a glance which repositories have a question set — without opening any of them.

:::info Requires `instructor_repo_token`
Repository topics and descriptions cannot be reached with the built-in `GITHUB_TOKEN` at **any** `permissions:` setting, because that key has no `administration` scope to grant. The marker therefore rides on the same PAT that [instructor repository delivery](1-instructor-repo.md) already uses. With `repo_marker` set but no token configured, the run logs a warning and writes nothing.
:::

## What it writes

`repo_marker` takes one of four values:

| Value         | What it writes                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `off`         | Nothing. No repository metadata is touched. **Default.**                                          |
| `topic`       | Adds the `grillmycode` topic to the repository.                                                   |
| `description` | Appends `· 🔥 GrillMyCode: N questions` to the repository description.                            |
| `both`        | Writes both, in two separate API calls.                                                           |

The two surfaces answer slightly different questions, which is why `both` exists:

- **The topic** is the filterable one. Once it is set, `org:<your-org> topic:grillmycode` in GitHub's search box lists exactly the assessed repositories, and the topic is a clickable chip wherever GitHub renders topics.
- **The description** is the only surface that can carry the **question count**, and it renders in every repository list view GitHub has.

## Example workflow

```yaml
name: GrillMyCode

on:
  push:
    branches: [main]
  workflow_dispatch:

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
          num_questions: "20"

          # The PAT the marker needs. Also stores the instructor copy.
          instructor_repo_token: ${{ secrets.INSTRUCTOR_REPO_TOKEN }}

          # Mark the repository once questions exist.
          repo_marker: "both"
```

Note that no extra entry is needed under `permissions:` — the marker does not use `GITHUB_TOKEN` at all.

## What a marked repository looks like

Before, in the organisation's repository list:

```
appd5000-700-ica-coat-or-no-coat-frank5428
Week 3 lab
```

After a run with `repo_marker: "both"`:

```
appd5000-700-ica-coat-or-no-coat-frank5428
Week 3 lab · 🔥 GrillMyCode: 20 questions
grillmycode
```

## Existing metadata is preserved

Both writes are deliberately conservative, because they edit metadata the instructor owns:

- **Topics are merged, never replaced.** GitHub's topics endpoint replaces the entire topic set — there is no add-one-topic operation, and writing a bare `["grillmycode"]` would silently delete every other topic on the repository. The action reads the current set first and writes back the union, so topics set by hand survive.
- **The description marker replaces itself.** Each run strips any marker written by a previous run before appending the current one, so a repository pushed to ten times carries one accurate marker rather than ten stale ones. Text that merely *mentions* GrillMyCode is left alone.
- **An over-long description is left untouched.** If appending the marker would push the description past GitHub's 350-character limit, the description is left exactly as it is and the run summary says so. Trimming words the instructor wrote to make room for a marker would destroy more than the marker is worth.
- **Failure is never fatal.** By the time the marker is written the student already has their questions. A marker that cannot be written logs a warning and reports its status in the run summary; the run still succeeds.

## Staleness: what the marker actually means

A marker is written when an assessment is generated, and the action only runs on a push, a tag, or a manual dispatch. Nothing ever *clears* it. So a marker means:

> this repository has had questions generated for it at least once

which is not quite the same as *currently has an open question set*. If a student closes their assessment issue, the marker stays.

For most assignments the distinction does not matter. Where it does, the precise answer is always available from search, which reads live state rather than a stored flag:

```
org:<your-org> is:issue is:open label:assessment
```

That lists exactly the repositories with a live question set, and needs no configuration at all.

## Checking it renders where you need it

GitHub shows topics in some repository list views and not others. Before standardising on `topic` alone, set it on one repository and confirm the chip appears in the view your instructors actually use — the organisation repositories tab and the organisation profile's repositories tab do not render identically. If topics do not appear where you look, use `description`, which renders everywhere.

## Related

- [Instructor Repository Delivery](1-instructor-repo.md) — the PAT this marker shares
- [Inputs and Outputs](../reference/inputs-outputs.md) — full input reference
