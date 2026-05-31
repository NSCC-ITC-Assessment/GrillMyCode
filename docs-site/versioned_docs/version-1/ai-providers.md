---
sidebar_position: 6
---

# AI Providers

GrillMyCode supports two AI providers via the `ai_provider` input. Both providers use the same OpenAI-compatible chat completions API shape internally — swapping providers requires only a change to a small number of inputs.

## Quick comparison

| Provider | `ai_provider` value | Requires `api_key` | Default |
|---|---|---|---|
| GitHub Models | `github-models` | No (uses `github_token`) | ✓ |
| OpenRouter | `openrouter` | Yes | |

---

## GitHub Models (default)

Uses the [GitHub Models](https://github.com/marketplace/models) inference endpoint. Authentication is handled automatically with the built-in `GITHUB_TOKEN` — no secrets need to be created.

**When to use:** The default for all workflows. No setup cost. Suitable for most classroom deployments.

### Required inputs

| Input | Value |
|---|---|
| `ai_provider` | `github-models` *(or omit)* |
| `github_token` | `${{ secrets.GITHUB_TOKEN }}` *(or omit — it is the default)* |

### Optional inputs

| Input | Notes |
|---|---|
| `ai_model` | Defaults to `gpt-4.1`. The only currently supported model on GitHub Models is `gpt-4.1`. See the [GitHub Models marketplace](https://github.com/marketplace/models) for the full catalogue. |
| `api_key` | Leave empty to use `github_token` automatically. Supply an instructor PAT here to authenticate calls under the instructor's account — see [Using an instructor token](#using-an-instructor-token) below |

### Using an instructor token

By default, the action authenticates GitHub Models API calls with the built-in `GITHUB_TOKEN`. Because `GITHUB_TOKEN` represents the **repository owner** — in a GitHub Classroom context, that is the **student's personal account** — the rate limit tier applied is the one attached to the student's GitHub plan (typically the free tier).

Supplying an instructor's Personal Access Token via `api_key` changes whose account is billed:

| Authentication | Rate limit tier used | Quota shared across… |
|---|---|---|
| `GITHUB_TOKEN` (default) | Student's plan | That student only |
| Instructor PAT | Instructor's plan | Every repo using the same PAT |

**Practical effect for a classroom:**

- Under the default, each student's workflow runs against that student's own quota. The limits are low on free accounts, but they are isolated — one student hitting their limit does not affect others.
- Under an instructor PAT, all students share the instructor's single quota. If the instructor has a higher-tier plan (Team, Enterprise, or an active Copilot subscription), the per-request limit and context window may be larger. The trade-off is that a surge of simultaneous submissions pools all requests against one account.

**How to set it up:**

1. Generate a [fine-grained Personal Access Token](https://github.com/settings/tokens?type=beta) from the instructor's GitHub account. No repository permissions are needed — GitHub Models only requires the token to be valid.
2. Add the token as an organisation-level secret (or a secret on each student repository) named e.g. `INSTRUCTOR_GITHUB_TOKEN`.
3. Pass it via `api_key`:

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    api_key: ${{ secrets.INSTRUCTOR_GITHUB_TOKEN }}
```

:::note

`github_token` is still required for GitHub API operations (posting PR comments, creating issues, etc.). Only the GitHub Models inference call is authenticated with `api_key` when it is supplied.

:::

### Minimal example

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

### With a different model

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    ai_provider: 'github-models'
    ai_model: 'gpt-4.1'
```

---

## OpenRouter

Uses the [OpenRouter](https://openrouter.ai/) unified inference API, which provides access to models from many different providers through a single key.

**When to use:** When you want to use a model from a provider other than GitHub Models.

### Required secrets

| Secret name | Description |
|---|---|
| `OPENROUTER_API_KEY` | Your OpenRouter API key |

### Inputs

| Input | Value |
|---|---|
| `ai_provider` | `openrouter` |
| `api_key` | `${{ secrets.OPENROUTER_API_KEY }}` |
| `ai_model` | Any model identifier supported by OpenRouter, in `provider/model-name` format. See the [OpenRouter model list](https://openrouter.ai/models). Examples: `openai/gpt-4o`, `anthropic/claude-3-5-sonnet`, `meta-llama/llama-3.1-70b-instruct` |

### Recommended models

The following models have been tested with GrillMyCode and are all usually under **1 cent per API call** at typical classroom scale. They are the options pre-loaded in the [workflow wizard](./workflow-wizard).

| Model | `ai_model` value | Notes |
|---|---|---|
| DeepSeek V4 Flash | `deepseek/deepseek-v4-flash` | Extremely low cost; strong instruction-following for structured JSON output. A reliable first choice. |
| Google Gemini 3.1 Flash Lite | `google/gemini-3.1-flash-lite` | Google's entry-level flash tier; fast, cheap, and consistent for short-form generation tasks. |
| Minimax M2.7 | `minimax/minimax-m2.7` | Very inexpensive; performs well on question generation with minimal prompt tuning. |
| StepFun Step 3.5 Flash | `stepfun/step-3.5-flash` | Competitive quality-per-token ratio; tested to produce well-formed assessment questions. |
| Tencent Hy3 Preview | `tencent/hy3-preview` | Preview-tier model from Tencent; cheap and functional, though output style may vary. |
| Xiaomi MiMo V2.5 Pro | `xiaomi/mimo-v2.5-pro` | Reasoning-optimised model from Xiaomi; good at following structured output constraints. |

All six are in the "free-or-near-free" tier on OpenRouter, making them suitable for deployments where many students submit simultaneously. If you want higher output quality and are willing to pay more, you can use any other OpenRouter model via the **Own Choice** option — just verify pricing at [openrouter.ai/models](https://openrouter.ai/models) first.

### Example

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    ai_provider: 'openrouter'
    ai_model: 'deepseek/deepseek-v4-flash'
    api_key: ${{ secrets.OPENROUTER_API_KEY }}
```
