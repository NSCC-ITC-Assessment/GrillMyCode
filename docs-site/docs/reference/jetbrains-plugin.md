---
sidebar_position: 13
sidebar_label: The JetBrains plugin
---

# The JetBrains plugin

GrillMyCode Companion (`org.grillmycode.companion` on the [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/35347-grillmycode-companion)) shows the questions from the [assessment issue](assessment-output.md) beside the code they ask about, in IntelliJ IDEA, PyCharm, WebStorm and the other IDEs built on the IntelliJ Platform, and shows an instructor each question's answer as well. It is separate from the action: it has its own releases, needs no input in the workflow, and only reads what the action has already posted. For setup, see [Showing questions in JetBrains IDEs](../guides/jetbrains-plugin.md).

It does what the [VS Code extension](vscode-extension.md) does: the student and instructor views, [workflow help](#workflow-help) and the [Workflow Wizard](#the-workflow-wizard) in the IDE.

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

Each load also checks again for an answer key, which decides whether the [instructor view](#the-instructor-view) is offered.

## When new questions arrive

Between loads, the plugin asks GitHub whether the questions have changed: once a minute, and when the IDE regains the focus, unless it asked in the 15 seconds before. Each check is one request, for the same list of issues a load reads.

It checks only while the IDE has the focus, and only once the repository has been read with the signed-in account. A check that fails says nothing, and the next one asks again.

A set counts as new when loading again would show other questions: the issue behind [the set being shown](#which-set-of-questions-it-shows) has other text, or another issue would be chosen in its place. What happens next depends on the list:

- **No questions are showing.** The new set is loaded at once. A notification says "GrillMyCode questions have arrived for this repository.", and its **Show Questions** button opens the tool window. If the tool window is not on screen, its icon carries a badge until it is.
- **Questions are showing.** The list is left as it is, so it never changes under someone who is reading it. A notification says "A newer set of GrillMyCode questions has arrived for this repository.", a note above the list says the same, and the tool window's icon carries a badge. **Show New Questions** in the notification loads the new set, as **Refresh Questions** does. Each set is announced once.

A set that arrives for another branch or submission tag than the one being shown is not announced. It is offered by **Choose Which Questions to Show…** after the next load.

## Opening a question's code

Selecting a question shows it in full below the list. Double-clicking it, or pressing **Enter**, opens the file it asks about and highlights the lines. A question that shows code from several files opens each file in a tab of its own and leaves the first in front. Under such a question the list has a row for each piece of code, and opening one brings its file to the front at those lines.

When another question is opened, the tabs the plugin opened for the one before are closed, except those on a file the new question shows too. A tab is left open when any of these is true:

- it was open before the question was;
- its file has been edited since, whether or not the edit was saved;
- the reader has pinned it;
- the reader closed it and opened it again.

Loading the questions again removes the highlights and leaves the tabs, which close when the next question is opened.

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
- In the [instructor view](#the-instructor-view), they step through the answer key's questions.

Neither action has a keyboard shortcut. A reader who wants one adds it under **Settings | Keymap**.

## The instructor view

An account that can read an assignment's answer key gets a second view. It lists the answer key's questions, and the panel below the list shows each one's answer under its code. Opening a question still opens the student's file at the lines it asks about.

No setting turns it on. The plugin offers the view only after it has read the answer key with the signed-in account, which a student's account cannot do, so a student's copy shows the questions and nothing else: no answers, no switch, and no mention of another view.

The plugin follows the VS Code extension's rules for this view, with the same requests:

- [where the answer key is read from](vscode-extension.md#where-the-answer-key-is-read-from), and how the student is found;
- [which view opens](vscode-extension.md#which-view-opens), by whose repository it is;
- [what happens when the answer key and the issue differ](vscode-extension.md#when-the-answer-key-and-the-issue-differ), which turns the [moved-code warning](#the-moved-code-warning) into a note that the two are from different runs;
- [what the view leaves out](vscode-extension.md#what-the-instructor-view-leaves-out), such as distractors and marks.

### Switching views

With a readable answer key, the tool window's title bar has **Show Student View** or **Show Instructor View**, whichever is not showing, and the same two are under **Tools | GrillMyCode**. The name of the view that is showing is written beside the tool window's name. Switching asks nothing of GitHub.

The choice is remembered for that repository, in that project. A remembered choice of the instructor view does nothing for an account that can no longer read the answer key.

The student view is the one a student gets, built from the issue. Switch to it before sharing your screen with a student.

## What it leaves out

- **The issue's answers.** With `include_answers` on, the issue contains them. The student view does not show them, and the instructor view shows the answer key's.
- **Questions lost to the issue's [length limit](assessment-output.md#length-limit).** When the issue was cut short, the question the cut landed in is dropped, and a note above the list says the last questions are missing and points to the PDF.

## Workflow help

In a file under `.github/workflows`, the plugin reads each step that uses `NSCC-ITC-Assessment/GrillMyCode`, at any version, and helps with its `with:` block. Like VS Code's, it works from the text of the file alone, with no sign-in and no request to GitHub, and it leaves every other step alone. It needs the bundled YAML plugin, which is on by default.

It checks, offers and describes what the VS Code extension does, with the same words:

- [what it checks](vscode-extension.md#what-it-checks), and at which level;
- [what it offers](vscode-extension.md#what-it-offers);
- [what it does not know](vscode-extension.md#what-it-does-not-know), such as which version of the action the workflow uses.

In a JetBrains IDE:

- **Problems** are marked as the file is typed and listed in the **Problems** tool window. An error is marked as one, a warning as a warning, and VS Code's information level as a weak warning. A deprecated input is struck through.
- **Completion** opens by itself after the space that follows an input's name, and on the first letter of a new input. **Ctrl+Space** opens it on demand. For an input with a fixed set of values, only those values are offered.
- **An input's description, values and default** appear when the pointer rests on its name, and with **Quick Documentation** (**Ctrl+Q**, or **F1** on macOS), on its name or on an input offered in completion.
- **Nothing is left to another plugin.** VS Code leaves input names, descriptions and unknown inputs to GitHub's extension where it is installed. JetBrains' own [GitHub Actions support](https://www.jetbrains.com/help/idea/github-actions.html) completes the inputs of local actions only, so the plugin offers, describes and checks GrillMyCode's inputs itself.

### Switching it off

Switch off the **GrillMyCode step inputs** inspection, under **Settings | Editor | Inspections | GrillMyCode**. That turns off the completion and the descriptions too. Like any inspection, it can be switched off for one project's profile only.

## The Workflow Wizard

**Tools | GrillMyCode | Open Workflow Wizard** opens the [Workflow Wizard](../workflow-wizard.mdx) in an editor tab. It is the docs site's Wizard, as the VS Code extension shows it, and it does the same two things a web page cannot:

- **It reads the project's folder.** On the **Files** step, **Use the open folder** tries the patterns on the folder the project is in, with nothing to pick. **Choose another folder…** reads one from anywhere on the computer, such as a folder holding your own solution. In a Git repository the IDE knows, the files Git ignores are left out.
- **It writes the workflow file.** On the last step, **Create the workflow file** writes `.github/workflows/grill-my-code.yml` in the project's folder and opens it. If the project already has that file, the plugin asks before replacing what is in it, and **Undo** in the editor reverses the change.

The tab follows the IDE's theme, and keeps its answers while another tab is in front. Closing it discards them. A link in it opens in your browser. [Workflow help](#workflow-help) checks the file the Wizard writes, as it checks any other.

It reads what VS Code's tab reads, and has the same limits: see [what the Wizard's tab reads](vscode-extension.md#what-the-wizards-tab-reads) and [what it does not do](vscode-extension.md#what-it-does-not-do).

Where the IDE cannot show a web page in a tab, as in some remote development setups, the action opens the Wizard on the docs site instead.

## Signing in

The plugin signs in with GitHub's device flow, through its own OAuth app, **GrillMyCode Companion**. **Tools | GrillMyCode | Sign In to GitHub…**, or the link in the tool window, shows a code and opens GitHub, where the reader enters it and authorizes the app. It does not use the account of the IDE's bundled GitHub plugin.

It asks for the `repo` scope. That scope grants full access to the account's repositories. It is the only OAuth scope that allows reading the issues of a private repository, which is what a student's assignment repository is.

The token is kept in the IDE's password storage, once for every project, and does not expire. **Tools | GrillMyCode | Sign Out of GitHub** forgets it. GitHub keeps the app's authorization until the account owner revokes it in [their GitHub settings](https://github.com/settings/connections/applications/Ov23liUoE9chsGQrWYQR).

### Organizations that restrict OAuth apps

GitHub turns on OAuth app access restrictions for every new organization. Until an owner approves GrillMyCode Companion, GitHub refuses the plugin's request with a 403 that names those restrictions. The tool window then says the organization has not approved GrillMyCode Companion, with **Ask on GitHub**, which opens the app's page in the reader's GitHub settings, where they can request approval. [Approve the plugin for your organization](../guides/jetbrains-plugin.md#approve-the-plugin-for-your-organization) has the steps for an owner.

### What is read

With that access the plugin makes these requests, each time it loads:

| Request | When |
| ------- | ---- |
| The repository's open issues labelled `assessment` | Always |
| The repository's direct collaborators | Only when the repository is not the account's own |
| The answer key, one file in the instructor repository | Whenever the student could be worked out |

The last two are how it [looks for an answer key](vscode-extension.md#where-the-answer-key-is-read-from). In a student's own repository that is one extra request, which GitHub refuses.

Between loads it repeats the first request alone, to learn [when new questions arrive](#when-new-questions-arrive).

It writes nothing to GitHub and collects no usage data. The one other service it talks to is OpenRouter, and only from [the Workflow Wizard's tab](#the-workflow-wizard), without the sign-in.

## Untrusted issue text

Anyone with write access to a student's repository, including the student, can edit the issue. The plugin therefore treats its text as untrusted: everything shown is escaped, in a simple HTML pane that runs no script rather than a browser, and a file path that is absolute or leaves the repository is never opened.

The answer key is read the same way, although only an account with write access to the instructor repository can change it.

The Workflow Wizard's tab does run a script, the Wizard itself, in the IDE's built-in browser. No text from an issue or an answer key is ever shown in it.
