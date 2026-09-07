---
sidebar_position: 1
sidebar_label: OpenRouter
---

# OpenRouter

[OpenRouter](https://openrouter.ai/) is a unified API gateway that gives you access to hundreds of AI models — from providers like Anthropic, Google, Meta, Mistral, DeepSeek, and more — through a single API key and a single billing account. Instead of signing up separately with each AI provider and managing multiple API keys, you create one OpenRouter account, fund it with a prepaid balance, and then specify which model you want to use at request time.

OpenRouter is the **only supported provider** in GrillMyCode, and the default — you can omit `ai_provider` entirely. Because OpenRouter is a gateway rather than a single vendor, you still choose freely between models from Anthropic, Google, DeepSeek, Meta, Mistral, and others — the choice is made in `ai_model`, not by swapping providers.

:::info[An API key is required]
OpenRouter cannot authenticate with the built-in `GITHUB_TOKEN`. Every GrillMyCode workflow must supply `api_key`. The action fails immediately with a setup message if it is missing.

Migrating a workflow that used to work and no longer does? See the [FAQ](../faq.md#ive-used-github-models-with-grillmycode-in-the-past-and-now-they-no-longer-function-why).
:::

## Instructor setup guide

To use OpenRouter with GrillMyCode, an instructor needs to perform the following steps **once**:

1. **Create an OpenRouter account** — Go to [openrouter.ai](https://openrouter.ai/) and sign up (Google, GitHub, or email).
2. **Add credit** — Navigate to [openrouter.ai/credits](https://openrouter.ai/credits) and add a prepaid balance. Many of the recommended models below cost fractions of a cent per call, so $5–10 will last a large class for an entire semester.
3. **Generate an API key** — Go to [openrouter.ai/keys](https://openrouter.ai/keys) and create a new key. Copy it immediately — you won't be able to view it again.
4. **Store the key as an organisation-level GitHub secret** — Go to your GitHub organisation's **Settings → Secrets and variables → Actions** and create a new secret named `OPENROUTER_API_KEY` with the key from Step 3. This makes the key available to all student repositories for that classroom automatically without any per-repo configuration.
5. **Configure the workflow** — Pass the key as `api_key` and choose a model via `ai_model` (see the tables below for recommended options). `ai_provider` can be omitted, since `openrouter` is the default.

:::tip[Classroom tip]
For a Classroom 50 setup the secret should **always** be added at the organization level. This ensures every student repo has access to the key from the moment it is created, with no extra setup required from students.
:::

## Required secrets

| Secret name | Description |
|---|---|
| `OPENROUTER_API_KEY` | Your OpenRouter API key |

## Inputs

| Input | Value |
|---|---|
| `ai_provider` | `openrouter` (the default — may be omitted) |
| `api_key` | `${{ secrets.OPENROUTER_API_KEY }}` — **required** |
| `ai_model` | Any model identifier supported by OpenRouter, in `provider/model-name` format. Defaults to `google/gemini-3.5-flash-lite`. See the [OpenRouter model list](https://openrouter.ai/models). Examples: `openai/gpt-4o`, `anthropic/claude-3-5-sonnet`, `meta-llama/llama-3.1-70b-instruct` |

## Recommended models

The following models have been tested with GrillMyCode and are all usually under **1 cent per API call** at typical classroom scale. They are the options pre-loaded in the [workflow wizard](../workflow-wizard).

| Model | `ai_model` value | Notes |
|---|---|---|
| **Google Gemini 3.5 Flash Lite** ⭐ **Recommended** | `google/gemini-3.5-flash-lite` *(default)* | Google's entry-level flash tier; fast, cheap, and consistent for short-form generation tasks. Of the tested models it produces the most effective distractors for multiple-choice questions, which is why it is both recommended and the default. |
| DeepSeek V4 Flash | `deepseek/deepseek-v4-flash` | Extremely low cost; strong instruction-following for structured JSON output. A reliable alternative. |
| Minimax M2.7 | `minimax/minimax-m2.7` | Very inexpensive; performs well on question generation with minimal prompt tuning. |
| StepFun Step 3.5 Flash | `stepfun/step-3.5-flash` | Competitive quality-per-token ratio; tested to produce well-formed assessment questions. |
| Tencent Hy3 | `tencent/hy3` | Model from Tencent; cheap and functional, though output style may vary. |
| Xiaomi MiMo V2.5 Pro | `xiaomi/mimo-v2.5-pro` | Reasoning-optimised model from Xiaomi; good at following structured output constraints. |

All six are in the "free-or-near-free" tier on OpenRouter, making them suitable for deployments where many students submit simultaneously. If you want higher output quality and are willing to pay more, you can use any other OpenRouter model via the **Own Choice** option — just verify pricing at [openrouter.ai/models](https://openrouter.ai/models) first.

## Example

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    api_key: ${{ secrets.OPENROUTER_API_KEY }}
    ai_model: 'google/gemini-3.5-flash-lite'
```

To pin the provider explicitly — harmless, but unnecessary — add `ai_provider: 'openrouter'`.
