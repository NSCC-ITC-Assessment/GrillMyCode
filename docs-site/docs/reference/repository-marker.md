---
sidebar_position: 7
---

# Repository marker internals

`repo_marker` marks each **student repository** in GitHub's own metadata once an assessment exists, so an instructor scanning the organization's repository list can see which repositories have questions. For an overview, see [Tracking assessed repositories](../guides/tracking-repositories.md).

## Why it needs the instructor token

Repository topics and descriptions can't be changed with the built-in `GITHUB_TOKEN` at **any** `permissions:` setting, because that token has no `administration` scope to grant. The marker therefore uses the same personal access token as the [instructor repository](instructor-repository.md). With `repo_marker` set but no `instructor_repo_token`, the run logs a warning and writes nothing. No extra `permissions:` entry is needed.

The marker is written last in the run, after the student already has their questions, and a failure never fails the run.

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

## Existing metadata is preserved

Both writes are deliberately conservative, because they edit metadata the instructor owns:

- **Topics are merged, never replaced.** GitHub's topics endpoint replaces the entire topic set — there is no add-one-topic operation, and writing a bare `["grillmycode"]` would silently delete every other topic on the repository. The action reads the current set first and writes back the union, so topics set by hand survive.
- **The description marker replaces itself.** Each run strips any marker written by a previous run before appending the current one, so a repository pushed to ten times carries one accurate marker rather than ten stale ones. Text that merely *mentions* GrillMyCode is left alone.
- **An over-long description is left untouched.** If appending the marker would push the description past GitHub's 350-character limit, the description is left exactly as it is and the run summary says so. Trimming words the instructor wrote to make room for a marker would destroy more than the marker is worth.
- **Failure is never fatal.** A marker that can't be written logs a warning and reports its status in the run summary; the run still succeeds.

## Keeping markers true: the reconciliation sweep

A marker is written when an assessment is generated, and the action only runs on a push, a tag, or a manual dispatch — so on its own, nothing ever *clears* one. A marker written by the action alone means *questions have been generated here at least once*, which drifts from *currently has a question set* the moment a student closes their assessment issue.

Enabling `repo_marker` therefore also installs **`reconcile-repo-markers.yml`** into the assignment's instructor repository, alongside the quiz workflow. Once a day it reads the live state and writes the difference:

| Repository state                                | What the sweep does       |
| ----------------------------------------------- | ------------------------- |
| Open `assessment` issue, marker present          | Nothing                   |
| Open `assessment` issue, topic missing           | Adds the topic            |
| No open `assessment` issue, topic present        | Removes the topic         |
| No open `assessment` issue, description marker   | Strips the marker         |

The open issue labelled `assessment` is the source of truth — it is what the action creates and updates for every assessment, and what the student actually reads.

**Description markers are cleared but never re-added.** The description marker carries a question count, and the sweep has no reliable way to recover it; the action puts it back on the student's next push, with a count it actually knows.

### Previewing it

Run the workflow manually from the instructor repository's Actions tab with **Report what would change** ticked. It writes nothing and reports every drift it found in the job summary — worth doing once on a live cohort before letting it write.

### What it needs

The same PAT as instructor delivery, visible to the instructor repository as `INSTRUCTOR_REPO_TOKEN`. If you followed the [Keeping a private answer key](../guides/instructor-setup.md) guide and added the PAT as an **organization-level** secret visible to private repositories, the instructor repository already inherits it and there is nothing to do. If your secret is scoped to selected repositories, add the instructor repository to that list — otherwise the job fails with a message saying exactly that.

### It winds down on its own

The sweep runs on a schedule, but the action only re-syncs it when a student pushes. An assignment nobody submits to any more would therefore keep sweeping every day on whatever version it last received — with no way for a later fix to reach it.

So a scheduled run first checks when the instructor repository was last written to. **After 10 days with no delivery** it stands down without examining anything, at a cost of one API call, and says so in the job summary. It resumes by itself the next time a student pushes; nothing needs re-enabling.

A **manual run ignores this entirely** — if you press Run, it runs, however long the assignment has been quiet. That is the way to reconcile a finished assignment one last time.

(GitHub separately disables scheduled workflows in a repository after about 60 days of inactivity, and in archived repositories. The stand-down above is the deliberate version of the same idea, and it takes effect far sooner.)

### Turning it off

Set `repo_marker` back to `off`. The next delivery re-syncs the workflow with its mode set to `off`, after which it exits immediately without examining anything — so disabling the marker disarms the sweep rather than leaving a scheduled job reconciling markers nothing writes any more.

### The zero-configuration alternative

If you would rather not run a sweep at all, this search reads live state directly and needs no setup:

```
org:<your-org> is:issue is:open label:assessment
```

That lists exactly the repositories with a live question set.

## Checking it renders where you need it

GitHub shows topics in some repository list views and not others. Before standardizing on `topic` alone, set it on one repository and confirm the chip appears in the view your instructors actually use — the organization repositories tab and the organization profile's repositories tab do not render identically. If topics do not appear where you look, use `description`, which renders everywhere.
