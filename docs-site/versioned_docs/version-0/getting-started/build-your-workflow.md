---
sidebar_position: 2
sidebar_label: 2. Build your workflow
---

# Step 2: Build your workflow

A *workflow* is a small file that tells GitHub when to run GrillMyCode and which settings to use. You don't have to write it yourself: the [Workflow Wizard](../workflow-wizard.mdx) asks you a few questions and writes it for you.

## Go through the Wizard

Open the [Workflow Wizard](../workflow-wizard.mdx) and work through its pages. For a first try, these choices work well:

| The Wizard asks about… | For a first try |
|---|---|
| **When it should run** | *Push, PR Merge, or Manual*. Questions are generated every time a student pushes. You can change this later; see [Choosing a trigger](../guides/choosing-a-trigger.md). |
| **Which AI model to use** | Keep the recommended model. Leave the secret name as `OPENROUTER_API_KEY`, which you saved in step 1. |
| **The questions** | Keep 20 questions, and write a sentence or two about the assignment in the instructor instructions box, for example *"Assignment 3: Python loops. Include at least one question about off-by-one errors."* Leave **Include answers** off. |
| **Which files are assessed** | Keep the defaults. |
| **Delivery** | Nothing to choose. Students always get an issue and a PDF. |
| **The instructor repository** | Answer **Yes**: your repositories are created by Classroom 50. The private answer key is on by default. It needs [its own one-time setup](../guides/instructor-setup.md), and until you've done that it quietly does nothing, so it's safe to leave on. |
| **Advanced settings** | Keep the defaults. |

On the last page, select **Copy workflow YAML to clipboard**.

:::tip
Everything the Wizard sets can be changed later by editing the file or running the Wizard again. You don't need to get it perfect now.
:::

## Next

[Step 3: Add it to your assignment →](add-to-assignment.md)

**Go deeper:** [Inputs and outputs](../reference/inputs-outputs.md) describes every setting the Wizard can produce.
