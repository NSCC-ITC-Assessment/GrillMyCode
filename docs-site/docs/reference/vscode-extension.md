---
sidebar_position: 12
sidebar_label: The VS Code extension
---

# The VS Code extension

GrillMyCode Companion (`GrillMyCode.grillmycode` on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=GrillMyCode.grillmycode)) shows the questions from the [assessment issue](assessment-output.md) beside the code they ask about, and shows an instructor each question's answer as well. It is separate from the action: it has its own releases, needs no input in the workflow, and only reads what the action has already posted. For setup, see [Showing questions in VS Code](../guides/vscode-extension.md).

## What it needs

- **VS Code 1.120 or later**, on the desktop or in a codespace. It is not a web extension, so it does not load in github.dev or vscode.dev.
- **VS Code's built-in Git support**, switched on. The extension reads the folder's remote, branch and commit from it and never runs `git` itself.
- **A repository on GitHub.com.** GitHub Enterprise Server is not supported.
- **A trusted folder.** VS Code switches its Git support off while the folder is open in Restricted Mode, so the extension loads no questions there. The GrillMyCode view says so and links to **Manage Workspace Trust**. Once the folder is trusted, the questions load without a restart.

## How it is installed

- **From a dev container configuration**, in a codespace: the extension is installed when the codespace is created, with nothing for the student to confirm.
- **From a recommendation**, on the desktop: VS Code asks "Do you want to install the recommended 'GrillMyCode Companion' extension from GrillMyCode for this repository?". After **Install**, it asks whether the reader trusts the publisher, the first time they install anything from it. The offer is made in Restricted Mode too.

Both install the latest stable version. A pre-release is installed only when the reader asks VS Code for one.

## The walkthrough

The extension adds a walkthrough, **Get Started with GrillMyCode Companion**, to VS Code's Welcome page. VS Code opens it when the extension is installed in an open window, and **Welcome: Open Walkthrough...** in the Command Palette opens it again. Opening it starts the extension, which looks for the repository but does not ask anyone to sign in.

Each step is ticked by what the extension finds, not by its button being selected:

| Step | Ticked when |
| ---- | ----------- |
| **Open your assignment's folder** | The open folder is a clone with a GitHub.com remote |
| **Sign in to GitHub** | GitHub has accepted the sign-in and found the repository |
| **Get your questions** | A set of questions is showing |
| **Go from a question to its code** | A question has been opened from the list |

A step that is ticked stays ticked, in every folder, until the reader unticks it.

## Which repository it reads

The open folder must be a clone with a GitHub.com remote. The `origin` remote is used when it points at GitHub, otherwise the first remote that does. In a window with several folders, the extension shows the questions for the first folder that qualifies.

## How it finds the questions

The questions come from one request to GitHub: the repository's open issues labelled `assessment`, up to 100 of them. From those it keeps the issues that are titled the way the action [titles them](assessment-output.md#title-and-label) and whose body reads as a GrillMyCode report. Pull requests and any other issue with that label are ignored.

Each question's number, file and lines come from the issue's [hidden data](assessment-output.md#hidden-data), and its text and code from the report around it. An issue posted before the action wrote that data is read from the report alone.

## When the issue is newer than the extension

The hidden data carries the version of the issue's layout. When that version is higher than the installed extension knows, the extension reads nothing from the issue. The GrillMyCode view says the questions were written by a newer version of GrillMyCode, and **Show GrillMyCode Companion** opens the extension's page in the Extensions view, where it can be updated. The questions are still in the issue on GitHub.

## Which set of questions it shows

A repository has one issue per branch and one per submission tag. When there are several, the extension shows, in order of preference:

1. the set the reader last picked with **Choose Which Questions to Show**, remembered for that repository;
2. the set for the branch that is checked out;
3. the most recently updated set.

Picking **Follow the checked-out branch** in that list clears the remembered choice.

## When it loads again

- When the reader selects **Refresh Questions**.
- When the folder is switched to another branch.
- When the GitHub account signed in to VS Code changes.

It does not check GitHub on a timer or after a push, so a new set of questions appears only after a refresh. Each load also checks again for an answer key, which decides whether the [instructor view](#the-instructor-view) is offered.

## The moved-code warning

Line numbers in the report are those of the commit the questions were written about, and the extension does not try to follow code that has moved. It highlights the original lines and shows a note above the list when either is true:

- the folder is at a different commit from the one in the report;
- a file the questions point into has changes that are not committed, or edits that are not saved.

A range that runs past the end of the file is cut to fit. A file that no longer exists is reported and not opened.

## The instructor view

An account that can read an assignment's answer key gets a second view. It lists the answer key's questions, and **Selected Question** shows each one's answer and distractors under its code. Selecting a question still opens the student's file at the lines it asks about.

No setting turns the view on. GitHub decides who can read the [instructor repository](instructor-repository.md), and the extension offers the view only after it has read the answer key with the signed-in account. A student's account cannot read it, so a student's copy shows the questions and nothing else: no answers, no switch, and no mention of another view.

### Where the answer key is read from

The extension works out the assignment and the student from the repository's name, by [the rule the action uses](instructor-repository.md#how-the-assignment-and-student-are-identified), and reads the student's [`questions.json`](instructor-repository.md#questionsjson). For `cs-principles-lab-3-jsmith` in the organization `my-school`, that is:

```text
my-school/cs-principles-lab-3-grillmycode-instructor/jsmith/data/questions.json
```

When the questions showing are a submission tag's, it reads that tag's copy, from the [tag's folder](instructor-repository.md#submission-tag-folders).

How the student is found depends on whose repository is open:

- **The account's own**, which is one whose name ends with the account's login. The login is the student, and the extension makes one request, for the file. GitHub answers 404 to a student, and that is the end of it.
- **Anyone else's.** The extension first lists the repository's direct collaborators, to find the one whose login ends the name. An account that may not list them gets the student view. A name ending in `group-<n>` with no such collaborator is a team's, and the key is read from the `group-<n>` folder.

### Which view opens

| Whose repository | Answer key | Opens in |
| ---------------- | ---------- | -------- |
| The account's own | Unreadable | The student view, with nothing else on offer |
| Someone else's, or a team's | Readable | The instructor view |
| The account's own | Readable | The student view, with a switch to the instructor view |
| Someone else's, or a team's | Unreadable | The student view, with nothing else on offer |

The third row is an instructor who has accepted their own assignment to try it.

### Switching views

With a readable answer key, the Questions view's title bar has **Show Student View** or **Show Instructor View**, whichever is not showing, and the same two commands are in the Command Palette. The name of the view that is showing is written beside the **Questions** heading.

The choice is remembered for that repository, in that VS Code workspace. It is not a setting, and it does not carry to another repository. A remembered choice of the instructor view does nothing for an account that can no longer read the answer key.

The student view an instructor switches to is the one a student gets: it is built from the issue, not from the answer key with the answers hidden. Switch to it before sharing your screen with a student.

### When the answer key and the issue differ

The answer key does not record which commit it was written about, so the [moved-code warning](#the-moved-code-warning) takes the commit from the questions issue. That holds only while the two are from the same run. An instructor repository keeps one answer key per student, or per submission tag, while a student's repository keeps an issue per branch, so after a run on another branch they differ.

The extension compares them by each question's number and lines. When they differ, the instructor view shows the answer key's questions with a note saying the two are from different runs, and makes no claim about whether the code has moved.

A repository with an answer key and no questions issue still gets the instructor view, without the moved-code warning.

### What the instructor view leaves out

- **Marks and notes.** Nothing is recorded in the editor.
- **Dropped questions.** The answer key lists the questions the action dropped for not pointing at the student's code. The view shows only the ones that were asked.
- **Earlier submissions.** The view reads the current answer key, not the [history](instructor-repository.md#spotting-resubmissions) kept for a submission tag.
- **A repository the action could not identify.** If the student is no longer a direct collaborator, the action filed no answer key and the extension finds none.

## What it leaves out

- **Answers, in the student view.** With `include_answers` on, the issue contains them. The student view does not show them.
- **Questions lost to the issue's [length limit](assessment-output.md#length-limit).** When the issue was cut short, the question the cut landed in is dropped, and the view says the last questions are missing and points to the PDF.

## Sign-in and what is read

The extension uses VS Code's built-in GitHub sign-in and asks for the `repo` scope. That scope grants full access to the account's repositories. It is the only OAuth scope that allows reading the issues of a private repository, which is what a student's assignment repository is.

With that access the extension makes these requests, each time it loads:

| Request | When |
| ------- | ---- |
| The repository's open issues labelled `assessment` | Always |
| The repository's direct collaborators | Only when the repository is not the account's own |
| The answer key, one file in the instructor repository | Whenever the student could be worked out |

The last two are how it [looks for an answer key](#where-the-answer-key-is-read-from). In a student's own repository that is one extra request, which GitHub refuses.

It writes nothing to GitHub, talks to no other service, and collects no usage data.

## Untrusted issue text

Anyone with write access to a student's repository, including the student, can edit the issue. The extension therefore treats its text as untrusted: everything shown is escaped, the page that shows the selected question runs no script, and a file path that is absolute or leaves the repository is never opened.

The answer key is read the same way, although only an account with write access to the instructor repository can change it.
