---
sidebar_position: 9
---

# Instructor Repository Delivery

Automatically stores a **private, instructor-only** copy of every assessment — including both questions and answers — in a dedicated repository. Students only ever see their student-facing report; the instructor copy is written separately using a PAT that students cannot access.

## How it works

When `instructor_repo_token` is provided the action:

1. Resolves the assignment name from the student repo's `template_repository` field (set automatically by GitHub Classroom). For non-Classroom repos it falls back to the source repository name.
2. Derives the instructor repository name as `{assignment-name}-grillmycode-instructor` in the same organisation.
3. Creates the repository as **private** on first run if it does not already exist, and commits a `student-questions-added.yml` GitHub Actions workflow into it.
4. Creates a folder named `{student-login}/` in the instructor repository and writes the full assessment (questions and answers) to `{student-login}/questions.md`, overwriting any previous run for the same student. The folder is created automatically if it does not already exist.
5. Each push of a `questions.md` file triggers the `student-questions-added` workflow inside the instructor repository, which currently writes a `{student-login}/future_brightspace_quiz.txt` placeholder. This file is a temporary stub — it will be replaced with real Brightspace quiz generation in a future release.

The student-facing report is unaffected — whether it includes answers is still controlled by the existing `include_answers` input.

## Prerequisites

See the **[Instructor Setup guide](../guides/instructor-setup)** for full step-by-step instructions, including how to create the PAT and add it as an org-level secret so all student repositories inherit it automatically.

In short:

1. Create a PAT with `repo` **and** `workflow` scopes (classic) or Contents + Workflows read/write permissions (fine-grained). The `workflow` scope is required to commit the `student-questions-added.yml` workflow file into the instructor repository on creation.
2. Add it as an **org-level** Actions secret named `INSTRUCTOR_REPO_TOKEN` — this makes it available to all student repos without any per-repo configuration.

## Example workflow

Copy this file to `.github/workflows/grill-my-code.yml` in the student repository.

```yaml
name: Code Assessment

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    permissions:
      contents: write       # required to commit the output file back to the repo
      pull-requests: write  # required to post the PR comment
      models: read          # required to call GitHub Models API
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          num_questions: "5"
          # Store a full Q+A copy in the private instructor repository.
          # The repository is created automatically if it does not exist.
          instructor_repo_token: ${{ secrets.INSTRUCTOR_REPO_TOKEN }}
```

## GitHub Classroom setup

For a Classroom assignment named `assignment-1`:

- Student repos: `your-org/assignment-1-student-login`
- Instructor repo (auto-created): `your-org/assignment-1-grillmycode-instructor`
- File written per student: `student-login/questions.md`

The assignment name is resolved automatically from the `template_repository` that GitHub Classroom sets on every student repo — no configuration is needed beyond the token.

## Non-Classroom setup

For a generic repository named `my-project`:

- Instructor repo (auto-created): `your-org/my-project-grillmycode-instructor`
- File written per student: `student-login/questions.md` (resolved from the most recent non-bot git commit author)

## Instructor report contents

The instructor copy always contains:

- Questions **and** answers (regardless of the `include_answers` setting)
- Student GitHub login and source repository name
- Commit range reviewed (base → head SHA)
- Full list of all files changed since the starter template (pre-filter)
- Assignment context files used (if any)
- AI provider and model
