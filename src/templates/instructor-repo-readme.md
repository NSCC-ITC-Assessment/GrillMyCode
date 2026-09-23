# <img src="{{LOGO_URL}}" alt="" height="{{LOGO_HEIGHT}}" align="absmiddle"> {{ASSIGNMENT_NAME}} — GrillMyCode Instructor Repository

This is a **private** repository created and managed by [GrillMyCode](https://github.com/NSCC-ITC-Assessment/GrillMyCode). It collects AI-generated code comprehension assessments — including answer keys — for every student in the **{{ASSIGNMENT_NAME}}** assignment.

> [!WARNING]
> This repository contains **correct answers**. Keep it private and never share access with students.

## Generate LMS Quiz

[![Generate LMS Quiz]({{WORKFLOW_URL}}/badge.svg)]({{WORKFLOW_URL}})

`{{ASSIGNMENT_NAME}}_{studentLogin}_quiz_{questionCount}.imscc` is generated automatically whenever a student's `questions.md` is added or updated — no manual step needed. [View workflow runs]({{WORKFLOW_URL}}), or run it manually to regenerate every student's quiz at once.

**Which file do I import?**

- **Any LMS:** use the `.imscc`. Common Cartridge is an open standard that most major LMS platforms can import — including Brightspace, Canvas, Moodle, Blackboard Learn and Sakai.
- **Brightspace only:** you can use `{{ASSIGNMENT_NAME}}_{studentLogin}_brightspace_quiz_{questionCount}.csv` instead. It holds the same questions in Brightspace's own question-import format. No other LMS can read it — if you are not on Brightspace, ignore it.

## Reconcile Repository Markers

Present only when the assignment's workflow sets `repo_marker`. GrillMyCode marks each student repository — a `grillmycode` topic, a note in the repository description, or both — when it generates an assessment, so you can tell which repositories have a question set from the organisation's repository list.

Nothing in the assessment run ever _clears_ a marker, because the action only runs when a student pushes. `reconcile-repo-markers.yml` closes that gap: once a day it compares every repository in this assignment against the live state — an open issue labelled `assessment` is the source of truth — and adds or removes markers to match. Run it from the Actions tab with **Report what would change** ticked to preview it without writing anything.

A scheduled run stands down after 10 days with no delivery to this repository — an assignment that is over stops sweeping on its own, and resumes if a student pushes again. Starting it manually from the Actions tab ignores that check, which is how to reconcile a finished assignment one last time.

It needs the same PAT as instructor delivery, read from an `INSTRUCTOR_REPO_TOKEN` secret this repository can see. An organisation-level secret visible to private repositories covers it with no per-assignment setup; without the secret the job fails with a message saying so. Description markers are cleared by the sweep but never re-added, because only the action knows the question count.

## Repository Structure

One folder is created per student, named after their GitHub login, and populated automatically each time a student pushes code.

```
{studentLogin}/
├── questions.md                                                            ← AI-generated questions + answers (instructor copy)
├── raw-ai-output.md                                                        ← the model's unprocessed reply, kept for diagnosis
├── {{ASSIGNMENT_NAME}}_{studentLogin}_quiz_{questionCount}.imscc              ← Common Cartridge quiz package for any LMS (auto-generated)
└── {{ASSIGNMENT_NAME}}_{studentLogin}_brightspace_quiz_{questionCount}.csv    ← optional alternative, Brightspace only (auto-generated)
```

### Submission tag folders

If the assignment's workflow is triggered by submission tags (the `submission_tags` input), each tag pattern gets its own subfolder inside the student's folder, so every milestone's assessment is kept rather than replaced by the next:

```
{studentLogin}/
└── {tagGroup}/                                                             ← the submission tag, e.g. phase1 or complete
    ├── questions.md
    ├── raw-ai-output.md
    ├── submissions.md                                                      ← every run for this tag, with a resubmission count
    ├── history/                                                            ← question sets replaced by a resubmission
    │   └── 1-questions.md
    ├── {{ASSIGNMENT_NAME}}_{studentLogin}_{tagGroup}_quiz_{questionCount}.imscc
    └── {{ASSIGNMENT_NAME}}_{studentLogin}_{tagGroup}_brightspace_quiz_{questionCount}.csv
```

The files are the same as those described below. The tag group is carried in the quiz filenames and in the quiz title (`{{ASSIGNMENT_NAME}} - {studentLogin} ({tagGroup})`), so each milestone's quiz stays identifiable once imported into the LMS.

#### Resubmissions

A student can resubmit under the same tag by moving it and pushing it again. Each time, the new assessment replaces `questions.md`, so two more files keep track:

- **`submissions.md`** lists every run for the tag — date, how it was started (tag push or manual run), who started it, and the commit — and counts how many were student submissions. A manual run started by someone other than the student, such as your own re-run from the Actions tab, is listed but not counted.
- **`history/<#>-questions.md`** is the question set a resubmission replaced, numbered by the row in `submissions.md` that produced it. Students see their questions (never the answers), so comparing these shows whether a resubmission was new work or an attempt to draw an easier set.

A resubmitted `questions.md` also says so in its header — for example `Submission: ⚠️ resubmitted — this is the 3rd submission of phase1` — so it stands out without opening the log.

## Files

### `{studentLogin}/questions.md`

The full instructor copy of the AI-generated assessment. Unlike the student-facing version, this file always includes:

- Metadata (student login, source repository, commit range, files assessed)
- All comprehension questions targeting the student's specific code submission
- **Correct answers** for every question
- Incorrect distractor options for multiple-choice quiz-style delivery

This file is created or updated automatically each time GrillMyCode runs against the student's repository.

### `{studentLogin}/raw-ai-output.md`

The AI's reply exactly as it arrived, before GrillMyCode processed it into `questions.md`. It is written on every run, and it is a diagnostic record rather than something you need to read or import — **`questions.md` is the assessment**.

It is worth opening when a student's `questions.md` looks wrong, because the processing steps are lossy and this file is the only place their input survives:

- **Fewer questions than you asked for.** Questions the model generated beyond `num_questions` are cut, and questions whose answer block could not be read are withheld. Both are visible here.
- **Formatting that came out strangely.** Question numbering is rewritten and bold and code spans are adjusted, so an oddity in `questions.md` may be a processing artefact rather than something the model produced.
- **A missing or malformed instructor note.** The context summary is lifted out of the reply into the report header; this file shows what the model actually emitted for it.

The header above the reply records how it was produced. **Stopped because** is the first thing to check when questions are missing: `length` means the model hit its output limit and the reply is incomplete, which is different from a model that simply wrote fewer questions. The header also shows token counts, how many attempts the request took, and the settings used — questions requested, temperature, and a short hash identifying the prompt version, so replies from different GrillMyCode releases can be told apart.

Use GitHub's **Raw** view, or `git blame`, to see markers and whitespace as the model wrote them — the rendered Markdown view hides some of what makes this file useful. If you are reporting a problem with generated questions, the contents of this file is the single most useful thing to include.

### `{studentLogin}/{{ASSIGNMENT_NAME}}_{studentLogin}_quiz_{questionCount}.imscc`

An IMS Common Cartridge (v1.3) package containing a QTI 1.2 multiple-choice quiz, generated from `questions.md` by the [Generate LMS Quiz](.github/workflows/generate-lms-quiz.yml) workflow. Each question carries the correct answer plus its distractors, with shuffled answer order. A question whose distractors could not be read from `questions.md` is left out of the package rather than exported on its own — a single-choice question would be a free mark for every student — so a quiz can be shorter than its `questions.md`. The workflow run names each one it left out. The trailing number in the filename is how many questions the package actually contains, so a shortfall is visible from the file listing alone — `_quiz_23.imscc` beside a 30-question `questions.md` says three questions were dropped without opening either file. The rest of the filename identifies both the assignment and the student, so exported files stay identifiable once out of this folder structure. A regenerated quiz with a different count is written under the new name and the previous file is removed, so there is never more than one package per student. Common Cartridge is an open standard from 1EdTech (formerly IMS Global), so the same file imports as a quiz into most major LMS platforms — including Brightspace, Canvas, Moodle, Blackboard Learn and Sakai. This is the file to use unless you specifically want the Brightspace CSV below.

### `{studentLogin}/{{ASSIGNMENT_NAME}}_{studentLogin}_brightspace_quiz_{questionCount}.csv` — Brightspace only

> [!NOTE]
> **Not on Brightspace? Ignore this file** and use the `.imscc` above. This CSV is in D2L Brightspace's own question-import format, which no other LMS can read.

An **alternative** to the `.imscc` for Brightspace users. You only need one of the two — they contain the same questions, and code snippets keep their syntax highlighting in both. Answer options are already in shuffled order, since the CSV format has no shuffle setting.

The difference is what gets imported. The `.imscc` arrives as a ready-made quiz, with its title and a one-attempt limit set. The CSV carries questions only: create or open a quiz in Brightspace and choose **Import → Upload a File**, or upload it into the Question Library and add the questions to a quiz from there. Each question is titled `{{ASSIGNMENT_NAME}} - {studentLogin} - Q1`, `Q2`, … so questions from different students stay distinguishable in the Question Library.

The first line, beginning `//gmc_content_hash`, is a comment that Brightspace ignores; the workflow uses it to tell whether the file is up to date. Leave it in place.

## Workflows

### Generate LMS Quiz (`.github/workflows/generate-lms-quiz.yml`)

Runs automatically whenever a `{studentLogin}/questions.md` file is added or modified by a push to this repository, regenerating that student's `{{ASSIGNMENT_NAME}}_{studentLogin}_quiz_{questionCount}.imscc` — an importable Common Cartridge/QTI package — and the Brightspace-only alternative `{{ASSIGNMENT_NAME}}_{studentLogin}_brightspace_quiz_{questionCount}.csv`, both extracted from their question answers and distractors. Every run checks all students but skips any whose `questions.md` is unchanged since their quiz was last built, so normally only the student who just pushed gets a new file; a change to the quiz package format rebuilds every student's quiz in a single run.

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
4. The action also writes this instructor copy — with answers — to this repository under `{studentLogin}/questions.md`, and files the model's unprocessed reply beside it as `{studentLogin}/raw-ai-output.md`.
5. That write triggers the Generate LMS Quiz workflow automatically, which produces `{{ASSIGNMENT_NAME}}_{studentLogin}_quiz_{questionCount}.imscc` (plus the Brightspace-only `{{ASSIGNMENT_NAME}}_{studentLogin}_brightspace_quiz_{questionCount}.csv`) for that student. Run it manually from the Actions tab any time to regenerate every student's quiz at once.

This repository is created automatically on the first assessment run and requires no manual setup beyond configuring the `instructor_repo_token` input on the GrillMyCode action.

---

<sub>Managed by [GrillMyCode](https://github.com/NSCC-ITC-Assessment/GrillMyCode)</sub>
