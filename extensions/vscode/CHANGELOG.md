# Changelog

What changed in each version of GrillMyCode Companion. A version marked pre-release is installed only if you ask VS Code for pre-release versions.

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
