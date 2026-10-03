# VS Code extension — possibilities and integration plan

> **Recorded:** 2026-10-03 (`ff56b1d`)
> **Status:** Proposal only. Nothing is built. The only artifact so far is the
> diagram, `student-extension-overview.svg`, in this folder.

GrillMyCode's output is about specific lines of code, and VS Code is where
that code is open. This note records what an extension could do with that,
how it would sit in this repository, and how it would be checked, released and
published without disturbing the action's own pipeline.

---

## Bottom line

- **One extension, two sides.** Students see their questions beside their
  code. An account that can read the answer key also sees answers and
  instructor tools. GitHub's permissions decide which side appears, not a
  setting.
- **The first release needs no change to the action.** Everything the student
  side needs is already in the issue, and everything the instructor side needs
  is already in the instructor repository's `questions.json`.
- **It lives in this repository**, in `extensions/vscode/` with its own
  dependencies, the same way `docs-site/` does.
- **It releases on its own tag prefix** (`vscode-v*`). Two existing workflows must
  be fixed before the first such tag is pushed, or the tag will build a stray
  container image and truncate the action's next release notes. See
  [Fixes needed first](#fixes-needed-first).
- **Later features need the action's core extracted** from the Actions
  toolkit. That is the largest piece of work here and nothing early depends on
  it.

---

## The possibilities

| #   | Idea                                                                        | Side       | Needs from GrillMyCode                | Size   |
| --- | --------------------------------------------------------------------------- | ---------- | ------------------------------------- | ------ |
| 1   | Questions in the editor, pinned to the lines they ask about                 | Student    | Nothing                               | Small  |
| 2   | Viva companion: questions, answers and the student's code in one window     | Instructor | Nothing                               | Small  |
| 3   | Help writing the workflow: completion, hover text and checks for the inputs | Instructor | `action.yml`, read at build time      | Medium |
| 4   | Assessed-files preview: which files would be assessed, excluded or starter  | Instructor | Shared core                           | Medium |
| 5   | Local trial runs: generate questions for a sample repository, with the cost | Instructor | Shared core, an API key               | Large  |
| 6   | Self-practice: a student generates practice questions before pushing        | Student    | Shared core, a second way to reach AI | Large  |

Idea 6 is also a product question. The organization's API key can't be given
to students, so it would run on the student's own key or their Copilot seat,
and the questions would differ from the ones the instructor sees.

**Set aside:** recording how code was written (large pastes, AI insertions) and
feeding that to GrillMyCode so questions target those regions. It would work,
but it is surveillance of students, with consent and privacy questions of its
own. If it is ever pursued it should be a separate, opt-in extension.

---

## One extension or two

**Recommendation: one extension.** The alternative considered was a student
extension and an instructor extension published separately.

GitHub does not tell an extension "this person is an instructor". What it does
tell it is what the signed-in account can read. So the extension does not ask
who is signed in. It opens the student's questions, then tries to read the
answer key for the same assignment from the instructor repository:

- **The read succeeds:** the account is an instructor for this assignment. The
  same question list gains answers, and the instructor tools appear.
- **The read fails:** the student side is all there is.

A student cannot switch sides by changing a setting, because the answers were
never downloaded: GitHub refused the request.

### A student in one course who is an instructor in another

A teaching assistant is the usual case. The side is decided for each
repository, when it is opened, so nobody chooses a role: the same person sees
answers in the repositories of the course they help teach and only questions
in their own coursework. That holds as long as these rules are kept:

- **The result is never remembered beyond the repository it was found for.**
  There is no "this person is an instructor" flag saved for the machine or the
  account. The check runs again when a folder is opened and when the signed-in
  account changes.
- **A window with several folders open decides each folder separately.**
- **Stored data is kept per repository.** "Studied" ticks, marks and notes for
  one repository never appear in another.
- **Tools that are not about one student's answers follow the repository
  too.** Workflow help, the assessed-files preview and trial runs appear where
  the account administers the open repository, not because the person was an
  instructor somewhere else. They reveal nothing, so they also stay reachable
  from the command list.
- **The view can be switched.** An instructor sharing their screen during a
  viva needs the student view. The switch is described in the next section.

Two things are per installation and cannot follow the assignment:

- **The release channel.** A teaching assistant who opts into pre-release
  versions gets the pre-release student side in their own coursework too.
- **The signed-in account.** Someone with separate student and staff accounts
  has to switch accounts, and the check then runs again.

### An instructor who accepts their own assignment

An instructor can accept their own assignment in Classroom 50 with their own
account. They then have a student repository of their own, named with their
login like any student's, and they can also read the instructor repository.
Both sides apply to the same folder.

The action already treats this as an ordinary submission: it files the answer
key under the instructor's login. It is also the best way to try everything
end to end, and it lets a maintainer test both sides with one account. So the
extension should support it on purpose, not leave it to whichever side
happens to win.

The starting view depends on two facts: whose repository it is, and whether
the answer key can be read.

| Whose repository | Answer key | Opens in                                              |
| ---------------- | ---------- | ----------------------------------------------------- |
| Their own        | Unreadable | Student view. The ordinary student.                   |
| Someone else's   | Readable   | Instructor view. The ordinary instructor.             |
| Their own        | Readable   | Student view, with a switch to instructor view.       |
| Someone else's   | Unreadable | Student view. A teammate, or a helper without access. |

A repository is the account's own when its name ends with the account's
login, which is the rule the action uses to name the student.

Rules for the third row:

- **Student view is the real student side.** It is built from the issue, by
  the same code a student's install runs. It is not the answer key with the
  answers hidden. Otherwise the instructor would be checking something their
  students never get.
- **One switch changes the view, and the current view is always shown**, for
  example in the status bar. Nobody should have to guess which one they are
  looking at.
- **The choice is remembered for that repository only.**
- **Both kinds of stored data can exist for one repository.** "Studied" ticks
  from student view and marks from instructor view are kept apart.
- **Tools that are not about answers are unaffected by the view.**

The same switch serves the second row: an instructor in a student's
repository can drop to student view before sharing their screen.

The first-run guide suggests a different route, a separate test student
account. That needs nothing special. The test account cannot read the answer
key, so it gets the plain student side.

Why one is better than two here:

- One Marketplace listing, one release workflow, one version to support and
  one set of install instructions.
- Instructors see exactly what students see, in the same tool.
- The question viewer is shared code either way. In one extension it needs no
  packaging of its own.

What it costs, and the answer to each:

- **Students receive instructor code.** It does nothing without access to an
  answer key. Instructor modules are loaded only when that access is found, so
  a fault in them cannot break the student side.
- **Instructor features change faster than students should see changes.**
  Instructor work ships on the Marketplace's pre-release channel, which
  instructors opt into. Students stay on stable. See
  [Versions and channels](#versions-and-channels).
- **Install size.** Ideas 4 to 6 pull the action's pipeline and its document
  readers into the package. This is the point to reconsider.

**Split it if** the package grows large enough to slow student installs, or if
handling an API key in a tool every student has installed becomes hard to
justify. The code should be kept in separate `student/` and `instructor/`
folders from the start so a split is a packaging change, not a rewrite.

---

## Student side

![How the pieces of the student side relate. On GitHub nothing changes: the student pushes, the GrillMyCode action runs, and it posts an issue of questions. In VS Code the extension takes the open folder, signs in to GitHub, finds the questions issue, reads out each question and matches it to lines in the file. The student sees a questions panel, each question pinned to its lines, and a warning when the code has moved on.](student-extension-overview.svg)

### What it does

The extension reads the issue GrillMyCode already posts and shows each
question beside the code it asks about. It never generates questions and never
reads the instructor repository on a student's behalf.

### What can be built now

All of this works from the issue as it is today:

- **Finding the issue.** The repository comes from the open folder's Git
  remote. The issue is the open one labelled `assessment` whose title is
  `GrillMyCode Questions (<branch>)` or `GrillMyCode Questions (tag: <pattern>)`
  (`src/delivery/issue.js`). A repository can have several, one per branch and
  one per tag pattern, so the extension matches the current branch and offers
  a picker otherwise.
- **Reading the questions.** Each question is a fixed block: a `Question N:`
  label, a caption giving the file and line range, the code, then the question
  (`renderQuestions` in `src/postprocess.js`). The line numbers are the file's
  own. The header gives the reviewed commit and the files assessed.
- **Questions panel.** A side-bar list grouped by file, with the broader
  questions in their own group.
- **Jump to code.** Selecting a question opens the file and highlights the
  lines.
- **Questions pinned to lines.** Each question shows as a read-only comment
  thread beside its code, the mechanism pull request reviews use.
- **Moved-code warning.** Shown when the folder is at a different commit from
  the reviewed one, or an assessed file has uncommitted edits.
- **Refresh.** A command, plus a check when the window regains focus, so new
  questions appear after a push.
- **"Studied" ticks.** A checkbox per question, stored locally by VS Code.

### What to hold back

- **Re-matching questions after the code is edited.** Line numbers go stale,
  and searching for the snippet text is unreliable because comments are
  stripped by default (`keep_comments` is `false`), so the snippet often does
  not match the file character for character. The first release warns and
  still jumps to the original lines.
- **Writing answers in the editor.** Where answers are kept and whether
  instructors see them is a product decision, not a technical one.
- **The browser editor (github.dev).** It needs a different way to read Git
  state. Codespaces behaves like the desktop and is covered.

### Telling a GrillMyCode issue from any other

The label, the exact title and a body that parses as a report are three
checks, and an issue passing all three by accident is very unlikely. That is
enough for a first release.

It cannot be made certain. The student has write access to their repository
and can edit the issue or create a convincing copy, including any marker we
add. This does not matter: the issue holds the student's own study questions,
with no answers and no grades, so a forgery fools only its author.

What does matter is that **the issue text is untrusted**. Anyone with write
access can edit it. The extension must render it as plain Markdown with raw
HTML and command links switched off, which is VS Code's default.

### Sign-in

The extension uses VS Code's built-in GitHub sign-in. Reading issues in a
private repository requires the `repo` permission, which is broad, but it is
the only one GitHub offers for private repositories through this sign-in.

### Getting it to students

Both are files the instructor adds to the assignment's template repository:

- **Codespaces:** list the extension in the dev container configuration. It
  installs automatically.
- **Desktop:** list it in the repository's recommended extensions. VS Code
  prompts the student to install it.

Both need the extension to be published on the Marketplace. Before that,
students would have to install a `.vsix` file by hand.

---

## Instructor side

### How an instructor is recognized

With a student's repository open, the extension works out the assignment and
the student from the repository name, by the same rule the action uses
(`matchSubmissionIdentity` in `src/submission-identity.js`, a pure function
that can be reused as it is). For the fictional repository
`cs-principles-lab-3-jsmith` in the organization `my-school`, it then tries to
read:

```
my-school/cs-principles-lab-3-grillmycode-instructor/jsmith/data/questions.json
```

A run started by a submission tag files its copy one folder down, in
`jsmith/<tag group>/data/`. If the read succeeds, the instructor side switches
on.

### Viva companion (idea 2)

This is the first instructor feature, and it needs nothing new from the
action. `questions.json` already holds every question as data: its number, its
snippets with file and line range, the answer, the distractors, and the
questions that were dropped (`buildQuestionsJson` in
`src/delivery/instructor-repo.js`). There is no Markdown to parse.

The instructor sees the student's question list with the answer under each
question, selects a question to jump to the code, and can record a mark or a
note. Where marks are stored is an open decision.

### Later tools

- **Workflow help (idea 3).** Completion, hover text and warnings for the
  action's inputs when editing a workflow file. The input list is generated
  from `action.yml` when the extension is built, so it cannot drift. The
  Workflow Wizard could be offered in a panel from the same data.
- **Assessed-files preview (idea 4).** Marks each file in the Explorer as
  assessed, excluded or starter code, using `src/stack-detection.js` and
  `src/files.js`. Exclude patterns are the setting instructors most often get
  wrong without feedback.
- **Local trial runs (idea 5).** Runs the pipeline against a sample repository
  and shows the questions with token use and cost, so an instructor can try a
  model before a class does.

Where these tools appear is decided for each repository, as set out in
[A student in one course who is an instructor in another](#a-student-in-one-course-who-is-an-instructor-in-another).
Hiding them elsewhere is for tidiness, not security.

### What ideas 4 and 5 need from the codebase

They reuse the action's modules, and those modules are tied to GitHub Actions
today:

- **Eleven modules import `@actions/core`** for logging and inputs, including
  `src/ai.js`, `src/files.js`, `src/inputs.js` and `src/stack-detection.js`.
  They need a logger and a settings object passed in. The action passes the
  toolkit's; the extension passes its own.
- **The comment stripper (`rmcm`) is a Linux x86_64 binary** downloaded in the
  `Dockerfile`. The extension would need builds for other platforms, or would
  run without stripping and say so.
- **PDF generation needs Chromium.** The extension leaves it out.
- **The action is written for Node 24 and later.** The extension runs on the
  Node version built into VS Code, so the shared code must be bundled and kept
  clear of newer-only features.

---

## Changes to GrillMyCode itself

None are required for the first release. Three are worth making later.

1. **Hidden data in the issue.** Add a comment to the issue body in the style
   of the existing `gmc:provenance` comment in the raw output file:

   ```
   <!-- gmc:questions {"version":1,"headSha":"…","questions":[{"number":1,"broader":false,"snippets":[{"file":"src/app.js","start_line":12,"end_line":18}]}]} -->
   ```

   The shape is `questions.json` without the answer, the distractors and the
   code. Its main value is the **version number**: when the report layout
   changes, an older extension can ask to be updated instead of showing
   garbled questions. It also removes the dependence on the title wording and
   on parsing Markdown. A test must assert the comment never carries an answer
   or a distractor, since this would be a new path for one to reach a student.

2. **Check that marker before overwriting or deleting.** On each run the
   action overwrites the first open issue with the matching label and title
   and deletes any other matches as duplicates (`postIssue`). A person's own
   issue with that exact title and label would be overwritten or deleted. This
   has not been reported, but the marker would close it.

3. **Extract the shared core**, as described above, when ideas 4 and 5 are
   started.

Changes 1 and 2 alter the action, so the usual rules in `AGENTS.md` apply.

---

## Where it lives in the repository

```
extensions/
  fixtures/                 sample reports and the questions each should yield
  vscode/
    package.json            its own dependencies and lockfile, like docs-site/
    esbuild.js              bundles everything into one file
    src/
      extension.js          start-up: sign-in, commands, which side to show
      shared/               parsing, question model, GitHub reads (no VS Code imports)
      student/              panel, comment threads, moved-code warning
      instructor/           answer key, marking, later tools (loaded on demand)
    test/                   unit tests, run by the root test command
    test-host/              the few tests that need a running VS Code
```

The `extensions/` folder holds one subfolder per editor, so an extension for
another one, such as a JetBrains plugin, can sit beside `vscode/` later. See
[Room for other editors](#room-for-other-editors).

Rules that make this work:

- **`shared/` never imports the VS Code API.** That lets the root `pnpm test`
  run its tests with no editor present.
- **The format is checked by a round-trip test in the root `test/` folder.**
  It builds a report with the action's own `formatReport` and
  `renderQuestions`, passes it through `neutraliseIssueAutoLinks` as the issue
  delivery does, parses it with the extension's parser, and asserts the
  questions match. A change to the report that would break the extension then
  fails in the same pull request. Past report layouts are kept as files in
  `extensions/fixtures/`, using the fictional names from `AGENTS.md`.
- **Plain JavaScript, like the rest of the repository.** The root test can
  then import the parser without a build step.
- **Shared code is imported from `../src` by the bundler**, not through a
  package. `pnpm-workspace.yaml` holds only pnpm settings and declares no
  packages. Move to workspace packages only if a third consumer appears.

Existing files that need a change:

| File                                  | Change                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `eslint.config.js`                    | Add a block for `extensions/vscode/**` and include it in `pnpm lint`         |
| `.prettierignore`                     | Ignore `extensions/vscode/dist/`                                             |
| `.github/workflows/branch-build.yml`  | Ignore `extensions/**` paths and all tags                                    |
| `.github/workflows/staging-build.yml` | Ignore `extensions/**` paths                                                 |
| `.github/workflows/release.yml`       | Limit the previous-tag search and the notes to the action. See below         |
| `renovate.json`                       | Stop automatic updates of `@types/vscode`. See [Dependencies](#dependencies) |
| `.vscode/launch.json`                 | Add a "Run Extension" entry pointing at `extensions/vscode/`                 |
| `AGENTS.md`                           | Add the rules in this section                                                |

`pr-checks.yml` should **not** ignore `extensions/**`: the round-trip test and
the extension's unit tests run there.

---

## Room for other editors

Nothing here commits to a second extension. The layout only avoids blocking
one.

A JetBrains plugin is written in Kotlin or Java, so it could not reuse the VS
Code extension's JavaScript. What the two would share is the **format**, not
code:

- **`extensions/fixtures/` is the shared contract.** Each fixture is a report
  as GrillMyCode posts it, paired with the questions an extension should read
  from it. The root round-trip test keeps the fixtures true to the action, and
  every extension, in whatever language, tests its reader against the same
  files.
- **The hidden data matters more.** Reading the issue's Markdown means every
  editor's extension carries its own copy of the parser. With the
  `gmc:questions` comment in place, each one only has to read JSON. That
  change is optional for VS Code alone and should come before a second
  extension is started.
- **The instructor side is already editor-neutral**, since it reads
  `questions.json`.

Each editor gets its own subfolder, tag prefix, checks workflow and release
workflow, following the same pattern: `extensions/jetbrains/`,
`jetbrains-v*`, and so on. The workflow fixes in
[Fixes needed first](#fixes-needed-first) are written to cover any prefix, so
they are done once.

---

## CI, release and publishing

### Checks on pull requests

- **Existing `pr-checks.yml`** covers lint, formatting, the unit tests in
  `extensions/vscode/test/` and the round-trip test, because they all run from the
  root.
- **A new `vscode-extension-checks.yml`**, limited to pull requests touching
  `extensions/vscode/**` or `extensions/fixtures/**`, builds the bundle, runs the `test-host/` tests in a real VS
  Code (under `xvfb` on Linux), packages a `.vsix` and attaches it to the run.
  A reviewer can install that file to try the change.

### Builds from main

The action publishes a `:next` image on every merge to main. The equivalent
here is the same `.vsix` attached to the workflow run on main. Nothing is
published to the Marketplace from main.

### Fixes needed first

These must land **before the first `vscode-v*` tag is pushed**:

1. **`branch-build.yml` would build a container image for the tag.** It
   ignores only `v*` tags, and GitHub does not apply path filters to tag
   pushes, so `vscode-v1.0.0` would produce an image named
   `branch-vscode-v1.0.0`. Make it ignore all tags, since `release.yml` is the
   only workflow that should act on one. A later prefix for another editor
   then needs no further change.
2. **`release.yml` would truncate the action's next release notes.** It finds
   the previous release with `git describe --tags --abbrev=0`, which returns
   the nearest tag of any name. After an extension release that is the
   extension's tag. Restrict it with `--match "v[0-9]*"`.
3. **The action's release notes would list extension commits.** The notes are
   built from every commit in the range. Exclude the `extensions/` path from
   that `git log`.

### Releasing

A release is a tag, as it is for the action:

```
vscode-v1.2.0
```

A new `vscode-extension-release.yml` runs on `vscode-v*` tags and:

1. Fails if the tag's version differs from the one in
   `extensions/vscode/package.json`.
2. Installs, builds and runs every test.
3. Packages the `.vsix`.
4. Publishes it to the Marketplace, as a pre-release if the minor number is
   odd.
5. Creates a GitHub Release with the `.vsix` attached and notes built from
   the commits that touched `extensions/vscode/` since the previous `vscode-v*`
   tag. The
   release is marked as not the latest, so the repository's "Latest release"
   stays on the action.

To avoid two copies of the release-notes logic, move the script that is inline
in `release.yml` to `scripts/`, taking a tag pattern and a path filter. Both
release workflows call it.

Commits use a scope, for example `feat(vscode): …`, so they read clearly in
the history. The notes are filtered by path, not by scope, so a mislabelled
commit still lands in the right notes.

### Versions and channels

The Marketplace accepts only `major.minor.patch`, with no pre-release
suffixes. VS Code's convention, which the release workflow follows:

- **Even minor** (`1.2.x`): stable. This is what students get.
- **Odd minor** (`1.3.x`): pre-release. Instructors who want new tools early
  switch to the pre-release channel on the extension's page.

Students' installs update on their own, so a stable release mid-term changes
what every student sees. Treat stable releases during a term the way action
releases are treated.

### Versioning

What ties the two together is the report format. The extension's release
notes and Marketplace page state the range it reads, for example "reads
reports from GrillMyCode v0.24 and later", and the version number in the
hidden data lets an out-of-date extension say so.

The extension starts at its own `0.x`, to signal the same early stage as the
action.

### Working with every action version in use

Most workflows pin `@v0`, so the issue format changes for everyone on the day
the action is released, while installed extensions update at their own pace.
The extension must therefore read every report layout that supported action
versions have produced, not only the newest. The fixtures in the round-trip
test are how that is enforced, and the version number in the hidden data is
how an out-of-date extension finds out.

### Accounts and secrets

- **A Marketplace publisher** has to be created by hand, once, with a
  Microsoft account. Its identifier is permanent and becomes part of the
  extension's identifier, so choose it deliberately.
- **A publishing token** is stored as a GitHub secret (`VSCE_PAT`). These
  tokens expire, so someone must own renewing it. Put it in a protected
  environment with a required reviewer, so every publish waits for approval.
- **Open VSX** is a second registry used by editors built on VS Code that
  cannot use Microsoft's Marketplace. Publishing there is optional and needs
  its own token. Codespaces and desktop VS Code do not need it.

### Dependencies

Renovate will find `extensions/vscode/package.json` on its own. One rule is needed:
the packaging tool refuses to build when `@types/vscode` is newer than the
minimum VS Code version the extension declares, so Renovate must not raise it
automatically. Raising the minimum version is a deliberate decision, because
it drops support for older editors.

pnpm's dependency layout is not understood by the packaging tool. This is
harmless because everything is bundled into one file, and the tool is told to
skip its dependency check.

### Documentation

- A guide for instructors on adding the extension to an assignment, and a
  short page students can be pointed to, both in the gentle layer of
  `docs-site/docs/`.
- If what students see changes, the slide deck needs updating too.
- **Timing:** the docs site's stable version is snapshotted only when the
  action is tagged. A page added for an extension release appears under
  "Next" until then, and unversioned links to it return 404. The Marketplace
  listing must not link to a page until an action release has snapshotted it.

---

## Suggested order

1. **Prerequisites, no code:** create the Marketplace publisher, decide who
   owns the token, and settle the open decisions below.
2. **Workflow fixes** from [Fixes needed first](#fixes-needed-first). They are
   safe to merge on their own.
3. **Student side**, with the round-trip test and
   `vscode-extension-checks.yml`.
   Release as a pre-release and try it with one class.
4. **Viva companion.** It reuses the question viewer and adds one read from
   the instructor repository.
5. **Hidden data in the issue** and the marker check in the action.
6. **Workflow help.**
7. **Shared core extraction**, then the assessed-files preview and local
   trial runs.

---

## Open decisions

- **Publisher identifier and extension name.** Permanent once chosen.
- **Who renews the publishing token**, and who approves a publish.
- **Whether students may be asked for the `repo` permission.** There is no
  narrower option for private repositories.
- **How the extension learns the student's login** when an instructor has the
  repository open. For a student it is the signed-in account. For an
  instructor it needs the repository's collaborator list, as the action does.
- **Where viva marks and notes are stored:** locally, or committed to the
  instructor repository.
- **Whether self-practice (idea 6) is wanted at all**, given the questions
  would differ from the instructor's.
- **Whose repository a team assignment's is.** Its name ends in `group-<n>`,
  not a login, so "their own" has to come from the collaborator list. If that
  cannot be read, open in instructor view when the answer key is readable.
- **How the extension tells that an account administers a repository.**
  GitHub reports the account's permission on it, but which permission
  Classroom 50 gives students and instructors has not been checked.
- **A release freeze during term** for stable versions.
