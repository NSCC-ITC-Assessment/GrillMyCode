![GrillMyCode logo](../img/grillmycode-logo.svg)

# GrillMyCode

*A GitHub Action that turns code submissions into comprehension quizzes — automatically.*

---

## Addresses the problem

*"Does the student actually **comprehend** the code they submitted?"*

## How it works

1. Detects what code a student changed (via git diff)
2. Collects changed files and applies include/exclude filters
3. Strips comments so the AI focuses on logic, not hints
4. Generates questions via AI and delivers the assessment as a GitHub Issue and PDF, with an optional private instructor copy and LMS quiz

## Key features

- ✦ Zero student setup — runs on every push, on a submission tag, or manually
- ✦ Built for Classroom 50 — skips template/starter files automatically
- ✦ Low cost — routes through OpenRouter; recommended models usually cost under a cent per assessment
- ✦ Configurable — questions, file filters, assignment context, choice of model

## A sample workflow

```yaml
name: GrillMyCode
on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:
concurrency:
  group: grillmycode-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  generate-questions:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          api_key: ${{ secrets.OPENROUTER_API_KEY }} # OpenRouter key (required)
          num_questions: '20' # how many questions to generate
          include_answers: 'false' # true shows answers to students — leave off
          instructor_context: | # tell the AI what the assignment is about
                   Assignment 3 – Python list comprehensions.
                   Focus questions on logic and readability choices.
          assignment_context: 'docs/brief.pdf' # inject the actual assignment into the prompt
```

## Read more

<https://grillmycode.org/>

> Looking for participants to pilot! DM me on Teams if interested.

---

grillmycode.org
