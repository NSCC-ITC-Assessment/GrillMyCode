---
sidebar_position: 4
---

# Choosing a model and managing cost

GrillMyCode doesn't include its own AI. It uses an AI model of your choice through [OpenRouter](https://openrouter.ai/), which gives you access to models from Google, Anthropic, DeepSeek and many others with one account. You pay OpenRouter directly, from a prepaid balance.

## The default is a good choice

GrillMyCode uses **Google Gemini 3.5 Flash Lite** unless you pick something else. It's fast and cheap, and in testing it wrote the best wrong answers for the multiple-choice quizzes, which is harder than it sounds. For most courses there's no reason to change it.

## What it costs

With the default model and the other recommended ones, an assessment usually costs **less than one cent**. A $5 US balance typically lasts a large class for a whole semester.

What adds to the cost:

- **How often it runs.** With the *every push* trigger, a student who pushes 20 times gets 20 assessments. A [submission tag](choosing-a-trigger.md#submission-tag) runs once per submission instead.
- **The private answer key.** When it's set up, the AI also writes three wrong answers per question for the LMS quiz, which makes each assessment somewhat longer.
- **The model.** The more capable models can cost 10 to 100 times as much per assessment.

To keep an eye on spending, check the activity page in your OpenRouter account. You can also give the key its own spending limit.

## The recommended models

The Workflow Wizard's **AI** step offers six models tested with GrillMyCode, all usually under a cent per assessment. [Recommended models](../ai-providers/openrouter.md#recommended-models) lists them, with notes on each.

## Using a more capable model

For advanced courses, a more capable model may ask sharper questions about complex code. In the Wizard, choose **Own Choice** and enter any model from [OpenRouter's catalogue](https://openrouter.ai/models).

Check the price on OpenRouter first, and multiply it by your class size and how often the workflow runs.

## Faster or cheaper, same model

Most models are offered by several companies at different speeds and prices, and OpenRouter normally picks one for you. The Wizard's **Model routing** setting lets you choose what matters more:

- **Balanced** (recommended): let OpenRouter choose.
- **Speed:** try the fastest providers first. This is worth it if you like the questions but they take too long to arrive, for example when a whole class submits at once. It can cost more, so check the price first.
- **Lowest cost:** try the cheapest providers first. They can be slower, or queue at busy times.

The model is the same either way, so the questions are just as good.

## When a whole class submits at once

Everyone shares your one OpenRouter key, so a class submitting in the same few minutes shares its limits too. GrillMyCode automatically waits and retries when OpenRouter is busy. If runs still fail with rate-limit errors, check that your OpenRouter balance is above zero; accounts with no credit are limited far more strictly.

---

**Go deeper:** [OpenRouter](../ai-providers/openrouter.md): model IDs, routing variants and every OpenRouter-related setting
