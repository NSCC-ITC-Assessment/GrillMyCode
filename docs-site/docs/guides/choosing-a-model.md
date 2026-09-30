---
sidebar_position: 4
---

# Choosing a model and managing cost

GrillMyCode doesn't include its own AI. It uses an AI model of your choice through [OpenRouter](https://openrouter.ai/), which you pay directly from a prepaid balance.

## The default is a good choice

GrillMyCode uses **Google Gemini 3.5 Flash Lite** unless you pick something else. In testing it was fast and inexpensive, and it wrote the best wrong answers for the multiple-choice quizzes, which is harder than it sounds. For most courses there's no reason to change it.

## What it costs

An assessment can cost **less than one cent**, and with a low-cost model a small budget can last a large class a whole semester. But the cost can rise sharply with your choices, and prices on OpenRouter change often.

What adds to the cost:

- **How often it runs.** With the *every push* trigger, a student who pushes 20 times gets 20 assessments. A [submission tag](choosing-a-trigger.md#submission-tag) runs once per submission instead.
- **The private answer key** (Classroom 50 only). When it's set up, the AI also writes three wrong answers per question for the LMS quiz, which makes each assessment somewhat longer.
- **The model.** The more capable models can cost many times as much per assessment.
- **Reasoning.** Many models think before they answer, and that thinking is billed too, which can multiply the cost. The Wizard's **Reasoning** setting, under **Advanced settings** on the AI step, shows what your model does and lets you turn it down.

## Estimate your cost with trial runs

**Working out what GrillMyCode will cost in your class is your responsibility.** The figures in these docs and the Wizard are only a guide: prices change, and your cost depends on your settings and your students' code. Before you roll it out:

1. Set up the workflow exactly as you'll use it, with the same model, reasoning level and answer key setting, in a test repository.
2. [Run it](running-manually.md) on a few submissions like your students', including a long one.
3. Check what each run cost on the activity page of your OpenRouter account.
4. Multiply by your class size and by how many times each student's workflow will run.

Repeat this whenever you change the model or settings, and before each term. Give the key its own spending limit on OpenRouter as a safety net.

## The recommended models

The Workflow Wizard's **AI** step offers the models tested with GrillMyCode, chosen partly for their low cost when tested. [Recommended models](../ai-providers/openrouter.md#recommended-models) lists them, with notes on each.

## Using a more capable model

For advanced courses, a more capable model may ask sharper questions about complex code. In the Wizard, choose **Own Choice** to search [OpenRouter's catalogue](https://openrouter.ai/models) by price, reasoning and a coding benchmark. That benchmark measures writing code, not asking good questions about it, so treat it as a starting point. Models that can't handle a full assessment are left out.

Do [trial runs](#estimate-your-cost-with-trial-runs) before rolling it out.

## Faster or cheaper, same model

Most models are offered by several companies at different speeds and prices. The Wizard's **Model routing** setting, under **Advanced settings** on the AI step, lets you choose what matters more:

- **Balanced** (recommended): let OpenRouter choose.
- **Speed:** try the fastest providers first, for when you like the questions but they take too long to arrive. It can cost more.
- **Lowest cost:** try the cheapest providers first. They can be slower, or queue at busy times.

The model is the same either way, but some providers run a compressed copy that can write weaker questions. The Wizard shows each option's price for your model and warns about compressed copies.

## When a whole class submits at once

Your whole class shares one OpenRouter key and its limits. GrillMyCode waits and retries when OpenRouter is busy. If runs still fail with rate-limit errors, check your balance is above zero, since accounts without credit are limited far more strictly. If the error says the model is busy for everyone, re-run later or try another model.

---

**Go deeper:** [OpenRouter](../ai-providers/openrouter.md): model IDs, routing variants, reasoning and every OpenRouter-related setting
