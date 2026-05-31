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
| `github_token` | Yes | `${{ github.token }}` | GitHub token for API access and GitHub Models credential |
| `ai_provider` | No | `github-models` | AI provider: `github-models` or `openrouter` |
| `ai_model` | No | `gpt-4.1` | Model identifier for the chosen provider |
| `ai_retry_max_attempts` | No | `5` | Total number of attempts (initial + retries) when calling the AI provider. Retries are triggered by transient errors: 429 (rate limit), 500, 502, 503, 504, and network-level failures. Values below 1 are clamped to 1 |
| `ai_temperature` | No | `0.5` | Controls the randomness of the AI's output (0.0 = fully deterministic, 1.0 = most random). Lower values produce more consistent questions; higher values produce more varied output |
| `api_key` | No | | API key for the provider. For `github-models`, leave empty to use `github_token`, or supply an instructor PAT to override it |
| `num_questions` | No | `20` | Number of questions to generate (minimum 1, maximum 50). Values above 50 are automatically capped |
| `include_answers` | No | `false` | When `true`, each question is immediately followed by its answer labelled **Answer:** in the **student-facing** report — meaning the student sees the answers. This defeats the purpose of the assessment, which is for the student to work out the answers themselves. Leave this `false` in almost all cases. The instructor repository (when `instructor_repo_token` is configured) always includes answers regardless of this setting |
| `exclude_pattern_overrides` | No | | Comma-separated entries to re-include files excluded by auto-detection or `additional_exclude_patterns`. Each entry can be an exact pattern (e.g. `**/*.md`) to re-include all files of that type, or a specific file path (e.g. `README.md`) to allow only that file through. Note: binary files are **always** skipped regardless of overrides |
| `additional_exclude_patterns` | No | | Comma-separated globs for **extra** files to exclude on top of the [auto-detected stack patterns](../guides/exclude-patterns.md). Use for assignment-specific files (starter code, fixtures, data files) that the auto-detected templates wouldn't cover |
| `output_file` | No | `grill-my-code.md` | Basename for the output Markdown file. Always written under the `.assessment/` folder (e.g. `grill-my-code.md` → `.assessment/grill-my-code.md`) |
| `post_pr_comment` | No | `false` | Post assessment as a PR comment. On re-runs, the existing comment is updated in place and a note is added indicating the questions were regenerated |
| `post_issue` | No | `false` | Create a GitHub Issue with the assessment. Automatically assigned to the student who authored the head commit |
| `post_discussion` | No | `false` | Create a GitHub Discussion with the assessment. Discussions are enabled automatically if not already on |
| `discussion_category` | No | `GrillMyCode` | Discussion category name |
| `instructor_repo_token` | No | | PAT with `repo` and `workflow` scopes and permission to create repositories in the same organisation. When provided, the action writes a private instructor-only assessment file (questions **and** answers) to a repository named `{assignment-name}-grillmycode-instructor` in the same organisation. The repository is created automatically on first run. The assignment name is resolved from the student repo's `template_repository` (GitHub Classroom), falling back to the source repo name. Leave empty to disable instructor repository delivery |
| `additional_context` | No | | Instructor-specific instructions for this assignment. Injected into the system prompt and takes precedence over default behaviour. Supports multi-line instructions. When set, the AI also generates a one-sentence summary of the question focus, shown as an **Instructor Note** in the report header |
| `assignment_context` | No | | Comma-separated file glob(s) read from the repository and injected into the AI prompt before `additional_context`. Supported file types: plain text / source files (UTF-8), PDF (`.pdf` — text layer only), Microsoft Word (`.doc`/`.docx` — text only). If no files match, a workflow warning is emitted and the action continues without context. Example: `"README.md, docs/brief.pdf, rubric.docx"` |
| `assignment_context_max_chars` | No | `20000` | Maximum total characters read from all `assignment_context` files combined. Prevents large files from flooding the prompt. Values below 1 are clamped to 1 |
| `keep_comments` | No | `false` | When `false` (default), inline and block comments are stripped before sending code to the AI. Set to `"true"` to preserve comments |
| `include_initial_commit` | No | `false` | When `false` (default), pins the diff base to the first commit so starter/template files are excluded. When `true`, uses the empty tree as the base so the initial commit's eligible files are included in the diff |
| `skip_committers` | No | `github-classroom[bot],github-actions[bot]` | Comma-separated list of commit author names or email substrings. Leading bot commits after the base SHA are excluded from the diff. Set to `''` to disable |
| `base_sha` | No | | Override the base commit SHA |
| `head_sha` | No | | Override the head commit SHA |

## Outputs

| Output | Description |
|---|---|
| `output_file` | Path to the generated assessment Markdown file |
| `questions` | The generated questions as a string (internal AI markers stripped; does not include the instructor note) |
| `code_before_strip` | Full code content of all assessed files before comment stripping |
| `code_after_strip` | Full code content of all assessed files after comment stripping |

## Using outputs in subsequent steps

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
