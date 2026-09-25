---
sidebar_position: 3
---

# Choosing which files are assessed

GrillMyCode only asks about code the student wrote. Most of the time you don't need to change anything. This page explains what it leaves out, and how to adjust that for an assignment.

## What's left out automatically

- **Your starter code.** Everything that was in the template when the student accepted the assignment. If a student edits one of your files, the questions cover only the lines they added or changed. The AI can still see the rest of that file, so it understands what their lines do.
- **Setup files.** Classroom 50's files, GitHub workflow files and Git settings files.
- **Anything generated or installed.** GrillMyCode recognizes the languages and frameworks in the repository (Python, Java, JavaScript, React, Laravel, Unity and many more) and leaves out what they produce: installed libraries, build output and caches.
- **Files nobody writes by hand.** Lock files, minified files and logs.
- **Environment files** such as `.env`, which can contain passwords.
- **Documentation.** Markdown files such as `README.md`. To give the AI your assignment brief, use [assignment context](tailoring-questions.md#share-the-assignment-brief-or-rubric) instead.
- **Editor settings,** including VS Code, JetBrains and AI coding assistant settings.
- **Diagrams and data.** draw.io, PlantUML and Mermaid diagrams, and CSV data files.
- **Images and other binary files.** These are always left out, and there's no way to include them.

## Leaving out more

Sometimes an assignment has files the student didn't write that GrillMyCode can't know about. Examples are test data you asked them to download, a library folder you supplied separately, or generated files from a tool you use in class.

List them in the Workflow Wizard's **Files** step, under **Additional exclude patterns**. A few patterns cover most needs:

| To leave out… | Write |
|---|---|
| Everything in a folder | `data/**` |
| Every file of one type | `*.sql` |
| One particular file | `config.json` |
| A folder inside another folder | `tests/fixtures/**` |

Separate several patterns with commas: `data/**, tests/fixtures/**`.

## Bringing something back

Sometimes the thing that's normally left out *is* the work. Examples are a UML diagram in PlantUML, a dev container definition in a containers course, or a README in a technical writing assignment.

List it in the **Files** step under **Exclude pattern overrides**:

| To assess… | Write |
|---|---|
| All files of a type that's normally left out | `*.puml` |
| One particular file | `README.md` |
| A folder that's normally left out | `**/.devcontainer/**` |

An override always wins, so anything you list here is assessed even if another rule would leave it out.

## Checking what was assessed

The top of every assessment issue lists the files that were assessed, under **Code Files Assessed**. If a file you expected isn't there, it was left out. The run's log shows which rule removed it; see [File filtering](../reference/exclude-patterns.md#confirming-what-was-applied).

---

**Go deeper:** [File filtering](../reference/exclude-patterns.md): the full list of rules and how patterns work · [What code is assessed](../reference/code-selection.md)
