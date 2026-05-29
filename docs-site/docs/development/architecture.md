---
sidebar_position: 1
---

# Architecture

## How the action runs

This is a **Docker-based GitHub Action** — rather than executing JavaScript directly on the runner, GitHub pulls a pre-built Docker image and runs the assessment script inside it. The image is published to the GitHub Container Registry (`ghcr.io`) and pinned in `action.yml`.

```
Consumer workflow
      │
      ▼
action.yml  ──► pulls Docker image from ghcr.io
                      │
                      ▼
              entrypoint.sh  ──► cd $GITHUB_WORKSPACE
                                       │
                                       ▼
                                 node src/main.js
```

Using Docker means:

- The Node version, `git` binary, and all dependencies are fixed and identical across every runner — no version drift
- The image is built once and reused; consumer repos pay no build cost at runtime
- The pre-built image reference in `action.yml` is updated automatically by the release workflow each time a version tag is pushed

---

## Execution flow

When `main.js` runs, it follows this sequence:

```
readInputs()
    │  Reads all INPUT_* environment variables set by action.yml
    │
resolveSHAs()
    │  Determines baseSha and headSha from the event context
    │  Handles: pull_request, push, issue_comment, workflow_dispatch
    │  Applies skip_initial_commit override when enabled
    │
resolveBranch()
    │  Extracts the branch name from the event payload or GITHUB_REF
    │
repos.getCommit(headSha)
    │  Resolves the GitHub login of the student who authored the head commit
    │  Falls back to ctx.actor if the git email is not linked to a GitHub account
    │
getChangedFiles() → filterFiles()
    │  Runs `git diff --name-only baseSha headSha`
    │  Applies include_patterns and exclude_patterns via minimatch
    │
getDiff()
    │  Runs `git diff baseSha headSha -- <files>`
    │  Result kept as a fallback only — not sent to the AI directly
    │
collectRawFiles()
    │  Fetches full file content at headSha via `git show`
    │  (deleted files are silently skipped)
    │
stripCommentsFromFiles()
    │  Writes each file to /tmp, runs the rmcm binary on it
    │  Falls back silently to original content for unsupported types
    │  Falls back to raw diff if stripping produces no output at all
    │
buildCodeContent()
    │  Formats stripped files as fenced Markdown code blocks
    │
readAssignmentContextFiles()
    │  Reads files from GITHUB_WORKSPACE that match assignment_context globs
    │  Concatenates contents as headed sections; capped at assignment_context_max_chars input (default 20000)
    │  Returns an empty string when no globs are supplied or no files match
    │
buildPrompt()
    │  Constructs the system + user messages for the AI
    │  Injects assignment context (file contents) then instructor instructions
    │  AI receives comment-stripped file content, not the raw diff
    │
callAI()
    │  POSTs to the provider's chat completions endpoint
    │  Returns the model's response text
    │
formatReport()          resolveOutputFile()
    │                          │
    └──────────┬───────────────┘
               │
        writes Markdown file to GITHUB_WORKSPACE
               │
    commitAssessmentFile()
               │  Commits the file back to the repository via the
               │  GitHub Contents API (creates or updates the blob)
               │  Skips with a warning on fork PRs (no write access)
               │
        sets action outputs
        (output_file, questions, code_before_strip, code_after_strip)
               │
     ┌─────────┼─────────┐
     ▼         ▼         ▼
postPrComment  postIssue  postDiscussion
  (REST)       (REST)      (GraphQL)
```

---

## Key modules

### `readInputs()`

Reads and normalises every `INPUT_*` environment variable. Responsible for:

- Parsing comma-separated glob lists into arrays
- Applying defaults (`DEFAULT_EXCLUDE_PATTERNS` when no `exclude_patterns` is supplied)
- Clamping `num_questions` to a minimum of 1 and a maximum of 50; a workflow warning is emitted if the supplied value exceeds 50
- Splitting `assignment_context` into a `assignmentContextGlobs` array for later file resolution

### `resolveSHAs(ctx, octokit, inputs)`

The most event-aware function in the codebase. Handles four distinct event types:

| Event | Base SHA | Head SHA | PR number |
|---|---|---|---|
| `pull_request` / `pull_request_target` | PR base branch SHA | PR head SHA | from payload |
| `push` | previous SHA (or first commit on new branch) | `after` SHA | — |
| `issue_comment` | PR base branch SHA (fetched via REST) | PR head SHA | from payload |
| everything else | first commit | `ctx.sha` | — |

After event-specific resolution, `skip_initial_commit` can override the base SHA to pin it to the repository's very first commit — the behaviour needed for GitHub Classroom to exclude starter template files.

Manual `base_sha` / `head_sha` inputs always take precedence over all of the above.

### `sanitiseSha(sha)`

Validates that a SHA is 4–64 hex characters before passing it to a `git` command. This prevents shell injection through crafted `base_sha`/`head_sha` inputs.

### `resolveOutputFile(outputFile, branchName)`

Always writes output under the `.assessment/` folder. Uses `path.basename()` to extract only the filename — any directory component of `output_file` is discarded. On `main`/`master` (or when the branch is unknown) the basename is kept as-is; on any other branch the sanitised branch name is inserted before the extension so each branch produces a distinct file without collisions.

### `callAI({ provider, model, apiKey, endpoint, messages, retryMaxAttempts })`

A thin provider abstraction over the OpenAI-compatible chat completions API. Each provider maps to a different base URL and authentication header:

| Provider | URL | Auth header |
|---|---|---|
| `github-models` | `models.inference.ai.azure.com/chat/completions` | `Authorization: Bearer <github_token>` |
| `openai` | `api.openai.com/v1/chat/completions` | `Authorization: Bearer <api_key>` |
| `openrouter` | `openrouter.ai/api/v1/chat/completions` | `Authorization: Bearer <api_key>` |
| `azure-openai` | caller-supplied endpoint | `api-key: <api_key>` |

All providers use the same request body shape (`model`, `messages`, `temperature`, `max_tokens`, `top_p`).

Transient failures are retried automatically up to `retryMaxAttempts` total attempts using **exponential backoff with full jitter**. The following status codes are retried: `429`, `500`, `502`, `503`, `504`. Network-level failures (e.g. DNS, socket errors) are also retried. A `429` response that includes a `Retry-After` header has that delay honoured in preference to the calculated backoff. A `core.warning()` is logged before each retry, showing the attempt number, status code, and delay.

### `postIssue()` / `postDiscussion()`

**`postIssue`** uses an update-first strategy:

1. List open assessment issues for the same branch
2. If one exists, update its title and body in-place (preserving issue number, URL, and comment history). Extra duplicates are deleted.
3. If none exists, create a fresh issue.

**`postDiscussion`** follows a supersession pattern:

1. List open assessment discussions for the same branch
2. Delete each superseded discussion
3. Create a fresh discussion with the latest report

`postDiscussion` uses the **GraphQL API** (not REST) because GitHub's REST API does not support creating Discussions.

---

## Security considerations

- **Shell injection prevention:** all `git` calls use `spawnSync` with an explicit argument array — no shell string interpolation. SHAs are validated with `sanitiseSha()` before use.
- **Secret masking:** the external API key is registered with `core.setSecret()` before any API call, preventing it from appearing in workflow logs.
- **Minimal permissions:** the action only requests the permissions it needs for the chosen delivery method.

---

## Docker image build

The image uses a **multi-stage Dockerfile**:

```
Stage 1 — rmcm-builder (rust:slim-bookworm)
      │
      │  git clone --branch production
      │  https://github.com/NSCC-ITC-Assessment/comment-remover
      │
      │  cargo build --release  ──► /build/target/release/rmcm
      │
      ▼
Stage 2 — final image (node:26-slim)
      │
      ├── COPY --from=rmcm-builder /build/target/release/rmcm /usr/local/bin/rmcm
      ├── pnpm install --prod
      └── COPY src/ entrypoint.sh
```

`rmcm` (the comment-stripping binary from [NSCC-ITC-Assessment/comment-remover](https://github.com/NSCC-ITC-Assessment/comment-remover)) is compiled from source at image-build time. The Rust build stage is discarded after compilation, so the final image contains only the compiled binary alongside the Node runtime.

---

## CI/CD workflows

Three workflows build and publish Docker images. They are mutually exclusive by trigger.

| Workflow | Trigger | Image tag(s) produced | Intended for |
|---|---|---|---|
| `branch-build.yml` | Push to any non-`main` branch (code changes only); `workflow_dispatch` | `branch-<sanitized-branch-name>` | **Contributors** — ephemeral dev image for testing a feature or fix branch before it is merged |
| `build-and-push.yml` | Push to `main` (code changes only); `workflow_dispatch` | `latest` | **Maintainers** — bleeding-edge integration build; reflects the current state of `main` but is not recommended for consumers |
| `release.yml` | Push of a `v*` tag | `vX.Y.Z`, `vX.Y`, `vX`, `latest` | **Consumers** — stable, versioned release; consumers pin to the major tag (e.g. `:v1`) |

All three workflows ignore documentation-only changes (`docs-site/**`, `README.md`, etc.) to avoid unnecessary image rebuilds.

See [Versioning & Releases](versioning) for the full release process.
