# Changelog

What changed in each version of GrillMyCode Companion. A version marked pre-release is installed only if you ask VS Code for pre-release versions.

## 0.4.1, 2026-10-10

- Fixes **Use the open folder**, on the Workflow Wizard's **Files** step, taking a very long time on a folder with thousands of files. It was slowest where the folder is on another machine, as in a codespace.
- The Wizard's file preview no longer reads the files Git ignores, such as build output. They are never committed, so a run never sees them, and the preview says when it has left them out. A folder that is not in a Git repository is read in full, as before.

## 0.4.0, 2026-10-10

The first version every install updates to since 0.2.2. It includes everything the 0.3 pre-releases added, listed under them below: the instructor view, and the checks on a workflow file. New in this version:

- Adds the command **GrillMyCode: Open Workflow Wizard**, which opens GrillMyCode's Workflow Wizard in an editor tab. It is the Wizard from the docs site, with the same steps.
- In the editor, the Wizard's **Files** step can try your patterns on the folder that is open, and its last step creates the workflow file in that folder. It asks before replacing one that is there.

## 0.3.1 (pre-release), 2026-10-09

- Checks the GrillMyCode step of a workflow file as you type. A value the action would reject or ignore is underlined, as are a missing API key, a key written into the file, and inputs that do not fit together, such as submission tags that differ from the tags the workflow runs on.
- Offers the values of an input that has a fixed set. Where the GitHub Actions extension is not installed, it also offers the inputs a step can set and describes each one.
- Adds the setting **Workflow Help: Enabled**, which switches both off.
- Fixes the GrillMyCode view saying no folder was a clone of a GitHub repository when a file was edited in the moment the repository was being found. It stayed that way until **Refresh Questions** was selected.

## 0.3.0 (pre-release), 2026-10-04

- Adds an instructor view. An account that can read an assignment's private answer key sees each question's answer under it, beside the student's code. **Show Student View** and **Show Instructor View** switch between the two. Students see no change.

## 0.2.2, 2026-10-04

- Adds a walkthrough, **Get Started with GrillMyCode Companion**, that VS Code opens when the extension is installed. It covers opening the assignment's folder, signing in to GitHub, where the questions come from, and going from a question to its code.

## 0.2.1, 2026-10-04

- Reads the hidden data that newer versions of GrillMyCode put in the questions issue, so a question opens at the right file and lines whatever the file is called. Issues posted before that are read as they were.
- When the questions were written by a version of GrillMyCode newer than the extension can read, the GrillMyCode view asks you to update the extension, in place of showing questions it might get wrong.

## 0.2.0, 2026-10-03

The first version every install updates to since 0.1.0.

- In a folder open in Restricted Mode, the GrillMyCode view now says that the folder has to be trusted, and links to where you do that. Before, the extension was switched off there and its icon was missing.
- Includes the new name from 0.1.2, GrillMyCode Companion.

## 0.1.2 (pre-release), 2026-10-03

- Renamed to **GrillMyCode Companion**. The view in the Activity Bar and the commands are still called GrillMyCode.

## 0.1.1 (pre-release), 2026-10-03

- No change to what the extension does. Published as a pre-release.

## 0.1.0, 2026-10-03

The first published version.

- Lists the questions GrillMyCode wrote for the repository you have open, grouped by file.
- Opens a question's file and highlights the lines it asks about.
- Shows the selected question in full, with the code as it was when the question was written.
- Warns you when the code has changed since the questions were written.
- Lets you choose which questions to show when the repository has more than one set.
