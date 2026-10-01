---
sidebar_position: 2
---

# Tailoring the questions

Out of the box, GrillMyCode asks questions the student must work out from the code in their repository, each with one checkable answer. For example:

- "Given the list `[80, 0, 95]`, what does this function return?"
- "When the file already exists, what does the `'w'` flag do to it?"

Each question quotes a short snippet of the student's code.

:::note[The AI writes the questions]
The AI can't guarantee every one, so you may choose to read them before relying on them for marks. [Your choice of model](choosing-a-model.md) matters.
:::

You can steer the questions in six ways, all in the [Workflow Wizard](../workflow-wizard.mdx). The first three are in its **Questions** step, and each of the others names its step.

## How many questions

The default is 20, and you can choose anywhere from 1 to 50.

For a conversation, 20 gives you plenty to choose from; you don't have to ask them all. For a written check where the student answers every question, a smaller number such as 5 to 8 is usually better.

## Research or tracing

**Question emphasis** limits the questions to one kind:

- **Research:** only questions that send the student to the documentation or ask about edge cases, such as why a line is needed or what a library call does here.
- **Tracing:** only questions the student answers by running the code in their head, such as what a function returns or how many times a loop runs.

The default, **Balanced**, mixes both. With a small submission, Research or Tracing may give some easier or repetitive questions, because the AI won't switch to the other kind.

## Tell the AI about the assignment

The **Instructor context / instructions** box takes a few sentences in plain English. The AI treats them as its most important guidance. Good instructions name the topic, say what to focus on, and ask for anything specific.

> Assignment 3: Python loops. Focus on how the loops produce their output for a given input. Include at least one question about off-by-one errors.

> Web development: a REST API built with Express. Ask about how a request travels through the routes and middleware, and include one question about error handling.

> Linked lists. Ask about what the list looks like after an insertion or a deletion, and include a question about the empty-list case.

:::note[Students see a summary]
When you write instructions, the AI adds a one-sentence summary of the question focus to the top of the student's issue, labelled **Instructor Note**. Don't put anything in the instructions that students shouldn't know.
:::

## Share the assignment brief or rubric

GrillMyCode can read the assignment brief, rubric or requirements and use them to pick what to ask about. It reads plain-text files, PDFs and Word documents that are in the student's repository.

In the **Assignment context files** box, in the Wizard's **Assignment** step, list where they are, for example `docs/brief.pdf, docs/rubric.docx`.

Two things to keep in mind:

- **It reads the student's copy.** Keep these files in a folder that students have no reason to edit, such as a `docs/` folder in your template. A student's edits to a file listed here would change what the questions focus on.
- **It steers the topics; it doesn't give orders.** Anything that must happen, such as "always ask about recursion", belongs in the instructions box.

Very long documents are cut off after about 20,000 characters (roughly 3,000 words).

## Let the AI see the rest of the project

If students' repositories start from your template, the Wizard's **Repositories** step asks **What should the AI do with the starter template?**:

- **Ignore it** — the AI sees only the student's work. This costs the least per run, and suits a template that holds only instructions, such as a README.
- **Use it as background context** — the AI also sees your starter files, so it can ask how the student's code uses yours. Questions stay on the student's code, but answers may depend on yours.
- **Allow GrillMyCode to also generate questions about available starter code** — as above, and up to one in five questions may be about your starter code itself. You can change how many on the **Questions** step. Your code is the same for every student, so answers to those questions can be shared.

When each submission tag assesses only the new work, such as phase 2 after phase 1, the AI also sees the student's earlier work as background. Untick **Give the AI the student's earlier work as context** in the **Trigger** step to leave it out.

Sending more code costs more per run. Large projects are trimmed to a size limit, which the Wizard shows beside whichever of these settings sends the extra code.

## Keep or remove comments

GrillMyCode normally removes code comments before the AI sees the code. That way, the questions are about what the code *does*, not about the student's notes.

When the comments *are* the work, for example in an assignment about documenting code, turn on **Keep code comments** in the Wizard's **Questions** step.

## Leave "Include answers" off

The **Include answers** option, in the Wizard's **Delivery** step, shows the answers to the student, right under each question. That defeats the purpose of the assessment, so leave it off. To see the answers yourself, use the [private answer key](instructor-setup.md) instead (Classroom 50 assignments only).

---

**Go deeper:** [Inputs and outputs](../reference/inputs-outputs.md) (`num_questions`, `question_emphasis`, `instructor_context`, `assignment_context`, `keep_comments`) · [Starter code](../reference/code-selection.md#starter-code) · [Codebase context](../reference/code-selection.md#codebase-context) · Recipes: [Assignment brief as context](../example-workflows/assignment-context.md) · [Research or tracing questions](../example-workflows/6-question-emphasis.md)
