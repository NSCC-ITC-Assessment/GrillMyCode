---
sidebar_position: 5
---

# The assessment issue and PDF

Every run that generates questions delivers them to the student in two fixed places: a GitHub issue and a PDF attached to a release. Neither can be turned off, and both need the permissions in [Tokens, secrets and permissions](permissions.md). For what this looks like to a student, see [What your students see](../guides/what-students-see.md).

## The issue

### Title and label

Each [delivery group](triggers.md#delivery-groups) has one issue, labelled `assessment`:

| Run | Issue title |
|---|---|
| Push, or manual run on a branch | `GrillMyCode Questions (main)`, with the branch's name |
| Submission tag `phase1` | `GrillMyCode Questions (tag: phase1)` |

### Who the issue is assigned to

The issue is assigned to the student the repository belongs to: the direct collaborator whose login ends the repository name (see [how the assignment and student are identified](instructor-repository.md#how-the-assignment-and-student-are-identified)). Who pushed or who started the run makes no difference. A team repository (`…-group-<n>`) has no single owner, so its issue isn't assigned.

### Pinning

The issue is pinned the first time it is created, so students find it at the top of their issues list. Later runs that update it don't pin it again. GitHub allows at most three pinned issues per repository; if that limit is already reached, pinning is skipped with a warning in the Actions log.

### What the body contains

A **GrillMyCode** heading with the logo, a **Download as PDF** button, then a header:

| Line | Shown |
|---|---|
| **Generated** | Always: date and time in UTC |
| **Student** / **Repository** | When known: the student's login and the `owner/repo` the questions came from. This makes each copy identifiable in the instructor repository |
| **Commits reviewed** | Always: base → head, as short SHAs |
| **Branch** | Only on a branch other than `main` or `master` |
| **Submission tag** | On tag runs, with the previous tag when `tag_diff_base` is `previous-tag` |
| **Code Files Assessed** | Always: the files that passed filtering |
| **Assignment Context** | When `assignment_context` matched any files |
| **Instructor Note** | When `instructor_context` is set: a one-sentence summary of the question focus, written by the model |

The questions follow, then a footer naming the model, provider and action version.

The student's copy never includes answers or multiple-choice distractors unless `include_answers` is `'true'`. Questions that couldn't be safely separated from their answers are withheld, and the report says how many; see [What code is assessed](code-selection.md#4-after-the-ai-replies).

### When the questions are regenerated

Every run in the same delivery group **overwrites the issue body**. The issue number, URL and comment history stay the same. A note comment is added each time, recording the commit the new questions came from:

> The assessment questions in this issue were regenerated at commit `a1b2c3d` and the questions have been updated. Any previous questions have been replaced.

Only an **open** issue with the exact title is reused. If the student closes their issue, the next run opens a new one.

If more than one open assessment issue exists for the same group, the extras are deleted. Deleting an issue needs admin rights, so if the workflow's token lacks them, the duplicates are left in place with a warning in the Actions log.

### Length limit

GitHub caps an issue body at 65,536 characters. If the report is longer than 65,000 characters, the issue body is cut short and a callout points to the PDF, which always has the full content. A warning is also logged. To avoid it, lower `num_questions` or shorten `instructor_context`.

## The PDF

The PDF is attached to a rolling GitHub release tagged `gmc-assessments` in the student's repository, and linked from the top of the issue.

### What the PDF contains

The same report as the issue body, with the GrillMyCode logo and name at the top of every page and page numbers at the bottom. Any images or HTML in the report are left out of the PDF, so nothing in it is loaded from the web.

### File name

The asset is named after the repository, `grill-my-code-{repository}.pdf`, with any character other than a letter, digit, `-` or `_` replaced by `-`:

| Repository | PDF asset |
|---|---|
| `cs-principles-lab-3-jsmith` | `grill-my-code-cs-principles-lab-3-jsmith.pdf` |
| `my.project` | `grill-my-code-my-project.pdf` |

A repository has one PDF for all its push and manual runs, so it always holds the most recent assessment, whichever branch produced it.

A tag run adds the tag's group, meaning its `submission_tags` entry reduced to the same filename-safe characters, so each milestone keeps its own PDF:

| Repository | `submission_tags` entry | PDF asset |
|---|---|---|
| `cs-principles-lab-3-jsmith` | `phase1` | `grill-my-code-cs-principles-lab-3-jsmith-phase1.pdf` |
| `cs-principles-lab-3-jsmith` | `phase*` (wildcard) | `grill-my-code-cs-principles-lab-3-jsmith-phase.pdf` |

Re-pushing a tag replaces that group's PDF, and every tag matching one wildcard entry shares a single asset.

### A stable download link

The download URL follows the pattern:

```
https://github.com/{owner}/{repo}/releases/download/gmc-assessments/{filename}
```

The release tag and file name don't change between runs, so neither does the URL. Each run replaces the asset, and the link in the issue always gives the latest version. The URL is also available as the `pdf_url` output; see [Inputs and outputs](inputs-outputs.md#outputs).

On a **private** repository, the link only works for someone signed in to GitHub with access to the repository. That is normal for release assets on private repositories.

If PDF generation fails, the issue is still created, without the PDF button, and `pdf_url` is empty.
