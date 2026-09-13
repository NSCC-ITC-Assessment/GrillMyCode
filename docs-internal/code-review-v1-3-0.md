# Code Review — Internal Reference

> **Application version:** v1.3.0 (`cb31940`)
> **Reviewed:** 2026-09-12
> **Scope:** `src/`, `scripts/`, `action.yml`, `Dockerfile`, `.github/workflows/`

A correctness sweep of the action, independent of the security audit in
`security-audit-v1-0-16.md` (which covers the prompt-injection surface and is
not re-litigated here). It is intended for maintainers and future contributors,
not end users.

Every finding below was reproduced by running the code, not inferred by reading
it. Reproductions are included verbatim so a fix can be verified against the
same input, and so a regression is recognisable without re-deriving the
analysis.

At the time of review `pnpm lint`, `pnpm format:check` and `pnpm test`
(11 tests, `test/submission-identity.test.js`) all pass. None of the findings
below are caught by the existing suite — see
[Gap: the post-processing path is untested](#gap-the-post-processing-path-is-untested).

---

## Status

| #                                                                                             | Finding                                           | Severity | Status |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------- | ------ |
| [1](#finding-1--nested-vendor-directories-are-never-excluded)                                 | Nested vendor directories are never excluded      | High     | Fixed  |
| [2](#finding-2--the-job-summary-never-renders-on-a-successful-run)                            | Job summary never renders on a successful run     | High     | Fixed  |
| [3](#finding-3--fencen-placeholder-collides-with-student-controlled-text)                     | `FENCE<n>` placeholder collides with student text | Medium   | Fixed  |
| [4](#finding-4--head_sha-on-its-own-is-silently-ignored)                                      | `head_sha` on its own is silently ignored         | Medium   | Fixed  |
| [5](#finding-5--boldquestionlines-corrupts-code-blocks-and-answer-interiors)                  | `boldQuestionLines` corrupts code blocks          | Medium   | Fixed  |
| [6](#finding-6--unguarded-message-access-in-the-ai-response)                                  | Unguarded `message` access in the AI response     | Medium   | Fixed  |
| [7](#finding-7--retry-after-is-honoured-without-a-cap)                                        | `Retry-After` honoured without a cap              | Medium   | Fixed  |
| [8](#finding-8--unguarded-graphql-mutations-in-issue-delivery)                                | Unguarded GraphQL mutations in issue delivery     | Medium   | Fixed  |
| [9](#finding-9--assorted-minor-issues)                                                        | Assorted minor issues (7 items)                   | Low      | Partly |
| [10](#finding-10--a-stray-separator-inside-an-answer-container-disables-the-structural-guard) | Stray separator disables the structural guard     | High     | Fixed  |

---

## Finding 1 — Nested vendor directories are never excluded

**Severity:** High — cost, prompt quality, and assessment validity
**Location:** `scripts/fetch-gitignore-templates.js:33-48`, `src/data/gitignore-templates.json`, `src/constants.js` (`FALLBACK_EXCLUDE_PATTERNS`), `src/stack-detection.js` (`ALWAYS_EXCLUDE`)

### Symptom

Excluded directories are only excluded at the repository root. Any nested
occurrence is collected, comment-stripped, and sent to OpenRouter.

### Reproduction

Matching uses `minimatch(f, p, { dot: true, matchBase: true })`
(`src/files.js:filterFiles`). `matchBase` only applies to patterns that contain
**no slash**, so every `foo/**` pattern is effectively root-anchored:

```
kept     frontend/node_modules/react/index.js   <- node_modules/**
kept     backend/venv/lib/site.py               <- (entire Python template)
kept     src/__pycache__/x.pyc                  <- __pycache__/**
kept     app/dist/bundle.js                     <- dist/**
kept     a/b/target/Main.class                  <- target/**
EXCLUDED __pycache__/x.pyc                      <- __pycache__/**
EXCLUDED sub/.env                               <- .env          (no slash → matchBase applies)
```

Checked against the real bundled templates rather than hand-written patterns:

```
node_modules entries in the Node template: [ 'node_modules/**' ]
frontend/node_modules/react/index.js excluded by Node template?   false
backend/venv/lib/site.py excluded by Python template?             false
```

### Scale

2,473 of the 4,552 distinct patterns in `gitignore-templates.json` are in this
root-anchored form. `FALLBACK_EXCLUDE_PATTERNS` in `src/constants.js` and
`ALWAYS_EXCLUDE` in `src/stack-detection.js` share the shape, so the bug is
present on the detected-stack path, the no-stack-detected path, and the
API-unreachable path alike.

### Root cause

`parseGitignore` translates gitignore syntax to minimatch globs but drops
gitignore's anchoring rule. In gitignore, a pattern **without** a leading slash
matches at any depth; only a pattern **with** a leading slash is root-anchored.
The generator strips the leading `/` (`scripts/fetch-gitignore-templates.js:32`)
and emits `foo/**` for both cases, collapsing the distinction in the
root-anchored direction.

### Impact

A student who runs `npm install` inside `frontend/`, or any monorepo layout,
ships their entire dependency tree to the AI provider. The consequences compound:
token spend, prompt overflow ahead of the real submission, and questions written
about library code rather than the student's own work.

### Fix

In the generator, preserve the anchoring the source file expresses:

- leading `/` → root-anchored, emit `foo/**` as today;
- no leading `/` → unanchored, emit `**/foo/**`.

Then regenerate `gitignore-templates.json` (the
`refresh-gitignore-templates.yml` workflow does this) and apply the same
`**/` prefixing by hand to `FALLBACK_EXCLUDE_PATTERNS` and `ALWAYS_EXCLUDE`.

Note that the anchoring information is already lost in the committed JSON, so a
regeneration is required — an in-place transform of the existing file cannot
distinguish the two cases and would have to treat every pattern as unanchored.

Once patterns carry explicit `**/` prefixes, `matchBase: true` in `filterFiles`
becomes redundant and can be dropped, which also removes a second surprise:
`additional_exclude_patterns: "test.js"` currently excludes every `test.js`
anywhere in the tree.

### Resolution

Fixed. `parseGitignore` now implements gitignore's real anchoring rule — a
separator at the beginning **or in the middle** of a pattern anchors it to the
root, anything else matches at any depth and is emitted with an explicit `**/`
prefix. `gitignore-templates.json` was regenerated through that parser (312
templates, 5,337 distinct patterns, up from 4,552 because unanchored directory
names now also emit a `name/**` form). `FALLBACK_EXCLUDE_PATTERNS` and
`ALWAYS_EXCLUDE` were prefixed by hand to match; neither list now contains a
root-anchored entry.

Every path in the reproduction above is excluded by its template.
`test/exclude-patterns.test.js` covers both the parser's anchoring cases and the
end-to-end filtering, so a regression fails the suite rather than showing up in
a bill.

Two deliberate departures from the fix as written above:

- **`matchBase: true` was kept in `filterFiles`.** It is now inert for the
  built-in patterns, which all contain a slash. Dropping it would only change
  the meaning of instructor-supplied input, silently re-anchoring an existing
  `additional_exclude_patterns: starter.py` to the repository root and letting
  `src/starter.py` back into the assessment. The depth-independent behaviour is
  documented in `action.yml` and in the pattern-syntax reference instead, so it
  is a stated rule rather than a surprise.
- **Non-glob patterns containing a slash now also emit a `name/**` form.**
  `build/Release` previously excluded only a file by that name, never the
  directory's contents. The generator's bare-name branch was widened to cover
  it, since it is the same "directory contents are not excluded" defect.

One consequence worth knowing: correct anchoring makes the upstream templates
stricter where they always meant to be. The `Python` template ignores `lib/`
unanchored, so a Python repository's `src/lib/helper.py` is now excluded — which
is what `git` itself does with that template. `exclude_pattern_overrides` is the
escape hatch if an assignment keeps student code there.

### Audit of the behaviour change

Run after the fact, by replaying representative submissions through
`filterFiles` with the pre- and post-fix pattern sets. The intended wins land:
`frontend/node_modules/react/index.js`, `app/dist/bundle.js` and
`backend/venv/lib/site.py` are excluded where they previously were not.

The collateral is narrower than feared but real. Scanning every template for
directory patterns that became depth-independent and could plausibly hold
student source, then filtering to templates the detector can actually select:

| Template                   | Reached by        | Newly excluded student code |
| -------------------------- | ----------------- | --------------------------- |
| `Python`                   | language / config | `src/lib/…`, `app/lib/…`    |
| `community/JavaScript/Vue` | `.vue` files      | `src/test/…`                |
| `R`                        | language          | `analysis/docs/…`           |

`Python` is the one that matters: `lib/` is an ordinary package directory, and
any assignment whose layout is `src/lib/` silently loses that code from the
assessment. `Global/Eclipse` and `ArchLinuxPackages` also gained `**/bin/**` and
`**/src/**`, but neither is reachable from the detector, so neither can fire.

The mitigation works and should be documented per-assignment:

```yaml
exclude_pattern_overrides: src/lib/** # re-includes student code only
```

`**/lib/**` also works but re-includes a root-level `lib/` build directory along
with it, so prefer the specific path.

---

## Finding 2 — The job summary never renders on a successful run

**Severity:** High — the entire run-summary feature is inert by default
**Location:** `src/files.js:126,136,151,197`; consumed at `src/main.js:675-688`; throws at `src/main.js:311`

### Symptom

`renderOverview`, `renderAssessedFiles`, `renderExcludedFiles`,
`renderDelivery`, `renderConfiguration` and `renderNotes` produce nothing on the
run page. Every successful run's summary is silently discarded.

### Reproduction

`readAssignmentContextFiles` returns two different shapes. The success path
returns an object (`src/files.js:197`); all three early returns return a bare
string (`src/files.js:126`, `:136`, `:151`):

```
no globs -> ""
content: undefined matchedFiles: undefined
CRASH: Cannot read properties of undefined (reading 'length')
```

### Root cause

The caller destructures the return value:

```js
const { content: assignmentContext, matchedFiles: assignmentContextFiles } =
  await readAssignmentContextFiles(...);           // src/main.js:675
```

Destructuring `''` yields `undefined` for both names. With `assignment_context`
unset — the default — `state.assignmentContextFiles` is then assigned
`undefined` (`src/main.js:688`), overwriting the `[]` from `createRunState`.

`renderConfiguration` dereferences it unconditionally:

```text
state.assignmentContextFiles.length > 0        // src/main.js:311
```

The `blocks` array in `writeRunSummary` is built eagerly, so this `TypeError`
is thrown while assembling the summary, caught by that function's own
`try/catch`, and reported only as `core.debug` — below the default log level.
The whole summary is lost, not just the configuration block.

This is why the failure is invisible: the summary is deliberately written to
never throw, and that guard swallows the bug.

### Why it is not caught elsewhere

`formatReport` guards the same value (`assignmentContextFiles && ...`,
`src/report.js:50`), so the report is unaffected and the run still succeeds. The
`reportEmptyAssessment` path writes its own summary and returns before line
1004, so a "nothing to assess" run **does** render — which makes the bug look
like the opposite of what it is.

### Fix

Return a consistent shape from all four exits:

```js
return { content: '', matchedFiles: [] };
```

Secondary: `matchedFiles` currently reports every glob-matched path, including
files skipped by the `maxChars` truncation `break` (`src/files.js:186`), so the
report can name a context file whose content was never sent. Populate it as
files are actually consumed.

### Resolution

Fixed. All four exits of `readAssignmentContextFiles` now return
`{ content: '', matchedFiles: [] }`, so the caller's destructure yields an array
on every path and `state.assignmentContextFiles` keeps the shape
`createRunState` gave it. The reproduction above now prints
`{"content":"","matchedFiles":[]}` and reads `.length` without throwing.

The secondary issue is fixed too: `matchedFiles` is built as files are actually
consumed rather than from the glob match list, so the report can no longer name
a context file the `maxChars` cap dropped. A file that truncation cut into is
still named, but only when the cap left room past its `### \`path\`` header for
some of its real content — a fragment of the heading is not context.

One addition beyond the fix as written: the `catch` in `writeRunSummary` now
reports at `core.warning` rather than `core.debug`. Never failing the run over a
summary is right; staying silent about it is what let a `TypeError` discard the
summary on every successful run for as long as the feature has shipped. The
guard still swallows the error — it just says so now.

`test/assignment-context.test.js` covers all four exits against the destructure
the caller performs, plus the `matchedFiles` accounting across the truncation
boundary. Not covered: `writeRunSummary` itself, which would need `core.summary`
stubbed; the tests pin the shape at the source instead.

---

## Finding 3 — `FENCE<n>` placeholder collides with student-controlled text

**Severity:** Medium — content corruption, trivially reachable by a student
**Location:** `src/postprocess.js:160-166`, `:225` (was `src/main.js:187-191`, `:231`
before the extraction recorded below)

### Symptom

A question stem mentioning an identifier of the form `FENCE` + digits is
rewritten — either spliced with a whole code block, or replaced by the literal
string `undefined`.

### Reproduction

Student code declaring `const FENCE1 = true;`, with the model writing the
obvious question about it, through `stripAnswers`:

```
1. **What does the constant undefined hold?**
```

`FENCE1` resolved to `fences[1]`, which does not exist (only one block was
protected, at index 0), so `undefined` was interpolated into the question.
A repository with two or more code blocks yields the other half of the bug:
an entire fenced block spliced into the middle of a question sentence.

### Root cause

`stripAnswers` protects fenced code blocks by substituting a placeholder before
running the answer-region regexes, then restoring:

```js
return `FENCE${fences.length - 1}`;                       // src/main.js:190
...
result = result.replace(/FENCE(\d+)/g, (_, i) => fences[parseInt(i, 10)]);  // src/main.js:231
```

The restore pattern matches _any_ occurrence of `FENCE<digits>` in the text, not
only the ones this function inserted. The model's prose is derived from student
code, so the student chooses whether such a token appears.

The comment immediately above the substitution already specifies the correct
design and does not match the code:

> The placeholder uses null bytes, which cannot appear in normal Markdown.

No null byte is used. `GMC_SEP` (`src/main.js:198`) has the same weakness,
though it is harder to reach because fenced blocks are already protected by the
time it is introduced.

### Fix

Use the null-byte sentinel the comment describes, e.g. `\0FENCE${n}\0`, and
restore on `/\0FENCE(\d+)\0/g`. Null bytes cannot survive in Markdown the model
emits, which is exactly the property the placeholder needs. Guard the restore
against an out-of-range index so a malformed match degrades to leaving the text
alone rather than writing `undefined`.

### Resolution

Fixed, but the finding's reproduction is wrong and the correction matters more
than the fix.

The placeholder was never a bare `FENCE<n>`. It was `\uE001FENCE<n>\uE001`, and
`GMC_SEP` was likewise wrapped in `\uE000` — Private Use Area codepoints, which
render as nothing in a terminal, a diff, an editor, and in the code quoted in
this document. The finding was written by reading code whose most important
characters are invisible. A student writing `const FENCE1 = true;` does **not**
corrupt their own assessment; the reproduction above was run and does not
reproduce.

What is real is the residual: a PUA codepoint has no barrier to entry. A student
who pastes U+E001 into their source has it survive `git show`, the UTF-8 read,
the prompt, and the model's prose, and can then hijack the restore pass. Feeding
`\uE001FENCE7\uE001` through `stripAnswers` as it stood produced

```
1. **What is undefined?**
```

which is the corruption this finding describes, reached by a different route.

So the prescribed fix was applied on its own merits. The sentinels are now null
bytes, which is what the comment always claimed and is strictly stronger than
PUA characters: `collectRawFiles` already drops any file containing a null byte,
so student code cannot carry the sentinel into the pipeline at all. The restore
guards its index (`fences[Number(i)] ?? match`) and leaves an unmatched token
untouched instead of writing `undefined`, and a final sweep strips any surviving
null byte so none can reach a report. Output is byte-identical to the previous
implementation. Replayed against the pre-review baseline (`8f62850`) across 16
output shapes — canonical blocks, indented containers, tilde fences, multiple
fences, markers embedded in code, CRLF endings, four-dash separators, fences
containing `---`, stray markers, empty input — in both answer modes: **32/32
identical**. Only the hostile input changed. That corpus is constructed, not
captured model output, so it is evidence rather than proof.

`test/strip-answers.test.js` covers both token routes and pins the sentinels:
one test asserts no PUA codepoint and no literal control character appears
anywhere in `src/postprocess.js`, because the whole defect here was an invisible
character nobody could see.

### A misstep worth recording

To make `stripAnswers` testable, `run()` was first put behind an
`import.meta.url === process.argv[1]` entrypoint guard, matching what
`scripts/fetch-gitignore-templates.js` does. It was smoke-tested with
`node src/main.js` and worked. It does **not** survive a symlinked path: Node
resolves `import.meta.url` through symlinks and `path.resolve` does not, so the
comparison fails, `run()` never fires, and the action exits **0 having done
nothing**. Silent success is the worst failure mode a CI action can have, and it
was traded for test convenience.

The current Dockerfile is not affected — `COPY src/ ./src/` produces a real
directory — but the guard has been removed regardless. The post-processing
functions now live in `src/postprocess.js` and `main.js` runs unconditionally
again, which is the fix the testing-gap section below always recommended. All
three invocation shapes were re-verified: relative path, absolute path from a
different working directory, and through a symlink.

While fixing this, the `GMC_SEP` substitution was found to be inert:
`ANSWER_REGION_RE` is lazy but still spans everything between the answer
markers, so a `---` inside a container is consumed whether or not it was swapped
for a placeholder first. That was first written up here as harmless dead weight.
**That was wrong** — the inertness is itself a High-severity defect, recorded as
[Finding 10](#finding-10--a-stray-separator-inside-an-answer-container-disables-the-structural-guard)
and fixed in the same change.

---

## Finding 4 — `head_sha` on its own is silently ignored

**Severity:** Medium — documented input does nothing
**Location:** `src/context.js:27-31`, `:114-116` (line numbers as at the
reviewed revision `cb31940`; the fix has since moved them)

### Symptom

Setting `head_sha` without also setting `base_sha` has no effect. The head comes
from the event as though the input were absent. No warning is emitted.

### Root cause

`resolveSHAs` honours a manual override only when **both** are supplied:

```js
if (inputs.baseSha && inputs.headSha) {       // src/context.js:27
  return { baseSha: ..., headSha: ... };
}
```

After the event-derived resolution there is a tail that applies a `base_sha`-only
override:

```js
if (inputs.baseSha) {
  // src/context.js:114
  baseSha = sanitiseSha(inputs.baseSha);
}
```

There is no matching branch for `headSha`, so the `head_sha`-only case falls
through every path unhandled.

### Correction to this finding as first written

The original write-up said both inputs were "documented independently in
`action.yml:233` ... with no stated requirement to supply them as a pair."
**That was wrong.** `action.yml:236-240` stated the requirement explicitly:

> Override the head commit SHA for the diff. Only applied when base_sha is also
> provided — both must be set together for the manual override to take effect.

The cited `action.yml:233` is the `required: false` line of `base_sha`, not the
`head_sha` description. So the canonical input contract described the behaviour
accurately, and the inconsistency was everywhere else:

- `README.md:51` and `docs-site/docs/reference/inputs-outputs.md:34` say only
  "Override the head commit SHA", with no caveat.
- `docs-site/docs/development/architecture.md:156` states the opposite outright:
  "Manual `base_sha` / `head_sha` inputs always take precedence over all of the
  above."
- `src/main.js:298` renders "Manual SHA override: **in effect**" from
  `i.baseSha || i.headSha`, so a run configured with `head_sha` alone told the
  instructor in its own job summary that the override had been applied while it
  had not. That is the sharpest form of the defect and the original write-up
  missed it: not merely silent, but actively contradicted by the report.

The asymmetry is what settles it. `base_sha` alone works; `head_sha` alone does
not, for no reason either the code or the docs give. Treating the action.yml
sentence as the intended contract would mean documenting the asymmetry in three
more places; making the input behave as its name implies is the smaller change
and the one the rest of the codebase already assumes.

### Fix

Fixed in `src/context.js`. The override is resolved up front and applied where
the event-derived head is computed, not in a tail at the end:

```js
const overrideHead = inputs.headSha ? sanitiseSha(inputs.headSha) : null;
...
headSha = overrideHead ?? sanitiseSha(ctx.payload.after);   // push
headSha = overrideHead ?? sanitiseSha(ctx.sha);             // everything else
```

### The fix this finding originally recommended is a regression

The original recommendation was to add a symmetric `if (inputs.headSha)` tail
beside the `base_sha` one and then delete the `if (baseSha && headSha)` fast
path as redundant. **That fast path is not redundant, and removing it breaks
cases that work today.** It is a short-circuit that skips event parsing
entirely when both ends are already named; without it, `ctx.payload.before` and
`ctx.sha` are parsed on the way to an override that had already answered the
question, and `sanitiseSha` throws on a payload that no longer matters.

Both forms were applied to the real module and probed across nine
event/override combinations. Applying the recommendation verbatim:

```
                            before fix        review's fix      shipped fix
push: head_sha only         head=cccc ✗       head=dddd ✓       head=dddd ✓
dispatch: head_sha only     head=cccc ✗       head=dddd ✓       head=dddd ✓
push junk payload: both     base=eeee ✓       THREW      ✗      base=eeee ✓
dispatch no ctx.sha: both   base=eeee ✓       THREW      ✗      base=eeee ✓
dispatch no ctx.sha: head   THREW     ✗       THREW      ✗      head=dddd ✓
```

The recommendation fixes the reported defect and introduces two new ones. The
shipped form is the only one of the three with no ✗.

Two further points decided the placement:

- **`skip_committers` ordering.** The tail form leaves
  `getLeadingSkipCandidates(baseSha, headSha, …)` walking `base..eventHead`
  while the caller asked about `base..overrideHead`, advancing the base against
  a head that is then discarded. Resolving the override before that block means
  the bot-commit walk ranges over the commits actually being assessed.
- **Why `base_sha` cannot move up with it.** `base_sha` is documented as taking
  precedence over `include_initial_commit`, which unconditionally rewrites
  `baseSha`. It therefore has to stay after that block. The asymmetric
  placement is deliberate and commented in the source.

### Documentation

- `action.yml:236-240` — the pairing requirement removed; `head_sha` now
  documented as applying on its own or with `base_sha`.
- The workflow wizard (`docs-site/docs/_workflow-wizard/generateYaml.js:357`
  and `docs-site/docs/_workflow-wizard/steps/StepAdvanced.js:81`, mirrored in
  `docs-site/versioned_docs/version-1/`) gated
  the whole SHA-override block behind `cfg.baseSha && cfg.headSha` and hid the
  Head SHA field until a base was typed. Each input is now emitted
  independently. Note this was _already_ wrong before this finding: a lone
  `base_sha`, which has always worked, was silently dropped from the generated
  workflow.
- `README.md:51`, `docs-site/docs/reference/inputs-outputs.md:34` and
  `docs-site/docs/development/architecture.md:156` needed no
  change — they already described the behaviour now implemented.

### Tests

`test/head-sha-override.test.js`, 9 cases, mocking `src/git.js`. Five fail
against the unfixed module and pass against the fixed one; the other four pass
in both and exist to pin the no-regression cases — in particular the two
junk-payload cases that the recommended fix would have broken.

Not covered: `resolveSHAs` is otherwise untested, so the `skip_committers`
verification loop, the all-zero-`before` first-push branch and the
`include_initial_commit` logging paths remain without coverage. These tests
exercise SHA resolution only.

---

## Finding 5 — `boldQuestionLines` corrupts code blocks and answer interiors

**Severity:** Medium — visible corruption of the code shown to the student
**Location:** `src/postprocess.js:96-97`

### Symptom

`**` markers are injected into fenced code blocks and into `<!-- gmc:answer -->`
regions, wherever a line begins with a number and a period.

### Reproduction

````text
1. **What is x?**

```text
1. **step one in the student data file**
```

<!-- gmc:answer -->
**Answer:**
1. **the first item**
<!-- /gmc:answer -->
````

Only the first line should have been touched — the injected `**` inside the
fenced block and inside the answer region are both the defect.

### Root cause

The implementation is a single unscoped regex:

```js
return text.replace(/^(\s*\d+\. )(?!\*\*)(.+)$/gm, '$1**$2**'); // src/postprocess.js:97
```

It has no fence tracking and no marker tracking, contradicting its own doc
comment:

> Skips lines already wrapped in bold, and skips the `<!-- gmc:answer -->`
> interior so answer headings and bullets are never touched.

Only the "already bold" clause is implemented, via the `(?!\*\*)` lookahead.

Because `boldQuestionLines` runs before `stripAnswers` (`src/main.js:724-734`),
the injected markers are inside the fence before `stripAnswers` protects it, so
the fence-protection in Finding 3 does not help here. `splitBoldAroundCode`
(`src/postprocess.js:110`) then compounds the damage on the same lines.

### Fix

`renumberQuestions` (`src/postprocess.js:60-87`), directly above, already performs
exactly the required walk — it tracks `inFence` and `inAnswer` line by line and
skips both. Reuse that traversal for the bolding pass rather than maintaining a
second, weaker notion of the same thing.

### Resolution

Fixed, but reusing `renumberQuestions`'s walk as written would have carried its
own defects into the bolding pass. Probing it showed two:

- **Fence tracking was a bare toggle.** Any line starting with ` ``` ` or
  `~~~` flipped `inFence`, so a `~~~` line inside a backtick fence "closed" it,
  renumbering the code below and skipping the real stem after it. (A four-backtick
  fence wrapping a ` ``` ` line happened to work, by luck of an even count.)
- **The opening answer marker matched anywhere on a line**, so a marker quoted in
  question prose opened a region that swallowed every later question.

All three stem-rewriting passes — `renumberQuestions`, `boldQuestionLines`, and
`splitBoldAroundCode`, which had the same unscoped regex and was not named in the
finding — now go through one private `mapTopLevelLines` walker. A fence closes
only on a run of the same character at least as long with nothing after it; a
backtick opener may not contain a further backtick. The opening answer marker
must start its line; the closing marker may trail the final bullet. An unclosed
fence or region runs to the end of the text, leaving those lines alone — bolding
and renumbering are cosmetic, so declining to guess is the safe failure.

Replayed old against new on 9 well-formed shapes (canonical blocks, already-bold
stems, tilde fences, indented containers, CRLF, multiple fences, `---` inside a
fence, empty, no numbers) across all three passes: **27/27 identical**.
Constructed corpus, so evidence rather than proof. `test/question-lines.test.js`
covers the reproduction and every edge case above.

**Follow-up — truncation and the question count.** `truncateToMaxQuestions` had
the same unscoped regex, with a worse outcome: with `num_questions: 1`, a `2.`
line inside question 1's code block cut the report off at the fence, deleting
the rest of the question. The job-summary count in `main.js`
(`state.questionsGenerated`) likewise counted numbered lines in code and answers.
Both now use the walker (`countQuestions` is exported for `main.js`), and
truncation matches the exact next number rather than a prefix of it. Old against
new on 8 well-formed shapes × 5 limits, plus the count on each: **48/48
identical**.

Still unscoped: `isQuestionBlock` in the redaction guard. A block whose only
numbered line is inside code is treated as a question and must carry an answer
container or be withheld — that fails closed, so it was left alone.

---

## Finding 6 — Unguarded `message` access in the AI response

**Severity:** Medium — bypasses the retry ladder it sits inside
**Location:** `src/ai.js:157`

### Symptom

A provider response whose choice carries no `message` object throws a raw
`TypeError` out of `callAI`, failing the run immediately instead of retrying.

### Root cause

`choices` is length-checked but its element's shape is not:

```js
if (!data.choices || data.choices.length === 0) { ... }    // src/ai.js:153
const content = data.choices[0].message.content;           // src/ai.js:157
```

OpenRouter proxies many upstream providers and normalises their responses
imperfectly; a `delta`-shaped choice (streaming shape leaking into a
non-streaming response) or an error-shaped choice has no `message`. The very
next block (`src/ai.js:160-173`) exists to retry exactly this class of failure —
"the model may have refused the request or hit a quota limit" — but the
`TypeError` is thrown before it can run.

### Fix

```js
const content = data.choices[0].message?.content;
```

`content` is then `undefined` and falls into the existing null-content retry
path, which already logs `finish_reason` and backs off.

### Resolution

Fixed, more broadly than the one-character fix above. Feeding 200 responses
through `callAI` showed the missing `message` was one of four shapes that
escaped as a raw `TypeError`:

```
{ choices: [{ delta: {...} }] }            TypeError: reading 'content'
{ choices: [null] }                        TypeError: reading 'message'
null                                       TypeError: reading 'choices'
{ choices: [{ message: { content: [] } }] } TypeError: content.trim is not a function
```

The choice is now read once as `data?.choices?.[0]`. A missing choice (including
a null body or a null element) takes the existing non-retried "empty choices"
error. Content that is not a string — absent, null, or an array of content parts
— takes the retry path, whose wording changed from "null content" to "no text
content" to stay accurate. The `native_finish_reason` read goes through the same
guarded `choice`.

`test/ai-response.test.js` stubs `fetch` and fast-forwards the backoff: 5 of its
9 tests fail against the pre-fix `ai.js`, all pass after.

**Follow-up — two more responses that bypassed the retry ladder**, fixed after a
maintainer decision:

- **A 200 carrying `{ error: { code, message } }` and no `choices`.** OpenRouter
  documents this as the shape of an upstream failure once generation has started,
  with `error.code` mirroring the HTTP status it could no longer send. It was
  reported as "empty choices", discarding the provider's message. It is now
  retried when `error.code` is in `AI_RETRYABLE_STATUS_CODES` (a numeric string
  is accepted), and otherwise fails at once with the code and message. There is
  no `Retry-After` on this path, so a 429 here uses ordinary backoff.
- **A 200 whose body is not valid JSON** (a dropped connection or a proxy page)
  threw a bare `SyntaxError`. It is now retried like a network failure, and on the
  last attempt fails with a descriptive error carrying the `SyntaxError` as
  `cause`.

Both share the existing `retryMaxAttempts` budget. `test/ai-response.test.js` now
has 20 tests. `docs-site/docs/development/architecture.md` describes both paths;
the user-facing retry descriptions (`action.yml`, README, inputs reference) list
status codes and network failures, which remain accurate, and were left alone.

---

## Finding 7 — `Retry-After` is honoured without a cap

**Severity:** Medium — a single response can stall the runner
**Location:** `src/ai.js:40-58`, `:133-138`

### Symptom

A 429 carrying a large `Retry-After` sleeps for that full duration, once per
remaining attempt.

### Root cause

Every other delay in the module is bounded by `AI_RETRY_MAX_DELAY_MS` (30s) via
`backoffDelay`. The `Retry-After` path is not:

```js
const retryAfterMs = parseRetryAfterMs(response);
delay = retryAfterMs !== null ? retryAfterMs : backoffDelay(...);   // src/ai.js:135-138
```

`parseRetryAfterMs` returns the header value unmodified, in both the
integer-seconds and HTTP-date forms. `Retry-After: 3600` therefore sleeps for an
hour, and with the default `ai_retry_max_attempts: 5` a persistent limit can
consume four of them — well past the job's useful lifetime, with no output.

The instructor-repository client already solves this correctly:
`rateLimitDelayMs` (`src/delivery/instructor-repo.js:258-271`) caps every wait
at `INSTRUCTOR_RATE_LIMIT_MAX_WAIT_MS` and documents why.

### Fix

Cap the parsed value the same way, against `AI_RETRY_MAX_DELAY_MS` or a
dedicated constant. Waiting the capped time and retrying is strictly better than
sleeping past the job timeout: if the limit has not cleared, the attempt budget
runs out and the run fails with a real diagnosis.

### Resolution

Fixed. The `Retry-After` value is clamped to `[0, AI_RETRY_MAX_DELAY_MS]` at the
429 retry site in `callAI`, so every AI wait now shares the one 30s ceiling. A
dedicated constant was not added: `AI_RETRY_MAX_DELAY_MS` already means "the
longest a single AI retry may wait", and a second knob would only let the two
drift apart. The 60s instructor-repository cap stays separate because GitHub's
secondary-limit guidance calls for at least a minute; OpenRouter gives no such
guidance.

When the cap applies, the retry warning names the requested wait
(`Retrying in 30000ms (Retry-After asked for 3600000ms; capped)…`), so a log
that ends in a 429 shows the provider wanted far longer than the action waited.

`test/ai-response.test.js` covers a small value honoured to the millisecond and
an hour-long value capped at 30s in both the integer-seconds and HTTP-date
forms; the two cap tests fail against the previous code. `action.yml`, the
README, the example workflow and the architecture page now say the value is
honoured up to 30 seconds. The versioned v1 docs were left as the snapshot they
are.

---

## Finding 8 — Unguarded GraphQL mutations in issue delivery

**Severity:** Medium — fails the run after the work has already succeeded
**Location:** `src/delivery/issue.js:81`, `:99-107`; related `:63`

### Symptom

A permissions failure while tidying duplicate issues fails the whole run, after
the assessment has been generated, the PDF uploaded, and the issue posted.

### Root cause

The three GraphQL mutations are guarded inconsistently. `pinIssue` is wrapped
and downgraded to a warning (`src/delivery/issue.js:123-131`), on the reasoning
that pinning is cosmetic. `updateIssue` (`:81`) and `deleteIssue` (`:99`) are
not wrapped at all, and `deleteIssue` requires admin rights that a stock
`GITHUB_TOKEN` does not necessarily carry. The resulting throw propagates to
`run()`'s outer `catch`, which calls `core.setFailed` — so an instructor sees a
red run for a repository whose assessment was delivered correctly.

Deleting duplicates is housekeeping, in the same class as pinning, and should
not be able to fail a delivered assessment.

### Related — over-broad predecessor match

```js
const searchStr = branchName ? `GrillMyCode Questions (${branchName})` : 'GrillMyCode';
const predecessors = existing.data.filter((i) => i.title.startsWith(searchStr));
```

When `branchName` is empty, `searchStr` collapses to `'GrillMyCode'`.
`resolveBranch` (`src/context.js:154`) returns `match ? match[1] : ref`, so it
yields `''` only when both `GITHUB_REF` and `ctx.ref` are absent — an event
context the action does not normally see, but which the `|| ''` fallback on the
line above exists to accommodate. That prefix
matches every branch's assessment issue. The first becomes the update target and
**the rest are deleted** as duplicates.

### Fix

Wrap the `deleteIssue` loop so a failure warns rather than throws, matching
`pinIssue`. For the predecessor match, require an exact title match rather than
a prefix, or skip predecessor tidying entirely when `branchName` is empty.

### Resolution

Fixed, both parts.

**Guarding.** Each `deleteIssue` call is wrapped individually and downgraded to
a warning, matching `pinIssue`. Wrapping each call rather than the loop means a
refused delete no longer abandons the remaining duplicates. `updateIssue` was
deliberately left unguarded, despite being listed above: if the update fails the
questions were not delivered, so a failed run is the correct outcome.
`createComment` was also left alone; it needs the same `issues: write`
permission the update just used successfully.

**Matching.** Predecessors now require `i.title === title`, and `searchStr` is
gone. Of the two fixes offered this one covers more: an empty `branchName`
produces the exact title `GrillMyCode Questions`, which matches only other
branchless issues, so tidying still works in that case instead of being
skipped. It also stops a hand-edited title that merely begins with the expected
one (`GrillMyCode Questions (main) — old attempt`) from being deleted as a
duplicate. The trade-off is that such a renamed issue is no longer adopted as
the update target, and a fresh issue is created alongside it — the safe
direction for a code path that deletes.

`test/issue-delivery.test.js` is the first coverage of `postIssue`, using a
stubbed octokit: normal duplicate deletion, a refused delete (warns, still
attempts later duplicates, returns the updated issue), a failed update (still
throws), an empty branch name with other branches' issues open (creates a new
issue, touches nothing), an empty branch name with a branchless predecessor
(updated), and a title that only starts with the expected one (ignored). Four of
the six fail against the previous code. The architecture page and the
post-to-issues example now describe the exact match and the non-fatal delete.

---

## Finding 9 — Assorted minor issues

**Severity:** Low
**Status:** Open

- **`truncated` is permanently `false`.** Declared as a literal at
  `src/main.js:675` and threaded through five call sites (`buildPrompt`, three
  `formatReport` calls). The notes it gates — `src/report.js:42-44` and
  `src/prompt.js:274-275` — are unreachable. Either implement the code-size cap
  it was intended to signal (see
  [No size cap on submitted code](#no-size-cap-on-submitted-code)) or remove the
  parameter from all five sites.

- **`AI_MAX_OUTPUT_TOKENS` is never sent.** Defined at `src/constants.js:250`
  with a comment explaining the reasoning ("50 questions … typically requires
  12,000–16,000 tokens"), but `callAI` never puts `max_tokens` in the request
  body (`src/ai.js:96-101`). The request therefore relies on each upstream
  provider's default, which is what the constant was added to avoid. Note that
  `ai.js:193` already warns on `finish_reason === 'length'`, so truncation is
  detected but not prevented.

- **Unanchored suffix strip.** `src/delivery/instructor-repo.js:297` uses
  `instructorRepoName.replace(INSTRUCTOR_REPO_SUFFIX, '')`, which replaces the
  first occurrence anywhere in the string rather than the suffix. Use
  `slice(0, -INSTRUCTOR_REPO_SUFFIX.length)`. Affects only the rendered README
  heading, but the same pattern would be a real defect if reused for the
  repository name itself.

- **`atob()` mangles non-ASCII manifests.** The four dependency scanners
  (`fetchPackageDeps`, `fetchComposerDeps`, `fetchGemfileDeps`, `fetchMixDeps` in
  `src/stack-detection.js`) decode base64 with `atob`, which produces latin-1.
  A `package.json` or `composer.json` containing non-ASCII bytes — an author
  name, a description — fails `JSON.parse`, and the `catch` returns `[]`
  silently. The framework then goes undetected and its build artifacts are
  assessed. Use `Buffer.from(data.content, 'base64').toString('utf-8')`, as
  `fetchFile` in `instructor-repo.js:145` already does.

- **README documents a removed input and output.** The inputs table documents
  `output_file` (README:41 — "Path for the output Markdown file", default
  `grill-my-code.md`) and the outputs table documents `output_file` (README:57 —
  "Path to the generated assessment Markdown file"). Neither exists in `action.yml` and neither is read or set
  anywhere in `src/`. A workflow setting it gets no error and no file.

- **`safeBranchName` is dead.** Exported from `src/context.js:165` and
  referenced only by a doc comment on the function below it. `safeFilePart` has
  superseded it.

- **Reproducibility gaps in the image.** The `Dockerfile` header states the
  image is "fully reproducible", but it pins `node:26-slim` by floating tag,
  runs `corepack prepare pnpm@latest --activate` (against
  `packageManager: pnpm@12.3.4` in `package.json`), and downloads the `rmcm`
  binary from a mutable release tag with no checksum verification. CI tests on
  Node 24 (`pr-checks.yml`) while the image ships Node 26.

### Resolution

Six items fixed; the reproducibility item partly. Two items above overstate or
misdirect, and are corrected here.

- **`truncated`** — removed from `buildPrompt`, `formatReport`, all four
  `main.js` call sites and both notes. The code-size cap was not built here: it
  needs its own design (per-file or total budget, which files drop, a new input,
  reporting), and re-adding a flag then is trivial. The prompt text is
  byte-identical, and the report still has a blank line before its `---`.
- **`AI_MAX_OUTPUT_TOKENS`** — deleted rather than sent. The item assumes
  sending it prevents truncation; on OpenRouter it does the opposite of what the
  constant's comment intends. OpenRouter routes a request with `max_tokens` only
  to providers that support a response of that length, so a fixed 16,384 can
  exclude endpoints, and it would impose a ceiling on models whose own output
  limit is higher. Omitting it leaves each model's limit in force, and the
  `finish_reason === 'length'` warning still reports a cut-off.
  `architecture.md` claimed `max_tokens` was in the request body; it now says it
  is deliberately omitted and why.
- **Suffix strip** — `endsWith` guard plus `slice`. A bare `slice`, as suggested,
  would chop characters off a name that lacks the suffix. No test: the function
  is module-private and only renders a README heading.
- **`atob()`** — the stated failure does not occur. `atob` does produce latin-1
  mojibake, but mojibake is still valid JSON string content, so `JSON.parse`
  succeeds and the (ASCII) dependency names come out intact. The real silent
  failure is a UTF-8 byte-order mark, which `JSON.parse` rejects — and which
  `Buffer` decoding alone does not fix either. All four scanners now share
  `decodeContent`, which decodes with `Buffer` as UTF-8 and strips a leading
  BOM. `test/stack-detection.test.js` covers non-ASCII text and a BOM; the BOM
  test fails against the previous code. `atob` was removed from the ESLint
  globals, as nothing uses it.
- **`output_file`** — both README rows removed.
- **`safeBranchName`** — removed. Its `architecture.md` section was also wrong
  about current behaviour (it claimed the PDF filename is derived from the
  branch); the section now documents `safeFilePart`, which derives it from the
  repository name.
- **Reproducibility** — partly. `corepack prepare pnpm@latest --activate` is gone:
  corepack now resolves pnpm from `packageManager` when `pnpm install` runs, so
  the image, CI and the devcontainer share one pnpm version. The tested Node
  version now matches the runtime: the `pr-checks.yml` test job runs a
  `["24", "26"]` matrix (24 is the `engines` minimum, 26 is what the image
  ships; lint and the other jobs stay on 24), and the devcontainer moved to
  `javascript-node:26`. That image ships no corepack, so its
  `corepack prepare` step was removed; its preinstalled pnpm switches itself to
  the `packageManager` version, verified against the repository's lockfile with
  no lockfile change.

  Deliberately not done, because each creates a future build break outside the
  repository's control: an `rmcm` checksum (the `grill-my-code` release asset is
  re-uploaded in place — last on 2026-09-07 — and each re-upload would fail the
  build until the digest is updated), a pinned corepack version (old corepack
  releases break when npm rotates the registry signing keys they embed), and a
  base-image digest pin without Dependabot. Also not done: softening the
  Dockerfile's "fully reproducible" header.

---

## Gaps and recommendations

These are not defects in themselves; they are the conditions that let the
defects above reach a release.

## Finding 10 — A stray separator inside an answer container disables the structural guard

**Severity:** High — the correct answer can be delivered to the student
**Location:** `src/postprocess.js:174-192` (`stripAnswers` pass 0), `:325-347`
(`redactStudentQuestions`)

Found while investigating `stripAnswers`'s positional-fallback pass, not part of
the original review. (An earlier draft credited this to Finding 5 — that was
wrong; Finding 5 is about `boldQuestionLines`, a different function.)

### Symptom

A question's correct answer appears in the student's assessment issue. The run
logs no warning, and `questions_withheld` reports `0`.

### Reproduction

Two questions. The first is well formed but carries a `---` inside its answer
container — model drift the prompt explicitly warns against but does not
prevent. The second drifts differently: its answer sits in a fenced block with
no `**Answer:**` heading and no container.

Through `stripAnswers` → `redactStudentQuestions`:

```
innerSep=false   blocks 2/2   structural=1   leaked=false
innerSep=true    blocks 2/3   structural=0   leaked=true
```

The first question's stray separator decides whether the second question's
answer reaches the student.

### Root cause

Four steps, each reasonable alone:

1. Pass 0 swaps `---` for a placeholder, removes the answer container, then
   restores. The swap does nothing: the container match spans the placeholder
   and takes it along.
2. So the student view has one fewer `---` than the answer-bearing original.
3. `redactStudentQuestions` aligns the two views by splitting both on `---`. On
   a count mismatch it skips the structural guard — deliberately, to avoid
   mis-dropping on misaligned boundaries — **for the whole assessment**, not
   just the affected question.
4. The structural guard is the only check that catches an answer emitted inside
   a fenced block, because `stripCodeForLeakCheck` strips fenced code before the
   leak guard looks at it. It has to: visible code otherwise reads as a leak.

The fail-closed backstop fails open, and silently — `structural` is `0`, so
neither warning fires.

### Fix

Re-emit any separator the container swallowed, so the block counts stay aligned:

```js
result = result.replace(ANSWER_REGION_RE, (region) => {
  const swallowed = region.match(/\0GMC_SEP\0/g)?.length ?? 0;
  return '\n' + `${SEP}\n`.repeat(swallowed);
});
```

### Resolution

Fixed as above — this is what the placeholder was always for. Output is
unchanged on every input tested except the one that matters: a `---` inside a
container now survives into the student view, keeping the counts aligned and the
structural guard live.

`test/strip-answers.test.js` covers the separator round-trip and runs the full
`stripAnswers` → `redactStudentQuestions` chain for both drift shapes; the leak
case fails against the previous implementation.

Two things this does **not** address, both worth their own change:

- **The guard still fails open on misalignment.** Any other cause of a count
  mismatch reopens the same hole, silently. It should at minimum warn, and
  arguably withhold rather than skip; aligning blocks by question number instead
  of by separator would remove the failure mode entirely.
- **The positional fallback deletes fenced blocks** sitting between a question
  stem and the distractors heading, which is where Finding 5's investigation
  started. It cannot tell a question's code context from an answer the model put
  in a fence, and it currently deletes both. Deleting is the safe direction, and
  with the structural guard working the content-loss case is withheld anyway —
  so this was left alone deliberately rather than "fixed" into a leak.

---

### Gap: the post-processing path is untested

**Largely closed.** The extraction this section recommended has been done:
the post-processing functions now live in `src/postprocess.js`, and `main.js`
is down from 1,253 lines to 937 — closer to the orchestration its header
describes.

`test/` covers `submission-identity.js`, the exclude-pattern and
assignment-context paths, and — since Findings 3 and 10 — `stripAnswers`,
`extractCorrectAnswers` and `redactStudentQuestions`, including the full
strip → redact chain that decides what reaches a student.

Still untested: `answerLeaksInto`, `hasAnswerStructure`, `isQuestionBlock`,
`renumberQuestions`, `boldQuestionLines`, `splitBoldAroundCode`,
`normaliseSeparators` and `truncateToMaxQuestions`. They are pure functions in
an importable module now, so each is a table-driven test away. Finding 5 is in
this set and is exactly what such a test catches on the first case.

The larger gap is unchanged: every test in the suite runs against constructed
fixtures. Nothing exercises the pipeline against captured model output, so the
shapes the model actually produces remain unverified.

### No size cap on submitted code

Nothing between `collectRawFiles` (`src/files.js:48`) and `callAI` bounds the
volume of code sent to the provider — no per-file limit, no total-character
budget, no file-count limit. `assignment_context` has such a cap
(`assignment_context_max_chars`); the student's own submission does not.

Combined with Finding 1, this is the real cost exposure. Implementing it also
gives `truncated` (Finding 9) its intended meaning, since the plumbing is
already in place at all five call sites.

### Verify the model identifier early

`ai_model` is free text passed straight through to OpenRouter. A typo surfaces
as a 404 only after SHA resolution, file collection, comment stripping and
prompt assembly have all run. Either validate against
`GET https://openrouter.ai/api/v1/models` at startup or special-case the 404 in
`callAI` with a message naming the model and linking the OpenRouter guide.

### Log exclusions with their matched pattern

`matchingPattern` (`src/main.js:160`) already computes which pattern removed
each file, but only for the summary table — which, per Finding 2, never renders.
Emitting the same mapping via `core.info` during filtering would have made
Finding 1 visible in every run log since the feature shipped.

---

## Method

Findings were produced by reading each module in `src/` in full, then executing
the suspect code in isolation against crafted inputs. The reproductions in
Findings 1, 2, 3 and 5 are trimmed output from those runs.

Not covered by this review, deliberately:

- the prompt-injection surface, covered by `security-audit-v1-0-16.md` and
  `security-test-cases.md`;
- the LMS quiz workflow, covered by `lms-quiz-known-issues.md`;
- `docs-site/`;
- prompt wording and rubric quality in `src/prompt.js`, which is an
  assessment-design question rather than a correctness one.
