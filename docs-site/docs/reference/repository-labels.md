---
sidebar_position: 7
---

# Repository label internals

`label_repos` labels each **student repository** in GitHub's own metadata once an assessment exists, so an instructor scanning the organization's repository list can see which repositories have questions. It is off unless the workflow sets it; the [Workflow Wizard](../workflow-wizard.mdx) turns it on by default. For an overview, see [Tracking assessed repositories](../guides/tracking-repositories.md).

## Why it needs the instructor token

Repository topics and descriptions can't be changed with the built-in `GITHUB_TOKEN` at **any** `permissions:` setting, because that token has no `administration` scope to grant. The labels therefore use the same personal access token as the [instructor repository](instructor-repository.md). With `label_repos: "true"` but no `instructor_repo_token`, the run logs a warning and writes nothing. No extra `permissions:` entry is needed.

The labels are written last in the run, after the student already has their questions, and a failure never fails the run.

## What it writes

`label_repos` is `"true"` or `"false"` (the default). When it is `"true"`, the action writes two labels, in two separate API calls:

- **The topic** `grillmycode`, the filterable one. `org:<your-org> topic:grillmycode` in GitHub's search box lists exactly the assessed repositories, and the topic is a clickable chip wherever GitHub renders topics. GitHub shows topics in some repository list views and not others.
- **The description note** `· 🔥 GrillMyCode: N questions`, appended to the repository description. It is the only one that carries the **question count**, and it renders in every repository list view GitHub has.

The two writes are independent: if one fails, the other is still attempted, and the run summary reports each separately. `"false"` writes nothing and touches no repository metadata. Any other value fails the run.

## Existing metadata is preserved

Both writes are deliberately conservative, because they edit metadata the instructor owns:

- **Topics are merged, never replaced.** GitHub's topics endpoint replaces the entire topic set — there is no add-one-topic operation, and writing a bare `["grillmycode"]` would silently delete every other topic on the repository. The action reads the current set first and writes back the union, so topics set by hand survive.
- **The description label replaces itself.** Each run strips any label written by a previous run before appending the current one, so a repository pushed to ten times carries one accurate label rather than ten stale ones. Text that merely *mentions* GrillMyCode is left alone.
- **An over-long description is left untouched.** If appending the label would push the description past GitHub's 350-character limit, the description is left exactly as it is and the run summary says so. Trimming words the instructor wrote to make room for a label would destroy more than the label is worth.
- **Failure is never fatal.** A label that can't be written logs a warning and reports its status in the run summary; the run still succeeds.

## Keeping labels true: the reconciliation sweep

Labels are written when an assessment is generated, and the action only runs on a push, a tag, or a manual dispatch — so on its own, nothing ever *clears* them. Labels written by the action alone mean *questions have been generated here at least once*, which drifts from *currently has a question set* the moment a student closes their assessment issue.

With `label_repos` on, the action therefore also installs **`reconcile-repo-labels.yml`** into the assignment's instructor repository, alongside the quiz workflow. Once a day it reads the live state and writes the difference:

| Repository state                                | What the sweep does       |
| ----------------------------------------------- | ------------------------- |
| Open `assessment` issue, both labels present    | Nothing                   |
| Open `assessment` issue, topic missing           | Adds the topic            |
| No open `assessment` issue, topic present        | Removes the topic         |
| No open `assessment` issue, description note    | Strips the note           |

The open issue labelled `assessment` is the source of truth — it is what the action creates and updates for every assessment, and what the student actually reads.

**Description labels are cleared but never re-added.** The description label carries a question count, and the sweep has no reliable way to recover it; the action puts it back on the student's next push, with a count it actually knows.

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

Set `label_repos: "false"`, or remove the line. An assignment that starts with it off never gets the sweep. If the sweep is already in the instructor repository, the next delivery re-syncs it switched off, after which it exits immediately without examining anything — so turning off labels disarms the sweep rather than leaving a scheduled job reconciling labels nothing writes any more. Labels already written stay until you remove them.

### The zero-configuration alternative

If you would rather not run a sweep at all, this search reads live state directly and needs no setup:

```
org:<your-org> is:issue is:open label:assessment
```

That lists exactly the repositories with a live question set.
