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

## What a label means

Labels are written each time questions are generated, and stay on the repository after that. A label means questions have been generated for the repository at least once. To see which repositories have an assessment issue open right now, search for it directly:

```
org:<your-org> is:issue is:open label:assessment
```

## Turning it off

Set `label_repos: "false"`, or remove the line. Labels already written stay on the repository until you remove them.
