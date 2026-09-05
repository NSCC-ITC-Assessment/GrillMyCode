# {{ASSIGNMENT_NAME}} — GrillMyCode Instructor Repository

This is a **private** repository created and managed by [GrillMyCode](https://github.com/NSCC-ITC-Assessment/GrillMyCode). It collects AI-generated code comprehension assessments — including answer keys — for every student in the **{{ASSIGNMENT_NAME}}** assignment.

> [!WARNING]
> This repository contains **correct answers**. Keep it private and never share access with students.

## Generate LMS Quiz

[![Generate LMS Quiz]({{WORKFLOW_URL}}/badge.svg)]({{WORKFLOW_URL}})

`{{ASSIGNMENT_NAME}}_{studentLogin}_quiz.imscc` is generated automatically whenever a student's `questions.md` is added or updated — no manual step needed. [View workflow runs]({{WORKFLOW_URL}}), or run it manually to regenerate every student's quiz at once.

## Repository Structure

One folder is created per student, named after their GitHub login, and populated automatically each time a student pushes code.

```
{studentLogin}/
├── questions.md                                    ← AI-generated questions + answers (instructor copy)
└── {{ASSIGNMENT_NAME}}_{studentLogin}_quiz.imscc    ← IMS Common Cartridge / QTI quiz package (auto-generated)
```

## Files

### `{studentLogin}/questions.md`

The full instructor copy of the AI-generated assessment. Unlike the student-facing version, this file always includes:

- Metadata (student login, source repository, commit range, files assessed)
- All comprehension questions targeting the student's specific code submission
- **Correct answers** for every question
- Incorrect distractor options for multiple-choice quiz-style delivery

This file is created or updated automatically each time GrillMyCode runs against the student's repository.

### `{studentLogin}/{{ASSIGNMENT_NAME}}_{studentLogin}_quiz.imscc`

An IMS Common Cartridge (v1.3) package containing a QTI 1.2 multiple-choice quiz, generated from `questions.md` by the [Generate LMS Quiz](.github/workflows/generate-lms-quiz.yml) workflow. Each question carries the correct answer plus its distractors, with shuffled answer order. A question whose distractors could not be read from `questions.md` is left out of the package rather than exported on its own — a single-choice question would be a free mark for every student — so a quiz can be shorter than its `questions.md`. The workflow run names each one it left out. The filename identifies both the assignment and the student, so exported files stay identifiable once out of this folder structure. Import the file directly into Brightspace (or any other Common Cartridge / QTI-compatible LMS) as a quiz.

## Workflows

### Generate LMS Quiz (`.github/workflows/generate-lms-quiz.yml`)

Runs automatically whenever a `{studentLogin}/questions.md` file is added or modified by a push to this repository, regenerating that student's `{{ASSIGNMENT_NAME}}_{studentLogin}_quiz.imscc` — an importable Common Cartridge/QTI package — extracted from their question answers and distractors. Every run checks all students but skips any whose `questions.md` is unchanged since their quiz was last built, so normally only the student who just pushed gets a new file; a change to the quiz package format rebuilds every student's quiz in a single run.

It can also be triggered manually from the Actions tab, which regenerates quizzes for every student in the repository at once (skipping any whose questions haven't changed since their last quiz was generated) — useful after a change to the quiz format itself, or to backfill a repository that predates this workflow.

This workflow file and this README are maintained by GrillMyCode: each assessment it writes here also refreshes them if a newer version of the action has changed them, which is how fixes to quiz generation reach this repository. **Edits made to either file are replaced on the next run** — put anything you want to keep in a separate file.

#### Reading a run's annotations

A run reports anything it could not do as an annotation on the run summary. Note that a **green run can still carry warnings** — it is worth opening a successful run that shows them.

**Warnings** (run still succeeds, quizzes are committed):

- **`No distractors parsed for question …`** — that question was left out of that student's quiz, so the quiz is a question shorter than their `questions.md`. Fix the distractor formatting in the named file; the next push rebuilds it.

**Errors** (run is marked failed):

- **`Quiz generation failed for this student …`** — that one student's quiz was not rebuilt, and their existing file, if any, is untouched. Every other student's quiz was still generated and committed.
- **`Could not push regenerated quizzes …`** — nothing was saved this time. No action needed: the next run regenerates and pushes everything again.

A failure for one student never stops the others. The run finishes everyone it can and commits their quizzes _before_ reporting failure, so a red run has usually still produced most of the work.

## How This Repository Is Populated

1. A student pushes code to their assignment repository.
2. The GrillMyCode GitHub Action runs in that repository, analyses the changed files, and calls an AI model to generate comprehension questions.
3. The action writes a student-facing assessment (without answers, unless configured so) into the student's own repository.
4. The action also writes this instructor copy — with answers — to this repository under `{studentLogin}/questions.md`.
5. That write triggers the Generate LMS Quiz workflow automatically, which produces `{{ASSIGNMENT_NAME}}_{studentLogin}_quiz.imscc` for that student. Run it manually from the Actions tab any time to regenerate every student's quiz at once.

This repository is created automatically on the first assessment run and requires no manual setup beyond configuring the `instructor_repo_token` input on the GrillMyCode action.

---

<sub>Managed by [GrillMyCode](https://github.com/NSCC-ITC-Assessment/GrillMyCode)</sub>
