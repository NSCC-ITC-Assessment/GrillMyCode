---
sidebar_position: 7
sidebar_label: Using with Classroom 50
---

# Using GrillMyCode with Classroom 50

GrillMyCode is built for [Classroom 50](https://github.com/foundation50/classroom50), the free, open-source classroom tool from the Fifty Foundation that replaced GitHub Classroom. GitHub Classroom shut down on August 28, 2026.

Most of this already happens without you doing anything. This page covers the parts worth knowing about.

## Your starter code is never assessed

When a student accepts an assignment, Classroom 50 makes their repository as a copy of your template. GrillMyCode only looks at what changed *after* that copy, so your starter code is never assessed. It also leaves out the files Classroom 50 adds during accept, `.classroom50.yaml` and its autograding workflow.

You don't need to set anything for this. The one exception is empty-repository assignments; see [below](#empty-repository-assignments).

## Adding GrillMyCode to an assignment

Commit the workflow to the assignment's **template repository**, and every student who accepts the assignment gets it. [Get started](../getting-started/add-to-assignment.md) walks through it.

Put GrillMyCode in its own file, `.github/workflows/grill-my-code.yml`. Don't ship your own copy of `.github/workflows/autograde.yaml`. Classroom 50 writes that file during accept, and replaces it from the template each time a student runs `gh student submit`.

## `gh student submit` and submission tags

How `gh student submit` interacts with GrillMyCode depends on your [trigger](choosing-a-trigger.md):

- **Every push:** `gh student submit` pushes the student's work, so it produces questions like any other push.
- **Submission tag:** `gh student submit` does **not** produce questions. Classroom 50 makes its own `submit/…` tags for grading, and GrillMyCode deliberately ignores them. It only responds to tags *you* named. Tell students to push your tag as well, for example `git tag complete && git push origin complete`. [What your students see](what-students-see.md#what-to-tell-your-students) has wording you can copy.

**Using Classroom 50 milestone tags?** If the assignment defines milestone tags such as `phase1`, use the same names in GrillMyCode. Then one `git push origin phase1` both grades the milestone in Classroom 50 and generates its questions.

## Empty-repository assignments

An assignment created with `gh teacher assignment add --empty-repo` gives each student a completely empty repository: no template, no starter code, no setup commit. The student's own first push is the first commit.

GrillMyCode normally skips a repository's first commit, because that's usually your starter code. In an empty repository it's the student's work, so a student who commits everything at once would get no questions.

:::warning[Change one setting for empty-repository assignments]
In the Workflow Wizard's **File handling options** step, tick **Include initial (template) commit**. There's no template to leave out, so you lose nothing.
:::

There's also no template to ship the workflow from, so add the workflow file to each student's repository directly.

## One API key for the whole class

Save your OpenRouter key once as an organization secret, as in [Get started](../getting-started/openrouter-key.md), and every repository Classroom 50 creates can use it. Students never need to see or handle the key. Costs and rate limits are shared across the class; see [Choosing a model and managing cost](choosing-a-model.md).

## Who gets the questions

Each assessment issue is assigned to the student who owns the repository, worked out from the repository's name. It doesn't matter who pushed or who started the run. A team repository has no single owner, so its issue isn't assigned to anyone.

## Features that need Classroom 50

The [private answer key](instructor-setup.md) relies on Classroom 50's repository naming to tell the assignment and the student apart, and so do the LMS quizzes and resubmission tracking that come with it. Everything else in GrillMyCode works in any GitHub repository.

---

**Go deeper:** [Classroom 50 internals](../reference/classroom50-internals.md): the commits Classroom 50 makes, and why GrillMyCode ignores them · [What code is assessed](../reference/code-selection.md): how the starting point is chosen
