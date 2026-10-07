---
sidebar_position: 10
sidebar_label: Every input, annotated
---

# Every input, annotated

**Use this when** you want to see every setting in one place. Each input has a comment explaining it, and optional ones are commented out. Delete what you don't need.

For full details of each input, see [Inputs and outputs](../reference/inputs-outputs.md).

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
      contents: write  # required to create the gmc-assessments release and PDF asset
      issues: write    # required to create the assessment issue
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v0
        with:
          # ── Authentication ────────────────────────────────────────────────

          # GitHub token used for API access — creating the assessment issue and
          # release, and reading repository metadata. It is NOT used to generate
          # questions; see api_key below. The built-in token is sufficient.
          github_token: ${{ secrets.GITHUB_TOKEN }}

          # API key for the AI provider. REQUIRED — the action fails immediately
          # without it. Create a key at https://openrouter.ai/keys and store it as an
          # organisation-level secret so every student repository inherits it.
          api_key: ${{ secrets.OPENROUTER_API_KEY }}

          # ── AI Provider ───────────────────────────────────────────────────

          # Provider to use for question generation.
          # Supported values: openrouter (the default — may be omitted)
          # ai_provider: "openrouter"

          # Model identifier, in OpenRouter's provider/model-name format.
          # See https://openrouter.ai/models for the full catalogue and pricing.
          # Optionally append a routing variant to choose which of the providers
          # serving the model is tried first — ":nitro" for the fastest (use when
          # the model's questions are good but assessments are slow to arrive;
          # check pricing first, as fast endpoints can cost more), ":floor" for
          # the cheapest. The model is unchanged, and providers that run a
          # compressed copy of it (e.g. fp4) are never used, whichever you choose.
          ai_model: "google/gemini-3.5-flash-lite"

          # Total number of attempts (initial + retries) when calling the AI provider.
          # Retries are triggered by 429 (rate limit), 500, 502, 503, 504, network
          # failures, and a reply that isn't the JSON GrillMyCode asked for (unless the
          # model stopped at its output limit). A 429 with a Retry-After header has that
          # delay honoured (max 30s); a 429 without one waits at least 5s.
          # Values below 1 are clamped to 1.
          # ai_retry_max_attempts: "5"

          # How much the model reasons before answering: default, none, minimal,
          # low, medium, high, xhigh or max. "default" sends no setting, so the
          # model's own default applies — some reason at "high" unless told
          # otherwise. Reasoning is billed as output, so a lower level can cut
          # the cost of a run several times over. "none" fails the run on a
          # model that always reasons; any other unsupported level is mapped to
          # the nearest one the model has.
          # ai_reasoning_effort: "default"

          # A temperature to send, from 0 to 2 (OpenRouter's range). Leave it
          # unset and the model runs at its own. Models differ in the range they
          # accept and whether they use temperature at all, so set it only if
          # you know the chosen model's. If you're not sure how a change would
          # affect the questions, don't set it.
          # ai_temperature: "0.3"

          # ── Question generation ───────────────────────────────────────────

          # Number of comprehension questions in the report. Minimum 1, maximum 50.
          # The AI is asked for two spare questions for every ten, rounded up, to
          # replace any that are dropped. Spares that aren't needed are cut.
          num_questions: "20"

          # Limits the kinds of question. "balanced" mixes all kinds; "research"
          # asks only questions that turn on documentation, edge cases and
          # changes; "tracing" asks only questions answered by mentally running
          # the code (values, variable state, order, where a value comes from).
          # question_emphasis: "balanced"

          # When true, answers are shown to the student immediately after each
          # question — this defeats the purpose of the assessment. Leave false
          # in almost all cases. The instructor repository always includes
          # answers regardless of this setting.
          # include_answers: "false"

          # Assignment-specific instructions for the AI. Injected at the end of
          # the system prompt and takes precedence over default behaviour.
          # Supports multi-line YAML strings.
          instructor_context: |
            Assignment 3 — Python loops.
            Prioritize questions that trace what a loop produces for a
            given input, and include at least one question about
            off-by-one errors.

          # Comma-separated file glob(s) whose contents are read from the repo
          # and injected into the prompt as assignment context (before
          # instructor_context). Useful for README files, assignment briefs, or
          # coding style guides. Leave empty (default) to disable.
          # Supported file types: plain text / source files (UTF-8), PDF (.pdf,
          # text layer only), and Microsoft Word (.doc/.docx, text content only).
          # assignment_context: "README.md, assignment.pdf, marking/rubric.docx"

          # Maximum total characters read from all assignment_context files
          # combined. Increase if your assignment brief is large; decrease to
          # limit token usage. Values below 1 are clamped to 1.
          # assignment_context_max_chars: "20000"

          # ── File filtering ────────────────────────────────────────────────

          # Allow specific files through the exclude list.
          # Use a pattern (e.g. **/*.md) to re-include all files of that type,
          # or a specific path (e.g. README.md) to allow only that file while
          # the pattern still excludes everything else. Environment files, lock
          # files and dependency folders come back only when an entry names
          # them (e.g. frontend/.env), not under a broader one (frontend/**).
          # exclude_pattern_overrides: 'README.md'

          # Glob patterns for extra files to exclude on top of the
          # auto-detected stack patterns (lock files, build artefacts, etc.
          # for your language/framework are excluded automatically). Separate
          # them with commas or line breaks. A trailing slash names a folder,
          # and case is ignored.
          # additional_exclude_patterns: 'tests/, docs/**, *.{sql,csv}'

          # When true, the run stops once it has worked out which files it
          # would assess, and lists them in the run summary with the files
          # left out and the pattern responsible for each. The AI is not
          # called, so no questions, issue or PDF are produced and api_key is
          # not needed. Offer it on the Run workflow form rather than setting
          # it here: left "true" in the file, every run is a preview and no
          # student is assessed.
          # preview_only: "false"

          # ── Instructor repository ─────────────────────────────────────────

          # Classroom 50 assignment repositories only — not available elsewhere.
          # PAT with the repo AND workflow scopes, from an account that can create
          # repositories in the same organisation as the student repositories. When provided, the
          # action writes a private instructor-only report (questions AND answers)
          # to a repository named {assignment-name}-grillmycode-instructor in the same org.
          # The repository is auto-created on first run if it does not exist.
          # The assignment name and student folder are read from the Classroom 50
          # repo name (<classroom>-<assignment>-<username>) and its direct
          # collaborators; any other repo skips instructor delivery with a warning.
          # Also turns on multiple-choice distractor generation: the three wrong
          # options per question are used only by the quiz built from the instructor
          # copy (student reports always strip them), so with no token set the action
          # asks the model for the correct answer alone — cheaper and quicker.
          # Leave empty (default) to disable instructor repository delivery.
          # instructor_repo_token: ${{ secrets.INSTRUCTOR_REPO_TOKEN }}

          # ── Repository label ─────────────────────────────────────────────

          # Labels the STUDENT repository in GitHub's own metadata once questions
          # have been generated, so assessed repositories are identifiable in the
          # organization's repository list. When "true", adds the
          # "grillmycode" topic (filterable with org:<org> topic:grillmycode) and
          # appends "· 🔥 GrillMyCode: N questions" to the repository
          # description. "false" (default) writes nothing.
          # Requires instructor_repo_token above: repository metadata cannot be
          # reached with GITHUB_TOKEN at any permissions: setting, because that
          # key has no administration scope to grant. Without the PAT the labels
          # are skipped with a warning.
          # Existing topics are preserved, and a label written by an earlier run
          # is replaced rather than appended to, so repeated pushes leave one
          # accurate label. A failure here never fails the run.
          # label_repos: "false"

          # ── Run reporting ─────────────────────────────────────────────────

          # When true, a run that finds nothing to assess fails instead of
          # succeeding. A run ends with nothing to assess when the commit range
          # is empty, or when every changed file is removed by the exclude
          # patterns; either way the job summary explains which and what to
          # check. Left "false" (default) because both cases occur normally the
          # moment an assignment is accepted, so failing by default would show a
          # red run on every student repository at creation. Set to "true" once
          # students have started work.
          # fail_on_empty_assessment: "false"

          # ── Comment stripping ─────────────────────────────────────────────

          # When false (default), inline and block comments are stripped from
          # the code before sending it to the AI. Set to "true" to preserve them.
          keep_comments: "false"

          # ── Diff resolution ───────────────────────────────────────────────

          # What the repository's first commit is, and what the AI does with
          # the starter code in it (default: "ignore").
          #   none    — the repository starts empty (Classroom 50 --empty-repo),
          #             so the first commit is the student's own work and is
          #             assessed.
          #   ignore  — the first commit is your starter code and is left out.
          #   context — as ignore, and unchanged starter files are sent as
          #             background. Questions are never about them alone.
          #   ask     — as context, and up to one in starter_questions_one_in
          #             questions may be about the starter code itself.
          # starter_code: "ignore"

          # Under starter_code: ask, up to one in this many questions may be
          # about the starter code alone (default: "5", so 4 of 20). From 2,
          # which allows half, upward; above num_questions it allows one.
          # starter_questions_one_in: "5"

          # Send the student's earlier work that this submission didn't touch
          # as background (default: "context"), or "ignore" to leave it out.
          # Only matters when tag_diff_base assesses only the latest phase, or
          # base_sha is set. Never asked about on its own.
          # previous_work: "context"

          # Maximum characters sent as codebase context, shared by starter code
          # and earlier work. Files nearest the assessed files go first; any
          # that don't fit are left out and counted in the run summary.
          # codebase_context_max_chars: "50000"

          # Comma-separated list of author names or email substrings.
          # A leading run of commits whose author matches any entry is skipped.
          # Only skips a contiguous leading run — not all matching commits.
          # Set to '' to disable entirely.
          # Classroom 50's accept-time setup commit is authored under the
          # student's own identity, not a bot, so it isn't matched here — its
          # .classroom50.yaml file is excluded by pattern instead.
          skip_committers: "github-actions[bot]"

          # ── Submission tags (tag-triggered workflows only) ────────────────

          # Tag patterns that mark a submission. Only used when the workflow is
          # triggered by tags (on.push.tags) — list the same patterns there and
          # here, or a tag run fails. Each pattern gets its own issue, PDF and
          # instructor-repository folder. See the Tag Submission example.
          # submission_tags: "phase1, phase2, complete"

          # What a tag run assesses: "cumulative" (default) — all work to
          # date; "previous-tag" — only the work since the nearest earlier
          # submission tag; "tag:phase1" — only the work since that tag
          # (the run fails if the tag is missing or not an earlier commit).
          # tag_diff_base: "cumulative"

          # Manually override the base and/or head commit SHA.
          # These take precedence over all automatic SHA resolution.
          # base_sha: ''
          # head_sha: ''
```
