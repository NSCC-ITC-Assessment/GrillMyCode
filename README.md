# GrillMyCode

A GitHub Action that analyses code changes and uses AI to generate targeted comprehension questions for conversational or written assessments.

## How it works

1. Detects the commit range from the triggering event (push or manual dispatch)
2. Collects the git diff of changed files, applying include/exclude filters
3. Sends the code to an AI provider to generate comprehension questions
4. Creates or updates a GitHub Issue with the questions and generates a PDF

See [architecture](https://nscc-itc-assessment.github.io/GrillMyCode/docs/development/architecture) for a detailed breakdown of how the action is structured and executed.

## Usage

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

### Inputs

| Input                          | Required | Default               | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | -------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `github_token`                 | Yes      | `${{ github.token }}` | GitHub token for API access and GitHub Models credential                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `ai_provider`                  | No       | `github-models`       | AI provider: `github-models` or `openrouter`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `ai_model`                     | No       | `gpt-4.1`             | Model identifier for the chosen provider                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `ai_retry_max_attempts`        | No       | `5`                   | Total number of attempts (initial + retries) when calling the AI provider. Retries are triggered by transient errors: 429 (rate limit), 500, 502, 503, 504, and network-level failures. A 429 with a `Retry-After` header has that value honoured. Values below 1 are clamped to 1.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `ai_temperature`               | No       | `0.5`                 | Controls the randomness of the AI's output (0.0 = fully deterministic, 1.0 = most random). Lower values produce more predictable, consistent questions; higher values produce more varied output. Most users should leave this at the default.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `api_key`                      | No       |                       | API key for the provider. For `github-models`, leave empty to use `github_token`, or supply an alternative PAT (e.g. an instructor token with an alternative licence) to override it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `num_questions`                | No       | `20`                  | Number of questions to generate (minimum 1, maximum 50). Supplied values above 50 are automatically capped to 50.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `include_answers`              | No       | `false`               | When `true`, each question is immediately followed by its answer labelled **Answer:** in the **student-facing** report — meaning the student sees the answers. This defeats the purpose of the assessment, which is for the student to work out the answers themselves. Leave this `false` in almost all cases. The instructor repository (when `instructor_repo_token` is configured) always includes answers regardless of this setting.                                                                                                                                                                                                                                                                                 |
| `exclude_pattern_overrides`    | No       |                       | Comma-separated entries that allow specific files through the auto-detected exclude patterns. Each entry can be an **exact pattern** (e.g. `**/*.md` — re-includes all Markdown files) or a **specific file path** (e.g. `README.md` — only that file passes through while `**/*.md` still excludes everything else).                                                                                                                                                                                                                                                                                                                                                                                                      |
| `additional_exclude_patterns`  | No       |                       | Comma-separated globs for **extra** files to exclude on top of the auto-detected stack patterns. Use for assignment-specific files (starter code, fixtures, data files) that the auto-detected templates wouldn't cover. See [Exclude Patterns](https://nscc-itc-assessment.github.io/GrillMyCode/docs/reference/exclude-patterns).                                                                                                                                                                                                                                                                                                                                                                                        |
| `output_file`                  | No       | `grill-my-code.md`    | Path for the output Markdown file                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `instructor_repo_token`        | No       |                       | PAT with `repo` and `workflow` scopes and permission to create repositories in the same organisation. When provided, the action writes a private instructor-only assessment file (questions **and** answers) to a repository named `{assignment-name}-grillmycode-instructor` in the same organisation. The repository is created automatically on first run, and its quiz-generation workflow and README are refreshed on every run whenever they differ from the copies shipped with the action. The assignment name is resolved from the student repo's `template_repository` (set by Classroom 50 templated assignments), falling back to the source repo name. Leave empty to disable instructor repository delivery. |
| `instructor_context`           | No       |                       | Instructor-specific instructions for this assignment. Injected at the end of the system prompt and takes precedence over any conflicting default behaviour. Supports multi-line, detailed instructions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `assignment_context`           | No       |                       | Comma-separated file glob(s) read from the repository and injected into the AI prompt before `instructor_context`. Steers which topics the questions focus on. Globs match the student's checked-out tree, so prefer instructor-maintained paths (a `docs/` directory, a PDF brief) where possible. Use `instructor_context` for instructions that must take effect regardless. Supported file types: plain text / source files (UTF-8), PDF (`.pdf` — text layer only), Microsoft Word (`.doc`/`.docx` — text only). If no files match, a workflow warning is emitted and the action continues without context. Example: `"docs/brief.pdf, instructor/rubric.docx"`.                                                      |
| `assignment_context_max_chars` | No       | `20000`               | Maximum total characters read from all `assignment_context` files combined. Prevents large files from flooding the prompt. Values below 1 are clamped to 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `keep_comments`                | No       | `false`               | When `false` (default), inline and block comments are stripped from the submitted code before it is sent to the AI. Set to `"true"` to preserve comments exactly as written.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `include_initial_commit`       | No       | `false`               | When `false` (default), pins the diff base to the first commit so starter/template files are excluded. When `true`, uses the empty tree as the base so the initial commit's eligible files are included in the diff regardless of event type.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `skip_committers`              | No       | `github-actions[bot]` | Comma-separated list of commit author names or email substrings. Consecutive leading commits (immediately after the base SHA) whose author matches any entry are excluded from the diff. Only a leading run is skipped — bot commits after any student commit are included. Set to `''` to disable.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `base_sha`                     | No       |                       | Override the base commit SHA                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `head_sha`                     | No       |                       | Override the head commit SHA                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### Outputs

| Output              | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `output_file`       | Path to the generated assessment Markdown file                   |
| `questions`         | The raw generated questions as a string                          |
| `code_before_strip` | Full code content of all assessed files before comment stripping |
| `code_after_strip`  | Full code content of all assessed files after comment stripping  |

## Example workflows

Ready-to-use workflows for each configuration are available in the [example workflows](https://nscc-itc-assessment.github.io/GrillMyCode/docs/category/example-workflows) section of the docs site. To generate a tailored workflow interactively, use the [Workflow Wizard](https://nscc-itc-assessment.github.io/GrillMyCode/workflow-wizard). Copy the relevant YAML into `.github/workflows/` in your repository.

### Push to default branch

Generates questions whenever a commit lands on `main` or `master` — whether pushed directly or merged via a pull request.

```yaml
name: GrillMyCode
on:
  push:
    branches: ['main', 'master']
  workflow_dispatch:

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write # gmc-assessments release + PDF asset
      issues: write # assessment issue
      models: read # GitHub Models API
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0 # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          num_questions: '20'
          instructor_context: 'Assignment 3 — Python list comprehensions'
```

### Using OpenRouter

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    ai_provider: 'openrouter'
    ai_model: 'anthropic/claude-3-5-sonnet'
    api_key: ${{ secrets.OPENROUTER_API_KEY }}
    num_questions: '8'
    instructor_context: 'Web Development — REST API design with Express.js'
```

---

## Permissions

| Permission        | Why                                                     |
| ----------------- | ------------------------------------------------------- |
| `contents: write` | Create and update the `gmc-assessments` release and PDF |
| `issues: write`   | Create and update the assessment issue                  |
| `models: read`    | Call the GitHub Models API (default provider)           |

Instructor repository delivery adds nothing to this block — it runs entirely on the
`instructor_repo_token` PAT, whose own scopes (`repo` + `workflow`) cover repository creation and
the workflow file it maintains. See [Instructor repository delivery](#instructor-repository-delivery).

---

## Classroom 50

This action was originally designed to work with [GitHub Classroom](https://classroom.github.com/), which GitHub is discontinuing (full shutdown August 28, 2026). It now targets [Classroom 50](https://github.com/foundation50/classroom50), the open-source replacement — see the [Classroom 50 guide](https://nscc-itc-assessment.github.io/GrillMyCode/docs/guides/classroom50) for full details.

By default (`include_initial_commit: 'false'`), the diff base is pinned to the repository's very first commit — the template/starter code committed when the student accepted the assignment. This means only code written by the student after accepting the assignment is eligible for assessment, and template boilerplate is never included in the diff unless configured as such (`include_initial_commit: 'true'`).

Classroom 50's accept-time setup commit (which writes `.classroom50.yaml` and the autograde workflow shim) is authored under the student's own identity rather than a bot, so there's no leading bot commit for `skip_committers` to advance past — its `.classroom50.yaml` metadata file is excluded by pattern instead. `skip_committers` (defaulting to `github-actions[bot]`) remains available for any other bot-authored commits that land at the start of the assessed range.

Set `include_initial_commit: 'true'` to include the initial commit's eligible files in the diff — the base is pinned to the empty tree regardless of event type, so all files from the very beginning of history are eligible to be assessed. To include truly everything (bot-committed starter files as well), also set `skip_committers: ''` to prevent the base from being advanced past those initial bot commits.

---

## Instructor repository delivery

Setting `instructor_repo_token` stores a private, instructor-only copy of every assessment —
questions **and** answers — outside the student's repository:

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    instructor_repo_token: ${{ secrets.INSTRUCTOR_REPO_TOKEN }}
```

- The repository is named `{assignment-name}-grillmycode-instructor` and created **private** in the
  same organisation on the first student push. Each student's copy lands at
  `{student-login}/questions.md`.
- That write triggers a bundled **Generate LMS Quiz** workflow in the instructor repository, which
  builds an IMS Common Cartridge / QTI package per student for import into Brightspace or any other
  Common Cartridge–compatible LMS.
- That workflow and the instructor repository's `README.md` are owned by the action and re-synced on
  every delivery, so repositories created by an earlier release pick up quiz-generation fixes on
  their own. Local edits to either file are replaced on the next run.
- The PAT needs the `repo` **and** `workflow` scopes. The `workflow` scope is what allows the sync;
  without it the assessment is still delivered but every run warns and the quiz workflow stays
  frozen at the version it was seeded with.

Add the PAT once as an **org-level** Actions secret and every student repository inherits it. Full
walkthrough: [Instructor Setup](https://nscc-itc-assessment.github.io/GrillMyCode/docs/guides/instructor-setup).

---

## Using action outputs

The action exposes several outputs for use in later steps:

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  id: assess
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}

- name: Print issue link
  run: echo "Assessment issue ${{ steps.assess.outputs.issue_url }}"

- name: Print questions
  run: echo "${{ steps.assess.outputs.questions }}"
```

---

## Exclude patterns behaviour

When the action runs it automatically detects your stack using up to seven signals and applies the relevant [github/gitignore](https://github.com/github/gitignore) templates — covering build artifacts, dependency directories, lock files, IDE files, and more. No configuration is needed for standard stacks.

1. **GitHub Languages API** — identifies all languages in the repository.
2. **Repository root inspection** — checks for well-known config files and directories (`Cargo.toml`, `go.mod`, `artisan`, `wp-config.php`, `project.godot`, `firebase.json`, `angular.json`, etc.).
3. **Root filename suffix scan** — detects frameworks with variable-name project files (`.xcodeproj` → Xcode, `.uproject` → Unreal Engine, `.ipynb` → Jupyter Notebooks, etc.).
4. **`package.json` dependency scan** _(JS/TS repos only)_ — reads `dependencies` and `devDependencies` to identify the exact framework (`next`, `svelte`, `vue`, `@angular/core`, etc.) rather than guessing from config filenames.
5. **`composer.json` dependency scan** _(PHP repos only)_ — reads `require` and `require-dev` to identify the exact framework (`laravel/framework`, `symfony/framework-bundle`, `drupal/core`, `yiisoft/yii2`, etc.) rather than guessing from config filenames.
6. **`Gemfile` dependency scan** _(Ruby repos only)_ — reads `gem` declarations to identify the exact framework (`rails`, `jekyll`, `nanoc`) more reliably than inferring it from a `Rakefile`.
7. **`mix.exs` dependency scan** _(Elixir repos only)_ — reads dependency tuples (e.g. `{:phoenix, ...}`) to add Phoenix web artifacts on top of the base Elixir excludes.

To exclude additional files specific to your assignment (starter code, fixtures, data files):

```yaml
additional_exclude_patterns: 'tests/**,docs/**'
```

---

## Further reading

Full documentation is available at **https://nscc-itc-assessment.github.io/GrillMyCode/**.

| Page                                                                                                   | Description                                                                       |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [AI Providers](https://nscc-itc-assessment.github.io/GrillMyCode/docs/ai-providers)                    | Supported AI providers, required inputs, secrets, and example snippets for each   |
| [Architecture](https://nscc-itc-assessment.github.io/GrillMyCode/docs/development/architecture)        | How the Docker-based action is structured and executed                            |
| [Example Workflows](https://nscc-itc-assessment.github.io/GrillMyCode/docs/category/example-workflows) | Copy-paste workflow files for each configuration                                  |
| [Instructor Setup](https://nscc-itc-assessment.github.io/GrillMyCode/docs/guides/instructor-setup)     | One-time org setup for private instructor repository delivery and LMS quiz export |
| [Contributing](https://nscc-itc-assessment.github.io/GrillMyCode/docs/development/contributing)        | Local development setup, commit conventions, and the release process              |
| [Versioning](https://nscc-itc-assessment.github.io/GrillMyCode/docs/development/versioning)            | Release guide — patch, minor, and major releases                                  |
