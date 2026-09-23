---
sidebar_position: 10
---

# Tracking assessed repositories

With a class of 30 or more, it helps to see at a glance which students have questions, and who has resubmitted. This page covers three ways to do that.

## See which repositories have questions

### A search, with no setup

This GitHub search lists every repository in your organization with a current set of questions. Replace `your-org` with your organization's name:

```
org:your-org is:issue is:open label:assessment
```

It reads the live state, so it's always accurate, and it needs no setup at all.

### Repository markers

GrillMyCode can also mark each student repository once questions exist. You can then see the mark right in your organization's repository list, without searching. There are two kinds of mark:

- **A topic.** A `grillmycode` tag on the repository. You can also filter by it, with the search `org:your-org topic:grillmycode`.
- **A note in the description.** GrillMyCode adds `· 🔥 GrillMyCode: 20 questions` to the end of the description. It's the only mark that shows the number of questions, and it appears in every list view.

You can use either or both. Choose them in the Workflow Wizard's **Instructor** step, under **Mark assessed repositories**. Markers need the [private answer key](instructor-setup.md) token, because GitHub doesn't let a workflow's built-in permissions change a repository's topics or description.

![An organization's repository list. Three student repositories show "· 🔥 GrillMyCode: 20 questions" at the end of their description and a grillmycode topic; one student's repository has neither.](/img/screenshots/org-repository-markers.png)

GrillMyCode is careful with these marks:

- It keeps any topics you've added yourself.
- It replaces its own old note rather than adding another one.
- It leaves a description alone if adding the note would make it too long for GitHub.

Once a day, a small workflow in the private repository removes marks from repositories whose assessment issue has since been closed. It stops by itself after an assignment has been quiet for 10 days.

:::tip
GitHub shows topics in some repository list views and not others. Before relying on topics alone, try one repository and check the topic appears where you look. The description note shows everywhere.
:::

## Spotting resubmissions

When students [submit with a tag](choosing-a-trigger.md#submission-tag), they can resubmit by moving the tag to a newer commit and pushing it again. GrillMyCode never blocks this, but with the [private answer key](instructor-setup.md) set up, it records every resubmission where students can't see or change it:

- **A warning in the assessment.** The student's `questions.md` in the private repository says it's a resubmission, for example *"this is the 3rd submission of phase1"*.
- **A log.** A `submissions.md` file in the tag's folder lists every run: when, what started it, who, and which commit.
- **The old questions.** Each set of questions a resubmission replaced is kept in a `history/` folder.

This matters because students see their questions (though never the answers), so re-pushing a tag is also a way to get a fresh set. By comparing the old sets with the new one, you can tell whether a student submitted new work or went looking for easier questions.

Only the student's own submissions count. A run you start yourself from the Actions tab is listed in the log, but it isn't counted as a resubmission.

---

**Go deeper:** [Repository marker internals](../reference/repository-marker.md): the daily sweep and how the marks are written · [Instructor repository internals](../reference/instructor-repository.md#spotting-resubmissions): the resubmission record · Recipe: [Repository marker](../example-workflows/2-repo-marker.md)
