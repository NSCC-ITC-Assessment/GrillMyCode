# LMS Quiz Generation — Known Issues

Findings from reviewing `src/workflows/generate-lms-quiz.yml` (the workflow
seeded into each instructor repository) and its interaction with
`src/delivery/instructor-repo.js`.

Fixed issues are listed for the record only — the reasoning lives in the code
comments at each site. Open issues keep their full write-up, so the fix can be
re-applied without re-deriving it.

---

## Fixed

- **Stray list marker before the distractor heading.** `-- **Distractors…**`
  defeated an exact `startsWith()`, so the question exported with only its
  correct answer — a free mark for every student. A leading marker sitting
  directly before the bold heading is now stripped.
- **A question with no distractors was exported anyway.** Such questions are now
  withheld from the package and raised as a `::warning file=…::` naming the
  question, with the count in the run log. This is the backstop for drift that
  has not been seen: a lost question is now visible rather than silently scored.
- **The import offered a content link alongside the quiz, and was slow.** The
  populated `<organizations>` tree asked Brightspace to build a content topic;
  it is now empty. With that, DEFLATE compression (118KB → 10.6KB), merged
  highlight spans (911 → 338, colors unchanged) and a flat `quiz.xml`, a
  20-question quiz imports in **1m00s instead of 3m13s**, with the quiz as the
  only item. Roughly 40s of what remains is Brightspace's fixed job overhead.
- **A bold line inside a fenced snippet was read as a filename.** `!inSnippet`
  added to the `fpMatch` guard, so Markdown snippets keep their bold lines and
  the filename header stays correct.
- **One bad student aborted the whole run.** Each student is isolated in
  `try`/`catch` with an `::error::` annotation; the run still exits non-zero
  afterwards, and the commit step is `if: ${{ !cancelled() }}` so packages
  that did build are committed rather than discarded.
- **The commit step had no push retry.** Pull-and-push retries 5 times with
  exponential backoff, aborts any stopped rebase between attempts, and is
  skipped entirely when nothing is staged.
- **Unpinned dependencies.** Pinned to `jszip@3.10.1 prismjs@1.30.0`.
- **Instructor repositories never received workflow updates.** The workflow and
  the README are now action-owned and re-synced on every delivery, each
  rewritten only when its bytes differ from the copy shipped in
  `src/workflows/` and `src/templates/`. A repository created by an earlier
  release therefore picks up every fix above on its next student push, and the
  concurrent-creation race dissolves — the run that loses the `422` now syncs
  too, retrying through the 409s raised while the winner's `auto_init` lands.
  The sync warns rather than throws, so it can never cost a student their
  assessment.
- **A 403 sat through four minutes of backoff before failing.** `isRateLimited`
  treated every 403 as a rate limit, but GitHub also returns 403 for a token
  lacking the scope for a write — `workflow`, for anything under
  `.github/workflows/`. A 403 now counts as a rate limit only with the evidence
  for one (`retry-after`, an exhausted `x-ratelimit-remaining`, or GitHub's
  limit wording); a scope failure fails fast, which matters now that a write
  needing `workflow` scope is attempted on every run.
- **The distractor heading emitted as an HTML comment.** `gemini-3.5-flash-lite`
  wrote `<!-- Distractors for Multiple-Choice Quiz: -->` in place of the bold
  heading on 7 of 30 questions in one set — all of them in positions 22-30, one
  malformed as `<!-- Distractors for Multiple-Choice Quiz:**`. The withhold-and-warn
  backstop caught every one, so the quiz was short rather than wrong. The likely
  cause is the prompt itself: it teaches that HTML comments are the structural
  marker syntax (`<!-- gmc:answer -->`) and then places one directly above
  `**Answer:**`, so the model generalised comment syntax onto the next heading.
  The prompt now states both headings are byte-exact and lists heading-in-a-comment
  as a rejected violation.
- **The instructor copy threw away the one structural marker that was reliable.**
  `main.js` stripped the `<!-- gmc:answer -->` container from the instructor copy
  to keep the rendered Markdown clean — but the markers are HTML comments, which
  render as nothing either way, and `generate-lms-quiz.yml` parses that exact
  file. That left the workflow with only the literal headings to find options by.
  The container is now carried through and `parseQuestions` reads it positionally
  (first bullet correct, the rest distractors), so heading text no longer has to
  be right. `PACKAGE_FORMAT` is bumped to `v5` so every quiz rebuilds under it.
- **`stripAnswers` pass 1 could delete whole questions from the student copy.**
  The lazy region from `**Answer:**` had a lookahead for the bold distractor
  heading only, so a block whose heading had drifted found no match inside itself
  and ran forward to the next block that had one, taking every question in
  between. The lookahead is now anchored on the block separator and end-of-input
  as well. This never fired in production — pass 0 removes the answer via the
  container first, so it needed the markers absent _and_ the heading drifted —
  but it also means a stray `---` inside an answer no longer costs the copy a
  separator, which had been silently disabling `redactStudentQuestions`' structural
  guard for the entire assessment.

---

## Partly addressed — the same failure mode via other formatting drift

Two changes moved most of this. `parseQuestions` now reads the
`<!-- gmc:answer -->` container positionally when one is present — first bullet
correct, the rest distractors — so the heading text no longer has to be right;
and the prompt hardening listed above makes heading drift less likely to begin
with. What stays open is drift that breaks the _question line_ or the _block
separator_, because the container bounds only the answer section and the block
split happens before it is ever read.

Every row was re-reproduced against the current parser, with a container
present:

| Drift in `questions.md`                                              | Before                            | Now                           |
| -------------------------------------------------------------------- | --------------------------------- | ----------------------------- |
| `**Distractors:**` (shortened heading)                               | question withheld, warning raised | parses correctly              |
| `**Distractors for Multiple Choice Quiz:**` (no hyphen)              | question withheld, warning raised | parses correctly              |
| `**Distractors for Multiple-Choice Quiz**:` (colon outside the bold) | question withheld, warning raised | parses correctly              |
| `<!-- Distractors for Multiple-Choice Quiz: -->` (comment-wrapped)   | question withheld, warning raised | parses correctly              |
| A drifted `**Answer:**` heading (e.g. `**Correct Answer:**`)         | question dropped silently         | parses correctly              |
| A stray `---` between the answer and the distractor heading          | question withheld, warning raised | unchanged                     |
| `*` or `+` instead of `-` for option bullets                         | question dropped silently         | unchanged                     |
| An indented question line                                            | question dropped silently         | unchanged                     |
| CRLF line endings with multiple questions                            | all questions merge into one      | merge into one, **7 options** |
| `----` or `---` plus trailing space as a separator                   | two questions merge into one      | merge into one, **7 options** |

The drifted-`**Answer:**` row is new, and was never in the table before because
nothing could see it: the block yielded no answer, so it never became a question
and there was nothing to count or warn about. It is the clearest demonstration
of why the container is worth more than any number of tolerant heading regexes —
it recovers a case that produced no signal at all.

**The three rows that stay unchanged, and why the container cannot reach them.**
The stray-`---` case splits the block before any of this runs, tearing the
container in half: the opening marker and the answer land in one fragment, the
distractors and the closing marker in the next. The first fragment holds a single
container bullet, which by design only supplies an answer rather than overriding
the options, so the question is still withheld and warned — the same outcome as
before. The `*`/`+` bullet case and the indented question line are outside the
container's remit entirely: container bullets are harvested with the same
`startsWith('- ')` test, and the question line is matched by `/^\d+\. /` against
the unindented line. Both still yield no question, and both are still silent.

**The two merge rows got marginally worse.** A merged block contains two
containers, and the harvest does not distinguish them — it collects all eight
bullets, takes the first as the answer and the remaining seven as distractors.
That includes the second question's _correct_ answer, so the merged item now
offers seven options of which two are true, where before it offered six of which
one was. Both versions are broken questions that import without complaint, so
this is a change in degree, not in kind, but it is a regression and it is cheap
to remove: count the `<!-- gmc:answer -->` openings in the block and fall back to
the heading path when there is more than one.

**Fix, if wanted.** The tolerant-regex work described in earlier revisions of
this note is now mostly redundant for new files — the container covers the same
drift more robustly — but it remains the only thing that helps a `questions.md`
generated before the markers were carried through. Those files have no container
at all, so they still depend entirely on literal heading matches. If it is
wanted: a heading recognised either as bolded (optionally preceded by a stray
marker) or as bare text terminated by a colon; bullets accepting any common
marker; the block separator as any run of 3+ dashes with optional `\r`; and a
separator-split fragment that starts no new question but carries answer-block
structure re-joined to the question it belongs to. This was written and passed
13 drift cases plus 2 safety cases (an option bullet beginning `- Answer: …`
must stay an option, not become a heading).

**The fix that would close the whole class.** None of the above catches drift at
generation time. `callAI` retries on HTTP status only, so a malformed response is
accepted and surfaces hours later in the instructor repository. Running
`parseQuestions` against the response and re-prompting when any question comes
back with no distractors would turn every row in this table into a retry costing
cents, and is the only approach that also covers drift nobody has thought of yet.

## Not addressed — the pre-rename workflow file is left in place

A repository created before commit `3070d29` has
`.github/workflows/generate-brightspace-quizzes.yml` as well as the
`generate-lms-quiz.yml` the sync now gives it. The old file is
`workflow_dispatch`-only — it has no `push:` trigger at all, which is why those
repositories generated nothing on a student push — so it costs nothing until
somebody dispatches it by hand from the Actions tab and gets the 2026-era
generator, with none of the fixes above. Deleting it was considered and left
out: nothing in the delivery path removes files, and a delete is the one
operation here that cannot be undone by the next run.

**Fix, if wanted.** `repos.deleteFile` on that path when it exists, guarded the
same way as the sync. Or delete it by hand — it is one file per
pre-rename repository, and the Actions tab shows which repositories still have
it.

---

## Operational note — the first sync sweeps the whole class

The first delivery after a repository receives a push-triggered workflow
generates a package for **every** student in it, not just the one who pushed —
each run sweeps all students, and none of them have a `gmc_content_hash` on
file yet. For a class of thirty that is thirty packages in one run, serialised
by the workflow's `concurrency: generate-lms-quiz` group. It is slow, not
broken, and it happens once.

## Operational note — regenerating an already-generated quiz

`gmc_content_hash` is a hash of `PACKAGE_FORMAT` plus `questions.md`, stored
inside the `.imscc` and on the `//gmc_content_hash` comment line of the `.csv`.
A student is skipped only when both files exist and both carry the current hash. Bumping `PACKAGE_FORMAT` therefore invalidates every stored
hash and forces all packages to rebuild on the next run — do that whenever the
generated package changes shape.

It does **not** cover parser changes, which alter the questions extracted from an
unchanged `questions.md` without changing its bytes. If a quiz was generated with
buggy parsing and `questions.md` has not changed, re-running the workflow still
skips it (`Unchanged, skipping: …`); delete the affected `*_quiz.imscc` or
`*_brightspace_quiz.csv` files first, then dispatch — or bump `PACKAGE_FORMAT` along with the parser fix.
