---
sidebar_position: 8
---

# FAQ

## General

### What is GrillMyCode?

GrillMyCode is a GitHub Action that analyses a student's code changes and uses AI to generate targeted comprehension questions for oral or written assessments (code vivas). It runs automatically when a student pushes code to the default branch — no manual preparation required.

### Does GrillMyCode grade code?

No. GrillMyCode generates questions and leaves evaluation to a human. This is deliberate: automated grading requires a rubric, a reference solution, and confidence that the AI's judgement is consistent and fair. A slightly off-target question is a minor annoyance; an unfair automated grade is not. See [Why GrillMyCode?](rationale.md) for more detail.

### Do I need to install anything?

No. GrillMyCode is a GitHub Action — there is nothing to install. Add a workflow file to the repository and it runs on GitHub's infrastructure. Use the [Workflow Wizard](workflow-wizard.mdx) to generate that file without writing any YAML by hand.

---

## Setup & secrets

### Do I need to create any secrets or API keys?

Not for the default configuration. The default AI provider (GitHub Models) authenticates automatically with the built-in `GITHUB_TOKEN` that every repository already has. No secrets need to be created.

If you want to use [OpenRouter](./ai-providers/openrouter) or supply an [instructor PAT for GitHub Models](./ai-providers/github-models#using-an-instructor-token), you will need to add a secret.

### What permissions does the workflow need?

The required permissions are the same for every configuration:

```yaml
permissions:
  contents: write  # gmc-assessments release + PDF asset
  issues: write    # assessment issue
  models: read     # GitHub Models API (remove if using openrouter)
```

The [Workflow Wizard](workflow-wizard.mdx) generates the correct `permissions` block automatically. See [Permissions](reference/permissions.md) for details.

### How do I set up the instructor repository feature?

The instructor repository feature stores a private copy of each student's questions and answers in a repository that only instructors can access. It requires a one-time org-level setup. See the [Instructor Setup guide](guides/instructor-setup.md) for step-by-step instructions.

---

## Workflow Wizard

### What is the Workflow Wizard?

The [Workflow Wizard](workflow-wizard.mdx) is an interactive, step-by-step tool that generates a ready-to-use GitHub Actions workflow YAML for GrillMyCode — no YAML writing required. It covers every major option (AI provider, question count, delivery, instructor repository, file patterns, and more) and outputs a complete workflow file you can copy straight into your repository. You can also write the workflow by hand using the examples in [Getting Started](getting-started.md) or [Example Workflows](example-workflows/pull-request.md).

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

See [GitHub Models](./ai-providers/github-models) and [OpenRouter](./ai-providers/openrouter) for configuration details.

### What model is used by default?

The default model is `gpt-4.1` on GitHub Models. You can override it with the `ai_model` input.

### Can I use a different model?

Yes. For GitHub Models, pass a supported model identifier via `ai_model`. For OpenRouter, set `ai_provider: 'openrouter'` and supply any model from the OpenRouter catalogue in `provider/model-name` format (e.g. `anthropic/claude-3-5-sonnet`).

### Students are hitting rate limits. What can I do?

By default each student's workflow uses their own `GITHUB_TOKEN`, so rate limits are per-student. You can supply an instructor's Personal Access Token via `api_key` to route all calls through the instructor's account, which may have a higher quota. See [Using an instructor token](./ai-providers/github-models#using-an-instructor-token) for trade-offs and setup instructions.

---

## Questions & output

### Where are the generated questions stored?

Questions are delivered as a **GitHub Issue** in the student's repository. The issue is automatically created on the first run and assigned to the student. On every run of the GrillMyCode action, regardless of the trigger type, the issue body is **overwritten** with freshly generated questions — the issue number and URL stay the same, but the previous questions are replaced. A PDF of the assessment is simultaneously generated and attached to a rolling GitHub Release tagged `gmc-assessments` — a download link is included in the issue body.

### Why is the assessment issue pinned?

GrillMyCode pins the assessment issue in the repository the first time it is created. This keeps it visible at the top of the issues list so students can find it easily without searching. The pin only applies on create — re-runs that update an existing issue do not re-pin it. GitHub allows a maximum of 3 pinned issues per repository; if that limit is already reached, the pin is skipped silently with a warning in the Actions log.

### What happens if the assessment is very long?

GitHub issue bodies have a maximum length of 65,536 characters. If the generated assessment exceeds 65,000 characters, the issue body is automatically truncated and a warning callout is appended pointing to the PDF download for the complete content. A warning is also logged in the Actions run. To avoid truncation, reduce `num_questions` or use a shorter `instructor_context`.

### What is the Repository line in the issue header?

Every assessment issue includes a **Repository** metadata line showing the `owner/repo` where the questions were generated (e.g. `NSCC-ITC-Assessment/assignment-1-student123`). This is useful in the instructor repository where multiple student assessments are collected — it makes it immediately clear which student's repository each assessment originated from.

### Can students see the answers?

By default, no. Set `include_answers: 'true'` to include answers in the student-facing report — but this defeats the purpose of the assessment. The instructor repository copy always includes answers regardless of this setting.

### Why are some questions missing from a student's report?

GrillMyCode occasionally withholds individual questions it cannot confirm are answer-free, replacing them with a short note. The instructor repository copy is never affected and always contains the full set of questions and answers.

### The AI doesn't seem to be reading my code comments. Why?

By default, inline and block comments are stripped from the submitted code before it is sent to the AI. This is intentional — it focuses assessment on what the code does rather than what the student wrote as annotations. To preserve comments, set `keep_comments: 'true'`:

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    keep_comments: 'true'
```

### How do I customise the questions for a specific assignment?

Use the `instructor_context` input to give the AI assignment-specific instructions:

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    num_questions: '8'
    instructor_context: |
      Assignment 3 — Python loops. Prioritize execution flow questions
      that trace what a loop produces for a given input, conceptual
      questions about loop design choices, and at least one error
      identification question about off-by-one errors.
```

You can also inject the assignment brief or rubric directly into the prompt via `assignment_context` (supports plain text, PDF, and Word files). The [Workflow Wizard](workflow-wizard.mdx) has a Questions step that walks through both of these inputs.

### How many questions are generated?

The default is 20. Set `num_questions` to any value between 1 and 50.

### What happens if a student pushes again while a run is still in progress?

The example workflows include a `concurrency` block that keeps only the **most recent** run alive:

```yaml
concurrency:
  group: grillmycode-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

When a new push arrives for the same branch while an earlier run is still going, GitHub **cancels the in-progress run** and starts a fresh one against the latest commit. The practical effects:

- **Only the latest code is assessed.** The superseded run stops before it publishes, so a stale assessment based on the older commit is never produced.
- **No duplicate or conflicting output.** Because the runs never overlap, you avoid duplicate assessment issues, clashing release-asset uploads, and competing commits to the instructor repository.
- **A cancelled run may stop part-way.** If an earlier run is cancelled after it has already written some output, the replacement run regenerates and overwrites it, so the final state still reflects the latest push. You may briefly see a cancelled run in the **Actions** tab — this is expected.
- **AI quota is not spent twice — but Actions minutes are.** The cancelled run stops before it finishes generating, so you are not billed by the AI provider for an assessment that gets thrown away. However, the cancelled run still consumed GitHub Actions minutes for the time it was running before cancellation, and the replacement run consumes its own minutes on top. On public repositories runner minutes are free; on private repositories (including most GitHub Classroom repos) they count against your plan's allowance, so rapid repeated pushes will use more minutes than a single run. Consider this when deciding how you'll configure the triggering of your GrillMyCode runs.

The grouping is per workflow **and** per branch (`github.ref`), so pushes to different branches still run independently. If you would rather let an in-progress run finish and queue the newer push instead, set `cancel-in-progress: false` — but note this assesses the older commit first and consumes AI quota for both runs.

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

See [Exclude Patterns](reference/exclude-patterns.md) for the full pattern syntax and examples. The [Workflow Wizard](workflow-wizard.mdx) has a Files step that configures both `additional_exclude_patterns` and `exclude_pattern_overrides` without writing patterns by hand.

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

Make sure the workflow's `permissions` block includes all required scopes: `contents: write`, `issues: write`, and `models: read` (for GitHub Models). Check the [Getting Started](getting-started.md) page for a reference workflow.

### How do I enable verbose logging to debug an issue?

Pass `debug: 'true'` as a workflow input, or enable [GitHub Actions debug logging](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/enabling-debug-logging) for the repository by setting the secret `ACTIONS_STEP_DEBUG` to `true`. See the [Debug Mode reference](reference/debug-mode.md) for details.

### OpenRouter fails with "No endpoints available matching your guardrail restrictions and data policy" (404).

The full error looks like this:

```
OpenRouter Error: Assessment failed: AI API error 404: { error: { message:
"No endpoints available matching your guardrail restrictions and data policy.",
code: 404 } }
```

This is an OpenRouter account-level configuration problem, not a GrillMyCode bug. OpenRouter is refusing to route your request because your privacy/guardrail settings exclude every provider that could serve the model you requested. It is most common with free or near-free models, which require you to opt in to data sharing.

Fix it in your [OpenRouter privacy settings](https://openrouter.ai/settings/privacy):

1. **Enable free endpoints** — toggle on the options that allow free endpoints that may train on or publish prompts. Free models will not route until these are enabled.
2. **Turn off "ZDR Endpoints Only"** — this restricts routing to zero-data-retention providers, which often excludes the free tier.
3. **Clear provider restrictions** — under Allowed/Ignored Providers, remove any rules so OpenRouter can route dynamically.

Then re-run the workflow. If it still fails, the model identifier may be deprecated — check the [OpenRouter model list](https://openrouter.ai/models) and confirm the exact `ai_model` value (free models often require a `:free` suffix). See [OpenRouter](./ai-providers/openrouter) for the recommended, tested model identifiers.
