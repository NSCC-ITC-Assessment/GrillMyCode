# 🔥 GrillMyCode

*A GitHub Action that turns code submissions into comprehension quizzes — automatically.*

---

## Addresses the problem

*"Does the student actually **comprehend** the code they submitted?"*

## How it works

1. Detects what code a student changed (via git diff)
2. Strips comments so the AI cannot be led by hints
3. Sends the code to an AI provider to generate targeted questions
4. Delivers the assessment as a PR comment, Issue, or Discussion

## Key features

- ✦ Zero student setup — triggers on every push, pull request, or manually
- ✦ Built for GitHub Classroom — skips template/starter files automatically
- ✦ Free by default — uses GitHub Models, OpenRouter, etc.
- ✦ Configurable — questions, file filters, assignment context, AI provider

## A sample workflow

```yaml
name: GrillMyCode
on:
  pull_request:
    types: [opened, synchronize]
jobs:
  generate-questions:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      models: read
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          num_questions: '20' # how many questions to generate
          include_answers: 'false' # attach model answers for instructor review
          additional_context: | # tell the AI what the assignment is about
                   Assignment 3 – Python list comprehensions.
                   Focus questions on logic and readability choices.
          assignment_context: 'docs/brief.pdf' # inject the actual assignment into the prompt
          post_issue: 'true' # also create a GitHub Issue assigned to the student
```

## Read more

<https://nscc-itc-assessment.github.io/GrillMyCode/>

> Looking for participants to pilot! DM me on Teams if interested.

---

nscc-itc-assessment.github.io/GrillMyCode
