---
sidebar_position: 13
sidebar_label: The JetBrains plugin
---

# The JetBrains plugin

GrillMyCode Companion (`org.grillmycode.companion` on the JetBrains Marketplace) shows the questions from the [assessment issue](assessment-output.md) beside the code they ask about, in IntelliJ IDEA, PyCharm, WebStorm and the other IDEs built on the IntelliJ Platform. It is separate from the action: it has its own releases, needs no input in the workflow, and only reads what the action has already posted. For setup, see [Showing questions in JetBrains IDEs](../guides/jetbrains-plugin.md).

It does what the [VS Code extension](vscode-extension.md)'s student view does. It has no instructor view, no workflow help and no Workflow Wizard.

## What it needs

- **A JetBrains IDE, version 2025.1 or later**, Community or paid.
- **The bundled Git plugin**, switched on. The plugin reads the project's remotes, branch and commit from it and never runs `git` itself.
- **A repository on GitHub.com.** GitHub Enterprise Server is not supported.
- **A trusted project.** In safe mode the IDE switches its Git support off, so the plugin loads no questions. The tool window says so. Once the project is trusted, the questions load without a restart.
- **An organization that allows the plugin.** If the repository's organization restricts OAuth apps, an owner must approve GrillMyCode Companion first. See [Signing in](#signing-in).

## Which repository it reads

The project must hold a clone with a GitHub.com remote. The `origin` remote is used when it points at GitHub, otherwise the first remote that does. In a project with several Git repositories, the plugin shows the questions for the first that qualifies.

## How it finds the questions

The questions come from one request to GitHub: the repository's open issues labelled `assessment`, up to 100 of them. From those it keeps the issues that are titled the way the action [titles them](assessment-output.md#title-and-label) and whose body reads as a GrillMyCode report. Pull requests and any other issue with that label are ignored.

Each question's number, file and lines come from the issue's [hidden data](assessment-output.md#hidden-data), and its text and code from the report around it. An issue posted before the action wrote that data is read from the report alone.

Nothing is asked of GitHub until the **GrillMyCode** tool window is first opened in a project.

## When the issue is newer than the plugin

The hidden data carries the version of the issue's layout. When that version is higher than the installed plugin knows, the plugin reads nothing from the issue. The tool window says the questions were written by a newer version of GrillMyCode, and **Show plugins** opens the IDE's **Plugins** settings, where it can be updated. The questions are still in the issue on GitHub.

## Which set of questions it shows

A repository has one issue per branch and one per submission tag. When there are several, the plugin shows, in order of preference:

1. the set the reader last picked with **Choose Which Questions to Show…**, remembered for that repository in that project;
2. the set for the branch that is checked out;
3. the most recently updated set.

**Choose Which Questions to Show…** is in the tool window's title bar and under **Tools | GrillMyCode** while there is more than one set. Picking **Follow the checked-out branch** in its list clears the remembered choice.

## When it loads again

- When the reader selects **Refresh Questions**.
- When the project is switched to another branch, or its GitHub remote changes.
- When the reader signs in or out.
- When a safe-mode project is trusted.
- When a first set of questions [arrives](#when-new-questions-arrive).

## When new questions arrive

Between loads, the plugin asks GitHub whether the questions have changed: once a minute, and when the IDE regains the focus, unless it asked in the 15 seconds before. Each check is one request, for the same list of issues a load reads.

It checks only while the IDE has the focus, and only once the repository has been read with the signed-in account. A check that fails says nothing, and the next one asks again.

A set counts as new when loading again would show other questions: the issue behind [the set being shown](#which-set-of-questions-it-shows) has other text, or another issue would be chosen in its place. What happens next depends on the list:

- **No questions are showing.** The new set is loaded at once. A notification says "GrillMyCode questions have arrived for this repository.", and its **Show Questions** button opens the tool window. If the tool window is not on screen, its icon carries a badge until it is.
- **Questions are showing.** The list is left as it is, so it never changes under someone who is reading it. A notification says "A newer set of GrillMyCode questions has arrived for this repository.", a note above the list says the same, and the tool window's icon carries a badge. **Show New Questions** in the notification loads the new set, as **Refresh Questions** does. Each set is announced once.

A set that arrives for another branch or submission tag than the one being shown is not announced. It is offered by **Choose Which Questions to Show…** after the next load.

## Opening a question's code

Selecting a question shows it in full below the list. Double-clicking it, or pressing **Enter**, opens the file it asks about and highlights the lines. A question that shows code from several files opens each file in a tab of its own and leaves the first in front. Under such a question the list has a row for each piece of code, and opening one brings its file to the front at those lines.

Unlike the VS Code extension, the plugin leaves open the tabs it opened for one question when the next is opened. The IDE closes old tabs itself, past its tab limit.

Opening another question removes the highlights, and so does a load that brings other questions. Editing a highlighted file removes that file's highlights, since the lines may have moved.

## The moved-code warning

Line numbers in the report are those of the commit the questions were written about, and the plugin does not try to follow code that has moved. It highlights the original lines and shows a note above the list when either is true:

- the project is at a different commit from the one in the report;
- a file the questions point into has changes that are not committed, or edits that are not saved.

A range that runs past the end of the file is cut to fit. A file that no longer exists is reported in a notification and not opened.

## Stepping through the questions

**Next Question** and **Previous Question** open the question after or before the one selected, as double-clicking it would. While a set of questions is showing, both are in the tool window's title bar and under **Tools | GrillMyCode**.

- The order is the list's: file by file, then the broader questions. It is not always the order of the question numbers.
- With no question selected, **Next Question** opens the first and **Previous Question** the last.
- A step past either end of the list goes round to the other.
- A broader question has no lines to open, so the editor stays where it was.
- A step shows the tool window if it is hidden.

Neither action has a keyboard shortcut. A reader who wants one adds it under **Settings | Keymap**.

## What it leaves out

- **Answers.** With `include_answers` on, the issue contains them. The plugin does not show them.
- **Questions lost to the issue's [length limit](assessment-output.md#length-limit).** When the issue was cut short, the question the cut landed in is dropped, and a note above the list says the last questions are missing and points to the PDF.

## Signing in

The plugin signs in with GitHub's device flow, through its own OAuth app, **GrillMyCode Companion**. **Tools | GrillMyCode | Sign In to GitHub…**, or the link in the tool window, shows a code and opens GitHub, where the reader enters it and authorizes the app. It does not use the account of the IDE's bundled GitHub plugin.

It asks for the `repo` scope. That scope grants full access to the account's repositories. It is the only OAuth scope that allows reading the issues of a private repository, which is what a student's assignment repository is.

The token is kept in the IDE's password storage, once for every project, and does not expire. **Tools | GrillMyCode | Sign Out of GitHub** forgets it. GitHub keeps the app's authorization until the account owner revokes it in [their GitHub settings](https://github.com/settings/connections/applications/Ov23liUoE9chsGQrWYQR).

### Organizations that restrict OAuth apps

GitHub turns on OAuth app access restrictions for every new organization. Until an owner approves GrillMyCode Companion, GitHub refuses the plugin's request with a 403 that names those restrictions. The tool window then says the organization has not approved GrillMyCode Companion, with **Ask on GitHub**, which opens the app's page in the reader's GitHub settings, where they can request approval. [Approve the plugin for your organization](../guides/jetbrains-plugin.md#approve-the-plugin-for-your-organization) has the steps for an owner.

### What is read

With that access the plugin makes one request, each time it loads: the repository's open issues labelled `assessment`. Between loads it repeats it, to learn [when new questions arrive](#when-new-questions-arrive).

It writes nothing to GitHub, talks to no other service, and collects no usage data.

## Untrusted issue text

Anyone with write access to a student's repository, including the student, can edit the issue. The plugin therefore treats its text as untrusted: everything shown is escaped, in a simple HTML pane that runs no script rather than a browser, and a file path that is absolute or leaves the repository is never opened.
