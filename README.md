# GrillMyCode

GrillMyCode writes questions about each student's own code, so you can check that they understand the work they hand in.

It's a GitHub Action. When a student pushes their work, it picks out the code they wrote and has an AI model write questions about it. The questions arrive as an issue in the student's repository, with a PDF copy, ready for a short conversation or written check (a _code viva_). It doesn't grade anything: it does the preparation, and you have the conversation.

It's built for [Classroom 50](https://github.com/foundation50/classroom50) assignments, and with the recommended models an assessment usually costs less than one cent.

**Full documentation: [grillmycode.org](https://grillmycode.org/)**

## How it works

1. **Something starts a run:** a push, a submission tag the student pushes, or you.
2. **GrillMyCode finds the student's own code.** Your starter code, setup files, generated files and comments are left out.
3. **An AI model writes the questions**, guided by your instructions and, optionally, the assignment brief. It goes through [OpenRouter](https://openrouter.ai/), using one key for the whole class.
4. **The student gets their questions** as a GitHub issue and a PDF. Optionally, you get every student's questions _with answers_ in a private repository, plus a quiz file for your LMS.

More: [How it works](https://grillmycode.org/docs/how-it-works) · [Architecture](https://grillmycode.org/docs/development/architecture)

## Quick start

1. **Create an OpenRouter key** and save it as the organization secret `OPENROUTER_API_KEY`. See [Set up an OpenRouter key](https://grillmycode.org/docs/getting-started/openrouter-key).
2. **Build your workflow** with the [Workflow Wizard](https://grillmycode.org/workflow-wizard), or use the minimal one below.
3. **Commit it** to the assignment's template repository as `.github/workflows/grill-my-code.yml`.

```yaml
name: GrillMyCode

on:
  push:
    branches: ['main', 'master']
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
      contents: write # gmc-assessments release + PDF asset
      issues: write # assessment issue
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0 # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          api_key: ${{ secrets.OPENROUTER_API_KEY }}
          # If desired, uncomment this input and edit to use a different one —
          # any model from https://openrouter.ai/models (provider/model-name).
          # ai_model: "google/gemini-3.5-flash-lite"
```

The full walkthrough, including how to check the first run, is in [Get started](https://grillmycode.org/docs/getting-started).

## Choosing when it runs

| Trigger            | Runs when…                                           | Best for                                                 |
| ------------------ | ---------------------------------------------------- | -------------------------------------------------------- |
| **Push**           | a student pushes to the default branch               | Short assignments, and practice while students work      |
| **Submission tag** | a student pushes a tag you named, such as `complete` | Assessing finished work once, or a project in stages     |
| **Manual only**    | you select **Run workflow**                          | Choosing the timing yourself, such as after the deadline |

See [Choosing a trigger](https://grillmycode.org/docs/guides/choosing-a-trigger).

## Documentation

|                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Get started** | [Overview](https://grillmycode.org/docs/getting-started) · [Workflow Wizard](https://grillmycode.org/workflow-wizard)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Guides**      | [Tailoring the questions](https://grillmycode.org/docs/guides/tailoring-questions) · [Choosing which files are assessed](https://grillmycode.org/docs/guides/choosing-files) · [Choosing a model and managing cost](https://grillmycode.org/docs/guides/choosing-a-model) · [What your students see](https://grillmycode.org/docs/guides/what-students-see) · [Using with Classroom 50](https://grillmycode.org/docs/guides/classroom50) · [Keeping a private answer key](https://grillmycode.org/docs/guides/instructor-setup) · [Importing quizzes into your LMS](https://grillmycode.org/docs/guides/lms-quizzes) · [Tracking assessed repositories](https://grillmycode.org/docs/guides/tracking-repositories) |
| **Recipes**     | [Ready-made workflow files](https://grillmycode.org/docs/category/example-workflows)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Help**        | [Troubleshooting](https://grillmycode.org/docs/troubleshooting) · [FAQ](https://grillmycode.org/docs/faq) · [Upgrade notes](https://grillmycode.org/docs/reference/upgrade-notes)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Reference**   | [Inputs and outputs](https://grillmycode.org/docs/reference/inputs-outputs) · [What code is assessed](https://grillmycode.org/docs/reference/code-selection) · [File filtering](https://grillmycode.org/docs/reference/exclude-patterns) · [Triggers in depth](https://grillmycode.org/docs/reference/triggers) · [Tokens, secrets and permissions](https://grillmycode.org/docs/reference/permissions) · [OpenRouter](https://grillmycode.org/docs/ai-providers/openrouter)                                                                                                                                                                                                                                       |
| **Development** | [Architecture](https://grillmycode.org/docs/development/architecture) · [Contributing](https://grillmycode.org/docs/development/contributing) · [Versioning](https://grillmycode.org/docs/development/versioning)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Inputs

Only `api_key` needs setting; everything else has a sensible default. Full details for each input are in [Inputs and outputs](https://grillmycode.org/docs/reference/inputs-outputs).

| Input                          | Required | Default                        | Description                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | -------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `github_token`                 | Yes      | `${{ github.token }}`          | GitHub token for the issue, the PDF release and repository metadata. Not used to generate questions                                                                                                                                                                                                                                                  |
| `api_key`                      | Yes      |                                | OpenRouter API key. Create one at [openrouter.ai/keys](https://openrouter.ai/keys)                                                                                                                                                                                                                                                                   |
| `ai_provider`                  | No       | `openrouter`                   | AI provider. `openrouter` is the only supported value                                                                                                                                                                                                                                                                                                |
| `ai_model`                     | No       | `google/gemini-3.5-flash-lite` | OpenRouter model ID (`provider/model-name`), optionally with a routing variant: `:nitro` (fastest) or `:floor` (cheapest)                                                                                                                                                                                                                            |
| `ai_retry_max_attempts`        | No       | `5`                            | Total attempts per AI request, retrying on 429, 5xx and network errors. Each wait is capped at 30 seconds                                                                                                                                                                                                                                            |
| `ai_temperature`               | No       | `0.5`                          | Randomness of the output, from `0.0` to `1.0`. Most users should leave this alone                                                                                                                                                                                                                                                                    |
| `num_questions`                | No       | `20`                           | Number of questions, from 1 to 50                                                                                                                                                                                                                                                                                                                    |
| `include_answers`              | No       | `false`                        | Show answers in the **student's** report. This defeats the purpose; leave it off. The instructor repository always has answers                                                                                                                                                                                                                       |
| `instructor_context`           | No       |                                | Your instructions for the AI, such as the topic and what to focus on. Takes precedence over default behaviour                                                                                                                                                                                                                                        |
| `assignment_context`           | No       |                                | Comma-separated globs of files (text, PDF, Word) read from the repository and given to the AI, such as a brief or rubric. Matches the student's copy, so prefer files students don't edit                                                                                                                                                            |
| `assignment_context_max_chars` | No       | `20000`                        | Maximum characters read from all `assignment_context` files combined                                                                                                                                                                                                                                                                                 |
| `keep_comments`                | No       | `false`                        | Keep code comments instead of removing them before the AI sees the code                                                                                                                                                                                                                                                                              |
| `additional_exclude_patterns`  | No       |                                | Comma-separated globs for extra files to leave out, on top of the [automatic exclusions](https://grillmycode.org/docs/reference/exclude-patterns)                                                                                                                                                                                                    |
| `exclude_pattern_overrides`    | No       |                                | Comma-separated globs or paths to bring back files that would otherwise be excluded. Binary files are always excluded                                                                                                                                                                                                                                |
| `include_initial_commit`       | No       | `false`                        | Include the repository's first commit. Set `true` for Classroom 50 `--empty-repo` assignments, where the first commit is the student's own                                                                                                                                                                                                           |
| `fail_on_empty_assessment`     | No       | `false`                        | Fail, instead of succeed, when there's nothing to assess. Both causes are normal at assignment-accept time, so this is opt-in                                                                                                                                                                                                                        |
| `skip_committers`              | No       | `github-actions[bot]`          | Comma-separated accounts whose **leading** commits are skipped, matched on the GitHub-verified login. `''` turns it off                                                                                                                                                                                                                              |
| `instructor_repo_token`        | No       |                                | **Classroom 50 repositories only.** A PAT (`repo` and `workflow` scopes) that enables the [private answer key](https://grillmycode.org/docs/guides/instructor-setup): a private `{assignment}-grillmycode-instructor` repository with every student's questions and answers, and LMS quiz files. Also turns on multiple-choice distractor generation |
| `repo_marker`                  | No       | `off`                          | Mark assessed student repositories: `topic`, `description`, `both` or `off`. Needs `instructor_repo_token`. See [Tracking assessed repositories](https://grillmycode.org/docs/guides/tracking-repositories)                                                                                                                                          |
| `submission_tags`              | No       |                                | **Tag-triggered workflows only.** The tags that count as a submission, matching `on.push.tags` exactly. Wildcards allowed. Each gets its own issue, PDF and folder                                                                                                                                                                                   |
| `tag_diff_base`                | No       | `cumulative`                   | **Tag-triggered workflows only.** `cumulative` assesses all work to date; `previous-tag` only the work since the previous submission tag                                                                                                                                                                                                             |
| `base_sha`                     | No       |                                | Override the base commit SHA                                                                                                                                                                                                                                                                                                                         |
| `head_sha`                     | No       |                                | Override the head commit SHA                                                                                                                                                                                                                                                                                                                         |

## Outputs

| Output              | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| `issue_url`         | URL of the assessment issue                                        |
| `issue_number`      | Number of the assessment issue                                     |
| `pdf_url`           | Download URL of the assessment PDF; empty if PDF generation failed |
| `questions`         | The generated questions as text                                    |
| `code_before_strip` | Full content of all assessed files, before comments were removed   |
| `code_after_strip`  | Full content of all assessed files, after comments were removed    |

Outputs can contain student-written text, so pass them to scripts through `env:` rather than inside `run:`. See [Using the action's outputs](https://grillmycode.org/docs/example-workflows/post-to-issues).

## Permissions

```yaml
permissions:
  contents: write # gmc-assessments release + PDF asset
  issues: write # assessment issue
```

These are the same for every configuration. See [Tokens, secrets and permissions](https://grillmycode.org/docs/reference/permissions).
