---
sidebar_position: 1
sidebar_label: OpenRouter
---

# OpenRouter

[OpenRouter](https://openrouter.ai/) is a gateway to hundreds of AI models, from Anthropic, Google, DeepSeek, Meta, Mistral and others, through one API key and one prepaid account. It is GrillMyCode's **only supported provider**, and the default, so `ai_provider` can be left out. The model is chosen with `ai_model`.

To create an account and key, see [Get started: Set up an OpenRouter key](../getting-started/openrouter-key.md). To choose a model and understand the cost, see [Choosing a model and managing cost](../guides/choosing-a-model.md).

:::info[An API key is required]
OpenRouter can't be reached with the built-in `GITHUB_TOKEN`. Every workflow must supply `api_key`, and the action fails immediately with a setup message if it is missing.
:::

:::caution[OpenRouter's catalogue changes constantly]
Models are added and retired, and their prices, reasoning defaults, capabilities and providers change often, sometimes daily. That's why these docs don't state them for any model. The Workflow Wizard shows OpenRouter's current data, but only as of when the page loaded. Confirm a model's details at [openrouter.ai/models](https://openrouter.ai/models) before deploying it, and check again each term.
:::

## Inputs

| Input | Value |
|---|---|
| `api_key` | `${{ secrets.OPENROUTER_API_KEY }}`. **Required** |
| `ai_model` | Any OpenRouter model ID, in `provider/model-name` format. Defaults to `google/gemini-3.5-flash-lite`. May end with a [routing variant](#model-routing-variants), such as `:nitro` |
| `ai_provider` | `openrouter`, the default. May be left out |
| `ai_reasoning_effort` | How much the model thinks before answering. Default `default`, the model's own setting. See [Reasoning](#reasoning) |
| `ai_temperature` | A temperature to send, from `0` to `2`. No default: unless it's set, the model runs at its own. See [Temperature](#temperature) |
| `ai_retry_max_attempts` | Total attempts per request, including the first. Default `5` |

Model IDs must match OpenRouter's catalogue exactly; see [openrouter.ai/models](https://openrouter.ai/models). For example: `anthropic/claude-sonnet-5`, `openai/gpt-5-mini`, `meta-llama/llama-3.1-70b-instruct`.

## Recommended models

These have been tested with GrillMyCode and were chosen partly for their low cost when tested. An assessment can cost less than one cent, but the cost can rise sharply with the model, its reasoning settings and how much code is assessed. They are the options pre-loaded in the [Workflow Wizard](../workflow-wizard.mdx), which shows each one's current price. Whatever model you use, estimating your class's cost is your responsibility; see [Estimate your cost with trial runs](../guides/choosing-a-model.md#estimate-your-cost-with-trial-runs).

| Model | `ai_model` | Good to know |
|---|---|---|
| Google Gemini 3.5 Flash Lite (default) | `google/gemini-3.5-flash-lite` | Wrote the best multiple-choice distractors of those tested, which is why it is the default |
| OpenAI GPT-6 Luna Pro | `openai/gpt-6-luna-pro` | |
| DeepSeek V4 Flash | `deepseek/deepseek-v4-flash` | A reliable alternative |
| Minimax M2.7 | `minimax/minimax-m2.7` | Did well with little tuning |
| StepFun Step 3.7 Flash | `stepfun/step-3.7-flash` | Good question quality |
| Tencent Hy3 | `tencent/hy3` | Works, though its writing style varies more |
| Xiaomi MiMo V2.5 Pro | `xiaomi/mimo-v2.5-pro` | Good at following the required question format |

Any other model works too; check its price at [openrouter.ai/models](https://openrouter.ai/models) first, because costs vary by orders of magnitude. Avoid models with a context window under 128K tokens or a reply limit under 16K tokens: a large submission can exceed the first, and a full set of questions plus any reasoning the second, which fails the run. Avoid models with a retirement date on OpenRouter too. The Workflow Wizard's **Own Choice** list leaves all of these out, and the Wizard warns about them if you type one in.

## Structured outputs

GrillMyCode asks for its questions as a JSON object and sends the format as a JSON schema too. OpenRouter routes the request to a provider that supports **structured outputs** for the model, when one does, and that provider holds the reply to the schema.

A model without structured outputs still works: the schema is ignored and the model follows the prompt's description of the format. Such models are more likely to return a reply GrillMyCode can't use, which it retries; see [After the AI replies](../reference/code-selection.md#4-after-the-ai-replies). To check a model, filter the [model list](https://openrouter.ai/models?supported_parameters=structured_outputs) by structured outputs. The Workflow Wizard's **Own Choice** list shows only such models unless you untick its filter.

## Compressed models

Many providers on OpenRouter serve a model **compressed** to a lower precision (quantized), which is cheaper to run but can make the model less accurate. The loss is largest where GrillMyCode relies on the model most: tracing code step by step, writing correct answers, reading a long prompt and following a strict JSON format.

GrillMyCode therefore sends OpenRouter a list of the precisions it accepts with every request, and OpenRouter routes only to providers on that list:

| Used | Never used |
|---|---|
| `fp32`, `bf16`, `fp16`, `fp8`, `mxfp8`, `int8`, `unknown` | `fp6`, `fp4`, `mxfp4`, `nvfp4`, `int4` |

This isn't an input: every run sends the same list, and it applies with or without a [routing variant](#model-routing-variants).

- **`fp8` is allowed.** Many models are released at `fp8`, and their makers serve them that way.
- **`unknown` is allowed.** Providers that don't publish a precision report `unknown`, and that includes Google and OpenAI serving their own models. Leaving it out would rule those models out entirely. It also means a provider that doesn't say could still be running a compressed copy.
- **A model served only compressed can't be used.** If every provider of a model runs a compressed copy, OpenRouter has nowhere to send the request, and the run fails with `AI API error 404`. The Workflow Wizard warns about such a model under the **Model** field. See [Troubleshooting](../troubleshooting.md#the-run-failed-with-ai-api-error-404).

Each provider's precision is on the model's page at [openrouter.ai/models](https://openrouter.ai/models).

## Model routing variants

Most models on OpenRouter are served by **several providers**, which differ in speed and price for the same model. By default OpenRouter chooses among them for you, weighing price and recent reliability.

Appending a **routing variant** to the model ID tells it what to prioritize instead. The variant is part of the `ai_model` value — there is no separate input:

| `ai_model` value | Effect | Reach for it when |
|---|---|---|
| `google/gemini-3.5-flash-lite` | OpenRouter's default choice of provider | Almost always. Speed and cost are both reasonable |
| `google/gemini-3.5-flash-lite:nitro` | Sorts providers by **throughput** (tokens per second) and allows their paid **priority tier** endpoints | The model's questions are good but assessments take an unreasonably long time to arrive. **Review the model's pricing first** — the fastest endpoints can cost more |
| `google/gemini-3.5-flash-lite:floor` | Sorts providers by **price** and allows their discounted **flex tier** endpoints | Cost matters more than turnaround. Flex endpoints can be slower, or queue when busy |

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v0
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    api_key: ${{ secrets.OPENROUTER_API_KEY }}
    ai_model: 'google/gemini-3.5-flash-lite:nitro'
```

Things worth knowing before you use one:

- **The model is the same, and so is the precision.** A variant only changes which provider runs the model. Providers running a [compressed copy](#compressed-models) are never used, so `:floor` can't reach a cheaper copy by giving up precision.
- **Fallbacks still apply.** If the first provider is unavailable, OpenRouter moves to the next one in the sorted order.
- **Check pricing before using `:nitro`.** Billing follows the provider that actually served the request, so a priority-tier endpoint is billed at its own, higher rate — and the fastest provider is rarely the cheapest. Per-provider prices are on each model's page at [openrouter.ai/models](https://openrouter.ai/models). The same applies in reverse to `:floor`: a request served on a flex tier is billed at the flex rate.
- **Try a different model before reaching for `:nitro`.** If assessments are slow *and* the questions are mediocre, another model is the better fix — see [Recommended models](#recommended-models). `:nitro` is for when the model is right and only the wait is wrong.
- **Models with a single provider are unaffected**, because there is nothing to sort.
- **One variant at a time.** `:nitro` and `:floor` are opposites; OpenRouter lets the last one in the ID win, but a workflow file should carry only one.

Variants are an OpenRouter feature. They live in the model ID rather than in a separate action input, so nothing changes for any other provider GrillMyCode might support later.

In the [Workflow Wizard](../workflow-wizard.mdx) this is the **Model routing** setting under **Advanced settings** on the AI step, which appends the suffix to the model you picked. Once a model is chosen, the Wizard fetches its providers live from OpenRouter and shows the output price range for each option and whether the choice makes any difference to cost. Providers running a compressed copy are left out of those prices, and the Wizard says how many there are.

:::note Other suffixes
OpenRouter also has suffixes that select a *different* model entry rather than a different provider, such as `:free`. Those are outside what the Wizard offers, but `ai_model` accepts any model string OpenRouter does. See OpenRouter's [model variants](https://openrouter.ai/docs/guides/routing/model-variants/overview) documentation.
:::

## Reasoning

Many models **reason** before they answer: they write out working that you never see, then the reply. Reasoning tokens are billed at the model's output rate, and they are counted in the **Tokens** line of `raw-ai-output.md` (for example `43,208 out (39,012 reasoning)`). On a model that reasons at a high level by default, reasoning can be most of what a run costs.

Models differ in whether they reason unless told not to, and at what level: some reason at `high` by default, others at `minimal` or not at all. `ai_reasoning_effort` sets the level instead:

| Value | Sent to OpenRouter | Effect |
|---|---|---|
| `default` (the default) | Nothing | The model's own default applies |
| `none` | `reasoning: { enabled: false }` | Switches reasoning off. **Fails the run** with a `400` on a model whose reasoning can't be switched off |
| `minimal`, `low`, `medium`, `high`, `xhigh`, `max` | `reasoning: { effort: "<value>" }` | Sets the level. A level the model doesn't support is mapped to its nearest one |

Things worth knowing:

- **Not every model supports every level.** OpenRouter's [model catalogue](https://openrouter.ai/api/v1/models) lists each model's levels, its default, and whether reasoning can be switched off, in its `reasoning` field. The Workflow Wizard's **Reasoning** setting reads the same catalogue and offers only the levels your model supports.
- **Models that don't reason** ignore the setting.
- **Less reasoning isn't always worse.** Question quality depends on the model, and reasoning doesn't always improve it. Try `low` on a few submissions and compare the questions with the model's default before settling on a level.

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v0
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    api_key: ${{ secrets.OPENROUTER_API_KEY }}
    ai_model: 'anthropic/claude-sonnet-5'
    ai_reasoning_effort: 'low'
```

## Temperature

Temperature changes how varied a model's replies are. `ai_temperature` has no default: unless you set it, GrillMyCode sends no temperature and the model runs at its own.

**If you're not sure how a temperature would affect the questions, don't set it.** Set one only when you know how the chosen model handles temperature, because you're responsible for whether the value suits it and for the questions it produces:

- **Models differ.** They differ in the range they accept, what they start at, and whether they use temperature at all. OpenRouter doesn't publish this for each model, so check the model maker's own documentation.
- **GrillMyCode checks only OpenRouter's range**, `0` to `2`. A value outside it, or one that isn't a number, is ignored with a warning in the log, and the model runs at its own temperature.
- **A value the model doesn't accept** may be ignored, adjusted or rejected, depending on the provider serving it. A rejection fails the run with a `400`; see [Troubleshooting](../troubleshooting.md#the-run-failed-with-ai-api-error-400-after-setting-a-temperature).
- **Compare before you commit to it.** Run a few submissions with and without the temperature and compare the questions.

A temperature that was sent is shown in the run summary's configuration and in the **Settings** line of `raw-ai-output.md`. GrillMyCode never sends `top_p`.

In the [Workflow Wizard](../workflow-wizard.mdx), this is **Temperature** under **Advanced settings** on the AI step. It stays off unless you tick **Set a temperature**, and unticking it clears the value. The Wizard accepts `0` to `2` with at most two decimal places, such as `0.75`; in the workflow file you can set any value in the range.

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v0
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    api_key: ${{ secrets.OPENROUTER_API_KEY }}
    ai_model: 'anthropic/claude-sonnet-5'
    ai_temperature: '0.3'
```

## Retries and rate limits

A request is retried on `429` (rate limit), `500`, `502`, `503` and `504` responses, and on network failures, up to `ai_retry_max_attempts` attempts in total. The wait between attempts grows each time, and a `Retry-After` header on a `429` is honoured. A `429` without that header waits at least 5 seconds, then up to 10, 20 and 30 seconds on later attempts. No single wait is longer than 30 seconds.

A `429` comes from one of two limits:

- **Your API key's limit.** It applies to the key, so a whole class submitting at once shares one budget. Accounts with no credit are limited far more strictly than funded ones. If these errors persist, check the account's balance, raise `ai_retry_max_attempts`, or try a less busy model.
- **The model provider's limit.** The company serving the model can rate-limit OpenRouter itself, which affects every OpenRouter user of that model at once. OpenRouter marks this with `"limit_source":"upstream_provider_shared_pool"` in the error, and GrillMyCode then fails with `The model's upstream provider (…) is rate-limiting every OpenRouter user of this model, not just this API key`. Your balance makes no difference. Re-run the workflow later, remove a `:nitro` or `:floor` [routing variant](#model-routing-variants) so OpenRouter can try other providers, or choose another model.

For the `404` "No endpoints available matching your guardrail restrictions and data policy" error, see [Troubleshooting](../troubleshooting.md).

## Example

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v0
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    api_key: ${{ secrets.OPENROUTER_API_KEY }}
    ai_model: 'google/gemini-3.5-flash-lite'
```

Setting `ai_provider: 'openrouter'` explicitly is harmless but unnecessary.
