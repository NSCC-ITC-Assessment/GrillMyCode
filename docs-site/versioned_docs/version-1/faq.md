---
sidebar_position: 9
---

# FAQ

Short answers, each with a link to the full story. For something that isn't working, see [Troubleshooting](troubleshooting.md).

## About GrillMyCode

### What is GrillMyCode?

A tool that runs in each student's GitHub repository and uses AI to write questions about the code that student wrote. You use the questions for a short conversation or written check, often called a code viva. See [How it works](how-it-works.md).

### Does it grade the code?

No, and that's deliberate. It writes questions and leaves the judgment to you. A slightly off-target question is easy to skip; an unfair automatic grade isn't. See [Why GrillMyCode?](rationale.md)

### Do I need to install anything?

No. It runs on GitHub's servers. You add one workflow file to the assignment's template repository, and the [Workflow Wizard](workflow-wizard.mdx) writes that file for you.

### Do my students need to do anything?

No setup at all. If you use submission tags, they need to know the tag commands. [What your students see](guides/what-students-see.md#what-to-tell-your-students) has wording you can copy into your assignment instructions.

### Does it work without Classroom 50?

Mostly. The questions, issue and PDF work in any GitHub repository. The private answer key, and the LMS quizzes and resubmission tracking that come with it, need Classroom 50's repository naming. See [Using GrillMyCode with Classroom 50](guides/classroom50.md#features-that-need-classroom-50).

## Cost and setup

### What does it cost?

GrillMyCode itself is free. The AI is paid through OpenRouter from a prepaid balance. With the recommended models, an assessment usually costs less than one cent, and $5 US typically lasts a large class a semester. See [Choosing a model and managing cost](guides/choosing-a-model.md).

### What secrets do I need?

One, `OPENROUTER_API_KEY`, saved once as an organization secret. The private answer key needs a second one, `INSTRUCTOR_REPO_TOKEN`. See [Tokens, secrets and permissions](reference/permissions.md).

### Can I change the settings after setting it up?

Yes. Edit the workflow file, or run the Wizard again and replace the file. To change a setting for one run only, see [Running it yourself](guides/running-manually.md).

## Questions

### How many questions are generated?

20 by default, and anywhere from 1 to 50. See [Tailoring the questions](guides/tailoring-questions.md#how-many-questions).

### How do I focus the questions on my assignment?

Write a few sentences of instructions, and optionally point GrillMyCode at the assignment brief or rubric. See [Tailoring the questions](guides/tailoring-questions.md).

### Can students see the answers?

No, unless you turn on **Include answers**, which defeats the purpose. To see the answers yourself, set up the [private answer key](guides/instructor-setup.md).

### Why are some questions missing from a student's report?

GrillMyCode holds back any question it can't be sure doesn't give away its answer, and says how many. See [Troubleshooting](troubleshooting.md#some-questions-are-missing-from-a-students-report).

### Why doesn't the AI see the code comments?

They're removed on purpose, so questions are about what the code does. You can keep them; see [Tailoring the questions](guides/tailoring-questions.md#keep-or-remove-comments).

### Is my starter code assessed?

No. Anything in the template when the student accepted is left out. See [Choosing which files are assessed](guides/choosing-files.md).

## When it runs

### Which trigger should I use?

Every push suits short assignments and practice. A submission tag suits finished or staged work. Manual only suits you choosing the timing. See [Choosing a trigger](guides/choosing-a-trigger.md).

### Can students trigger the assessment only when they're done?

Yes, with a submission tag: the student pushes a tag you named, such as `complete`. See [Choosing a trigger](guides/choosing-a-trigger.md#submission-tag).

### Does `gh student submit` run GrillMyCode?

With the every-push trigger, yes, like any push. With a submission tag, no: students must also push your tag. See [Using GrillMyCode with Classroom 50](guides/classroom50.md#gh-student-submit-and-submission-tags).

### What happens if a student pushes again while a run is in progress?

The older run is cancelled and a new one starts on the latest commit, so only the latest code is assessed. See [Triggers in depth](reference/triggers.md#overlapping-runs).

### Can I tell when a student resubmits under the same tag?

Yes, with the private answer key set up. Every resubmission is counted, and the replaced questions are kept. See [Tracking assessed repositories](guides/tracking-repositories.md#spotting-resubmissions).

## Results

### Where are the questions?

In a GitHub issue in the student's repository, called **GrillMyCode Questions**, with a PDF linked from the top. See [What your students see](guides/what-students-see.md).

### Can I get the questions into my LMS?

Yes. With the private answer key, each student gets a quiz file you can import into Brightspace, Canvas, Moodle and most others. See [Importing quizzes into your LMS](guides/lms-quizzes.md).

### How can I see which students have questions?

Search your organization for open `assessment` issues, or turn on repository markers. See [Tracking assessed repositories](guides/tracking-repositories.md).

## Upgrading

### I've used GitHub Models with GrillMyCode in the past and now they no longer function. Why?

GitHub permanently discontinued GitHub Models, so there's nothing to reconnect to. Switch the workflow to OpenRouter; [Upgrade notes](reference/upgrade-notes.md#github-models-was-discontinued) has the steps.
