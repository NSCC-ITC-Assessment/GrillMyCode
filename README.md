# <img src="docs-site/static/img/grillmycode-logo.svg" alt="" height="40" align="absmiddle"> GrillMyCode

GrillMyCode writes questions about each student's own code, so you can check that they understand the work they hand in.

It's a GitHub Action. When a student pushes their work, it picks out the code they wrote and has an AI model write questions about it. The questions arrive as an issue in the student's repository, with a PDF copy, ready for a short conversation or written check (a _code viva_). It doesn't grade anything: it does the preparation, and you have the conversation.

It's built for [Classroom 50](https://github.com/foundation50/classroom50) assignments, and an assessment can cost less than one cent. The cost can rise sharply with the model you choose, its reasoning settings and how much code is assessed, so estimating your class's cost is your responsibility: do [trial runs](https://grillmycode.org/docs/guides/choosing-a-model) before rolling it out.

**Full documentation: [grillmycode.org](https://grillmycode.org/)**

## How GrillMyCode works

![A cartoon road with five numbered stops. 1: a student at a laptop says "Done!" and sends their work off. 2: the GrillMyCode flame uses a magnifying glass to pick out the student's own code and sets other files aside. 3: a friendly robot, handed a sticky note of instructions, writes questions. The road then forks at a signpost. 4, for students: the student smiles at a pinned issue of questions with a PDF copy. 5, for you and optional (Classroom 50 only): an instructor with a coffee mug beside a locked folder and a quiz card.](docs-site/static/img/how-gmc-works-journey.svg)

1. **The student submits code** by pushing it or by pushing a submission tag. You can also start a run yourself.
2. **GrillMyCode isolates submitted code.** Your starter code, setup files, generated files and comments are left out.
3. **An AI writes questions about submitted code**, guided by your instructions and, optionally, the assignment brief. It goes through [OpenRouter](https://openrouter.ai/), using one key for the whole class.
4. **Questions are delivered to the student** as a GitHub issue and matching PDF. Optionally, for Classroom 50 assignments, you get every student's questions _with answers_ in a private repository, plus a quiz file for your LMS.

More: [How GrillMyCode works](https://grillmycode.org/docs/how-gmc-works) · [Architecture](https://grillmycode.org/docs/development/architecture)

Students who work in VS Code can read their questions beside their code with the optional [GrillMyCode Companion](https://marketplace.visualstudio.com/items?itemName=GrillMyCode.grillmycode) extension.

## Quick start

You'll need basic Git and GitHub skills: committing and pushing changes, working with the default branch, and finding your way around a repository on GitHub, plus creating and pushing tags if you use submission tags. See [What you need](https://grillmycode.org/docs/getting-started#what-you-need).

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

      - uses: NSCC-ITC-Assessment/GrillMyCode@v0
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

|                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Get started** | [Overview](https://grillmycode.org/docs/getting-started) · [Workflow Wizard](https://grillmycode.org/workflow-wizard)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Guides**      | [Tailoring the questions](https://grillmycode.org/docs/guides/tailoring-questions) · [Choosing which files are assessed](https://grillmycode.org/docs/guides/choosing-files) · [Choosing a model and managing cost](https://grillmycode.org/docs/guides/choosing-a-model) · [What your students see](https://grillmycode.org/docs/guides/what-students-see) · [Showing questions in VS Code](https://grillmycode.org/docs/guides/vscode-extension) · [Using with Classroom 50](https://grillmycode.org/docs/guides/classroom50) · [Keeping a private answer key](https://grillmycode.org/docs/guides/instructor-setup) · [Importing quizzes into your LMS](https://grillmycode.org/docs/guides/lms-quizzes) · [Tracking assessed repositories](https://grillmycode.org/docs/guides/tracking-repositories) |
| **Recipes**     | [Ready-made workflow files](https://grillmycode.org/docs/category/example-workflows)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Help**        | [Troubleshooting](https://grillmycode.org/docs/troubleshooting) · [FAQ](https://grillmycode.org/docs/faq) · [Upgrade notes](https://grillmycode.org/docs/reference/upgrade-notes)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Reference**   | [Inputs and outputs](https://grillmycode.org/docs/reference/inputs-outputs) · [What code is assessed](https://grillmycode.org/docs/reference/code-selection) · [File filtering](https://grillmycode.org/docs/reference/exclude-patterns) · [Triggers in depth](https://grillmycode.org/docs/reference/triggers) · [Tokens, secrets and permissions](https://grillmycode.org/docs/reference/permissions) · [OpenRouter](https://grillmycode.org/docs/ai-providers/openrouter)                                                                                                                                                                                                                                                                                                                              |
| **Development** | [Architecture](https://grillmycode.org/docs/development/architecture) · [Contributing](https://grillmycode.org/docs/development/contributing) · [Versioning](https://grillmycode.org/docs/development/versioning)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## Inputs

Only `api_key` needs setting; everything else has a sensible default. Full details for each input are in [Inputs and outputs](https://grillmycode.org/docs/reference/inputs-outputs).

| Input                          | Required | Default                        | Description                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | -------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `github_token`                 | Yes      | `${{ github.token }}`          | GitHub token for the issue, the PDF release and repository metadata. Not used to generate questions                                                                                                                                                                                                                                                  |
| `api_key`                      | Yes      |                                | OpenRouter API key. Create one at [openrouter.ai/keys](https://openrouter.ai/keys)                                                                                                                                                                                                                                                                   |
| `ai_provider`                  | No       | `openrouter`                   | AI provider. `openrouter` is the only supported value                                                                                                                                                                                                                                                                                                |
| `ai_model`                     | No       | `google/gemini-3.5-flash-lite` | OpenRouter model ID (`provider/model-name`), optionally with a routing variant: `:nitro` (fastest) or `:floor` (cheapest)                                                                                                                                                                                                                            |
| `ai_retry_max_attempts`        | No       | `5`                            | Total attempts per AI request, retrying on 429, 5xx, network errors and unusable replies. Rate-limit waits start at 5 seconds; each wait is capped at 30 seconds                                                                                                                                                                                     |
| `ai_temperature`               | No       | —                              | Temperature to send, from `0` to `2`. Empty by default: the model runs at its own. Set it only if you know the chosen model's range; if you're not sure, don't set it                                                                                                                                                                                |
| `ai_reasoning_effort`          | No       | `default`                      | How much the model reasons before answering: `default` (the model's own setting), `none`, or `minimal` to `max`. Reasoning is billed as output                                                                                                                                                                                                       |
| `num_questions`                | No       | `20`                           | Number of questions in the report, from 1 to 50. The AI is asked for two spare questions for every ten, to replace any that are dropped                                                                                                                                                                                                              |
| `question_emphasis`            | No       | `balanced`                     | Limits the kinds of question: `balanced` (any), `research` (only documentation, edge-case and change questions) or `tracing` (only questions answered by mentally running the code)                                                                                                                                                                  |
| `include_answers`              | No       | `false`                        | Show answers in the **student's** report. This defeats the purpose; leave it off. The instructor repository always has answers                                                                                                                                                                                                                       |
| `instructor_context`           | No       |                                | Your instructions for the AI, such as the topic and what to focus on. Takes precedence over default behaviour                                                                                                                                                                                                                                        |
| `assignment_context`           | No       |                                | Comma-separated globs of files (text, PDF, Word) read from the repository and given to the AI, such as a brief or rubric. Matches the student's copy, so prefer files students don't edit                                                                                                                                                            |
| `assignment_context_max_chars` | No       | `20000`                        | Maximum characters read from all `assignment_context` files combined                                                                                                                                                                                                                                                                                 |
| `keep_comments`                | No       | `false`                        | Keep code comments instead of removing them before the AI sees the code                                                                                                                                                                                                                                                                              |
| `additional_exclude_patterns`  | No       |                                | Globs for extra files to leave out, on top of the [automatic exclusions](https://grillmycode.org/docs/reference/exclude-patterns), separated by commas or line breaks. Case is ignored                                                                                                                                                               |
| `exclude_pattern_overrides`    | No       |                                | Globs or paths to bring back files that would otherwise be excluded. Environment files, lock files and dependency folders come back only when an entry names them. Binary files are always excluded                                                                                                                                                  |
| `preview_only`                 | No       | `false`                        | `true` lists the files a run would assess, and the files left out with the pattern responsible, then stops. The AI is not called, so it costs nothing and needs no `api_key`. See [Previewing in a run](https://grillmycode.org/docs/reference/exclude-patterns#previewing-in-a-run)                                                                 |
| `starter_code`                 | No       | `ignore`                       | What the first commit is and what the AI does with your starter code: `none` (the repository starts empty, as with Classroom 50 `--empty-repo`, so the first commit is the student's), `ignore`, `context` (sent as background, never asked about alone) or `ask` (some questions may be about it; see `starter_questions_one_in`)                   |
| `starter_questions_one_in`     | No       | `5`                            | Under `starter_code: ask`, up to one in this many questions may be about the starter code alone (rounded down, but at least one once there are two). Values below 2 are clamped to 2                                                                                                                                                                 |
| `previous_work`                | No       | `context`                      | On tag runs that assess only the latest phase: send the student's earlier work as background (`context`) or not (`ignore`)                                                                                                                                                                                                                           |
| `codebase_context_max_chars`   | No       | `50000`                        | Maximum characters sent as codebase context (starter code and earlier work). Files nearest the assessed files go first; any that don't fit are left out                                                                                                                                                                                              |
| `fail_on_empty_assessment`     | No       | `false`                        | Fail, instead of succeed, when there's nothing to assess. Both causes are normal at assignment-accept time, so this is opt-in                                                                                                                                                                                                                        |
| `skip_committers`              | No       | `github-actions[bot]`          | Comma-separated accounts whose **leading** commits are skipped, matched on the GitHub-verified login. `''` turns it off                                                                                                                                                                                                                              |
| `instructor_repo_token`        | No       |                                | **Classroom 50 repositories only.** A PAT (`repo` and `workflow` scopes) that enables the [private answer key](https://grillmycode.org/docs/guides/instructor-setup): a private `{assignment}-grillmycode-instructor` repository with every student's questions and answers, and LMS quiz files. Also turns on multiple-choice distractor generation |
| `label_repos`                  | No       | `false`                        | `true` labels assessed student repositories with a `grillmycode` topic and a question count in the description. The Workflow Wizard turns it on. Needs `instructor_repo_token`. See [Tracking assessed repositories](https://grillmycode.org/docs/guides/tracking-repositories)                                                                      |
| `submission_tags`              | No       |                                | **Tag-triggered workflows only.** The tags that count as a submission, matching `on.push.tags` exactly. Wildcards allowed. Each gets its own issue, PDF and folder                                                                                                                                                                                   |
| `tag_diff_base`                | No       | `cumulative`                   | **Tag-triggered workflows only.** `cumulative` assesses all work to date; `previous-tag` only the work since the previous submission tag; `tag:<name>` (e.g. `tag:phase1`) only the work since that tag, failing the run if it can't be used                                                                                                         |
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
