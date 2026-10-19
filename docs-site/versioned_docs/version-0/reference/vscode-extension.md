---
sidebar_position: 12
sidebar_label: The VS Code extension
---

# The VS Code extension

GrillMyCode Companion (`GrillMyCode.grillmycode` on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=GrillMyCode.grillmycode)) shows the questions from the [assessment issue](assessment-output.md) beside the code they ask about, and shows an instructor each question's answer as well. It also [checks the GrillMyCode step](#workflow-help) of a workflow file as it is written, and opens the [Workflow Wizard](#the-workflow-wizard) in the editor. It is separate from the action: it has its own releases, needs no input in the workflow, and only reads what the action has already posted. For setup, see [Showing questions in VS Code](../guides/vscode-extension.md).

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
| **Go from a question to its code** | A question has been opened, from the list or by [stepping to it](#stepping-through-the-questions) |

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
- When a first set of questions [arrives](#when-new-questions-arrive).

Each load also checks again for an answer key, which decides whether the [instructor view](#the-instructor-view) is offered.

## When new questions arrive

Between loads, the extension asks GitHub whether the questions have changed: once a minute, and when the VS Code window regains the focus, unless it asked in the 15 seconds before. Each check is one request, for the same list of issues a load reads. Checking is in version 0.4.4 and later. Earlier versions show a new set only after a refresh.

It checks only while the window has the focus, and only once the repository has been read with the signed-in account. A check that fails says nothing, and the next one asks again.

A set counts as new when loading again would show other questions: the issue behind [the set being shown](#which-set-of-questions-it-shows) has other text, or another issue would be chosen in its place. What happens next depends on the list:

- **No questions are showing.** The new set is loaded at once. A notification says "GrillMyCode questions have arrived for this repository.", and its **Show Questions** button opens the Questions view. If that view is not on screen, the GrillMyCode icon in the Activity Bar carries a badge until it is.
- **Questions are showing.** The list is left as it is, so it never changes under someone who is reading it. A notification says "A newer set of GrillMyCode questions has arrived for this repository.", a note above the list says the same, and the GrillMyCode icon carries a badge. **Show New Questions** in the notification loads the new set, as **Refresh Questions** does. Each set is announced once.

A set that arrives for another branch or submission tag than the one being shown is not announced. It is offered by **Choose Which Questions to Show** after the next load.

## Opening a question's code

Selecting a question opens the file it asks about, in the editor group that is active, and highlights the lines. A question that shows code from several files opens each file in a tab of its own, in the order the question shows them, and leaves the first in front. Under such a question the list has a row for each piece of code, and selecting one brings its file to the front at those lines. Versions before 0.4.3 opened one file at a time.

When another question is opened, the tabs the extension opened for the one before are closed, except those on a file the new question shows too. A tab is left open when any of these is true:

- it was open before the question was;
- its file has been edited since, whether or not the edit was saved;
- the reader has pinned it;
- the reader closed it and opened it again.

Loading the questions again removes the highlights and leaves the tabs, which close when the next question is opened.

## The moved-code warning

Line numbers in the report are those of the commit the questions were written about, and the extension does not try to follow code that has moved. It highlights the original lines and shows a note above the list when either is true:

- the folder is at a different commit from the one in the report;
- a file the questions point into has changes that are not committed, or edits that are not saved.

A range that runs past the end of the file is cut to fit. A file that no longer exists is reported and not opened.

## Stepping through the questions

**Next Question** and **Previous Question** open the question after or before the one shown in **Selected Question**, as selecting it in the list would. While a set of questions is showing, both are in the Questions view's title bar and in the Command Palette, as **GrillMyCode: Next Question** and **GrillMyCode: Previous Question**. They are in version 0.4.2 and later.

- The order is the list's: file by file, then the broader questions. It is not always the order of the question numbers.
- With no question selected, **Next Question** opens the first and **Previous Question** the last.
- A step past either end of the list goes round to the other.
- A broader question has no lines to open, so the editor stays where it was.
- A step shows the GrillMyCode view if it is closed.
- In the [instructor view](#the-instructor-view), they step through the answer key's questions.

Neither command has a keyboard shortcut. A reader who wants one adds it in VS Code's **Keyboard Shortcuts** editor.

## The instructor view

An account that can read an assignment's answer key gets a second view. It lists the answer key's questions, and **Selected Question** shows each one's answer under its code. Selecting a question still opens the student's file at the lines it asks about.

The instructor view is in version 0.4.0 and later. No setting turns it on. GitHub decides who can read the [instructor repository](instructor-repository.md), and the extension offers the view only after it has read the answer key with the signed-in account. A student's account cannot read it, so a student's copy shows the questions and nothing else: no answers, no switch, and no mention of another view.

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
- **Distractors.** The answer key holds them for the [quiz](instructor-repository.md#quiz-files). The view shows the answer alone.
- **Dropped questions.** The answer key lists the questions the action dropped for not pointing at the student's code. The view shows only the ones that were asked.
- **Earlier submissions.** The view reads the current answer key, not the [history](instructor-repository.md#spotting-resubmissions) kept for a submission tag.
- **A repository the action could not identify.** If the student is no longer a direct collaborator, the action filed no answer key and the extension finds none.

## Workflow help

In a file under `.github/workflows`, the extension reads each step that uses `NSCC-ITC-Assessment/GrillMyCode`, at any version, and helps with its `with:` block. It works from the text of the file alone: no sign-in, no request to GitHub and no Git. Every other step is left alone. Workflow help is in version 0.4.0 and later.

Opening a YAML file starts the extension, as opening the GrillMyCode view does.

### What it checks

Problems are underlined as the file is typed and listed in the **Problems** panel, each marked **GrillMyCode**. The level follows what the action does with the value, as [Inputs and outputs](inputs-outputs.md) describes it:

- **Error:** the run fails, or the value cannot be used.
- **Warning:** the run carries on, but not with what was written.
- **Information:** the input is fine, and has no effect as the workflow stands.

| What is underlined | Level |
| ------------------ | ----- |
| A value outside the input's fixed set: `starter_code`, `previous_work`, `question_emphasis`, `ai_reasoning_effort`, `ai_provider`, `tag_diff_base` | Error |
| Anything but `true` or `false` for `label_repos` or `preview_only` | Error |
| A `submission_tags` pattern outside the [supported syntax](triggers.md#pattern-syntax) | Error |
| Text where a whole number belongs | Error |
| A number below the input's smallest value or above its largest, where the action uses the nearest one it allows | Warning |
| An `ai_temperature` the action ignores | Warning |
| Anything but `true` or `false` for `keep_comments`, `include_answers` or `fail_on_empty_assessment`, which the action reads as `false` | Warning |
| A [deprecated input](inputs-outputs.md#deprecated-inputs) | Warning |
| An input the action does not declare, with the input it resembles when one is close | Warning |

An unquoted `True` is not underlined: GitHub passes it to the action as `true`.

Some checks compare one input with another, or with the rest of the workflow:

| What is underlined | Level |
| ------------------ | ----- |
| No `api_key`, unless `preview_only` is set | Error |
| A workflow that runs on `on.push.tags` with no `submission_tags` | Error |
| `submission_tags` and `on.push.tags` that list different entries | Warning |
| `api_key`, `instructor_repo_token` or `github_token` written into the file, or read from a workflow input | Warning |
| `label_repos` with no `instructor_repo_token` | Warning |
| `starter_questions_one_in` when `starter_code` is not `ask` | Information |
| `previous_work` when neither `tag_diff_base` nor `base_sha` gives the run earlier work | Information |
| `tag_diff_base` with no `submission_tags` | Information |

A value GitHub works out when the workflow runs, such as `${{ inputs.num_questions }}`, is not checked, and neither is a comparison that depends on one.

### What it offers

- **The values of an input** that has a fixed set, after its name. The default is marked.
- **The inputs the step does not set yet**, on an empty line of the `with:` block, each with its description from `action.yml`. Deprecated inputs are not offered.
- **An input's description, values and default**, when the pointer rests on its name.

### With the GitHub Actions extension

GitHub's own [GitHub Actions extension](https://marketplace.visualstudio.com/items?itemName=github.vscode-github-actions) offers and describes the inputs of every action, and reports an input an action does not declare. Where it is installed, GrillMyCode Companion leaves those three to it, so nothing is shown twice, and adds the rest: the checks on values and between inputs, and the values on offer.

### What it does not know

- **Which version the workflow uses.** The extension carries the inputs of the action as they were when the extension was released. In a workflow pinned to an older version, it may offer an input that version lacks. With an extension older than the action, a new input is reported as unknown.
- **Exclude patterns, stack templates and model IDs.** `additional_exclude_patterns`, `exclude_pattern_overrides`, `stack_templates` and `ai_model` are not checked.
- **What a repository contains.** Whether a pattern matches a file, or a tag exists, is known only to a run. A [preview run](exclude-patterns.md#previewing-in-a-run) answers the first.

### Switching it off

Set `grillmycode.workflowHelp.enabled` to `false` in VS Code's settings, for the user or for one folder.

## The Workflow Wizard

**GrillMyCode: Open Workflow Wizard**, in the Command Palette, opens the [Workflow Wizard](../workflow-wizard.mdx) in an editor tab. It is the docs site's Wizard, with the same steps and the same workflow at the end, and it does two things a web page cannot. The Wizard is in version 0.4.0 and later.

- **It reads the folder that is open.** On the **Files** step, **Use the open folder** tries the patterns on the folder open in the editor, with nothing to pick. **Choose another folder…** reads one from anywhere on the computer, such as a folder holding your own solution. With several folders open, the extension asks which one. In a Git repository, the files Git ignores, such as build output, are left out: they are never committed, so a run never sees them.
- **It writes the workflow file.** On the last step, **Create the workflow file** writes `.github/workflows/grill-my-code.yml` in the open folder and opens it beside the Wizard. If the folder already has that file, the extension asks before replacing what is in it, and the change can be undone in the editor. With no folder open, the workflow opens as a new file that is not saved yet.

[Workflow help](#workflow-help) checks the file the Wizard writes, as it checks any other. The tab keeps its answers while another tab is in front. Closing it discards them.

The command is there for every account, as the Wizard on the docs site is.

### What the Wizard's tab reads

- **The folder, as it is on disk.** That is the same reading as [the preview on the docs site](exclude-patterns.md#previewing-in-the-workflow-wizard) makes, not the list of files Git tracks, so a file Git ignores is listed too. The `.git` folder and dependency folders such as `node_modules` are not opened. A symbolic link is listed as a file and is never followed.
- **Only that folder.** The tab is given the files of the folder you chose and no others, and nothing it reads leaves the computer.
- **OpenRouter's public list of models**, for the **AI** step. It is the one address the tab can reach. No key is sent and nothing about the folder is.

The Wizard needs no sign-in to GitHub and reads no issue.

### What it does not do

- **Open a workflow that already exists.** The Wizard starts from its own defaults each time. It does not read a workflow file back into its steps.
- **Keep up with the docs site between releases.** The extension carries the Wizard as it was when the extension was released, so the Wizard on the docs site can be newer. The same holds for [the inputs workflow help knows](#what-it-does-not-know).
- **Choose the action's version.** The workflow is written for `@v0`, the action's current major version. To stay on one minor version, edit that line afterward: see [Choosing when to upgrade](upgrade-notes.md#choosing-when-to-upgrade).

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

Between loads it repeats the first request alone, to learn [when new questions arrive](#when-new-questions-arrive).

It writes nothing to GitHub and collects no usage data. The one other service it talks to is OpenRouter, and only from [the Workflow Wizard's tab](#what-the-wizards-tab-reads), without the sign-in.

## Untrusted issue text

Anyone with write access to a student's repository, including the student, can edit the issue. The extension therefore treats its text as untrusted: everything shown is escaped, the page that shows the selected question runs no script, and a file path that is absolute or leaves the repository is never opened.

The Workflow Wizard's tab does run a script, the Wizard itself. No text from an issue or an answer key is ever shown in it.

The answer key is read the same way, although only an account with write access to the instructor repository can change it.
