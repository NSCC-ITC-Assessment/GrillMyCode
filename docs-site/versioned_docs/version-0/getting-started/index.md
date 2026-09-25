---
sidebar_label: Overview
---

import MinimalWorkflow from '../_partials/_minimal-workflow.mdx';

# Get started

Setting up GrillMyCode takes about 15 minutes. The first step is done once for your whole classroom. After that, adding GrillMyCode to another assignment takes about a minute.

![Three panels joined by arrows. "Once per classroom": an instructor puts a key into a safe labelled "your org", captioned "Create and store your AI provider key in your GitHub organization". "Once per assignment": a magic wand makes a file with the GrillMyCode flame on it, which drops into a starter template, captioned "Add GrillMyCode to the starter template: one file, written by the Workflow Wizard". "Automatic": six student repositories, each with a different student and a copy of the file, captioned "Every student gets a copy when they accept the assignment".](/img/setup-effort.svg)

## What you need

- **Basic Git and GitHub skills.** GrillMyCode lives in your students' repositories, so you should be comfortable committing and pushing changes, working with the default branch, and finding your way around a repository on GitHub: its files, issues and settings. If you use submission tags, you'll also need to create and push tags. These pages explain the GitHub Actions parts as they come up. New to Git? GitHub's [Start your journey](https://docs.github.com/en/get-started/start-your-journey) guides cover the basics, and Pro Git explains [tagging](https://git-scm.com/book/en/v2/Git-Basics-Tagging).
- **A Classroom 50 classroom**, with permission to change its GitHub organization's settings. Organization owners have this.
- **The assignment's template repository**, with permission to commit to it.
- **An OpenRouter account with a little credit.** A small budget is enough for a large class for a semester with the recommended models, though cost can vary widely depending on the model you choose. Step 1 walks you through it.

## The four steps

1. **[Set up an OpenRouter key](openrouter-key.md).** Once per classroom.
2. **[Build your workflow](build-your-workflow.md)** with the Workflow Wizard.
3. **[Add it to your assignment](add-to-assignment.md)** by committing one file to the template repository.
4. **[Check the first run](check-first-run.md)** to make sure everything worked.

<details>
<summary>Prefer to write the workflow yourself?</summary>

This is the smallest working workflow. It runs on every push to the main branch and whenever you start it from the Actions tab. Complete step 1 first, then commit this file to the assignment's template repository.

<MinimalWorkflow />

Every setting is described in [Inputs and outputs](../reference/inputs-outputs.md), and the [workflow recipes](../example-workflows/pull-request.md) have ready-made variations.

</details>
