# {{ASSIGNMENT_NAME}} — GrillMyCode Instructor Repository

This is a **private** repository created and managed by [GrillMyCode](https://github.com/NSCC-ITC-Assessment/GrillMyCode). It collects AI-generated code comprehension assessments — including answer keys — for every student in the **{{ASSIGNMENT_NAME}}** assignment.

> [!WARNING]
> This repository contains **correct answers**. Keep it private and never share access with students.

## Generate Brightspace Quizzes

[![Generate Brightspace Quizzes]({{WORKFLOW_URL}}/badge.svg)]({{WORKFLOW_URL}})

[▶ Run the Generate Brightspace Quizzes workflow]({{WORKFLOW_URL}}) to create or refresh `future_brightspace_quiz.txt` for every student in this repository.

## Repository Structure

One folder is created per student, named after their GitHub login, and populated automatically each time a student pushes code.

```
{studentLogin}/
├── questions.md                ← AI-generated questions + answers (instructor copy)
└── future_brightspace_quiz.txt ← Brightspace-ready quiz export (auto-generated)
```

## Files

### `{studentLogin}/questions.md`

The full instructor copy of the AI-generated assessment. Unlike the student-facing version, this file always includes:

- Metadata (student login, source repository, commit range, files assessed)
- All comprehension questions targeting the student's specific code submission
- **Correct answers** for every question
- Incorrect distractor options for multiple-choice quiz-style delivery

This file is created or updated automatically each time GrillMyCode runs against the student's repository.

### `{studentLogin}/future_brightspace_quiz.txt`

A Brightspace-compatible quiz export generated from `questions.md` by the [Generate Brightspace Quizzes](.github/workflows/generate-brightspace-quizzes.yml) workflow. Run the workflow manually to regenerate all quiz files at once. Each file can be imported into Brightspace or reviewed directly.

## Workflows

### Generate Brightspace Quizzes (`.github/workflows/generate-brightspace-quizzes.yml`)

Run manually from the Actions tab to regenerate quizzes for every student in the repository at once. It scans for all `*/questions.md` files, extracts questions, answers, and code snippets (with syntax highlighting), and writes or overwrites `{studentLogin}/future_brightspace_quiz.txt` in each student folder. Re-running the workflow picks up any changes to question content.

## How This Repository Is Populated

1. A student pushes code to their assignment repository.
2. The GrillMyCode GitHub Action runs in that repository, analyses the changed files, and calls an AI model to generate comprehension questions.
3. The action writes a student-facing assessment (without answers, unless configured so) into the student's own repository.
4. The action also writes this instructor copy — with answers — to this repository under `{studentLogin}/questions.md`.
5. Run the Generate Brightspace Quizzes workflow manually from the Actions tab to produce `future_brightspace_quiz.txt` for all students.

This repository is created automatically on the first assessment run and requires no manual setup beyond configuring the `instructor_repo_token` input on the GrillMyCode action.

---

<sub>Managed by [GrillMyCode](https://github.com/NSCC-ITC-Assessment/GrillMyCode)</sub>
