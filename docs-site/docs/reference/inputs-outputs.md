---
sidebar_position: 1
---

# Inputs & Outputs

:::tip
The [Workflow Wizard](../workflow-wizard.mdx) lets you configure these inputs visually and generates the complete workflow YAML for you.
:::

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `github_token` | Yes | `${{ github.token }}` | GitHub token for API access — issues, releases, and repository metadata. Not used for question generation |
| `ai_provider` | No | `openrouter` | AI provider. `openrouter` is the only supported value, so this can be omitted |
| `ai_model` | No | `google/gemini-3.5-flash-lite` | Model identifier in OpenRouter `provider/model-name` format. See [openrouter.ai/models](https://openrouter.ai/models) May end with an OpenRouter routing variant — `:nitro` (fastest providers first) or `:floor` (cheapest providers first). See [Model routing variants](../ai-providers/openrouter.md#model-routing-variants) |
| `ai_retry_max_attempts` | No | `5` | Total number of attempts (initial + retries) when calling the AI provider. Retries are triggered by transient errors: 429 (rate limit), 500, 502, 503, 504, and network-level failures, and by a reply that isn't in the format GrillMyCode asked for, unless the model stopped at its output limit; see [After the AI replies](code-selection.md#4-after-the-ai-replies). Values below 1 are clamped to 1 |
| `ai_temperature` | No | | A temperature to send, from `0` to `2` (OpenRouter's range). Empty by default, so none is sent and the model runs at its own. Models differ in the range they accept and whether they use temperature at all: set it only if you know the chosen model's, and if you're not sure how a change would affect the questions, don't set it. A value outside `0` to `2`, or not a number, is ignored with a warning. See [Temperature](../ai-providers/openrouter.md#temperature) |
| `ai_reasoning_effort` | No | `default` | How much the model reasons before answering: `default`, `none`, `minimal`, `low`, `medium`, `high`, `xhigh` or `max`. `default` sends no setting, so the model's own default applies. `none` switches reasoning off, and fails the run with a `400` on a model that always reasons. Any other level the model doesn't support is mapped to its nearest one. Reasoning is billed as output. Case-insensitive; an unknown value fails the run. See [Reasoning](../ai-providers/openrouter.md#reasoning) |
| `api_key` | Yes | | OpenRouter API key. Required — `github_token` cannot be used for question generation, and the action fails immediately if this is empty. Create one at [openrouter.ai/keys](https://openrouter.ai/keys) |
| `num_questions` | No | `20` | Number of questions to generate (minimum 1, maximum 50). Values above 50 are automatically capped |
| `question_emphasis` | No | `balanced` | Limits the kinds of question asked: `balanced` (any kind), `research` (only questions that turn on documentation, edge cases and changes) or `tracing` (only questions answered by mentally running the code). Case-insensitive; any other value fails the run. See [Question emphasis](#question-emphasis) |
| `include_answers` | No | `false` | When `true`, each question is immediately followed by its answer labelled **Answer:** in the **student-facing** report — meaning the student sees the answers. This defeats the purpose of the assessment, which is for the student to work out the answers themselves. Leave this `false` in almost all cases. The instructor repository (when `instructor_repo_token` is configured) always includes answers regardless of this setting |
| `exclude_pattern_overrides` | No | | Comma-separated entries to re-include files excluded by auto-detection or `additional_exclude_patterns`. Each entry can be an exact pattern (e.g. `**/*.md`) to re-include all files of that type, or a specific file path (e.g. `README.md`) to allow only that file through. Note: binary files are **always** skipped regardless of overrides |
| `additional_exclude_patterns` | No | | Comma-separated globs for **extra** files to exclude on top of the [auto-detected stack patterns](exclude-patterns.md). Use for assignment-specific files (starter code, fixtures, data files) that the auto-detected templates wouldn't cover |
| `instructor_repo_token` | No | | **Classroom 50 assignment repositories only.** PAT with `repo` and `workflow` scopes and permission to create repositories in the same organization. When provided, the action writes a private instructor-only assessment file (questions **and** answers) to a repository named `{assignment-name}-grillmycode-instructor` in the same organization. The repository is created automatically on first run, and its quiz-generation workflow and README are refreshed on every run whenever they differ from the copies shipped with the action. The assignment name and the student's folder are read from the Classroom 50 repository name (`<classroom>-<assignment>-<username>`) and the repository's direct collaborators — see [how the assignment and student are identified](instructor-repository.md#how-the-assignment-and-student-are-identified). Any other repository skips instructor delivery with a warning. It also switches on multiple-choice distractor generation: the three wrong options exist only for the quiz built from this copy, so when the token is absent the action asks the model for the correct answer alone. Leave empty to disable instructor repository delivery |
| `label_repos` | No | `false` | Labels the **student repository** in GitHub's own metadata once an assessment exists, so assessed repositories are identifiable in an organization's repository list. When `true`, adds the `grillmycode` topic, which makes them filterable with `org:<org> topic:grillmycode`, and appends `· 🔥 GrillMyCode: N questions` to the repository description. `false` (the default) writes nothing. Requires `instructor_repo_token`; without it the labels are skipped with a warning — see [Tracking assessed repositories](../guides/tracking-repositories.md) and [Repository label internals](repository-labels.md). Existing topics are preserved, and a label written by an earlier run is replaced rather than appended to. Never fails the run |
| `instructor_context` | No | | Instructor-specific instructions for this assignment. Injected into the system prompt and takes precedence over default behaviour. Supports multi-line instructions. When set, the AI also generates a one-sentence summary of the question focus, shown as an **Instructor Note** in the report header |
| `assignment_context` | No | | Comma-separated file glob(s) read from the repository and injected into the AI prompt before `instructor_context`. Supported file types: plain text / source files (UTF-8), PDF (`.pdf` — text layer only), Microsoft Word (`.doc`/`.docx` — text only). If no files match, a workflow warning is emitted and the action continues without context. Example: `"README.md, docs/brief.pdf, rubric.docx"` |
| `assignment_context_max_chars` | No | `20000` | Maximum total characters read from all `assignment_context` files combined. Prevents large files from flooding the prompt. Values below 1 are clamped to 1 |
| `keep_comments` | No | `false` | When `false` (default), inline and block comments are stripped before sending code to the AI. Set to `"true"` to preserve comments |
| `fail_on_empty_assessment` | No | `false` | When `true`, a run that finds nothing to assess fails instead of succeeding. Both causes (empty commit range; every changed file excluded) occur normally at assignment-accept time, so this is opt-in. The run summary explains the reason either way |
| `starter_code` | No | `ignore` | What the repository's first commit is, and what the AI does with the starter code in it: `none` (the repository starts empty, so the first commit is the student's and is assessed — Classroom 50 `--empty-repo`), `ignore` (the first commit is your starter code and is left out), `context` (unchanged starter files are also sent as background, never asked about on their own) or `ask` (as `context`, and up to one in `starter_questions_one_in` questions may be about the starter code itself). Case-insensitive; any other value fails the run. See [Starter code](code-selection.md#starter-code) |
| `starter_questions_one_in` | No | `5` | Under `starter_code: ask`, up to one in this many questions may be about starter code alone, rounded down but at least one once there are two questions: `5` allows 4 of 20. Values below 2 are clamped to 2, so at least half the questions stay on the student's own work; values above `num_questions` allow one, and values above 50 are clamped to 50. No effect under other `starter_code` values. See [Asking about starter code](code-selection.md#asking-about-starter-code) |
| `previous_work` | No | `context` | Whether the student's own earlier work that this submission didn't touch is sent to the AI as background: `context` or `ignore`. Earlier work exists only when the range starts after the first commit (`tag_diff_base: previous-tag` or `tag:<name>`, or `base_sha`), so other runs are unaffected. Never asked about on its own, except the starter lines of a starter file the student changed earlier, under `starter_code: ask`. Case-insensitive; any other value fails the run. See [Codebase context](code-selection.md#codebase-context) |
| `codebase_context_max_chars` | No | `50000` | Maximum total characters sent as codebase context: starter code under `starter_code: context` or `ask`, and earlier work under `previous_work: context`. The two share the limit. Files are added whole, nearest to the assessed files first; a file that would exceed the limit is left out and counted in the run summary. Values below 1 are clamped to 1 |
| `skip_committers` | No | `github-actions[bot]` | Comma-separated list of commit author names or email substrings. Leading bot commits after the base SHA are excluded from the diff. Classroom 50's accept-time setup commit is authored under the student's own identity, not a bot, so this input has no leading commit to match there (see [Classroom 50](../guides/classroom50.md)); its `.classroom50.yaml` file is excluded by pattern instead. Set to `''` to disable |
| `submission_tags` | No | | **Tag-triggered workflows only.** Comma- or newline-separated tag names that mark a submission — the tags you define for the assignment, listed exactly as in the workflow's `on.push.tags` (e.g. `complete`, or `phase1, phase2, final`). No tag is recognized unless it is listed here. A wildcard entry is allowed, using GitHub's filter syntax: `*` (not crossing `/`), `**`, `?`, `+` and `[ ]` classes; `!` negation is not supported. A run started by a tag fails unless the tag matches one of these entries **and** points at a commit on the default branch. Each entry is its own delivery group — one issue, one PDF, one instructor-repository folder — so `phase1` and `phase2` are kept apart. Ignored on runs not started by a tag. See [Triggers in depth](triggers.md#submission-tags) |
| `tag_diff_base` | No | `cumulative` | **Tag-triggered workflows only.** `cumulative` uses the same diff base as any other run, so each tag assesses all of the student's work to date. `previous-tag` starts the diff at the nearest earlier commit carrying a `submission_tags` tag, so each tag assesses only the work since the one before it; with no earlier tag it falls back to `cumulative`. `tag:<name>` (for example `tag:phase1`) starts the diff at that one tag, which need not be in `submission_tags`; it never falls back, so see [What each tag assesses](triggers.md#what-each-tag-assesses) for when it fails the run. `base_sha` takes precedence over all three |
| `base_sha` | No | | Override the base commit SHA |
| `head_sha` | No | | Override the head commit SHA |

### Deprecated inputs

These still work until the next major version, with a warning in the run log. When the input that replaces them is set, they are ignored.

| Input | Read as |
|---|---|
| `include_initial_commit: 'true'` | `starter_code: none` |
| `include_initial_commit: 'false'` | `starter_code: ignore` |
| `include_codebase_context: 'true'` | `starter_code: context` and `previous_work: context` (with `include_initial_commit: 'true'`, `starter_code` stays `none`) |
| `include_codebase_context: 'false'` | `previous_work: ignore` |

## Question emphasis

GrillMyCode builds each question set from a range of question kinds. `question_emphasis` limits which kinds it may use.

| Value | Every question asks… | Question words suggested |
|---|---|---|
| `balanced` | Any kind. At least half trace the code or follow data through it. | Which, Where, When, Why, How many, How often, How much, In what order, At what point, Under what condition, What |
| `research` | Why a line or ordering is needed, what a built-in or library call does here, what happens on an edge case or after a change, under what condition a branch runs, or in what order things happen. | Why, How would … change if, How does … change when, How does … respond when, Under what condition, When, At what point, In what order, and What only as: What happens when, What happens if, What would … if, What does … return when, What is the exact effect of … on, What is the direct impact on … of |
| `tracing` | The value a function returns for a given input, the state of a variable at a point, where a value comes from, or in what order statements run. | Which, Where, How many, How often, How much, In what order, What |

How each value changes the prompt:

- **`balanced`** sends the same prompt as a workflow that doesn't set the input.
- **`research`** allows only the research kinds. At least a quarter of the questions (rounded up) must be causal "why" questions or questions about how the language or a library behaves. Before writing, the AI lists every place the code relies on behaviour a student would need to look up: built-in and library calls, casts, comparisons, default arguments, flags, type coercion, mutation versus copying, async ordering, and the conditions under which a call throws or returns something unexpected. It spends the questions on those first. The list is the first part of its reply, a `lookup_targets` field written before any question, so the step happens even on a model that doesn't reason before answering. Students never see the list. It's kept only in the instructor repository's [`raw-ai-output.md`](instructor-repository.md#raw-ai-outputmd), where it shows what the AI found to ask about. No two questions may test the same call or condition, and a question the student could answer by reading the snippet aloud (the text a condition returns, the limit an `if` checks) is rewritten. So is one that only runs a stated value past a condition the snippet shows, such as what an `if` that resets negatives to zero does to −2. A question about a change must change how the code uses the language or a library (an argument, flag, cast, operator or comparison, or one call swapped for another). Changing a data value or removing a record and recounting is tracing, so it isn't asked. A "What" question may only use the forms in the table, each of which brings in a change or input the code doesn't show. Questions that ask what a call, argument or variable does, holds or is for in general ("What does … do", "What is the purpose of…", "the exact effect of `ENT_QUOTES`") are not allowed.
- **`tracing`** allows only the tracing kinds, so there are no "why" questions and no questions about how the language or a library behaves.

`research` and `tracing` are all-or-nothing. When the submitted code can't supply enough good questions of those kinds, the AI doesn't switch to other kinds. It first uses fewer distinct kinds and asks more than one question about the same function. Under `research`, it may also test the same call or condition again with a different input. Then it writes simpler "broader" questions of the same kinds. On a small or simple submission, expect some questions to be easier or more repetitive than under `balanced`.

Some things don't change with the setting. Every question still uses an allowed opening and has one provable answer. One in every three is still short-answer.

The value a run used is shown in the run summary's **Configuration used by this run** block. When it isn't `balanced`, it's also recorded in the settings line of the instructor repository's raw AI output.

## Outputs

| Output | Description |
|---|---|
| `issue_url` | URL of the created or updated assessment issue |
| `issue_number` | Number of the created or updated assessment issue |
| `pdf_url` | Download URL of the assessment PDF release asset. Empty if PDF generation failed |
| `questions` | The generated questions as a string (internal AI markers stripped; does not include the instructor note) |
| `code_before_strip` | Full code content of all assessed files before comment stripping |
| `code_after_strip` | Full code content of all assessed files after comment stripping |

## Using outputs in subsequent steps

Give the action step an `id`, then reference its outputs with `steps.<id>.outputs.<name>`.

Pass outputs into a script through `env:`, never by writing `${{ … }}` directly inside `run:`. `questions`, `code_before_strip` and `code_after_strip` contain student-written text. GitHub pastes an expression into the script *before* the shell runs it, so a crafted value could break the script or run commands of the student's choosing.

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v0
  id: assess
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    api_key: ${{ secrets.OPENROUTER_API_KEY }}

- name: Print issue link and questions
  env:
    ISSUE_URL: ${{ steps.assess.outputs.issue_url }}
    QUESTIONS: ${{ steps.assess.outputs.questions }}
  run: |
    echo "Assessment issue $ISSUE_URL"
    printf '%s\n' "$QUESTIONS"

- name: Comment character count
  env:
    CODE_BEFORE: ${{ steps.assess.outputs.code_before_strip }}
    CODE_AFTER: ${{ steps.assess.outputs.code_after_strip }}
  run: |
    echo "Code before stripping: ${#CODE_BEFORE} chars"
    echo "Code after stripping:  ${#CODE_AFTER} chars"
```

See also the [Using the action's outputs](../example-workflows/post-to-issues.md) recipe.
