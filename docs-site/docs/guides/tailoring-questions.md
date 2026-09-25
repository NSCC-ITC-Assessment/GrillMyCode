---
sidebar_position: 2
---

# Tailoring the questions

Out of the box, GrillMyCode asks a mix of three kinds of question about any code:

- **What it's for:** "What is the purpose of this function?"
- **What happens when it runs:** "If the list is empty, which branch runs?"
- **What could go wrong:** "Which input would make this function throw an error?"

Each question quotes a short snippet of the student's own code, so they know exactly what it's asking about.

You can steer the questions in five ways, all in the [Workflow Wizard](../workflow-wizard.mdx)'s **Questions** step unless noted.

## How many questions

The default is 20, and you can choose anywhere from 1 to 50.

For a conversation, 20 gives you plenty to choose from; you don't have to ask them all. For a written check where the student answers every question, a smaller number such as 5 to 8 is usually better.

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

In the **Assignment context files** box, list where they are, for example `docs/brief.pdf, docs/rubric.docx`.

Two things to keep in mind:

- **It reads the student's copy.** Keep these files in a folder that students have no reason to edit, such as a `docs/` folder in your template. A student's edits to a file listed here would change what the questions focus on.
- **It steers the topics; it doesn't give orders.** Anything that must happen, such as "always ask about recursion", belongs in the instructions box.

Very long documents are cut off after about 20,000 characters, which is roughly 3,000 words.

## Let the AI see the rest of the project

Turn on **Give the AI the rest of the project as context** in the Wizard's **File handling options** step. The AI then also sees every eligible file that's left once the usual exclusions are applied and the assessed files are set aside. That's:

- **Your starter code** that the student hasn't changed.
- **The student's earlier work**, when each submission tag assesses only the new work, such as phase 1 while phase 2 is assessed.

It can then ask how the new code fits with the code around it.

- **It's background only.** Every question is still about the assessed code.
- **It costs more per run.** Large projects are trimmed to a limit you can set in the **Advanced** step.

## Keep or remove comments

GrillMyCode normally removes code comments before the AI sees the code. That way, the questions are about what the code *does*, not about the student's notes.

When the comments *are* the work, for example in an assignment about documenting code, turn on **Keep code comments** in the Wizard's **File handling options** step.

## Leave "Include answers" off

The **Include answers** option shows the answers to the student, right under each question. That defeats the purpose of the assessment, so leave it off. To see the answers yourself, use the [private answer key](instructor-setup.md) instead.

---

**Go deeper:** [Inputs and outputs](../reference/inputs-outputs.md) (`num_questions`, `instructor_context`, `assignment_context`, `keep_comments`) · [Codebase context](../reference/code-selection.md#codebase-context) · Recipe: [Assignment brief as context](../example-workflows/assignment-context.md)
