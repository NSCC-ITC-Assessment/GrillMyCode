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
| **Student repositories** | Answer **Yes**: you are using it alongside Classroom 50, which creates your repositories. Then say how they start. If they start empty, choose **Empty**. If they start from your template, choose **From a starter template**, then **Ignore it** for the lowest cost per run; you can change this later. |
| **Your assignment** | If your template includes the assignment brief or rubric, list where it is, for example `docs/brief.pdf`. Otherwise leave it empty. The Wizard skips this page if your repositories start empty. |
| **Which files are left out** | Keep the defaults. |
| **Which AI model to use** | Leave the secret name as `OPENROUTER_API_KEY`, which you saved in step 1, and choose the model marked **Recommended**. Leave **Advanced settings** on this page as they are. |
| **The questions** | Keep 20 questions and the **Balanced** emphasis. Write a sentence or two about the assignment in the instructor instructions box, for example *"Assignment 3: Python loops. Include at least one question about off-by-one errors."* |
| **What students and instructors get** | Leave **Include answers** off. The private answer key is on by default. It needs [its own one-time setup](../guides/instructor-setup.md), and until you've done that it quietly does nothing, so it's safe to leave on. |
| **When it should run** | *Push, PR Merge, or Manual*. Questions are generated every time a student pushes. You can change this later; see [Choosing a trigger](../guides/choosing-a-trigger.md). |
| **Changing settings for one run** | Answer **Yes**, and keep the settings that are ticked. |
| **Other advanced settings** | Keep the defaults. |

On the last page, select **Copy workflow YAML to clipboard**.

:::tip
Everything the Wizard sets can be changed later by editing the file or running the Wizard again. You don't need to get it perfect now.
:::

## Next

[Step 3: Add it to your assignment →](add-to-assignment.md)

**Go deeper:** [Inputs and outputs](../reference/inputs-outputs.md) describes every setting the Wizard can produce.
