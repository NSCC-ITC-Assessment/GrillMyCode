---
sidebar_position: 1
sidebar_label: Welcome
slug: /
---

# Welcome to GrillMyCode

GrillMyCode writes questions about each student's own code, so you can check that they understand the work they hand in.

When a student pushes their work, GrillMyCode reads the code they wrote and has an AI model write questions about it: why they made a choice, what a line does, what would change if the input were different. A few minutes later the questions appear in the student's repository, ready for a short conversation or a written check (often called a *code viva*).

GrillMyCode does not grade anything. It does the preparation, and you have the conversation.

![An assessment issue in a student's repository: the GrillMyCode header with a Download as PDF button, then questions that each quote a snippet of the student's own PHP code.](/img/screenshots/assessment-issue.png)

## How it fits into your course

1. **You add GrillMyCode to an assignment once.** One file goes into the assignment's template repository, and every student who accepts the assignment gets a copy.
2. **Students work as usual.** There is nothing for them to install or learn.
3. **Each student gets their own questions.** They appear as a GitHub issue in the student's repository, with a PDF copy. You choose when: on every push, when the student says they're done, or only when you start it.
4. **You can also get the answers.** An optional private repository, which only instructors can see, holds every student's questions with answers, plus a quiz file you can import into your LMS.

With the recommended AI models, an assessment usually costs less than one cent.

## Built for Classroom 50

GrillMyCode is designed for [Classroom 50](https://github.com/foundation50/classroom50) assignments. It knows which code came from your starter template and leaves it out, so the questions are only about what the student wrote.

Not using Classroom 50? Most of GrillMyCode still works; see [What code is assessed](reference/code-selection.md).

## Where to next

- **New here?** Read [How it works](how-it-works.md). It takes five minutes.
- **Ready to set it up?** Go to [Get started](getting-started/index.md). It takes about 15 minutes.
- **Wondering whether it's worth it?** Read [Why GrillMyCode?](rationale.md)
