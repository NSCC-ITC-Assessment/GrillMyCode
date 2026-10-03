# VS Code extension — plan

> **Recorded:** 2026-10-03 (`ff56b1d`)
> **Status:** Phase 1 is built, in `extensions/`, and not published. Every
> later phase is a proposal.

GrillMyCode's output is about specific lines of code, and VS Code is where
that code is open. This note records what an extension does with that, how it
sits in this repository, and how it is checked, released and published without
disturbing the action's own pipeline.

---

## Phases at a glance

| Phase | What it adds                                                                                                        | Needs first                                          | Status               |
| ----- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------- |
| 1     | From a question to its code: the questions list, the selected question, the jump to code and the moved-code warning | Nothing                                              | Built, not published |
| 2     | Ready for a class: Marketplace listing, release workflow, questions pinned to lines, "studied" ticks, guides        | The Marketplace publisher and its token              | Not started          |
| 3     | Instructor view: the viva companion and the view switch                                                             | A decision on where marks are stored                 | Not started          |
| 4     | Action changes: hidden data in the issue, and the marker check                                                      | An action release                                    | Not started          |
| 5     | Workflow help                                                                                                       | Nothing                                              | Not started          |
| 6     | Assessed-files preview and local trial runs                                                                         | The action's core extracted from the Actions toolkit | Not started          |

Phases 2 to 5 do not depend on one another and can be taken in another order.
Phase 4 should come before an extension for a second editor is started.

Keep this table current: change a row's status when work on that phase starts
or finishes, and add or reword a row when a phase's scope changes. The detail
for each phase is under [Phases](#phases).

---

## Bottom line

- **One extension, two sides.** Students see their questions beside their
  code. An account that can read the answer key also sees answers and
  instructor tools. GitHub's permissions decide which side appears, not a
  setting.
- **Neither side needs a change to the action to start.** The student side
  reads the issue, and the instructor side reads the instructor repository's
  `questions.json`.
- **It lives in this repository**, in `extensions/vscode/`, with its own
  dependencies, the way `docs-site/` does.
- **It releases on its own tag prefix**, `vscode-v*`, and its own version
  numbers.
- **The last phase needs the action's core extracted** from the Actions
  toolkit. That is the largest piece of work here, and nothing earlier depends
  on it.

---

## The ideas

| #   | Idea                                                                        | Side       | Needs from GrillMyCode                | Phase     |
| --- | --------------------------------------------------------------------------- | ---------- | ------------------------------------- | --------- |
| 1   | Questions in the editor, beside the lines they ask about                    | Student    | Nothing                               | 1 and 2   |
| 2   | Viva companion: questions, answers and the student's code in one window     | Instructor | Nothing                               | 3         |
| 3   | Help writing the workflow: completion, hover text and checks for the inputs | Instructor | `action.yml`, read at build time      | 5         |
| 4   | Assessed-files preview: which files would be assessed, excluded or starter  | Instructor | Shared core                           | 6         |
| 5   | Local trial runs: generate questions for a sample repository, with the cost | Instructor | Shared core, an API key               | 6         |
| 6   | Self-practice: a student generates practice questions before pushing        | Student    | Shared core, a second way to reach AI | Undecided |

Idea 6 is a product question as much as a technical one. The organization's
API key can't be given to students, so it would run on the student's own key
or their Copilot seat, and the questions would differ from the instructor's.

**Set aside:** recording how code was written (large pastes, AI insertions) so
that questions target those regions. It would work, but it is surveillance of
students. If it is ever pursued it should be a separate, opt-in extension.

---

## One extension, two sides

GitHub does not tell an extension "this person is an instructor". It does
tell it what the signed-in account can read. So the extension tries to read
the answer key for the open assignment from the instructor repository. If the
read succeeds, the instructor side switches on. If it fails, the student side
is all there is, and no setting can change that, because the answers were
never downloaded.

The starting view depends on whose repository is open and whether the answer
key can be read:

| Whose repository | Answer key | Opens in                                              |
| ---------------- | ---------- | ----------------------------------------------------- |
| Their own        | Unreadable | Student view. The ordinary student.                   |
| Someone else's   | Readable   | Instructor view. The ordinary instructor.             |
| Their own        | Readable   | Student view, with a switch to instructor view.       |
| Someone else's   | Unreadable | Student view. A teammate, or a helper without access. |

A repository is the account's own when its name ends with the account's
login, the rule the action uses to name the student. The third row is an
instructor who accepted their own assignment, which is the best way to try
everything end to end.

Rules that keep this sound, including for a teaching assistant who is a
student in one course and an instructor in another:

- **The side is decided per repository, each time one is opened.** Nothing is
  remembered for the machine or the account, and the check runs again when the
  signed-in account changes. A window with several folders decides each one
  separately.
- **Student view is the real student side.** It is built from the issue by the
  code a student's install runs, not from the answer key with the answers
  hidden. Otherwise an instructor would be checking something students never
  get.
- **One switch changes the view, and the current view is always shown.** The
  choice is remembered for that repository only. An instructor can drop to
  student view before sharing their screen in a viva.
- **Stored data is kept per repository and per view.** "Studied" ticks and
  viva marks never cross over.
- **Tools that are not about one student's answers follow the repository
  too.** Workflow help, the assessed-files preview and trial runs appear where
  the account administers the open repository.

Two things are per installation and cannot follow the assignment: the release
channel, and the signed-in account.

The alternative was two extensions published separately. One is better
because there is one listing, one release workflow and one set of install
instructions, and because instructors see exactly what students see. Its
costs:

- **Students receive instructor code.** It does nothing without access to an
  answer key, and it is loaded only when that access is found.
- **Instructor features change faster than students should see.** They ship
  on the pre-release channel. See [Versions](#versions).
- **Install size.** Phase 6 pulls the action's pipeline into the package.

**Split it if** the package grows large enough to slow student installs, or if
handling an API key in a tool every student has installed becomes hard to
justify. The code is kept in separate folders per side so a split is a
packaging change, not a rewrite.

---

## Student side

![How the pieces of the student side relate. On GitHub nothing changes: the student pushes, the GrillMyCode action runs, and it posts an issue of questions. In VS Code the extension takes the open folder, signs in to GitHub, finds the questions issue, reads out each question and matches it to lines in the file. The student sees a questions panel, each question pinned to its lines, and a warning when the code has moved on.](student-extension-overview.svg)

The extension reads the issue GrillMyCode already posts and shows each
question beside the code it asks about. It never generates questions and never
reads the instructor repository on a student's behalf.

- **Finding the issue.** It is the open issue labelled `assessment` and titled
  `GrillMyCode Questions (<branch>)` or `GrillMyCode Questions (tag: <pattern>)`
  (`src/delivery/issue.js`). A repository can have several.
- **Trust.** The label, the title and a body that reads as a report are enough
  to tell a GrillMyCode issue from any other. It cannot be made certain, since
  the student can edit the issue, and it does not need to be: the issue holds
  the student's own questions, so a forgery fools only its author. What
  matters is that **the issue text is untrusted** and is escaped before it is
  shown.
- **Sign-in.** VS Code's built-in GitHub sign-in, with the `repo` permission.
  It is broad, but it is the only one GitHub offers for reading a private
  repository this way.
- **Getting it to students.** The instructor lists the extension in the
  template repository's dev container configuration (Codespaces installs it)
  and in its recommended extensions (desktop VS Code prompts). Both need the
  extension on the Marketplace. Until then it is a `.vsix` installed by hand.

Not planned for any phase yet:

- **Re-matching questions after the code is edited.** Searching for the
  snippet text is unreliable, because comments are stripped by default, so the
  snippet often does not match the file. The extension warns and jumps to the
  original lines.
- **Writing answers in the editor.** Where they are kept and who sees them is
  a product decision.
- **The browser editor (github.dev).** It needs another way to read Git state.
  Codespaces behaves like the desktop and is covered.

---

## Instructor side

With a student's repository open, the extension works out the assignment and
the student from the repository name, by the rule the action uses
(`matchSubmissionIdentity` in `src/submission-identity.js`). For
`cs-principles-lab-3-jsmith` in the organization `my-school` it tries to read:

```
my-school/cs-principles-lab-3-grillmycode-instructor/jsmith/data/questions.json
```

A run started by a submission tag files its copy one folder down, in
`jsmith/<tag group>/data/`.

- **Viva companion (phase 3).** `questions.json` already holds every question
  as data, with its snippets, answer and distractors (`buildQuestionsJson` in
  `src/delivery/instructor-repo.js`), so there is no Markdown to read. The
  instructor sees the question list with each answer, jumps to the code, and
  records a mark or a note.
- **Workflow help (phase 5).** Completion, hover text and warnings for the
  action's inputs in a workflow file, generated from `action.yml` when the
  extension is built.
- **Assessed-files preview (phase 6).** Marks each file as assessed, excluded
  or starter code, using `src/stack-detection.js` and `src/files.js`.
- **Local trial runs (phase 6).** Runs the pipeline against a sample
  repository and shows the questions with token use and cost.

Phase 6 reuses the action's modules, which are tied to GitHub Actions today:

- **Eleven modules import `@actions/core`** for logging and inputs. They need
  a logger and a settings object passed in.
- **The comment stripper (`rmcm`) is a Linux x86_64 binary.** The extension
  would need other builds, or would run without stripping and say so.
- **PDF generation needs Chromium.** The extension leaves it out.
- **The action targets Node 24 and later.** The extension runs on the Node
  built into VS Code, so shared code must avoid newer-only features.

---

## Changes to GrillMyCode itself

None so far. Two are planned for phase 4, and the usual rules in `AGENTS.md`
apply to both.

1. **Hidden data in the issue.** A comment in the issue body, in the style of
   the existing `gmc:provenance` comment:

   ```
   <!-- gmc:questions {"version":1,"headSha":"…","questions":[{"number":1,"broader":false,"snippets":[{"file":"src/app.js","start_line":12,"end_line":18}]}]} -->
   ```

   The shape is `questions.json` without the answer, the distractors and the
   code. Its main value is the **version number**: when the report layout
   changes, an older extension can ask to be updated instead of showing
   garbled questions. A test must assert the comment never carries an answer
   or a distractor.

2. **Check that marker before overwriting or deleting.** On each run the
   action overwrites the first open issue with the matching label and title
   and deletes other matches as duplicates (`postIssue`). A person's own issue
   with that title and label would be overwritten or deleted.

---

## Where it lives in the repository

```
extensions/
  fixtures/
    current/                sample issues in today's layout (generated)
  vscode/
    package.json            its own dependencies and lockfile, like docs-site/
    esbuild.js              bundles everything into one file
    src/
      extension.js          start-up
      shared/               parsing, question model, GitHub reads (no VS Code imports)
      student/              panel, jump to code, moved-code warning
      instructor/           phase 3: answer key, marking, later tools
    test/                   unit tests, run by the root test command
    test-host/              the few tests that need a running VS Code
```

- **`shared/` never imports the VS Code API**, so the root `pnpm test` runs
  its tests with no editor present.
- **The fixtures are the contract.** `scripts/build-extension-fixtures.js`
  runs the action's own code, from a model reply to the issue it would post,
  and files the result in `extensions/fixtures/current/`. One test fails when
  those files no longer match what the action writes, and another fails when
  the extension's reader does not get the original questions back. A report
  change that would break the extension then fails in the same pull request.
  `extensions/fixtures/README.md` says what to do when the layout changes.
- **Plain JavaScript, like the rest of the repository.**
- **Phase 6 imports the action's code from `src/` through the bundler**, not
  through a package. `pnpm-workspace.yaml` declares no packages.

`AGENTS.md` carries these rules for contributors, and `extensions/README.md`
has the commands.

### Room for other editors

`extensions/` holds one folder per editor, so a JetBrains plugin could sit
beside `vscode/`. Nothing here commits to one. It would be written in Kotlin
or Java and could share no code, only the format:

- **`extensions/fixtures/`** is what every extension tests its reader against.
- **The hidden data matters more.** Without it each editor's extension carries
  its own copy of the Markdown reader. With it each one only reads JSON.
- **The instructor side is already editor-neutral**, since it reads
  `questions.json`.

Each editor gets its own folder, tag prefix and workflows: `extensions/jetbrains/`,
`jetbrains-v*`, and so on.

---

## CI, release and publishing

### Checks

- **`pr-checks.yml`** covers lint, formatting, the fixtures test and the
  extension's unit tests, because they run from the repository root. It must
  not ignore `extensions/**`.
- **`vscode-extension-checks.yml`** runs for changes under `extensions/`. It
  builds the bundle, runs the `test-host/` tests in a real VS Code, packages a
  `.vsix` and attaches it to the run, on pull requests and on main. Nothing is
  published from main.
- **The image builds skip `extensions/**`**, so extension-only changes build no
  container image.

### How tags are kept apart

Phase 1 changed two workflows so that an extension tag cannot disturb the
action:

- **`branch-build.yml` ignores every tag.** It used to ignore only `v*`, and
  GitHub does not apply path filters to tag pushes, so `vscode-v1.0.0` would
  have built a container image.
- **`release.yml` looks for the previous release among the action's own tags**
  and leaves commits that touch only `extensions/` out of the release notes.

### Releasing (phase 2)

A release is a tag, `vscode-v1.2.0`. A new `vscode-extension-release.yml` runs
on `vscode-v*` tags and:

1. Fails if the tag's version differs from `extensions/vscode/package.json`.
2. Installs, builds and runs every test.
3. Packages the `.vsix`.
4. Publishes it to the Marketplace, as a pre-release if the minor number is
   odd.
5. Creates a GitHub Release with the `.vsix` attached, marked as not the
   latest, with notes from the commits that touched `extensions/vscode/` since
   the previous `vscode-v*` tag.

The release-notes script is inline in `release.yml` today. Move it to
`scripts/`, taking a tag pattern and a path filter, so both release workflows
call one copy.

### Versions

The extension has its own version numbers, starting at `0.x`. The Marketplace
accepts only `major.minor.patch`, so VS Code's convention marks the channel:

- **Even minor** (`1.2.x`): stable. This is what students get.
- **Odd minor** (`1.3.x`): pre-release, for instructors who opt in.

Students' installs update on their own, so a stable release mid-term changes
what every student sees.

What ties the extension to the action is the report format, not the version
number. Most workflows float on `@v0`, so the format changes for everyone on
the day the action is released, while installed extensions update at their own
pace. The extension must therefore read every layout that supported action
versions have produced. The fixtures enforce that, the release notes state the
range ("reads reports from GrillMyCode v0.24 and later"), and the version
number in the hidden data lets an out-of-date extension say so.

### Accounts and secrets

- **A Marketplace publisher** is created by hand, once, with a Microsoft
  account. Its identifier is permanent and becomes part of the extension's
  identifier.
- **A publishing token** is stored as a GitHub secret (`VSCE_PAT`), in a
  protected environment with a required reviewer. It expires, so someone must
  own renewing it.
- **Open VSX** is a second registry, for editors built on VS Code that cannot
  use Microsoft's Marketplace. It is optional and needs its own token.

### Dependencies

Renovate finds `extensions/vscode/package.json` on its own. It is told to
leave `@types/vscode` alone, because the extension will not package when that
is newer than the minimum VS Code version it declares. Raising the minimum is
a deliberate decision, since it drops support for older editors.

### Documentation (phase 2)

- A guide for instructors on adding the extension to an assignment, and a
  short page for students, in the gentle layer of `docs-site/docs/`.
- The slide deck, if what students see changes.
- The docs site's stable version is snapshotted only when the action is
  tagged. Until then a new page is under "Next" and unversioned links to it
  return 404, so the Marketplace listing must not link to it.

---

## Phases

### Phase 1: from a question to its code (built)

Someone opens a repository GrillMyCode has posted questions to, sees the
questions in the editor, and selects one to land on the lines it asks about.
Student side only, read-only, with no change to the action and nothing
published.

What it does:

- **Signs in and finds the issue** for the checked-out branch, with a picker
  when the repository has several.
- **Lists the questions** in a GrillMyCode view in the Activity Bar, grouped by
  file.
- **Shows the selected question in full** under the list, with each snippet as
  it was when the question was written. A list row holds one line, which is
  too short for a question. The page runs no script.
- **Jumps to the code** and highlights the lines.
- **Warns when the code has moved:** the folder is at another commit, or a
  file the questions point into has uncommitted edits.
- **Refreshes** on command.

Details settled while building:

- **The minimum VS Code version is 1.120.**
- **The publisher in `package.json` is a placeholder**, `grillmycode`, which
  is enough for a `.vsix` installed by hand.
- **Answers are read but not shown.** With `include_answers` on, the issue
  carries them. The panel leaves them out until the instructor view exists.
- **A report cut short for length** drops the question the cut landed in, and
  the panel says the last questions are missing.
- **A window with several folders** shows the first that is a clone of a
  GitHub repository.
- **Only GitHub.com is supported**, not GitHub Enterprise Server.

What was checked:

- The repository's tests, lint and formatting, from a copy holding only the
  files git would commit.
- Seven tests inside a real VS Code: the extension starts, finds the
  repository, waits at the sign-in prompt, lists a fixture's questions, opens
  a question at its lines, copes with a range past the end of a file, and
  refuses a path that leaves the repository.
- The panel and the Activity Bar icon, looked at in that VS Code.
- The packaged `.vsix`, installed by hand in a Codespace on 2026-10-03 and
  reported working as described.

What was not checked:

- **The "Run Extension" entry.**
- **`vscode-extension-checks.yml` on GitHub.** Its steps were run locally.
- **Windows and macOS.** Everything above ran on Linux.

### Phase 2: ready for a class

Create the Marketplace publisher, add `vscode-extension-release.yml`, and
publish a pre-release. Write the guides. Try it with one class. It also adds:

- **Questions pinned to lines**, as read-only comment threads beside the code.
  This waited because a pinned note on the wrong lines misleads for as long as
  the file is open, while a jump to the wrong lines is seen once and passed.
  It should follow real use of the moved-code warning.
- **"Studied" ticks**, stored locally, and **refreshing when the window
  regains focus**.

### Phase 3: instructor view

The viva companion, the view switch and the rules in
[One extension, two sides](#one-extension-two-sides). It reuses the question
viewer and adds one read from the instructor repository.

### Phase 4: action changes

The hidden data in the issue and the marker check, in
[Changes to GrillMyCode itself](#changes-to-grillmycode-itself).

### Phase 5: workflow help

Described under [Instructor side](#instructor-side). It needs nothing from the
other phases.

### Phase 6: assessed-files preview and local trial runs

Also under [Instructor side](#instructor-side), with what the action's modules
need first.

---

## Open decisions

- **Publisher identifier and extension name.** Permanent once chosen. Blocks
  phase 2.
- **Who renews the publishing token**, and who approves a publish. Blocks
  phase 2.
- **Whether students may be asked for the `repo` permission.** There is no
  narrower option for private repositories.
- **A release freeze during term** for stable versions.
- **Where viva marks and notes are stored:** locally, or committed to the
  instructor repository.
- **How the extension learns the student's login** when an instructor has the
  repository open. For an instructor it needs the repository's collaborator
  list, as the action does.
- **Whose repository a team assignment's is.** Its name ends in `group-<n>`,
  not a login. If the collaborator list cannot be read, open in instructor
  view when the answer key is readable.
- **How the extension tells that an account administers a repository.** Which
  permission Classroom 50 gives students and instructors has not been checked.
- **Whether self-practice (idea 6) is wanted at all.**
