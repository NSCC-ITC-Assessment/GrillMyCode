---
sidebar_position: 7
sidebar_label: Private answer key
---

# Private answer key

**Use this when** you want every student's questions **with the answers**, and a multiple-choice quiz for your LMS, in a private repository only instructors can see. Classroom 50 assignment repositories only.

First complete the one-time token setup in [Keeping a private answer key](../guides/instructor-setup.md#one-time-setup). Then:

```yaml title=".github/workflows/grill-my-code.yml"
name: GrillMyCode

on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:

# A new push cancels any run still in progress for the same branch,
# so only the latest commit is ever assessed.
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
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          api_key: ${{ secrets.OPENROUTER_API_KEY }}
          num_questions: "20"
          # Store a full questions-and-answers copy in the private instructor
          # repository. The repository is created automatically if it doesn't exist.
          instructor_repo_token: ${{ secrets.INSTRUCTOR_REPO_TOKEN }}
```

## Change these

Nothing, if you named the secret `INSTRUCTOR_REPO_TOKEN`. Otherwise, use your secret's name.

## What you get

For the classroom `cs-principles` and assignment `hello`, the repository is `your-org/cs-principles-hello-grillmycode-instructor`. Each student has a folder with:

- `questions.md`: questions and answers
- `cs-principles-hello_{student}_quiz_20.imscc`: an LMS quiz
- `cs-principles-hello_{student}_brightspace_quiz_20.csv`: a Brightspace-only alternative
- `raw-ai-output.md`: the model's unprocessed reply

## Good to know

- The token must have the `repo` **and** `workflow` scopes.
- With the token set, each question also gets three wrong answers for the quiz, which makes each assessment slightly more expensive. Students never see them.
- Students' own reports are unaffected; they still never see answers.
- A delivery problem doesn't fail the run. Check the run's annotations if nothing arrives.

## Related

[Keeping a private answer key](../guides/instructor-setup.md) · [Importing quizzes into your LMS](../guides/lms-quizzes.md) · [Instructor repository internals](../reference/instructor-repository.md)
