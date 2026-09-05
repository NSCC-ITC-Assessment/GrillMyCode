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

---

## Not addressed — the same failure mode via other formatting drift

The stray-marker fix listed above covers the one drift that was actually
observed. The parser still matches every other structural marker by exact
string, so other drift still loses questions — but since the withhold-and-warn
backstop is now in place, a lost question is reported rather than silently
exported as a free mark. That is what takes this off the urgent list: the
remaining cost is questions going missing from quizzes, not questions being
scored wrongly.

Each of these was reproduced against the real parser:

| Drift in `questions.md`                                              | Result                            |
| -------------------------------------------------------------------- | --------------------------------- |
| `**Distractors:**` (shortened heading)                               | question withheld, warning raised |
| `**Distractors for Multiple Choice Quiz:**` (no hyphen)              | question withheld, warning raised |
| `**Distractors for Multiple-Choice Quiz**:` (colon outside the bold) | question withheld, warning raised |
| A stray `---` between the answer and the distractor heading          | question withheld, warning raised |
| `*` or `+` instead of `-` for option bullets                         | question dropped silently         |
| An indented question line                                            | question dropped silently         |
| CRLF line endings with multiple questions                            | all questions merge into one      |
| `----` or `---` plus trailing space as a separator                   | two questions merge into one      |

Note the split: drift that breaks the _distractor_ section is caught by the
backstop, because the question still parses and its empty option list is
visible. Drift that breaks the _question line or the answer_ is not — such a
block never becomes a question at all, so there is nothing to count or warn
about, and it disappears from the quiz without comment. The last four rows are
therefore still silent: the two drop cases yield no question at all, and the two
merge cases yield one question carrying both questions' options — six choices
instead of three, which imports without complaint.

The stray-`---` case is a known model habit: `stripAnswers` in `src/main.js`
already guards the student-facing copy against it (see the `GMC_SEP`
placeholder), but the instructor copy is written raw, so `parseQuestions`
splits the block there and strands the distractors.

**Fix, if wanted.** Match the markers with tolerant regexes instead of exact
strings — a heading recognised either as bolded (optionally preceded by a stray
marker) or as bare text terminated by a colon; bullets accepting any common
marker; the block separator as any run of 3+ dashes with optional `\r`; and a
separator-split fragment that starts no new question but carries answer-block
structure re-joined to the question it belongs to. This was written and passed
13 drift cases plus 2 safety cases (an option bullet beginning `- Answer: …`
must stay an option, not become a heading).

---

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
inside the `.imscc`. Bumping `PACKAGE_FORMAT` therefore invalidates every stored
hash and forces all packages to rebuild on the next run — do that whenever the
generated package changes shape.

It does **not** cover parser changes, which alter the questions extracted from an
unchanged `questions.md` without changing its bytes. If a quiz was generated with
buggy parsing and `questions.md` has not changed, re-running the workflow still
skips it (`Unchanged, skipping: …`); delete the affected `*_quiz.imscc` files
first, then dispatch — or bump `PACKAGE_FORMAT` along with the parser fix.
