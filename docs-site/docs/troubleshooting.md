---
sidebar_position: 8
---

# Troubleshooting

Find the symptom you're seeing. Each entry gives the likely cause and the fix.

Most answers start in the same place: the student's repository → **Actions** → the GrillMyCode run. The **summary page** of a run shows its annotations (errors and warnings) and a written summary. The **log** is under the job; select the GrillMyCode step to expand it.

## No questions appeared

### The run is green, but there are no questions

A run that finds nothing to assess ends early and, by default, still **succeeds**. Open the run's summary page. It says which of two things happened:

- **"The commit range … contains no changed files."** Nothing was compared at all. This is normal straight after a student accepts an assignment, before they push any work.

  On an **empty-repository** assignment (`--empty-repo`), it also happens when the student's work is all in the first commit. Set `starter_code: none`; see [Using GrillMyCode with Classroom 50](guides/classroom50.md#empty-repository-assignments). Otherwise, check any `base_sha` or `head_sha` override.
- **"All N changed file(s) were removed by the exclude patterns."** Files changed, but every one was filtered out. The summary lists them. Bring back the ones you need with `exclude_pattern_overrides`; see [Choosing which files are assessed](guides/choosing-files.md#bringing-something-back).

Once students have started work, set [`fail_on_empty_assessment`](reference/inputs-outputs.md) to `'true'` so an unassessed repository shows as a failed run instead of a green tick.

### The run failed with `api_key is required`

The OpenRouter key didn't reach the workflow. Check that:

- the organization secret is called exactly `OPENROUTER_API_KEY`, or whatever name the workflow uses in `${{ secrets.… }}`;
- its **Repository access** includes the student's repository.

See [Get started: Set up an OpenRouter key](getting-started/openrouter-key.md#save-the-key-in-your-github-organization).

### The run failed with a permissions error

The workflow's `permissions` block must include both `contents: write` and `issues: write`; see [Tokens, secrets and permissions](reference/permissions.md#github_token-and-the-permissions-block). Workflows created with the Wizard or copied from a recipe already have them.

### A tag-triggered run failed

A run started by a tag fails, rather than assessing anything, in two cases. The run's log says which:

- **The tag matches nothing in `submission_tags`.** The workflow's `on.push.tags` and the `submission_tags` input have drifted apart. List the same tags in both.
- **The tagged commit isn't on the default branch.** Merge the work into the default branch, move the tag to the merged commit with `git tag -f <name>`, and push it with `git push --force origin <name>`.

See [Triggers in depth](reference/triggers.md#submission-tags).

### A student ran `gh student submit`, but no questions appeared

With a tag-triggered workflow, that's expected. GrillMyCode ignores Classroom 50's own `submit/…` tags, so the student also has to push *your* tag. See [Using GrillMyCode with Classroom 50](guides/classroom50.md#gh-student-submit-and-submission-tags).

## AI and OpenRouter

### OpenRouter: "No endpoints available matching your guardrail restrictions and data policy" (404)

This is an OpenRouter account setting, not a GrillMyCode bug. Your privacy or guardrail settings exclude every provider that could serve the requested model. It's most common with free or near-free models, which require you to opt in to data sharing.

Fix it in your [OpenRouter privacy settings](https://openrouter.ai/settings/privacy):

1. **Allow free endpoints.** Turn on the options that allow free endpoints that may train on or publish prompts. Free models won't route until these are on.
2. **Turn off "ZDR Endpoints Only".** This restricts routing to zero-data-retention providers, which often excludes the free tier.
3. **Clear provider restrictions.** Under Allowed/Ignored Providers, remove any rules so OpenRouter can route freely.

Then re-run the workflow. If it still fails, the model ID may be wrong or retired. Check it against [OpenRouter's model list](https://openrouter.ai/models); free models often need a `:free` suffix.

### The run failed with `AI API error 404`

If the error says GrillMyCode only uses providers at `fp8` precision or higher, every provider OpenRouter has for this model may run a compressed copy, which GrillMyCode never uses. Choose another model. The Workflow Wizard warns about such a model under the **Model** field on the AI step. See [Compressed models](ai-providers/openrouter.md#compressed-models).

Otherwise, check the model ID against [OpenRouter's model list](https://openrouter.ai/models). A mistyped or retired model also returns a 404.

### Runs fail with rate-limit errors (429)

GrillMyCode already waits and retries, so a run that still fails hit a limit that lasted longer than its retries. Check the error message for the cause:

- **`The model's upstream provider (…) is rate-limiting every OpenRouter user of this model`**: the company serving the model is busy for everyone, not just you. Re-run later, remove a `:nitro` or `:floor` ending from `ai_model`, or try another model.
- **Any other 429**: your key's limit, which a whole class pushing at once shares. Check the OpenRouter account has credit, because accounts with no credit are limited far more strictly. Then raise `ai_retry_max_attempts` or try a less busy model; see [Choosing a model and managing cost](guides/choosing-a-model.md).

For how the two limits differ, see [Retries and rate limits](ai-providers/openrouter.md#retries-and-rate-limits).

### The run failed with `AI API error 400` after changing reasoning

If the error mentions `ai_reasoning_effort`, the workflow asked the model to switch reasoning off (`ai_reasoning_effort: "none"`), and the model always reasons. OpenRouter rejects that request rather than guessing a level.

Change `ai_reasoning_effort` to `default` or a low level such as `minimal` or `low`, or remove it. The Workflow Wizard's **Reasoning** setting, under **Advanced settings** on the AI step, offers **Off** only for models that allow it. See [Reasoning](ai-providers/openrouter.md#reasoning).

### The run failed with `AI API error 400` after setting a temperature

If the error mentions `ai_temperature`, the model, or the provider serving it, doesn't accept the temperature the workflow set. Models differ in the range they accept.

Remove `ai_temperature` so the model runs at its own temperature, or check the model maker's documentation for its range. In the Workflow Wizard, untick **Set a temperature** under **Advanced settings** on the AI step. See [Temperature](ai-providers/openrouter.md#temperature).

### The run failed with `AI reply could not be used`

GrillMyCode asks the model for its questions in a fixed JSON format, and every attempt returned something else. If the log also warns that the model hit its output limit, the reply was cut off before a single question was complete.

- If the reply was cut off, lower `num_questions`, or choose a model with a larger output limit.
- Otherwise, choose a model that supports structured outputs, which holds it to the format. See [Structured outputs](ai-providers/openrouter.md#structured-outputs).

### Questions take a long time to arrive

If you're happy with the questions but not the wait, try the **Speed** routing option (`:nitro`). Check the price first, because fast providers can cost more. See [Model routing variants](ai-providers/openrouter.md#model-routing-variants).

## Questions and files

### Some questions are missing from a student's report

GrillMyCode holds back any question it can't be sure doesn't give away its own answer, and the student's report says how many. It also drops questions that don't point at the student's own code: ones naming a file or lines that weren't sent to the AI, and ones showing only code the student didn't write in this submission. Your [instructor repository](reference/instructor-repository.md) copy has every question that wasn't dropped. The ones dropped for not pointing at the student's code are in `data/questions.json`, marked as dropped, and `data/raw-ai-output.md` has the model's full original reply. See [What code is assessed](reference/code-selection.md#4-after-the-ai-replies).

### A repository has two issues called GrillMyCode Questions

One of them wasn't written by GrillMyCode: someone opened it by hand with the same title and the `assessment` label, or edited a GrillMyCode issue until the report's opening lines were gone. GrillMyCode never overwrites or deletes an issue it didn't write, so it posts the questions in an issue of its own, and the run's log names the one it left alone. Close or rename the other issue. See [When the questions are regenerated](reference/assessment-output.md#when-the-questions-are-regenerated).

### A file I expected isn't assessed

Check the `Exclude patterns applied` list in the run's log, and find the pattern that matches the file. Then add the file, or the pattern for all files of that type, to `exclude_pattern_overrides`. See [File filtering](reference/exclude-patterns.md#confirming-what-was-applied).

### Files are assessed that shouldn't be

Add them to `additional_exclude_patterns`. See [Choosing which files are assessed](guides/choosing-files.md#leaving-out-more).

### The detected language looks wrong

Detection uses GitHub's language statistics for the repository, which are based on file extensions, and the project files (such as `package.json` or `artisan`) found in each folder. The `Using gitignore templates` log lines show what was applied, one for the repository root and one for each nested project folder. Use `additional_exclude_patterns` to fill gaps, or `exclude_pattern_overrides` to bring back files a mismatched template excluded.

### The AI ignores the code comments

That's intended: comments are removed so questions are about what the code does. Set `keep_comments: 'true'` to keep them; see [Tailoring the questions](guides/tailoring-questions.md#keep-or-remove-comments).

## Private answer key (instructor repository)

The answer key reports problems through **annotations on the student's GrillMyCode run**, on its summary page. The quiz workflow's own annotations are described in the instructor repository's `README.md`, under "Reading a run's annotations".

### The run is green, but nothing arrived in the instructor repository

**This is the one to watch for.** A delivery failure is raised as an *error annotation*, `Failed to write to instructor repository {org}/{assignment-name}-grillmycode-instructor: …`, but it does **not** fail the job. The student's issue and PDF are produced normally, so the run finishes with a green tick.

That's deliberate: a student should never see a failed assessment because of an instructor-side problem. The trade-off is that the failure is easy to miss, so read the annotations rather than trusting the tick. The message names the underlying GitHub error, most often a token that has expired, lost access to the organization, or can't create repositories there.

Delivery isn't retried later on its own, but nothing is lost: the student's next push delivers their assessment in full.

### `Could not update .github/workflows/generate-lms-quiz.yml in …`

The token can't write under `.github/workflows/`, which needs the `workflow` scope (classic token) or Workflows: Read and Write (fine-grained). The assessment itself still arrives; only the sync of the action-owned files is skipped. The repository keeps working with whatever version of the quiz workflow it started with, and never receives later fixes.

To fix it, edit the token (**Settings → Developer settings → Tokens (classic) → your token**) and tick **`workflow`** alongside **`repo`**, or add **Workflows: Read and Write** to a fine-grained token. If that produced a new value, update the `INSTRUCTOR_REPO_TOKEN` secret.

The same warning naming `README.md` instead means a broader permission problem, since that file needs no special scope.

### `… was rate limited (403)` or `… hit a concurrent-write conflict (409)`

Both are expected when a whole class pushes at once, because every student's run commits to the same repository. Each write is retried up to five times. Conflicts re-read the file and retry after a short random delay. Rate limits wait for GitHub's `Retry-After` or `X-RateLimit-Reset` time, up to 60 seconds per wait. A run that logs these warnings and then finishes has delivered successfully.

Only if all five attempts fail does it become the error annotation above, and the student's next push tries again from scratch.

### `Timed out waiting for … default branch to initialise`

This is raised while creating a brand-new instructor repository, when GitHub's first commit hasn't appeared after ten one-second checks. It's rare, and fixes itself: the repository now exists, so the next student push delivers normally.

### The instructor repository is never created (personal accounts)

Automatic creation uses GitHub's *create an organization repository* endpoint, so the student repositories must belong to an **organization**. Under a personal account the creation fails, and is reported as the error annotation above.

To use the feature anyway, create the repository by hand. Name it exactly `{assignment-name}-grillmycode-instructor`, make it private, initialize it with a README so it has a default branch, and give the token access to it. The action only creates a repository when one doesn't exist, so every later run writes to yours as normal.

### Quizzes are missing or out of date

The quiz files are built by the **Generate LMS Quiz** workflow in the instructor repository, not by the student's run. Check that repository's **Actions** tab. To rebuild every student's quiz, run the workflow by hand. A student folder without a `data/questions.json`, such as one assessed by an earlier release, gets no quiz until that student is assessed again; see [Upgrade notes](reference/upgrade-notes.md#quizzes-are-built-from-dataquestionsjson). See [Instructor repository internals](reference/instructor-repository.md#quiz-files).

## Getting more detail

- **Turn on debug logging** to see every resolved input and the exact prompt sent to the AI. See [Debug mode](reference/debug-mode.md).
- **Read `data/raw-ai-output.md`** in the student's folder in the instructor repository to see the model's reply before any processing. See [Instructor repository internals](reference/instructor-repository.md#raw-ai-outputmd).
- **After an upgrade,** check [Upgrade notes](reference/upgrade-notes.md) for changes that need action.
