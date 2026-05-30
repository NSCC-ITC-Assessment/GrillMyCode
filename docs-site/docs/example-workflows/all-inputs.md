---
sidebar_position: 7
---

# All Inputs

A fully annotated workflow showing every available input. Inputs that don't apply to the pull-request scenario are commented out with an explanation of when they would be used instead.

Copy this file to `.github/workflows/grill-my-code.yml` in the student repository and remove or adjust inputs as needed.

```yaml
name: Grill My Code

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    permissions:
      contents: write       # required to commit the output file back to the repo
      pull-requests: write  # required to post the PR comment
      models: read          # required to call GitHub Models API
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          # ── Authentication ────────────────────────────────────────────────

          # GitHub token used for API access and as the GitHub Models credential.
          # The built-in token is sufficient for most setups; supply an instructor
          # PAT here if you need an account with a higher GitHub Models rate limit.
          github_token: ${{ secrets.GITHUB_TOKEN }}

          # ── AI Provider ───────────────────────────────────────────────────

          # Provider to use for question generation.
          # Supported values: github-models | openrouter
          ai_provider: "github-models"

          # Model identifier for the chosen provider.
          # GitHub Models: gpt-4.1
          # OpenRouter:    provider/model-name format (e.g. anthropic/claude-3-5-sonnet)
          ai_model: "gpt-4.1"

          # Total number of attempts (initial + retries) when calling the AI provider.
          # Retries are triggered by 429 (rate limit), 500, 502, 503, 504, and network
          # failures. A 429 with a Retry-After header has that delay honoured.
          # Values below 1 are clamped to 1.
          # ai_retry_max_attempts: "5"

          # Controls the randomness of the AI's output (0.0 = fully deterministic,
          # 1.0 = most random). Lower values produce more consistent questions;
          # higher values produce more varied output. Most users should leave this
          # at the default.
          # ai_temperature: "0.5"

          # API key for the provider. Leave empty when using github-models with
          # the built-in GITHUB_TOKEN. Required for openrouter.
          # api_key: ${{ secrets.OPENROUTER_API_KEY }}

          # ── Question generation ───────────────────────────────────────────

          # Number of comprehension questions to generate. Minimum 1, maximum 50.
          num_questions: "20"

          # When true, answers are shown to the student immediately after each
          # question — this defeats the purpose of the assessment. Leave false
          # in almost all cases. The instructor repository always includes
          # answers regardless of this setting.
          # include_answers: "false"

          # Assignment-specific instructions for the AI. Injected at the end of
          # the system prompt and takes precedence over default behaviour.
          # Supports multi-line YAML strings.
          additional_context: |
            Assignment 3 — Python list comprehensions.
            Focus questions on: when list comprehensions are appropriate,
            performance trade-offs, and readability.

          # Comma-separated file glob(s) whose contents are read from the repo
          # and injected into the prompt as assignment context (before
          # additional_context). Useful for README files, assignment briefs, or
          # coding style guides. Leave empty (default) to disable.
          # Supported file types: plain text / source files (UTF-8), PDF (.pdf,
          # text layer only), and Microsoft Word (.doc/.docx, text content only).
          # assignment_context: "README.md, assignment.pdf, rubric.docx"

          # Maximum total characters read from all assignment_context files
          # combined. Increase if your assignment brief is large; decrease to
          # limit token usage. Values below 1 are clamped to 1.
          # assignment_context_max_chars: "20000"

          # ── File filtering ────────────────────────────────────────────────

          # Allow specific files through the default exclude list.
          # Use an exact default pattern (e.g. **/*.md) to re-include all files
          # of that type, or a specific path (e.g. README.md) to allow only
          # that file while the pattern still excludes everything else.
          # exclude_pattern_overrides: 'README.md'

          # Comma-separated glob patterns for extra files to exclude on top of
          # the auto-detected stack patterns (lock files, build artefacts, etc.
          # for your language/framework are excluded automatically).
          # additional_exclude_patterns: 'tests/**,docs/**'

          # ── Output & delivery ─────────────────────────────────────────────

          # Filename for the written assessment file (basename only — directory
          # components are ignored). Always written under .assessment/.
          output_file: "grill-my-code.md"

          # Post the assessment as a pull request comment (default: "false").
          # Set to "true" to enable. Requires pull-requests: write permission.
          post_pr_comment: "true"

          # Create a GitHub Issue with the assessment.
          # Requires issues: write permission.
          post_issue: "false"

          # Create a GitHub Discussion with the assessment.
          # Requires discussions: write (and administration: write if not yet enabled).
          post_discussion: "false"

          # Discussion category name (must already exist in repository settings).
          discussion_category: "Assessments"

          # ── Instructor repository ─────────────────────────────────────────

          # PAT with repo scope and permission to create repositories in the
          # same organisation as the student repositories. When provided, the
          # action writes a private instructor-only report (questions AND answers)
          # to a repository named {assignment-name}-grillmycode-instructor in the same org.
          # The repository is auto-created on first run if it does not exist.
          # The assignment name is resolved from the student repo's
          # template_repository (GitHub Classroom), falling back to the source
          # repo name for non-Classroom setups.
          # Leave empty (default) to disable instructor repository delivery.
          # instructor_repo_token: ${{ secrets.INSTRUCTOR_REPO_TOKEN }}

          # ── Comment stripping ─────────────────────────────────────────────

          # When false (default), inline and block comments are stripped from
          # the code before sending it to the AI. Set to "true" to preserve them.
          keep_comments: "false"

          # ── Diff resolution ───────────────────────────────────────────────

          # Pin the diff base to the repository's first commit (default: true).
          # Set to "false" to use the empty tree as the base instead,
          # which includes the initial commit's files in the diff.
          skip_initial_commit: "true"

          # Comma-separated list of author names or email substrings.
          # A leading run of commits whose author matches any entry is skipped.
          # Only skips a contiguous leading run — not all matching commits.
          # Set to '' to disable entirely.
          skip_committers: "github-classroom[bot],github-actions[bot]"

          # Manually override the base and/or head commit SHA.
          # These take precedence over all automatic SHA resolution.
          # base_sha: ''
          # head_sha: ''
```
