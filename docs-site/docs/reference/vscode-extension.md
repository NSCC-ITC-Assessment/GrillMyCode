---
sidebar_position: 12
sidebar_label: The VS Code extension
---

# The VS Code extension

GrillMyCode Companion (`GrillMyCode.grillmycode` on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=GrillMyCode.grillmycode)) shows the questions from the [assessment issue](assessment-output.md) beside the code they ask about. It is separate from the action: it has its own releases, needs no input in the workflow, and only reads what the action has already posted. For setup, see [Showing questions in VS Code](../guides/vscode-extension.md).

## What it needs

- **VS Code 1.120 or later**, on the desktop or in a codespace. It is not a web extension, so it does not load in github.dev or vscode.dev.
- **VS Code's built-in Git support**, switched on. The extension reads the folder's remote, branch and commit from it and never runs `git` itself.
- **A repository on GitHub.com.** GitHub Enterprise Server is not supported.
- **A trusted folder.** VS Code switches its Git support off while the folder is open in Restricted Mode, so the extension loads no questions there. The GrillMyCode view says so and links to **Manage Workspace Trust**. Once the folder is trusted, the questions load without a restart.

## How it is installed

- **From a dev container configuration**, in a codespace: the extension is installed when the codespace is created, with nothing for the student to confirm.
- **From a recommendation**, on the desktop: VS Code asks "Do you want to install the recommended 'GrillMyCode Companion' extension from GrillMyCode for this repository?". After **Install**, it asks whether the reader trusts the publisher, the first time they install anything from it. The offer is made in Restricted Mode too.

Both install the latest stable version. A pre-release is installed only when the reader asks VS Code for one.

## Which repository it reads

The open folder must be a clone with a GitHub.com remote. The `origin` remote is used when it points at GitHub, otherwise the first remote that does. In a window with several folders, the extension shows the questions for the first folder that qualifies.

## How it finds the questions

It makes one request to GitHub: the repository's open issues labelled `assessment`, up to 100 of them. From those it keeps the issues that are titled the way the action [titles them](assessment-output.md#title-and-label) and whose body reads as a GrillMyCode report. Pull requests and any other issue with that label are ignored.

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

It does not check GitHub on a timer or after a push, so a new set of questions appears only after a refresh.

## The moved-code warning

Line numbers in the report are those of the commit the questions were written about, and the extension does not try to follow code that has moved. It highlights the original lines and shows a note above the list when either is true:

- the folder is at a different commit from the one in the report;
- a file the questions point into has changes that are not committed, or edits that are not saved.

A range that runs past the end of the file is cut to fit. A file that no longer exists is reported and not opened.

## What it leaves out

- **Answers.** With `include_answers` on, the issue contains them. The extension does not show them.
- **Questions lost to the issue's [length limit](assessment-output.md#length-limit).** When the issue was cut short, the question the cut landed in is dropped, and the view says the last questions are missing and points to the PDF.

## Sign-in and what is read

The extension uses VS Code's built-in GitHub sign-in and asks for the `repo` scope. That scope grants full access to the account's repositories. It is the only OAuth scope that allows reading the issues of a private repository, which is what a student's assignment repository is.

With that access the extension makes the single request described above. It writes nothing to GitHub, talks to no other service, and collects no usage data.

## Untrusted issue text

Anyone with write access to a student's repository, including the student, can edit the issue. The extension therefore treats its text as untrusted: everything shown is escaped, the page that shows the selected question runs no script, and a file path that is absolute or leaves the repository is never opened.
