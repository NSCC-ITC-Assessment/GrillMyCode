# Model evaluation plan

> **Recorded:** 2026-09-30 (branch `ai-temp-rework`)
> **Status:** Plan only. Nothing has been run.

A repeatable way to compare how models, or two builds of GrillMyCode, write
questions for the same submissions. It has two uses:

1. **Before releasing the new temperature default.** Until this branch, every
   run sent `temperature: 0.5` and `top_p: 0.95`. Now `ai_temperature` is
   opt-in with no default: unless an instructor sets it, nothing is sent, so
   the default model (`google/gemini-3.5-flash-lite`) runs at Google's own
   settings, which Google recommends for Gemini 3.x. `top_p` is never sent.
   Nobody has yet seen GrillMyCode's questions from it that way. This plan
   compares the two.
2. **Reviewing the Wizard's tested models** (`OPENROUTER_MODELS` in
   `steps/StepAIProvider.js`) before each term, or when adding one.

It is also how to decide whether setting `ai_temperature` is worth it for a
given model: run the same submissions with the model's own temperature and
with the value you have in mind, and compare.

---

## Bottom line

- Compare with numbers GrillMyCode already records. No new tooling is needed.
- Run each submission **three times** per build or model. One run can't show
  variety between runs, or tell a model's habit from bad luck.
- **Release the new default if** the branch shows no more retries, dropped
  questions or `length` stops than the current release, and its questions rate
  no worse.

---

## Test submissions

Use a practice organization with fictional names (see `AGENTS.md`):
organization `my-school`, classroom `cs-principles`, assignment `lab-3`,
student `jsmith`, repository `cs-principles-lab-3-jsmith`. Create one
repository per submission below, each from a starter commit so the starter-code
exclusion is exercised.

| #   | Submission                                                  | Why                                                           |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Python loops and lists, about 80 changed lines              | The typical first-year lab                                    |
| 2   | JavaScript DOM event handlers, about 150 lines over 3 files | Several files, a second language                              |
| 3   | Java classes with inheritance, about 250 lines              | Longer code, design questions                                 |
| 4   | Renames and formatting only                                 | Should produce few or weak questions; shows how a model copes |
| 5   | Submission 3 with codebase context on                       | Longest prompt; most likely to hit output limits              |

Keep the repositories. The same submissions are what make later comparisons
fair.

---

## What to run

For each build or model under test, run every submission **three times** with
the workflow started by hand. Leave every other setting at its default, apart
from these:

- **Multiple choice on** for every run: `include_answers: true`. Wrong options
  are where a loose model shows first.
- **The same `num_questions`** across everything compared (20, the default).
- **An instructor repository** configured, so `questions.json` and
  `raw-ai-output.md` are filed for each run.

For the temperature comparison, the two builds are:

| Build                       | Where it runs from                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Before**: current release | The normal workflow, `uses: NSCC-ITC-Assessment/GrillMyCode@v0`                                                                          |
| **After**: this branch      | The branch image, `ghcr.io/nscc-itc-assessment/grillmycode:branch-ai-temp-rework`, built by `branch-build.yml` when the branch is pushed |

`action.yml` always points at the `:v0` image, so referencing the branch by
`@ai-temp-rework` would still run released code. A test workflow has to use the
branch image directly (`uses: docker://…`). **To confirm before the first run:**
how inputs reach a `docker://` step; `action.yml` maps each one to an `INPUT_…`
environment variable, so the test workflow may need to set those itself.

---

## What to record

Everything below is already written by each run.

**From `raw-ai-output.md` in the instructor repository** (the header):

- **Stopped because.** Count `length` stops: the reply hit the output limit and
  lost questions.
- **Attempts.** Retries mean the reply was unusable or the provider failed.
  Each retry is paid for.
- **Tokens**, including reasoning, and **served by**, which provider answered.

**From `questions.json`:**

- Questions with `"dropped": true`, which didn't point at the student's code.

**From the run summary** (the Actions run page):

- Questions generated against questions requested, and any withheld.

**From OpenRouter's activity page:**

- Cost of each generation.

**By hand**, one rating per question, using the same rater for every build
where possible:

| Check                                                         | Scale                 |
| ------------------------------------------------------------- | --------------------- |
| About this student's code, or a fair language or API question | yes / no              |
| Answer correct                                                | yes / no              |
| Wrong options plausible but clearly wrong                     | 0 none, 1 some, 2 all |
| Repeats a question from another of the three runs             | yes / no              |

Keep the table in a spreadsheet: one row per question, with the build or model,
submission number and run number.

---

## Deciding

**For the new temperature default**, compare after against before over all 15
runs of each:

- **Retries, dropped questions and `length` stops:** no increase.
- **Hand ratings:** no drop in correct answers or plausible wrong options.
- **Repeats between runs:** more variety is expected now; note it, but don't
  count it against the branch. Telling the model which questions it asked last
  time was considered on 2026-09-30 and not built, because no one had reported
  repeats as a problem. A high repeat count here is the evidence that would
  reopen it. The earlier questions would have to come from the instructor
  repository's `questions.json`, never the student's issue, which the student
  can edit.

If the branch is worse on the first two, look at which submissions caused it
before concluding anything. A drop confined to one submission is more likely
the submission than the setting.

**For choosing tested models**, rank by hand ratings first and cost second.
Drop any model with repeated `length` stops or retries on the typical
submissions (1–3).

---

## Related

- [Jev decision model evaluation](jev-decision-model-evaluation.md)
- [Raw AI output: opportunities](raw-ai-output-opportunities.md). Its
  "measure how often the AI breaks format" idea would automate the retry and
  dropped-question counts here.
