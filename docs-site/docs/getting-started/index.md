---
sidebar_label: Overview
---

import MinimalWorkflow from '../_partials/_minimal-workflow.mdx';

# Get started

Setting up GrillMyCode takes about 15 minutes. The first step is done once for your whole classroom. After that, adding GrillMyCode to another assignment takes about a minute.

## What you need

- **A Classroom 50 classroom**, with permission to change its GitHub organization's settings. Organization owners have this.
- **The assignment's template repository**, with permission to commit to it.
- **An OpenRouter account with a little credit.** About $5 US is enough for a large class for a semester with the recommended models. Step 1 walks you through it.

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
