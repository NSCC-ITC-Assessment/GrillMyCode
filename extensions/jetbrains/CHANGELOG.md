# Changelog

The Marketplace shows a version's section on the listing's "What's New" tab.
Each heading is a version as `gradle.properties` writes it.

## [Unreleased]

### Added

- Select a question to read it in full, with its code, below the list.
- Opening a question highlights the lines it asks about, in every file it
  shows. Editing a file takes its highlight away.
- A note above the list when the highlighted lines may have moved: the project
  is at another commit than the questions were written for, or a file they
  point into has changes.
- **Next Question** and **Previous Question**, at the top of the tool window
  and in **Tools | GrillMyCode**, step through the questions in the list's
  order.

## [0.1.0-eap.1]

### Added

- Sign in to GitHub from **Tools | GrillMyCode**.
- The **GrillMyCode** tool window lists the questions from your repository's
  questions issue, file by file. Double-click a question to open the code it
  asks about.
