# Changelog

The Marketplace shows a version's section on the listing's "What's New" tab.
Each heading is a version as `gradle.properties` writes it.

## [Unreleased]

### Added

- Help with the GrillMyCode step of a workflow file, as the VS Code extension
  gives it: problems with its inputs marked as you type, the inputs and the
  values of an input offered, and each input's description. Switch it off with
  the **GrillMyCode step inputs** inspection, under **Settings | Editor |
  Inspections | GrillMyCode**.
- **Tools | GrillMyCode | Open Workflow Wizard** opens the docs site's
  Workflow Wizard in an editor tab. It tries your choice of files on the
  project's folder, and writes the workflow file in it. Where the IDE cannot
  show a web page in a tab, it opens the Wizard on grillmycode.org.
- Reads the questions of a question set: a workflow whose name keeps its
  questions apart from another workflow's. **Choose Which Questions to Show…**
  lists each set by its name, such as **Lab 3 · main**, and the instructor view
  reads that set's answer key.
- The workflow help marks a `question_set`, or a workflow name, that the action
  can't file questions under, and warns when two workflow files in a
  repository share a question set.
- The Workflow Wizard writes the workflow file under a name of its own for each
  question set, such as `grill-my-code-lab-3.yml`, so a second set never
  replaces the first set's file.

## [0.2.0]

### Added

- Opening another question closes the tabs opened for the one before, as the
  VS Code extension does. A tab that was open already, or that you have
  edited, pinned, or closed and opened again, stays open.
- Select a question to read it in full, with its code, below the list.
- Opening a question highlights the lines it asks about, in every file it
  shows. Editing a file takes its highlight away.
- A note above the list when the highlighted lines may have moved: the project
  is at another commit than the questions were written for, or a file they
  point into has changes.
- **Next Question** and **Previous Question**, at the top of the tool window
  and in **Tools | GrillMyCode**, step through the questions in the list's
  order.
- Question text wraps to the width of the tool window, so a long question
  can be read without widening it.
- A repository with questions for more than one branch or submission tag:
  **Choose Which Questions to Show** picks which, and the choice is remembered.
  By default the questions follow the branch that is checked out.
- New questions are noticed while the IDE has the focus. The first set loads on
  its own; a newer set is announced and waits until you ask for it, with a dot
  on the tool window's icon until then.
- A project open in safe mode says why no questions show: trust the project.
- When the organization that owns the repository has not approved GrillMyCode
  Companion, the tool window says so, and links to the page on GitHub where you
  can ask for approval.
- The instructor view: an account that can read the assignment's answer key
  sees the key's questions, each with its answer below the list. **Show
  Instructor View** and **Show Student View**, in the tool window's title and
  **Tools | GrillMyCode**, switch between the two, and the choice is
  remembered for the repository. A student's account sees no sign of either.

### Changed

- The Marketplace description lists what the plugin does, and links to the
  student guide on grillmycode.org.
- Each load also asks GitHub for the assignment's answer key. In a student's
  own repository that is one more request, which GitHub refuses.

## [0.1.0-eap.1]

### Added

- Sign in to GitHub from **Tools | GrillMyCode**.
- The **GrillMyCode** tool window lists the questions from your repository's
  questions issue, file by file. Double-click a question to open the code it
  asks about.
