# Jev (TypeSafe) decision model — evaluation for GMC

> **Recorded:** 2026-09-30 (`0e01a23`)
> **Status:** Exploration only. Nothing implemented. Two live API calls made
> against `typesafe/jev-1.13`; a third was not run.

TypeSafe publishes two "Jev" entries on OpenRouter. This note records what
they are, what the API actually looks like (probed by hand, since it is not
documented in the catalogue), and whether either would help GrillMyCode meet
its goals.

---

## Bottom line

- **Jev cannot replace the model GMC uses today.** It returns a choice or a
  score, never text. GMC's core job is writing questions, and that needs a text
  model.
- **Jev Router is not usable today** and conflicts with how GMC keeps cost in
  the instructor's hands.
- **Jev 1.13 could be a cheap pre-check or post-check** around the main
  call. The most useful version is **skipping cosmetic-only pushes**. It is a
  small benefit, and it comes with an alpha API, a single provider and a new
  input. **Recommendation: don't build it now.** Revisit if instructors report
  noise from trivial pushes, or if the decisions API leaves alpha.

---

## GMC's goals, as the docs state them

From `docs-site/docs/intro.md`:

1. Write questions **about each student's own code**, so the instructor can
   check understanding (a code viva). GMC does not grade.
2. **Nothing for students to install or learn.**
3. An assessment "can cost less than one cent", but the cost can rise sharply; **working out cost is
   the instructor's responsibility, through trial runs.**
4. Built for Classroom 50: starter code is excluded, so questions cover only
   what the student wrote.

Every option below is judged against these goals.

---

## What the two models are

|                              | `typesafe/jev-router`                               | `typesafe/jev-1.13`                                    |
| ---------------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| What it does                 | Picks a model and reasoning effort for each request | Returns typed decisions (choice / score / probability) |
| Output                       | Text (via whichever model it routes to)             | Decisions only — no text                               |
| Endpoint                     | `/api/v1/chat/completions`                          | `/api/alpha/decisions` (**alpha**)                     |
| Live endpoints on 2026-09-30 | **None** (list is empty)                            | One (TypeSafe), 100 % uptime over the last day         |
| Context                      | 1M                                                  | 32k tokens                                             |
| Price in catalogue           | `-1` (dynamic)                                      | Very low per input token; output listed as free        |
| Declared parameters          | None                                                | None                                                   |

Jev 1.13 does not appear in the main `/api/v1/models` list (it seems to list
only text-output models). Its page and `/models/typesafe/jev-1.13/endpoints`
do resolve.

Prices are recorded here only as they stood on the date above. Per project
convention, never put them in public docs.

---

## The decisions API (worked out by probing)

Calling Jev 1.13 on `chat/completions` fails:

> typesafe/jev-1.13 is a decisions model and cannot be used with the
> chat/completions endpoint. Use the /api/alpha/decisions endpoint instead.

The request shape below was pieced together from its validation errors:

```json
{
  "model": "typesafe/jev-1.13",
  "state": "…string, object or array: the input being judged…",
  "questions": {
    "<key>": { "type": "choice", "instructions": "…", "criteria": { "<option>": "<description>" } },
    "<key>": { "type": "score", "instructions": "…", "criteria": ["<level 0>", "<level 1>", "…"] },
    "<key>": { "type": "noul", "instructions": "…" }
  }
}
```

- `choice` → one option picked, plus a probability for each option and a
  confidence.
- `score` → an ordinal score plus a `legend` mapping each level to its label,
  a probability for each level, and a confidence.
- `noul` → a single probability between 0 and 1 (in effect yes/no).
- `instructions` can be a string, object or array.
- One request can ask several questions about the same `state`.

### Test result

Input: a diff that only renames `r` to `radius` and adds spaces.

```json
"worth_grilling": { "choice": "skip", "probabilities": { "skip": 1, "grill": 0 }, "confidence": 1 },
"complexity":     { "score": 0.01, "legend": { "0": "trivial", "1": "simple", "2": "moderate", "3": "complex" }, "confidence": 0.99 },
"has_tests":      { "noul": 0.02 },
"usage":          { "input_tokens": 426, "output_tokens": 68, "cost": 1.7892e-05 }
```

All three answers were right, and the call cost about $0.00002. A second test,
on a diff with real logic (a binary search), was **not run**, so we have no
evidence yet that it says "grill" when it should. That test is needed before
drawing any conclusion.

---

## Would it help GMC? Option by option

### 1. Skip pushes with nothing worth asking about

GMC already stops when **no code** is left to assess (`src/main.js`, "no code
to ask questions about"). It does **not** stop when the only changes are
renames, formatting or comments. On an "every push" trigger, those pushes
produce a fresh issue full of questions about trivial edits.

- **Helps goal 1:** fewer low-value question sets, less noise for the student
  and the instructor.
- **Helps goal 3 a little:** skips the main call on trivial pushes. With the
  default model the main call is already cheap, so the saving only matters
  with expensive models.
- **Risk:** a false "skip" silently withholds questions the instructor
  expected. The step must fail open (on error or low confidence, run as
  normal) and log its decision.
- **Partly solved already:** the "when the student says they're done" and
  manual triggers avoid most trivial pushes anyway.

**Verdict: the only option with a clear benefit. The benefit is modest.**

### 2. Choose the model per submission

Score complexity with Jev, then map each level to a model the instructor
chose (for example cheap for trivial, stronger for complex).

- **Conflicts with goal 3.** Instructors estimate cost from trial runs, and a
  model that changes per submission makes those trials less reliable.
- Adds a complicated input (a map from level to model) to a product whose
  setup is meant to take 15 minutes.

**Verdict: not worth it.** Jev Router has the same problem in a worse form,
because the instructor doesn't pick the models at all.

### 3. Focus the questions

Ask Jev which changed files or functions matter most, and send only those to
the main model.

- Only 32k tokens of context, while GMC's codebase context alone can be 50,000
  characters (`DEFAULT_CODEBASE_CONTEXT_MAX_CHARS`). Big submissions would
  need trimming before Jev could even see them.
- The main model already weighs the code when writing questions.
  `question_emphasis` and the existing filters cover most of this.

**Verdict: little benefit.**

### 4. Check the questions after they're written

For each generated question, ask "is this answerable from the student's own
code?" and drop any that aren't.

- **Supports goals 1 and 4.** GMC already drops questions about unassessed
  files (`dropQuestionsOnUnassessedFiles`), so this would extend an existing
  idea.
- Up to 50 questions per run (`MAX_QUESTIONS`) at the 32k context limit would
  mean batching.
- Questions about language or API knowledge are in scope by design, so the
  check would have to be worded carefully not to reject them.

**Verdict: plausible, but unproven.** It would need its own trial on real
output first.

### Jev Router as `ai_model`

- No live endpoints right now, so requests would fail.
- Picks its own reasoning effort, which overrides `ai_reasoning_effort`.
- No declared support for `response_format`, and GMC needs structured output
  to parse questions.
- Dynamic pricing works against goal 3.

**Verdict: no.**

---

## Costs of adopting Jev 1.13 at all

- **Alpha endpoint.** `/api/alpha/decisions` may change or disappear without
  notice.
- **Single provider, recently listed.** Acceptable for an optional extra, not
  as a dependency.
- **A second API call on every run.** It adds another way to fail, so it has
  to fail open.
- **New input.** Needs all six places listed in `AGENTS.md` (action.yml,
  inputs, constants, README, all-inputs example, Wizard), plus a guide mention.
- **No new secret or setup.** It uses the same OpenRouter key, so goal 2 is
  unaffected.

---

## If we revisit

1. Run the missing test: a diff with real logic should come back "grill".
   Then try around 20 real (anonymized) student pushes, a mix of trivial and
   real changes, and record how often the skip decision is wrong.
2. Only if that mix comes back clean: prototype option 1 behind an opt-in
   input, off by default, that fails open and logs the decision and
   confidence in the job summary.
