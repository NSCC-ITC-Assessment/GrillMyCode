---
sidebar_position: 6
---

# Instructor repository internals

When `instructor_repo_token` is set, GrillMyCode writes a full copy of each assessment, with questions **and** answers, to a private repository for the assignment. This page covers how that works. To set it up, see [Keeping a private answer key](../guides/instructor-setup.md).

## How the assignment and student are identified

Classroom 50 names every student repository `<classroom>-<assignment>-<username>` (lowercased), and `gh student accept` adds the accepting student to it as a direct collaborator. The action reads both names from those two facts and nothing else:

- **Student folder:** the repository's direct collaborator whose login ends the repository name. For `cs-principles-lab-3-jsmith` with direct collaborator `jsmith`, the folder is `jsmith/`.
- **Instructor repository:** everything before that login, plus `-grillmycode-instructor`, so `cs-principles-lab-3-grillmycode-instructor`. The classroom slug stays attached, which keeps two classrooms running the same assignment in separate instructor repositories.
- **Team assignments:** a team repository ends in `-group-<n>` rather than a login, and its assessment is filed under `group-<n>/`.

Who pushed, who started the run, who authored the commits and which template the repository came from play no part. Pushing a workflow file into a student's repository, or running the workflow by hand, never changes where an assessment is filed. Each run logs what it resolved; look for `Assignment: cs-principles-lab-3 · Submitter: jsmith` in the Actions log.

If a repository doesn't fit, the action doesn't guess. That covers a repository not created by Classroom 50, a student who is no longer a direct collaborator, or more than one collaborator whose login ends the name. It skips instructor delivery, raises a **workflow warning** giving the reason, and repeats the reason in the run summary. The student's issue and PDF are produced as normal.

Renaming an assignment with `gh teacher assignment rename` renames its student repositories too, so assessments made after a rename go to a new instructor repository named for the new slug.

## What each run does

1. All student-facing work (the issue, the PDF) uses the workflow's `GITHUB_TOKEN`. Only the steps below use `INSTRUCTOR_REPO_TOKEN`.
2. If the instructor repository doesn't exist, it is **created as a private repository** in the same organization.
3. The action-owned files are synced (see [below](#action-owned-files)).
4. The student's files are written to their folder, replacing any from an earlier run.
5. Writing `questions.md` triggers the **Generate LMS Quiz** workflow, which builds the student's quiz files.

Creating the repository needs the student repositories to belong to an **organization**. Under a personal account the create call fails; see [Troubleshooting](../troubleshooting.md#the-instructor-repository-is-never-created-personal-accounts) for the workaround.

A delivery failure is reported as an error annotation on the run but **doesn't fail the job**, so the student is never shown a failed assessment because of an instructor-side problem. Conflicting writes and rate limits, which are common when a whole class pushes at once, are retried up to five times. See [Troubleshooting](../troubleshooting.md#private-answer-key-instructor-repository).

## Repository layout

```
README.md                                   ← describes the repository (action-owned)
.github/workflows/
  generate-lms-quiz.yml                     ← builds the quiz files (action-owned)
  reconcile-repo-markers.yml                ← only when repo_marker is enabled (action-owned)
{student-login}/
  questions.md                              ← the assessment: questions and answers
  raw-ai-output.md                          ← the AI's unprocessed reply, for diagnosis
  {assignment}_{student-login}_quiz_{count}.imscc              ← quiz package for any LMS
  {assignment}_{student-login}_brightspace_quiz_{count}.csv    ← alternative, Brightspace only
```

For the classroom `cs-principles`, assignment `lab-3` and student `jsmith`:

- Instructor repository: `https://github.com/my-school/cs-principles-lab-3-grillmycode-instructor`
- Assessment: `jsmith/questions.md`
- Quiz package: `jsmith/cs-principles-lab-3_jsmith_quiz_20.imscc`
- Brightspace alternative: `jsmith/cs-principles-lab-3_jsmith_brightspace_quiz_20.csv`
- Raw AI output: `jsmith/raw-ai-output.md`

Each run replaces the student's files, so there is always exactly one up-to-date assessment per student (per [delivery group](triggers.md#delivery-groups)). If the question count changes, the new count appears in the quiz file names and the files carrying the old count are removed.

### Action-owned files

`README.md`, `generate-lms-quiz.yml` and, when `repo_marker` is enabled, `reconcile-repo-markers.yml` belong to the action. Every run compares them with the copies shipped in the action and rewrites any that differ, so a repository created by an older release picks up fixes by itself. Local edits to them are replaced on the next run.

Writing under `.github/workflows/` needs the token's `workflow` scope. Without it the sync logs a warning, and the assessment is still delivered; see [Upgrade notes](upgrade-notes.md#already-have-an-instructor-pat).

## `questions.md`

The instructor's copy of the report. It has the same header as the student's issue (see [The assessment issue and PDF](assessment-output.md#what-the-body-contains)), plus:

- the answer to every question, whatever `include_answers` is set to
- three multiple-choice distractors per question, used to build the quiz
- the full set of questions, including any withheld from the student's copy
- on tag runs, a **Submission** line flagging a resubmission (see [below](#spotting-resubmissions))

### Distractors depend on the token

The three wrong options per question are only needed for the quiz, and every student-facing report strips them. Runs without `instructor_repo_token` therefore ask the model for the correct answer only, which is cheaper and quicker. With the token in place, every run generates distractors. A class that adds the token mid-semester needs no other change, but assessments produced before it was added have no options to build a quiz from; re-running the workflow on those repositories regenerates them.

## `raw-ai-output.md`

A diagnostic record, not something to read or import; **`questions.md` is the assessment**. It holds the model's reply exactly as it arrived, before GrillMyCode repaired code fences, cut questions beyond `num_questions`, dropped questions about unassessed files, lifted the instructor note out of the body and renumbered the rest (see [What code is assessed](code-selection.md#4-after-the-ai-replies)).

Open it when a student's `questions.md` looks wrong. Questions that were cut or dropped, and formatting changes the processing steps made, are only visible here. Use GitHub's **Raw** view to see it as the model wrote it, and include its contents in any bug report about generated questions.

The header records how the reply was produced:

- why the model stopped. A `length` stop means it hit its output limit and the reply is incomplete.
- how many tokens went in and out
- how many attempts the request took
- the settings used: questions requested, temperature, and a short hash identifying the prompt version

The same facts, with full commit SHAs, are embedded as JSON in a `<!-- gmc:provenance … -->` comment for tooling. It is invisible in the rendered view.

## Quiz files

The **Generate LMS Quiz** workflow runs whenever a `questions.md` is written, and can be started by hand from the Actions tab.

It checks every student but skips any whose `questions.md` hasn't changed since their quiz was last built, so normally only the student who just pushed gets new files. It decides this by comparing a content hash stored inside each `.imscc` and `.csv`. A change to the quiz format, such as an updated workflow, leaves no matching hashes, so the next run rebuilds **every** student's quiz once; see [Upgrade notes](upgrade-notes.md#the-first-run-after-an-upgrade-regenerates-every-students-quiz).

The `.imscc` is an IMS Common Cartridge package with a QTI quiz, titled `{assignment} - {student-login}` and limited to one attempt. The `.csv` holds the same questions in Brightspace's question-import format, with options pre-shuffled. See [Importing quizzes into your LMS](../guides/lms-quizzes.md).

A question whose distractors can't be read from `questions.md` is left out of the quiz rather than imported with a single option. The count in the file name is the number of questions the quiz actually holds, so a short quiz can be spotted without opening it.

## Submission tag folders

With a [tag-triggered workflow](triggers.md#submission-tags), each `submission_tags` entry gets its own subfolder inside the student's folder, so a milestone's assessment is kept when the next one arrives:

```
{student-login}/
  {tag-group}/                     ← e.g. phase1 or complete
    questions.md
    raw-ai-output.md
    submissions.md                 ← every run for this tag, with a resubmission count
    history/                       ← question sets replaced by a resubmission
      1-questions.md
    {assignment}_{student-login}_{tag-group}_quiz_{count}.imscc
    {assignment}_{student-login}_{tag-group}_brightspace_quiz_{count}.csv
```

The tag group is the `submission_tags` entry reduced to filename-safe characters; for a wildcard entry such as `phase*`, that is `phase`. It appears in the quiz file names and in the quiz title shown in the LMS (`cs-principles-lab-3 - jsmith (phase1)`). Within one group, the one-up-to-date-assessment rule still applies: re-pushing a tag replaces that group's `questions.md` and rebuilds its quiz.

## Spotting resubmissions

A student can resubmit under the same tag by moving it and pushing it again. Nothing is blocked, but every resubmission is flagged in three places:

- **The assessment itself.** A resubmitted `questions.md` carries a line in its header, for example `Submission: ⚠️ resubmitted — this is the 3rd submission of phase1 (previous: 2026-09-18 14:03 UTC, a1b2c3d)`.
- **`submissions.md`** in the tag folder lists every run for that tag: the date, the trigger (tag push or manual run), who started it and the commit. It also states how many counted as student submissions.
- **`history/`** keeps each question set a resubmission replaced, as `<#>-questions.md`, numbered by the `submissions.md` row that produced it.

**What counts as a submission:** every tag push, and every manual run started by the student themselves. A manual run started by anyone else, such as your own re-run from the Actions tab, is listed in `submissions.md` but not counted, and its header says so. In a team repository there's no single student to compare against, so every run counts.

The record lives only in the instructor repository, so students can't see or edit it, and deleting and re-pushing a tag doesn't reset the count. The student's run summary also mentions a resubmission, but that count is informational; the instructor repository is the record to rely on.
