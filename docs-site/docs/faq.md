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

Yes. Question generation runs through [OpenRouter](./ai-providers/openrouter), which requires its own API key — the built-in `GITHUB_TOKEN` cannot be used for it. Create a key at [openrouter.ai/keys](https://openrouter.ai/keys), store it as a secret (org-level is recommended so every student repository inherits it), and pass it as `api_key`.

The `github_token` input is still needed, but only for GitHub API access — creating the assessment issue, the release, and reading repository metadata. It defaults to the built-in `GITHUB_TOKEN`, so you do not need to create anything for it.

### What permissions does the workflow need?

The required permissions are the same for every configuration:

```yaml
permissions:
  contents: write  # gmc-assessments release + PDF asset
  issues: write    # assessment issue
```

The [Workflow Wizard](workflow-wizard.mdx) generates the correct `permissions` block automatically. See [Permissions](reference/permissions.md) for details.

### How do I set up the instructor repository feature?

The instructor repository feature stores a private copy of each student's questions and answers in a repository that only instructors can access. It is available only in Classroom 50 assignment repositories — the student repositories Classroom 50 creates when a student accepts an assignment — because the action identifies the assignment and student from Classroom 50's repository naming. It requires a one-time org-level setup. See the [Instructor Setup guide](guides/instructor-setup.md) for step-by-step instructions.

---

## Workflow Wizard

### What is the Workflow Wizard?

The [Workflow Wizard](workflow-wizard.mdx) is an interactive, step-by-step tool that generates a ready-to-use GitHub Actions workflow YAML for GrillMyCode — no YAML writing required. It covers every major option (AI provider, question count, delivery, instructor repository, file patterns, and more) and outputs a complete workflow file you can copy straight into your repository. You can also write the workflow by hand using the examples in [Getting Started](getting-started.md) or [Example Workflows](example-workflows/pull-request.md).

### Can I edit the generated YAML after copying it?

Yes. The Wizard output is plain YAML — you can edit any value in your workflow file at any time. The [Inputs & Outputs reference](reference/inputs-outputs.md) documents every available input.

### Can I change settings when running the workflow manually, without editing the file?

Yes, for settings you expose as `workflow_dispatch` inputs. Those appear as a form on the **Run workflow** button in the Actions tab, pre-filled with the values from your workflow file, and anything you change there applies to that run only.

In the Wizard this is the **Manual run overrides** section on the **Trigger** step — expand it and tick the settings you want on the form. Six are ticked by default: `num_questions`, `ai_model`, `instructor_context`, `keep_comments`, `additional_exclude_patterns` and `exclude_pattern_overrides`. See [Manual Run Overrides](example-workflows/manual-dispatch.md) for the generated YAML and how it works.

Secrets and a few integrity-sensitive settings are deliberately not offered — see [Settings to keep out of the form](example-workflows/manual-dispatch.md#settings-to-keep-out-of-the-form).

---

## AI providers & models

### Which AI providers are supported?

[OpenRouter](./ai-providers/openrouter) is the only supported provider. It is a gateway to hundreds of models from Anthropic, Google, DeepSeek, Meta, and others through a single API key, so you can still choose whichever model suits your course.

| Provider | `ai_provider` value | Requires a secret? |
|---|---|---|
| OpenRouter | `openrouter` *(default)* | Yes (`OPENROUTER_API_KEY`) |

Because `openrouter` is the default, you can omit `ai_provider` entirely. See [OpenRouter](./ai-providers/openrouter) for configuration details.

### I've used GitHub Models with GrillMyCode in the past and now they no longer function. Why?

GitHub **permanently discontinued GitHub Models**, so the endpoint GrillMyCode called no longer exists. This affects every version of GrillMyCode that offered `ai_provider: 'github-models'` — there is no configuration or token that will bring it back.

Current versions of GrillMyCode fail immediately with a message pointing here if a workflow still sets `ai_provider: 'github-models'`.

**To migrate**, update your workflow as follows:

1. **Create an OpenRouter API key** — sign up at [openrouter.ai](https://openrouter.ai/), add a small prepaid balance, and generate a key at [openrouter.ai/keys](https://openrouter.ai/keys).
2. **Store it as a secret** — add it as an organisation-level Actions secret named `OPENROUTER_API_KEY` so all student repositories inherit it.
3. **Update the workflow** — remove `ai_provider: 'github-models'` (or set it to `'openrouter'`, which is now the default), replace the `ai_model` value with an OpenRouter `provider/model-name` identifier, and add `api_key`.

```diff
 permissions:
   contents: write
   issues: write

 steps:
   - uses: NSCC-ITC-Assessment/GrillMyCode@v1
     with:
       github_token: ${{ secrets.GITHUB_TOKEN }}
-      ai_provider: 'github-models'
-      ai_model: 'gpt-4.1'
+      ai_model: 'google/gemini-3.5-flash-lite'
+      api_key: ${{ secrets.OPENROUTER_API_KEY }}
```

The main practical difference is cost: GitHub Models was free within your GitHub quota, whereas OpenRouter bills per token. The [recommended models](./ai-providers/openrouter#recommended-models) are typically well under one cent per assessment, so a small prepaid balance covers a full class for a semester.

### What model is used by default?

The default model is `google/gemini-3.5-flash-lite` on OpenRouter. It is inexpensive at classroom scale and, of the models tested, produces the most effective distractors for multiple-choice questions. You can override it with the `ai_model` input.

### Can I use a different model?

Yes. Supply any model from the OpenRouter catalogue in `provider/model-name` format (e.g. `anthropic/claude-3-5-sonnet`) via `ai_model`. Check pricing at [openrouter.ai/models](https://openrouter.ai/models) before deploying to a class — costs vary by orders of magnitude between models.

### Students are hitting rate limits. What can I do?

Rate limits on OpenRouter apply to the API key, not to individual students, so a whole class pushing at once shares one budget. If you see 429 errors, check that your OpenRouter account has a positive credit balance (free-tier keys are rate-limited far more aggressively than funded ones), and consider raising `ai_retry_max_attempts` so transient limits are retried for longer. Switching to a less congested model also helps — see [recommended models](./ai-providers/openrouter#recommended-models).

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
    api_key: ${{ secrets.OPENROUTER_API_KEY }}
    keep_comments: 'true'
```

### How do I customise the questions for a specific assignment?

Use the `instructor_context` input to give the AI assignment-specific instructions:

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    api_key: ${{ secrets.OPENROUTER_API_KEY }}
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
- **AI quota is not spent twice — but Actions minutes are.** The cancelled run stops before it finishes generating, so you are not billed by the AI provider for an assessment that gets thrown away. However, the cancelled run still consumed GitHub Actions minutes for the time it was running before cancellation, and the replacement run consumes its own minutes on top. On public repositories runner minutes are free; on private repositories (including most Classroom 50 repos) they count against your plan's allowance, so rapid repeated pushes will use more minutes than a single run. Consider this when deciding how you'll configure the triggering of your GrillMyCode runs.

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

## Classroom 50

### Does GrillMyCode work with Classroom 50?

Yes — it is designed for [Classroom 50](https://github.com/foundation50/classroom50), the open-source successor to GitHub Classroom (which GitHub is shutting down on August 28, 2026). The default configuration excludes template/starter code and setup files, so only code written by the student after accepting the assignment is eligible for assessment. See the [Classroom 50 guide](guides/classroom50.md).

### How do I exclude the starter code that Classroom 50 pre-populates?

`include_initial_commit: 'false'` (the default) already excludes the template's starter code, since the base is pinned to the repo's first commit. The `.classroom50.yaml` metadata file that `gh student accept` writes is excluded automatically. For additional file-level exclusions of provided starter files, use `additional_exclude_patterns: 'provided_starter/**'` (adjusting the path to match your repository layout).

### What are the `[Classroom 50]` commits in my students' repositories?

Classroom 50 prefixes every commit its own tooling makes with `[Classroom 50]`. In a student assignment repo you'll see the accept-time setup commit, an empty commit that opens the Feedback PR, and — if you later change the assignment's submission mode or rename it — commits authored under your own instructor account. All of them touch only files GrillMyCode already excludes, and the instructor-side ones carry `[skip ci]` so they don't trigger a run. Note that `gh student submit` also uses the prefix (`[Classroom 50] Submit <assignment>`) for the **student's own work**, so the prefix must never be treated as a "not the student" marker. See [Classroom 50's own commits](guides/classroom50.md#classroom-50s-own-commits).

### My empty-repository assignment produced no questions. Why?

An assignment created with `gh teacher assignment add --empty-repo` gives each student a bare repo with no commits, so the repository's first commit is the student's own first push. The default `include_initial_commit: 'false'` pins the diff base there and excludes it. Set `include_initial_commit: 'true'` in the workflow for those assignments — see [Empty-repository assignments](guides/classroom50.md#empty-repository-assignments).

---

## Troubleshooting

### The run succeeded but no questions were generated.

A run that finds nothing to assess reports the reason and, by default, still succeeds — so in a list of student repositories it shows a green tick like any other. Open the run and read the **job summary**: it names which of two things happened and what to check.

**"The commit range … contains no changed files."** Base and head resolved to the same commit, so nothing was compared and the exclude patterns were never involved. On a Classroom 50 **empty-repository** assignment this means the student's work is all in the repo's first commit, which the default excludes — set `include_initial_commit: 'true'` (see [Empty-repository assignments](guides/classroom50.md#empty-repository-assignments)). Otherwise check any `base_sha`/`head_sha` override.

**"All N changed file(s) were removed by the exclude patterns."** Files did change but every one was filtered out. The summary lists the excluded files; use `exclude_pattern_overrides` to recover the ones you need, and check the `Exclude patterns applied` list in the step log for the over-broad pattern.

Both are normal immediately after an assignment is accepted — a template repository's only commit is its starter code, and a Classroom 50 setup commit contains only the excluded `.classroom50.yaml`. That is why the run succeeds by default. Once students have started work, set [`fail_on_empty_assessment`](reference/inputs-outputs.md) to `'true'` and an unassessed repository will show as a failed run instead of one you have to open to notice.

### The action is failing with a permissions error.

Make sure the workflow's `permissions` block includes all required scopes: `contents: write` and `issues: write`. Check the [Getting Started](getting-started.md) page for a reference workflow.

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
