---
sidebar_position: 9
---

# Instructor Repository Delivery

Automatically stores a **private, instructor-only** copy of every assessment — including both questions and answers — in a dedicated repository. Students only ever see their student-facing report; the instructor copy is written separately using a PAT that students cannot access.

## How it works

When `instructor_repo_token` is provided the action:

1. Resolves the assignment name from the student repo's `template_repository` field (set automatically by GitHub when the repo is created from a template — the mechanism Classroom 50 uses). For repos with no template it falls back to the source repository name.
2. Derives the instructor repository name as `{assignment-name}-grillmycode-instructor` in the same organisation.
3. Creates the repository as **private** on first run if it does not already exist, commits a `generate-lms-quiz.yml` GitHub Actions workflow into it, and writes a descriptive `README.md` explaining the repository structure and contents.
   On every later run it re-checks both files and rewrites either one whose contents no longer match the copies shipped with the action, so a repository created by an older release picks up quiz-generation fixes on its own. Both files are owned by the action: local edits to them are replaced. If the PAT cannot write them the run logs a warning and still delivers the assessment.
4. Creates a folder named `{student-login}/` in the instructor repository and writes the full assessment (questions and answers) to `{student-login}/questions.md`, overwriting any previous run for the same student. The folder is created automatically if it does not already exist.
5. Writing that file automatically triggers the **Generate LMS Quiz** workflow in the instructor repository, which produces an IMS Common Cartridge / QTI quiz package (`{student-login}/{assignment-name}_{student-login}_quiz.imscc`) for that student, ready to import directly into Brightspace or any other Common Cartridge / QTI-compatible LMS. Every run checks all students but skips any whose `questions.md` is unchanged since their quiz was last built, so normally only the student who just pushed gets a new file; a change to the quiz package format rebuilds every student's quiz in a single run. You can also run the workflow manually from the Actions tab to regenerate every student's quiz at once.

The student-facing report is unaffected — whether it includes answers is still controlled by the existing `include_answers` input.

## Prerequisites

See the **[Instructor Setup guide](../guides/instructor-setup)** for full step-by-step instructions, including how to create the PAT and add it as an org-level secret so all student repositories inherit it automatically.

In short:

1. Create a PAT with `repo` **and** `workflow` scopes (classic) or Contents + Workflows read/write permissions (fine-grained). The `workflow` scope is required to commit the `generate-lms-quiz.yml` workflow file into the instructor repository, both on creation and whenever a later release updates it.
2. Add it as an **org-level** Actions secret named `INSTRUCTOR_REPO_TOKEN` — this makes it available to all student repos without any per-repo configuration.

If you set this up before the `workflow` scope was required, update the existing token — a `repo`-only PAT warns on every run and never picks up quiz-generation fixes. See [Already have an instructor PAT?](../guides/instructor-setup#step-1--create-an-instructor-pat).

## Example workflow

Copy this file to `.github/workflows/grill-my-code.yml` in the student repository.

```yaml
name: GrillMyCode

on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:

# A new push cancels any run still in progress for the same branch,
# so only the latest commit is ever assessed (see FAQ).
# Do not modify this setting unless you have a compelling reason to.
concurrency:
  group: grillmycode-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write  # gmc-assessments release + PDF asset
      issues: write    # assessment issue
      models: read     # GitHub Models API
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          num_questions: "20"
          # Store a full Q+A copy in the private instructor repository.
          # The repository is created automatically if it does not exist.
          instructor_repo_token: ${{ secrets.INSTRUCTOR_REPO_TOKEN }}
```

## Classroom 50 setup

For a Classroom 50 classroom `cs-principles`, assignment slug `hello`, with a template repo also named `hello`:

- Student repos: `your-org/cs-principles-hello-student-login`
- Instructor repo (auto-created): `your-org/hello-grillmycode-instructor`
- Files written per student: `student-login/questions.md`, `student-login/hello_student-login_quiz.imscc`

The assignment name is resolved automatically from the `template_repository` that Classroom 50 sets on every templated student repo — no configuration is needed beyond the token. Note that the resolved name comes from the **template repo's name**, which doesn't have to match the assignment slug (see [Instructor Setup](../guides/instructor-setup#assignment-name-vs-template-repo-name)).

## Non-classroom setup

For a generic repository named `my-project`:

- Instructor repo (auto-created): `your-org/my-project-grillmycode-instructor`
- Files written per student: `student-login/questions.md`, `student-login/my-project_student-login_quiz.imscc` (student resolved from the most recent non-bot git commit author)

## Instructor report contents

The instructor copy always contains:

- Questions **and** answers (regardless of the `include_answers` setting)
- Student GitHub login and source repository name
- Commit range reviewed (base → head SHA)
- The list of code files assessed (the same filtered list the student report shows)
- Assignment context files used (if any)
- AI provider and model
