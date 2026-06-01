---
sidebar_position: 8
---

# FAQ

## General

### What is GrillMyCode?

GrillMyCode is a GitHub Action that analyses a student's code changes and uses AI to generate targeted comprehension questions for oral or written assessments (code vivas). It runs automatically when a student pushes code or opens a pull request — no manual preparation required.

### Does GrillMyCode grade code?

No. GrillMyCode generates questions and leaves evaluation to a human. This is deliberate: automated grading requires a rubric, a reference solution, and confidence that the AI's judgement is consistent and fair. A slightly off-target question is a minor annoyance; an unfair automated grade is not. See [Why GrillMyCode?](rationale.md) for more detail.

### Do I need to install anything?

No. GrillMyCode is a GitHub Action — there is nothing to install. Add a workflow file to the repository and it runs on GitHub's infrastructure. Use the [Workflow Wizard](workflow-wizard.mdx) to generate that file without writing any YAML by hand.

---

## Setup & secrets

### Do I need to create any secrets or API keys?

Not for the default configuration. The default AI provider (GitHub Models) authenticates automatically with the built-in `GITHUB_TOKEN` that every repository already has. No secrets need to be created.

If you want to use [OpenRouter](ai-providers.md#openrouter) or supply an [instructor PAT for GitHub Models](ai-providers.md#using-an-instructor-token), you will need to add a secret.

### What permissions does the workflow need?

The minimum permissions for the default workflow are:

```yaml
permissions:
  contents: write        # commit the output file back to the repository
  pull-requests: write   # post the assessment as a PR comment
  models: read           # call the GitHub Models API
```

The [Workflow Wizard](workflow-wizard.mdx) generates the correct `permissions` block automatically based on your chosen delivery options. See [Inputs & Outputs](reference/inputs-outputs.md) for the full list of inputs that affect which permissions are required.

### How do I set up the instructor repository feature?

The instructor repository feature stores a private copy of each student's questions and answers in a repository that only instructors can access. It requires a one-time org-level setup. See the [Instructor Setup guide](guides/instructor-setup.md) for step-by-step instructions.

---

## Workflow Wizard

### What is the Workflow Wizard?

The [Workflow Wizard](workflow-wizard.mdx) is an interactive, step-by-step tool that generates a ready-to-use GitHub Actions workflow YAML for GrillMyCode — no YAML writing required. It covers every major option (trigger, AI provider, question count, delivery, instructor repository, file patterns, and more) and outputs a complete workflow file you can copy straight into your repository. You can also write the workflow by hand using the examples in [Getting Started](getting-started.md) or [Example Workflows](example-workflows/pull-request.md).

### Can I edit the generated YAML after copying it?

Yes. The Wizard output is plain YAML — you can edit any value in your workflow file at any time. The [Inputs & Outputs reference](reference/inputs-outputs.md) documents every available input.

---

## AI providers & models

### Which AI providers are supported?

GrillMyCode supports two providers:

| Provider | `ai_provider` value | Requires a secret? |
|---|---|---|
| GitHub Models | `github-models` *(default)* | No |
| OpenRouter | `openrouter` | Yes (`OPENROUTER_API_KEY`) |

See [AI Providers](ai-providers.md) for configuration details.

### What model is used by default?

The default model is `gpt-4.1` on GitHub Models. You can override it with the `ai_model` input.

### Can I use a different model?

Yes. For GitHub Models, pass a supported model identifier via `ai_model`. For OpenRouter, set `ai_provider: 'openrouter'` and supply any model from the OpenRouter catalogue in `provider/model-name` format (e.g. `anthropic/claude-3-5-sonnet`).

### Students are hitting rate limits. What can I do?

By default each student's workflow uses their own `GITHUB_TOKEN`, so rate limits are per-student. You can supply an instructor's Personal Access Token via `api_key` to route all calls through the instructor's account, which may have a higher quota. See [Using an instructor token](ai-providers.md#using-an-instructor-token) for trade-offs and setup instructions.

---

## Questions & output

### Where are the generated questions stored?

Questions are written to a Markdown file committed back to the student repository under `.assessment/` (e.g. `.assessment/grill-my-code.md`). The filename is configurable via the `output_file` input.

### Can the questions also be posted as a PR comment or GitHub Issue?

Yes. Use the `post_pr_comment` and `post_issue` inputs to enable each delivery method. They are both opt-in and can be combined. The [Workflow Wizard](workflow-wizard.mdx) has a dedicated Delivery step that configures these options for you.

### Can students see the answers?

By default, no. Set `include_answers: 'true'` to include answers in the student-facing report — but this defeats the purpose of the assessment. The instructor repository copy always includes answers regardless of this setting.

### The AI doesn't seem to be reading my code comments. Why?

By default, inline and block comments are stripped from the submitted code before it is sent to the AI. This is intentional — it focuses assessment on what the code does rather than what the student wrote as annotations. To preserve comments, set `keep_comments: 'true'`:

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    keep_comments: 'true'
```

### How do I customise the questions for a specific assignment?

Use the `additional_context` input to give the AI assignment-specific instructions:

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    num_questions: '8'
    additional_context: 'Assignment 3 — Python list comprehensions. Focus on when list comprehensions are appropriate versus when a regular loop should be preferred.'
```

You can also inject the assignment brief or rubric directly into the prompt via `assignment_context` (supports plain text, PDF, and Word files). The [Workflow Wizard](workflow-wizard.mdx) has a Questions step that walks through both of these inputs.

### How many questions are generated?

The default is 20. Set `num_questions` to any value between 1 and 50.

---

## File filtering

### Why are some of my files not being assessed?

GrillMyCode automatically detects the repository's language and framework stack and excludes build artifacts, dependency directories, and generated files. Binary files, lock files, and Markdown files are always excluded.

Check the `Exclude patterns applied` and `Assessing N file(s)` lines in the workflow step log to see exactly which files were included and which patterns caused exclusions.

### How do I exclude assignment-specific files (starter code, fixtures)?

Use the `additional_exclude_patterns` input with comma-separated glob patterns:

```yaml
additional_exclude_patterns: 'provided_starter/**, tests/fixtures/**, data/**'
```

See [Exclude Patterns](guides/exclude-patterns.md) for the full pattern syntax and examples. The [Workflow Wizard](workflow-wizard.mdx) has a Files step that configures both `additional_exclude_patterns` and `exclude_pattern_overrides` without writing patterns by hand.

### How do I re-include a file that is excluded by default?

Use `exclude_pattern_overrides`. This takes precedence over all other exclusions:

```yaml
exclude_pattern_overrides: 'README.md'
```

---

## GitHub Classroom

### Does GrillMyCode work with GitHub Classroom?

Yes — it is specifically designed for GitHub Classroom. The default configuration excludes template/starter code and bot-committed setup files, so only code written by the student after accepting the assignment is eligible for assessment. See the [GitHub Classroom guide](guides/github-classroom.md).

### How do I exclude the starter code that GitHub Classroom pre-populates?

GrillMyCode skips commits made by `github-classroom[bot]` and `github-actions[bot]` by default. For additional file-level exclusions of provided starter files, use `additional_exclude_patterns: 'provided_starter/**'` (adjusting the path to match your repository layout).

---

## Troubleshooting

### The action runs but no files are being assessed.

The action emits a warning — `No assessable files found after applying include/exclude filters` — when the filtered file list is empty. Open the workflow step log and check the `Exclude patterns applied` list. If a pattern is too broad, use `exclude_pattern_overrides` to recover the files you need.

### The action is failing with a permissions error.

Make sure the workflow's `permissions` block includes all required scopes. At minimum: `contents: write`, `pull-requests: write` (if posting a PR comment), and `models: read` (for GitHub Models). Check the [Getting Started](getting-started.md) page for a reference workflow.

### The output file was not committed on a pull request from a fork.

This is expected. GitHub Actions workflows triggered by pull requests from forks run with read-only `GITHUB_TOKEN` — the action cannot push commits back to the fork owner's repository. The action logs a warning and continues. PR comments and GitHub Issues are not affected; only the file commit is skipped. If you need the file, ask the student to push directly to a branch on the upstream repository instead.

### How do I enable verbose logging to debug an issue?

Pass `debug: 'true'` as a workflow input, or enable [GitHub Actions debug logging](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/enabling-debug-logging) for the repository by setting the secret `ACTIONS_STEP_DEBUG` to `true`. See the [Debug Mode guide](guides/debug-mode.md) for details.
