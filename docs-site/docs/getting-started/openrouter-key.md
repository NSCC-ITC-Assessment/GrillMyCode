---
sidebar_position: 1
sidebar_label: 1. Set up an OpenRouter key
---

# Step 1: Set up an OpenRouter key

GrillMyCode uses [OpenRouter](https://openrouter.ai/) to reach AI models. You need an OpenRouter account, some credit, and an *API key*: a password that lets GrillMyCode use your account.

You only do this once. Every assignment in your classroom shares the same key.

## Create an account and add credit

1. Go to [openrouter.ai](https://openrouter.ai/) and sign up with Google, GitHub or an email address.
2. Open the [credits page](https://openrouter.ai/credits) and add a prepaid balance. A small amount is plenty to start with, though cost can vary widely depending on the model you choose.

You're charged only for what GrillMyCode uses. With a prepaid balance and automatic top-up turned off, spending can never go beyond what you've added.

## Create the key

1. Go to [openrouter.ai/keys](https://openrouter.ai/keys) and create a new key. Give it a name you'll recognize later, such as `GrillMyCode – Fall 2026`.
2. **Copy the key straight away.** OpenRouter shows it only once.

If you like, you can also give the key its own spending limit on the same page.

## Save the key in your GitHub organization

GitHub keeps passwords for workflows as *secrets*. Once a secret is saved, nobody can view it again, but workflows can still use it. If you save it in your classroom's organization, every student repository gets it automatically.

1. On GitHub, open your classroom's organization and go to **Settings → Secrets and variables → Actions**.
2. Select **New organization secret**.
3. For **Name**, enter `OPENROUTER_API_KEY`. Spell it exactly like this, because the workflow looks for this name.
4. For **Value**, paste the key you copied.
5. Under **Repository access**, choose **All repositories**, or **Private repositories** if all your student repositories are private.
6. Select **Add secret**.

![GitHub's "New secret" form: the name OPENROUTER_API_KEY, the key pasted as the value, and repository access set to All repositories.](/img/screenshots/new-organization-secret.png)

## Next

[Step 2: Build your workflow →](build-your-workflow.md)

**Go deeper:** [OpenRouter](../ai-providers/openrouter.md) · [Tokens, secrets and permissions](../reference/permissions.md)
