---
sidebar_position: 9
---

# Importing quizzes into your LMS

With the [private answer key](instructor-setup.md) set up, GrillMyCode builds a multiple-choice quiz for each student from their own questions. You can import it into your learning management system and have students answer it there.

## Where the quiz files are

In the assignment's private repository, each student's folder has two quiz files:

| File | Use it when |
|---|---|
| `cs-principles-lab-3_jsmith_quiz_20.imscc` | You use **any** LMS. This is the one to start with. |
| `cs-principles-lab-3_jsmith_brightspace_quiz_20.csv` | You use **Brightspace** and would rather import questions than a whole quiz. |

The number at the end is how many questions the quiz holds; `20` above.

Download the file from GitHub: open it, then select the download button.

## The `.imscc` file: for any LMS

An `.imscc` file is a **Common Cartridge** package, an open standard that most LMSs can import, including Brightspace, Canvas, Moodle, Blackboard Learn and Sakai. It imports as a ready-made quiz, titled with the assignment and the student, for example `cs-principles-lab-3 - jsmith`, and set to one attempt.

Use your LMS's course import feature and choose the Common Cartridge option. For example:

- **Brightspace:** Course Admin → Import/Export/Copy Components → Import Components.
- **Canvas:** Settings → Import Course Content → Common Cartridge 1.x Package.

For other systems, search your LMS's help for "Common Cartridge import".

## The `.csv` file: Brightspace only

**Not on Brightspace? Skip this section.** No other LMS can read this file.

On Brightspace you can import either file; they hold the same questions. The difference:

| | `.imscc` | `.csv` |
|---|---|---|
| Imports as | A ready-made quiz, limited to one attempt | Questions only; you add them to a quiz yourself |
| How to import | Import the package into the course | Open a quiz and choose **Import → Upload a File**, or upload to the Question Library |

The CSV's questions are titled `cs-principles-lab-3 - jsmith - Q1`, `Q2` and so on, and their answer options are already shuffled. Leave the `//gmc_content_hash` line at the top of the file alone. Brightspace ignores it, and GrillMyCode uses it to tell whether the file is up to date.

## When the quiz files are made

A quiz is rebuilt automatically each time a student's questions change, usually within a few minutes. This is done by a workflow in the private repository called **Generate LMS Quiz**.

To rebuild every student's quiz at once, run that workflow by hand from the private repository's **Actions** tab.

## Why a quiz can be shorter than the questions

A question needs three wrong answers to become multiple choice. If any are missing, GrillMyCode leaves the question out of the quiz rather than import it with only one option. The number in the file name tells you how many made it, so you can spot a short quiz without opening it.

---

**Go deeper:** [Instructor repository internals](../reference/instructor-repository.md): file names, tag folders and how the quiz workflow decides what to rebuild
