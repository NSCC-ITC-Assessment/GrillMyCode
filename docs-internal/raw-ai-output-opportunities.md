# Raw AI Output — Opportunities for Fixes and Features

Ideas for putting `{studentLogin}/raw-ai-output.md` in the instructor repository
to further use, beyond reading it by hand when a quiz looks wrong. None of these
are implemented; each is written up far enough that it can be picked up without
re-deriving the reasoning.

Written against the code as of `b010191`. Function names are given rather than
line numbers, so references survive edits.

---

## Why the raw file is worth more than it looks

`deliverToInstructorRepo` in `src/delivery/instructor-repo.js` writes the
model's reply verbatim, with the provenance header from `formatRawOutput` in
`src/report.js`, on every student push. Each write is its own commit, so the
**git history** of `*/raw-ai-output.md` is a corpus: every reply, for every
student, for every submission, tagged with the commit range and model that
produced it.

It is also the only place three things survive:

- **Surplus questions.** `truncateToMaxQuestions` deletes everything past
  `num_questions` outright.
- **The unprocessed shape.** Renumbering, bolding, separator repair and summary
  extraction all rewrite the text before `questions.md` is cut from it.
- **The answer container before stripping**, with the model's own ordering of
  answer and distractors.

Nearly every entry in `lms-quiz-known-issues.md` was found by someone reading
these replies. Most of what follows automates that loop, or recovers value the
pipeline currently discards.

---

## Prerequisite — record more in the provenance header

Several ideas below need data the header does not carry. Today it has the date,
student, repository, commit range, and model/provider.

**Add a machine-readable block** — an HTML comment holding JSON, so it renders
as nothing — with:

- **Request settings:** `num_questions` requested, `ai_temperature`, action
  version, and a hash of the prompt template (system and user message).
- **Response metadata:** `finish_reason`, token usage, latency, and the number
  of retries `callAI` spent.

**Why `finish_reason` matters on its own.** `callAI` in `src/ai.js` inspects
`finish_reason` only on failure paths and returns `content.trim()` on success,
so the reason is discarded for every reply that gets through. A reply cut off
at `finish_reason: "length"` is indistinguishable from a model that simply
generated fewer questions — nothing downstream can tell the two apart. Returning
the metadata alongside the text is a small change to `callAI`'s signature and
its callers.

---

## Fixes

### 1. Replay harness and regression corpus

A script that takes a `raw-ai-output.md` and runs it through the full pipeline —
the postprocessing chain in `main.js` (`renumberQuestions` →
`truncateToMaxQuestions` → `extractContextSummary` → `boldQuestionLines` →
`splitBoldAroundCode` → `normaliseSeparators`, then the two copies), followed by
`parseQuestions` from the quiz workflow — and diffs the result against the
committed `questions.md` and package.

Scrubbed samples (see [Privacy](#privacy)) go into `test/fixtures/`, so every
parser change is tested against real drift rather than hand-written cases. The
drift table in `lms-quiz-known-issues.md` was "re-reproduced against the current
parser" by hand; this makes it a CI job.

**Blocker:** `parseQuestions` lives inside the inline script in
`src/workflows/generate-lms-quiz.yml`, so nothing can import it. Extracting it
into a module the workflow loads is worth doing regardless of this idea.

### 2. Targeted regeneration after a parser fix

The operational note in `lms-quiz-known-issues.md` says a parser change does not
invalidate `gmc_content_hash`, which leaves two options: delete affected
packages by hand, or bump `PACKAGE_FORMAT` and rebuild every student. Running
the replay harness from (1) across a repository answers exactly which students'
quizzes would change under the new parser, so only those are deleted or
rebuilt.

### 3. Evidence for validate-and-retry at generation

`lms-quiz-known-issues.md` names re-prompting on malformed output as "the fix
that would close the whole class". The corpus measures how often each kind of
drift actually occurs, per model, which settles the open questions before it is
built: whether a retry pays for itself, which checks should trigger one, and
whether some models warrant it and others do not.

### 4. Mining prompt counter-examples

The rule in `src/prompt.js` rejecting a heading wrapped in an HTML comment came
from a real reply. A scanner that clusters recurring violations across the
corpus would propose the next rejected violations to name in the prompt, taken
from what models actually do rather than from guesses.

---

## Features

### 5. Backfilling withheld questions from the surplus

When the quiz workflow withholds a question — no distractors parsed, or a blank
option — the quiz ships short (`_quiz_23` against 30 requested). The raw file
often holds the questions `truncateToMaxQuestions` cut. The workflow could take
the next surplus question, run it through the same validation, and fill the gap.

Variants:

- **Deliberate spares** — request two or three more than `num_questions` so a
  backfill is nearly always available.
- **Random-selection pools** — QTI 1.2 supports drawing N questions from a
  larger section, so the surplus could become a per-student pool and a retake
  would see different questions.

Needs no new data, and is the most visible improvement for instructors.

### 6. Instructor-side health report

Recovery warnings — summary-marker drift, separator repair, redaction — are
written to the **student's** Actions log, which instructors rarely open. A step
in the instructor workflow could compare raw → `questions.md` → package for each
student and write a job summary, or a `HEALTH.md` at the repository root, with:
questions requested, generated, kept and exported; recoveries applied; and
`finish_reason` (once the header records it).

### 7. Model conformance scorecard

Aggregate format conformance by model: answer-container presence, heading
drift, separator variants, question count against the number requested, and
duplicate distractors. That gives an evidence base for `DEFAULT_AI_MODEL`, and
the Workflow Wizard could show a reliability note beside each model rather than
only its name.

Spans repositories, so it falls under [Privacy](#privacy).

### 8. Offline evaluation of prompt and model changes

Each raw header names a `(repository, base, head)` — a real submission that can
be regenerated. Sample a set, generate with a candidate prompt or model, and
score the replies against the stored baseline with the conformance checks from
(7). That is a regression evaluation before release, instead of discovering
drift in instructor repositories weeks later. Once the prompt hash is in the
header, prompt versions can also be compared on production data.

### 9. Quiz-quality lint

Because the raw reply keeps the answer container intact, it can be checked for
the well-known tells of generated multiple-choice questions:

- the correct answer is the longest or most specific option;
- the same distractors recur across students;
- distractors that are near-copies of the answer.

Length bias especially is something students learn to exploit. The lint could
flag affected questions, or feed a prompt rule asking for options of comparable
length.

### 10. One-click bug report

When a question is withheld, the workflow could open an issue in the
**instructor** repository, prefilled with the raw excerpt and the replay diff
from (1). The instructor README already calls the raw file "the single most
useful thing to include" in a report; this makes including it the default.

---

## Privacy

Raw replies contain excerpts of student code, and the file path carries the
student's GitHub login. Anything that moves data out of the private instructor
repository needs a scrubbing step first: fixtures committed to this public
repository (1, 4), cross-repository scorecards (7), and reports sent anywhere
beyond the instructor repository (10).

Ideas 2, 5, 6 and 9 run entirely inside the instructor repository and do not.

---

## Suggested order

1. **Header enrichment** and **the replay harness (1)** — cheap, and they
   underpin 2, 3, 7 and 8.
2. **Surplus backfill (5)** — the most visible win for instructors, with no new
   data required.
3. **Health report (6)** — makes existing diagnostics reach the people who need
   them.
4. The rest as evidence from the above makes the case for them.
