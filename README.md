# Grill My Code

A GitHub Action that analyses code changes and uses AI to generate targeted comprehension questions for conversational or written assessments.

## How it works

1. Detects the commit range from the triggering event (push, pull request, etc.)
2. Collects the git diff of changed files, applying include/exclude filters
3. Sends the diff to an AI provider to generate comprehension questions
4. Writes the assessment to a Markdown file, and optionally posts it as a PR comment, GitHub Issue, or GitHub Discussion

See [architecture](https://nscc-itc-assessment.github.io/GrillMyCode/docs/development/architecture) for a detailed breakdown of how the action is structured and executed.

## Usage

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

### Inputs

| Input                          | Required | Default                                     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------ | -------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `github_token`                 | Yes      | `${{ github.token }}`                       | GitHub token for API access and GitHub Models credential                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `ai_provider`                  | No       | `github-models`                             | AI provider: `github-models`, `openai`, `openrouter`, or `azure-openai`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ai_model`                     | No       | `gpt-4.1`                                   | Model identifier for the chosen provider                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `ai_retry_max_attempts`        | No       | `5`                                         | Total number of attempts (initial + retries) when calling the AI provider. Retries are triggered by transient errors: 429 (rate limit), 500, 502, 503, 504, and network-level failures. A 429 with a `Retry-After` header has that value honoured. Values below 1 are clamped to 1.                                                                                                                                                                                                                                                                          |
| `ai_temperature`               | No       | `0.5`                                       | Controls the randomness of the AI's output (0.0 = fully deterministic, 1.0 = most random). Lower values produce more predictable, consistent questions; higher values produce more varied output. Most users should leave this at the default.                                                                                                                                                                                                                                                                                                               |
| `api_key`                      | No       |                                             | API key for the provider. For `github-models`, leave empty to use `github_token`, or supply an alternative PAT (e.g. an instructor token with an alternative licence) to override it                                                                                                                                                                                                                                                                                                                                                                         |
| `azure_endpoint`               | No       |                                             | Azure OpenAI endpoint URL (required for `azure-openai`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `num_questions`                | No       | `20`                                        | Number of questions to generate (minimum 1, maximum 50). Supplied values above 50 are automatically capped to 50.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `include_answers`              | No       | `false`                                     | When `true`, each question is immediately followed by its answer labelled **Answer:** in the **student-facing** report — meaning the student sees the answers. This defeats the purpose of the assessment, which is for the student to work out the answers themselves. Leave this `false` in almost all cases. The instructor repository (when `instructor_repo_token` is configured) always includes answers regardless of this setting.                                                                                                                   |
| `include_patterns`             | No       |                                             | Comma-separated globs for files to include                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `exclude_patterns`             | No       | _(common non-code files)_                   | Comma-separated globs for files to exclude. **Providing a value completely replaces the default list** — you are responsible for re-including any defaults you still want (e.g. `node_modules/**`, `**/*.md`, `**/*.png`).                                                                                                                                                                                                                                                                                                                                   |
| `output_file`                  | No       | `grill-my-code.md`                          | Path for the output Markdown file                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `post_pr_comment`              | No       | `false`                                     | Post assessment as a PR comment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `post_issue`                   | No       | `false`                                     | Create a GitHub Issue with the assessment. The issue is automatically assigned to the student who authored the head commit.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `post_discussion`              | No       | `false`                                     | Create a GitHub Discussion with the assessment. If Discussions are not enabled on the repository, the action enables them automatically.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `discussion_category`          | No       | `Assessments`                               | Discussion category name                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `instructor_repo_token`        | No       |                                             | PAT with `repo` and `workflow` scopes and permission to create repositories in the same organisation. When provided, the action writes a private instructor-only assessment file (questions **and** answers) to a repository named `{assignment-name}-grillmycode-instructor` in the same organisation. The repository is created automatically on first run. The assignment name is resolved from the student repo's `template_repository` (GitHub Classroom), falling back to the source repo name. Leave empty to disable instructor repository delivery. |
| `additional_context`           | No       |                                             | Instructor-specific instructions for this assignment. Injected at the end of the system prompt and takes precedence over any conflicting default behaviour. Supports multi-line, detailed instructions.                                                                                                                                                                                                                                                                                                                                                      |
| `assignment_context`           | No       |                                             | Comma-separated file glob(s) read from the repository and injected into the AI prompt before `additional_context`. Supported file types: plain text / source files (UTF-8), PDF (`.pdf` — text layer only), Microsoft Word (`.doc`/`.docx` — text only). If no files match, a workflow warning is emitted and the action continues without context. Example: `"README.md, docs/brief.pdf, rubric.docx"`.                                                                                                                                                     |
| `assignment_context_max_chars` | No       | `20000`                                     | Maximum total characters read from all `assignment_context` files combined. Prevents large files from flooding the prompt. Values below 1 are clamped to 1.                                                                                                                                                                                                                                                                                                                                                                                                  |
| `exclude_workflow_files`       | No       | `true`                                      | Exclude `.github/workflows/**` files from the assessed diff. Set to `"false"` to include workflow files so they can be subject to comprehension questions.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `keep_comments`                | No       | `false`                                     | When `false` (default), inline and block comments are stripped from the submitted code before it is sent to the AI. Set to `"true"` to preserve comments exactly as written.                                                                                                                                                                                                                                                                                                                                                                                 |
| `skip_initial_commit`          | No       | `true`                                      | When `true` (default), pins the diff base to the first commit so starter/template files are excluded. When `false`, uses the empty tree as the base so the initial commit's files are included in the diff regardless of event type.                                                                                                                                                                                                                                                                                                                         |
| `skip_committers`              | No       | `github-classroom[bot],github-actions[bot]` | Comma-separated list of commit author names or email substrings. Consecutive leading commits (immediately after the base SHA) whose author matches any entry are excluded from the diff. Only a leading run is skipped — bot commits after any student commit are included. Set to `''` to disable.                                                                                                                                                                                                                                                          |
| `base_sha`                     | No       |                                             | Override the base commit SHA                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `head_sha`                     | No       |                                             | Override the head commit SHA                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### Outputs

| Output              | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `output_file`       | Path to the generated assessment Markdown file                   |
| `questions`         | The raw generated questions as a string                          |
| `code_before_strip` | Full code content of all assessed files before comment stripping |
| `code_after_strip`  | Full code content of all assessed files after comment stripping  |

## Example workflows

Ready-to-use workflows for each configuration are available in the [example workflows](https://nscc-itc-assessment.github.io/GrillMyCode/docs/category/example-workflows) section of the docs site. To generate a tailored workflow interactively, use the [Workflow Wizard](https://nscc-itc-assessment.github.io/GrillMyCode/workflow-wizard). Copy the relevant YAML into `.github/workflows/` in your repository.

### Pull request

Generates questions whenever a student opens or updates a PR, and posts them as a PR comment.

```yaml
name: Grill My Code
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write # required to post the PR comment
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0 # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          post_pr_comment: 'true'
          num_questions: '20'
          additional_context: 'Assignment 3 — Python list comprehensions'
```

### Push to branch

Generates questions on every push. Useful when students work directly on a branch without opening a PR.

```yaml
name: Grill My Code
on:
  push:
    branches-ignore: [main, master]

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    permissions:
      contents: write # required to write the output file to the repo
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          post_pr_comment: 'false'
          output_file: 'grill-my-code.md'
```

### Post to GitHub Issues

Creates a searchable GitHub Issue for each assessment run. If an issue already exists for the same branch, its body is updated in-place rather than deleted and recreated, preserving issue history and comments.

```yaml
jobs:
  generate-questions:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: write
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          post_issue: 'true'
          post_pr_comment: 'false'
```

### Post to GitHub Discussions

Creates a Discussion instead of (or as well as) a PR comment. If Discussions are not yet enabled on the repository, the action enables them automatically. The named category must already exist.

```yaml
jobs:
  generate-questions:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      discussions: write
      administration: write # required only if Discussions may not yet be enabled
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          post_discussion: 'true'
          discussion_category: 'Assessments'
```

### Using a third-party AI provider

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    ai_provider: 'openai'
    ai_model: 'gpt-4o'
    api_key: ${{ secrets.OPENAI_API_KEY }}
    num_questions: '8'
    additional_context: 'Web Development — REST API design with Express.js'
```

---

## Permissions

| Permission              | When required                                                                     |
| ----------------------- | --------------------------------------------------------------------------------- |
| `contents: read`        | Always — needed to check out the repo and read the git history                    |
| `contents: write`       | When writing the output file back to the repository                               |
| `models: read`          | When using the `github-models` provider (the default)                             |
| `pull-requests: write`  | When `post_pr_comment: 'true'`                                                    |
| `issues: write`         | When `post_issue: 'true'`                                                         |
| `discussions: write`    | When `post_discussion: 'true'`                                                    |
| `administration: write` | When `post_discussion: 'true'` and Discussions may not yet be enabled on the repo |

---

## GitHub Classroom

This action is designed to work with GitHub Classroom. By default (`skip_initial_commit: 'true'`), the diff base is pinned to the repository's very first commit — the template/starter code committed by Classroom. This means only code written by the student after accepting the assignment is assessed, and template boilerplate is never included in the diff.

In addition, the `skip_committers` input (defaulting to `github-classroom[bot],github-actions[bot]`) automatically advances the base past any consecutive bot commits that appear immediately after that first commit — for example, the feedback pull request or autograder setup commits that Classroom applies when a student accepts an assignment.

Set `skip_initial_commit: 'false'` to include the initial commit's files in the diff — the base is pinned to the empty tree regardless of event type, so all files from the very beginning of history are eligible to be assessed. To include truly everything (bot-committed starter files as well), also set `skip_committers: ''` to prevent the base from being advanced past those initial bot commits.

---

## Output file naming

All assessment files are written under the `.assessment/` folder. Any directory component of the `output_file` setting is ignored — only the basename is used. On the default branch (`main`/`master`) the file keeps the configured basename; on any other branch the sanitised branch name is appended before the extension:

| Branch            | `output_file` setting | Actual file written                            |
| ----------------- | --------------------- | ---------------------------------------------- |
| `main`            | `grill-my-code.md`    | `.assessment/grill-my-code.md`                 |
| `feat/login-form` | `grill-my-code.md`    | `.assessment/grill-my-code-feat-login-form.md` |
| `student/a1`      | `assessment.md`       | `.assessment/assessment-student-a1.md`         |

---

## Using action outputs

The action exposes two outputs for use in later steps:

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  id: assess
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}

- name: Upload assessment
  uses: actions/upload-artifact@v7
  with:
    name: assessment
    path: ${{ steps.assess.outputs.output_file }}

- name: Print questions
  run: echo "${{ steps.assess.outputs.questions }}"
```

---

## Exclude patterns behaviour

The default `exclude_patterns` list covers common non-code files (lock files, images, build artefacts, minified assets, and Markdown files). **Providing a custom value completely replaces this list** — it does not extend it. If you want to add patterns while keeping the defaults, you must repeat them:

```yaml
exclude_patterns: 'node_modules/**,**/*.lock,dist/**,tests/**'
```

---

## Further reading

Full documentation is available at **https://nscc-itc-assessment.github.io/GrillMyCode/**.

| Page                                                                                                   | Description                                                                     |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| [AI Providers](https://nscc-itc-assessment.github.io/GrillMyCode/docs/ai-providers)                    | Supported AI providers, required inputs, secrets, and example snippets for each |
| [Architecture](https://nscc-itc-assessment.github.io/GrillMyCode/docs/development/architecture)        | How the Docker-based action is structured and executed                          |
| [Example Workflows](https://nscc-itc-assessment.github.io/GrillMyCode/docs/category/example-workflows) | Copy-paste workflow files for each configuration                                |
| [Contributing](https://nscc-itc-assessment.github.io/GrillMyCode/docs/development/contributing)        | Local development setup, commit conventions, and the release process            |
| [Versioning](https://nscc-itc-assessment.github.io/GrillMyCode/docs/development/versioning)            | Release guide — patch, minor, and major releases                                |
