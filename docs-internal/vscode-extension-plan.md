# VS Code extension — plan

> **Recorded:** 2026-10-03 (`ff56b1d`), shortened on 2026-10-04. The long
> version, with what was tried and how, is this file at `10791ec`.
> **Status:** Phases 1 and 4 and the first-run walkthrough are released.
> Phase 2 is under way. Phases 3, 5 and 7 are in 0.4.0, the next stable
> release, which is prepared and not tagged. Phase 3 is without marking, and
> parts of all three go out without having been seen working. Phase 6 is a
> proposal.

GrillMyCode Companion (`GrillMyCode.grillmycode`) shows the questions the
action posts beside the code they ask about. It lives in `extensions/vscode/`
and releases on its own `vscode-v*` tags. This note says what is left to do
and gives one line to each thing that is done. The commands and the release
steps are in `extensions/README.md`, and the rules for contributors are in
`AGENTS.md`.

![The student side: the action posts an issue of questions, and the extension finds it, reads each question and matches it to lines in the open folder.](student-extension-overview.svg)

---

## Phases at a glance

| Phase | What it adds                                                                                                        | Needs first                                              | Status                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1     | From a question to its code: the questions list, the selected question, the jump to code and the moved-code warning | Nothing                                                  | Published                                                                                                            |
| 2     | Ready for a class: publishing, guides and a stable release, then questions pinned to lines and "studied" ticks      | Nothing                                                  | In progress: 0.2.2 is the stable release until 0.4.0 is tagged; two hand checks, the token and the features are left |
| 3     | Instructor view: answers beside the student's code, and the view switch                                             | Nothing                                                  | In 0.4.0, stable, not tagged. Marks and notes, and a real viva, are left                                             |
| 4     | Action changes: hidden data in the issue, and the marker check                                                      | An action release                                        | Released: the action in v0.25.0, the extension in 0.2.1                                                              |
| 5     | Workflow help: the action's inputs checked, offered and described in a workflow file                                | A look at what the GitHub Actions extension already does | In 0.4.0, stable, not tagged. A look beside the GitHub Actions extension is left                                     |
| 6     | Assessed-files preview and local trial runs                                                                         | The action's core extracted from the Actions toolkit     | Not started                                                                                                          |
| 7     | The Workflow Wizard in an editor tab: the docs site's own, reading the open folder and writing the workflow file    | Nothing                                                  | In 0.4.0, stable, not tagged. A pass by hand is left                                                                 |

Phases 2, 3, 5 and 7 do not depend on one another. The suggested order for what
remains is 2, 6. Keep this table current when a phase starts, finishes
or changes scope.

---

## Done

- **Phase 1**, published on 2026-10-03: sign-in, the questions list, the
  selected question in full, the jump to code and the moved-code warning.
- **Phase 2, so far:** the Marketplace publisher, the release workflow, the
  name, two guides and a reference page, both install routes tried, a message
  in Restricted Mode, and the stable release 0.2.0.
- **Phase 4**, released on 2026-10-04: the issue carries a `gmc:questions`
  comment with a layout version, the action touches only issues it wrote, and
  the extension reads both layouts and asks for an update when the version is
  newer than it knows.
- **Phase 3**, released as the pre-release 0.3.0 on 2026-10-04: an account
  that can read the answer key sees each question's answer, and can
  switch to the student view. How the view is chosen is in the docs site's
  `reference/vscode-extension.md`.
- **The first-run walkthrough**, released in 0.2.2 on 2026-10-04, outside the
  phases. It is a patch number because 0.3.0 would have been a pre-release.
- **Phase 5**, released as the pre-release 0.3.1 on 2026-10-09: in a workflow file, the
  GrillMyCode step's inputs are checked as they are typed, and the values of
  an input with a fixed set are offered. What is checked is in the docs
  site's `reference/vscode-extension.md`.
- **Phase 7**, built on 2026-10-10 and first released in 0.4.0: **Open Workflow Wizard**
  shows the docs site's Wizard in an editor tab. Its file preview reads the
  open folder, and its last step writes the workflow file. How it works is in
  the docs site's `reference/vscode-extension.md`.
- **0.4.0**, prepared on 2026-10-10 and not tagged: the first stable release
  since 0.2.2. It takes phases 3, 5 and 7 to every install. It was decided
  that day to release them as they are, with what is listed under "Built but
  never seen working" below still unseen, and to look afterwards.
- **Tags kept apart:** `release.yml` runs on `v[0-9]*` and `branch-build.yml`
  ignores every tag, so a `vscode-v*` tag cannot release the action.
- **Releases:** the workflow has published 0.1.1, 0.1.2, 0.3.0 and 0.3.1 as
  pre-releases, and 0.2.0, 0.2.1 and 0.2.2 as stable. 0.1.0 was published by hand, and is
  stable although its minor number is odd.

Built but never seen working. 0.4.0 carries every one of these to every
install:

- **An issue from before `v0.25.0` updated in place** on GitHub, not left
  beside a new one. Tests cover it against a stand-in.
- **The update message in an installed copy**, where it should offer
  **Update**. A development copy offers **Install**.
- **The "Run Extension" launch entry.**
- **The instructor view against GitHub.** The tests hand it an answer key, and
  it was looked at in VS Code 1.140.0 on Linux that way. Nobody has signed in
  and opened a student's repository. That pass shows whether an instructor's
  account may list a repository's direct collaborators, which the view needs
  in anyone's repository but the account's own.
- **The two switch buttons in the view's title bar.** Both commands were run
  by name. The buttons show only under a pointer, which the test display
  lacks.
- **Workflow help beside the GitHub Actions extension.** The tests run with
  that extension absent. With it installed, input names, hover text and
  unknown inputs are left to it, and nobody has looked at the two together,
  signed in or not.
- **Workflow help by hand.** The tests ask VS Code for the problems, the
  completions and the hover text. Nobody has typed in a workflow file and
  watched them appear.
- **The Wizard's prompts.** The folder dialog, the choice between several
  open folders and the question before a file is replaced are answered by the
  tests in place of a person. Nobody has seen one.
- **The Wizard with no folder open, or several.** With none, the workflow
  should open as an unsaved file. The tests run with one folder open.
- **The Wizard on Windows and macOS, by hand.** Every step was worked in a
  real tab on Linux, in a dark and a light theme, by a script: all ten steps,
  the open folder read, the file written and found clean by workflow help.
  The other two systems have only the tests, which do not press its buttons.
- **The Wizard on a large folder.** The page asks for each file's first bytes
  one at a time, up to 5,000 files. The largest folder read had three.

---

## Phase 2: what is left

To be ready for a class:

1. **One install by hand on Windows**, with a GitHub sign-in, which the tests
   never do. Look at the listing's page in a browser in the same sitting.
2. **A replacement for the publishing token** before 2026-12-01. See
   [Accounts and secrets](#accounts-and-secrets).
3. **One pass as a student**, from a template repository that lists the
   extension: accept the assignment with a test account, then follow the
   student guide in a codespace and in desktop VS Code. It also shows whether
   the walkthrough opens after each kind of install and after an update to
   0.2.2, and whether its steps are ticked.

Features:

- **Questions pinned to lines**, as read-only comment threads. A pinned note
  on the wrong lines misleads for as long as the file is open, so this follows
  real use of the moved-code warning. Weigh "the code as it was", under
  [Further ideas](#further-ideas), first.
- **"Studied" ticks**, stored locally.
- **Refreshing when the window regains focus.**

No trial with a class is planned. It was dropped on 2026-10-04.

---

## Accounts and secrets

- **The publisher is `GrillMyCode`.** Verification of `grillmycode.org`, which
  earns the verified badge, was requested on 2026-10-03.
- **Publishing uses the `VSCE_PAT` secret, which stops working on
  2026-12-01.** Azure DevOps retires those tokens then.
- **The `vscode-marketplace` environment has no required reviewer**, so a tag
  publishes as soon as the tests pass.

**A Microsoft Entra identity is the replacement that can be set up today.**
The workflow already uses one whenever the environment names it, ahead of the
secret. The account steps are due by 2026-11-02. They need a tenant in which
an application can be registered, and no Azure subscription.

1. Register an application in the tenant. It needs no secret and no role.
2. Give it a federated credential for GitHub Actions, with the issuer
   `https://token.actions.githubusercontent.com` and the subject
   `repo:NSCC-ITC-Assessment/GrillMyCode:environment:vscode-marketplace`.
   Entra compares the subject letter for letter, capitals included.
3. On the `vscode-marketplace` environment, set the variables
   `AZURE_CLIENT_ID` and `AZURE_TENANT_ID`. Neither is a secret.
4. Run **VS Code Extension Publisher Check**. It prints the ID the
   Marketplace knows the identity by, then fails, because the identity is not
   a member of the publisher yet.
5. On the publisher's page, add that ID as a member with the Contributor role.
6. Run the check again. When it passes, delete the `VSCE_PAT` secret.

Do steps 3 to 6 in one sitting, with no tag pushed in between. This route has
not been tried end to end.

**Trusted publishing is simpler and is not open yet.** On 2026-10-03 the
Marketplace answered "Trusted Publishing is not supported", and the stable
packaging tool (4.0.0) sent the request in a form it rejects. The publisher
check reports the Marketplace's answer on every run. When it opens: raise
`@vscode/vsce`, add a policy naming this repository and
`vscode-extension-release.yml`, and delete the secret or the two variables.

---

## Rules that outlast the phases

- **Even minor numbers are stable, odd ones are pre-releases.** Students'
  installs update on their own, so a stable release mid-term changes what
  every student sees. A version number can be published only once, so a
  fault found in 0.4.0 is fixed by 0.4.1, not by taking 0.4.0 back.
- **The report format ties the extension to the action, not the version
  number.** Most workflows float on `@v0`, so a layout change reaches every
  repository on the day the action is released, while installs update at
  their own pace. The extension must read every layout a supported action
  version has written. The fixtures enforce that.
- **A new listing screenshot** has to be on the deployed docs site before the
  tag is pushed, and cropped again for the walkthrough's image.
- **A new docs page is under "Next" until the action is tagged**, so the
  listing must not link to it before then.
- **One extension serves both sides.** Split it in two if the package slows
  student installs, or if handling an API key in a tool every student has
  becomes hard to justify. The code is kept in a folder per side, so a split
  is a packaging change.
- **The extension's input list is generated**, by
  `scripts/build-extension-action-inputs.js`, and every check follows what
  `src/inputs.js` does with the value. `test/extension-action-inputs.test.js`
  fails when the list is stale, and when a check fires on a workflow the docs
  show.
- **The extension knows the inputs of the action as it was at the
  extension's release.** An older extension reports a new input as unknown,
  so that check is a warning that says to update, never an error.
- **A student's copy shows no sign of the instructor view.** The two switch
  commands appear nowhere unless an answer key was read, and
  `test/manifest.test.js` guards it.
- **The answer key's format is part of the contract.** Each fixture carries
  the `questions.json` its run files, and the extension keeps its own copy of
  the action's rules for where that file is. `test/extension-fixtures.test.js`
  fails when either drifts.
- **The extension must not depend on VS Code's Git extension**, which is off
  in Restricted Mode. `test/manifest.test.js` guards it.
- **There is one Workflow Wizard.** The extension bundles
  `docs-site/docs/_workflow-wizard/` where it stands, and what only the editor
  can do reaches a step through the Wizard's optional `host`. Nothing is
  copied. `test/extension-wizard.test.js` fails when the Wizard uses a
  package, a static file or a colour the extension does not supply.
- **An extension release carries main's Wizard and main's inputs.** Release
  the action first when an input has changed since the last `v*` tag, or the
  Wizard writes an input the released action lacks. The Wizard on the docs
  site can be newer than the one in an installed extension.
- **One page runs a script: the Wizard's.** The Selected Question view never
  does, because it shows issue text. Nothing from an issue or an answer key is
  sent to the Wizard's page, its content security policy names the one address
  it may reach, and it is given files only from a folder the instructor
  chose.

---

## Phases still to come

### Phase 3: what is left

- **The tag.** 0.4.0 is the stable release that carries the view to every
  install. A student's copy shows no sign of it.
- **A sign-in against GitHub**, soon after the tag. It is under
  [Done](#done), as built but never seen working. Of everything in 0.4.0 it
  matters most: every student's copy now asks GitHub about an answer key each
  time it loads, and only the tests have seen GitHub refuse.
- **Marks and notes per question.** Left out on 2026-10-04, until where they
  are stored is decided.
- **A real viva.** The phase is done when an instructor runs one from the
  student's repository without leaving the editor, and a student account on
  the same repository sees no sign of the instructor view.

Settled while building:

- **The student is found from the repository's direct collaborators**, as the
  action finds them, except in the account's own repository, where the login
  is the student and nothing is listed. An account that may not list them
  gets the student view.
- **A team repository is nobody's own.** An account that can read its answer
  key starts in the instructor view.
- **Any account that can read the answer key gets the switch**, not only one
  in its own repository.
- **Distractors are not shown.** They are written for the quiz, and a spoken
  check has no use for them. The reader still keeps them.
- **The answer key and the issue are compared by each question's number and
  lines.** When they differ the view says so, and makes no moved-code claim.

### Phase 5: what is left

- **The tag.** 0.4.0 is the stable release that carries it. From then a
  student's copy starts when any YAML file is opened, and checks a workflow
  file if the repository has one.
- **A look at it beside the GitHub Actions extension**, and one pass by hand.
  Both are under [Done](#done), as built but never seen working.

Settled while building:

- **What the GitHub Actions extension already does is left to it.** It
  offers and describes every action's inputs, and reports one the action
  does not declare, from the `action.yml` it fetches. Where it is installed,
  this extension does none of the three. It does not report a missing
  `api_key`, because `action.yml` gives that input an empty default.
- **Checks on values and between inputs are built either way**, with the
  values of an input that has a fixed set.
- **The file is read with the `yaml` package**, which GitHub's own workflow
  parser uses, so a value is read as the action receives it.
- **A value GitHub works out at run time is not checked.**
- **Exclude patterns and stack templates are not checked.** Their rules are
  in `src/file-selection.js`, which the extension does not carry yet. Phase 6
  brings it in.
- **Students get it too**, in a repository that holds the workflow. One
  setting switches it off.

Left out:

- **Quick fixes**, such as replacing a misspelled input with the one meant.
- **The Workflow Wizard in the editor.** It became phase 7.

### Phase 7: what is left

- **The tag.** The version is set to 0.4.0, a stable release, and the tag is
  not pushed. The package grows from about 100 KB to about 240 KB, most of it
  React, which every student's install downloads.
- **A pass by hand**, with the prompts, with no folder open and on Windows or
  macOS. All are under [Done](#done), as built but never seen working.

Settled while building:

- **The Wizard is bundled, not rebuilt.** A second Wizard made of VS Code's
  own pickers would have to follow every change to the first.
- **The editor's colours, through the docs site's variables.** The Wizard's
  stylesheet is used as it is, and each `--ifm-` variable is given the
  editor's value, so it follows the colour theme.
- **The Wizard walks the folder itself.** The page asks the extension for one
  folder's entries at a time, in the shape a browser's folder picker gives,
  so the rules for which folders are skipped and where the walk stops stay in
  the Wizard's `readFolder.js`.
- **The folder is read as it is on disk**, as on the docs site, not as Git
  tracks it.
- **The workflow file is replaced as an edit**, after asking, so it can be
  undone.
- **Everyone has the command**, students included. The Wizard is public on
  the docs site.
- **The Wizard is not on a menu or in the GrillMyCode view.** It is in the
  Command Palette alone, until there is somewhere for instructor tools to
  live.

Left out:

- **Opening an existing workflow in the Wizard.** It is under
  [Further ideas](#further-ideas).
- **Only the files Git tracks**, in the file preview. A file Git ignores is
  listed, which a run never sees.
- **Bringing the tab back** after VS Code restarts. Its answers are lost when
  it closes.

### Phase 6: assessed-files preview and local trial runs

Marks each file as assessed, excluded or starter code, and runs the pipeline
against a sample repository to show the questions with token use and cost.

- **Needs first:** the action's core separated from the Actions toolkit.
  Eleven modules import `@actions/core` and need a logger and a settings
  object passed in. It changes no behaviour and can be released on its own.
- **Also needs:** VS Code's secret storage for the API key, builds of the
  comment stripper (`rmcm`) for Windows and macOS or a run without stripping,
  and code that runs on VS Code's Node, not only Node 24. PDF generation is
  left out.
- **Size:** large.
- **Done when** an instructor sees what a workflow would assess, and what a
  run would cost, without pushing.

---

## Further ideas

None of these is planned. "Small" is days and "medium" a week or two.

### For students

| Idea                      | What it does                                                                    | Needs                                               | Size      |
| ------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------- | --------- |
| The code as it was        | Opens the file at the commit the questions were written about, read-only        | Nothing                                             | Small     |
| New-questions notice      | A badge and a notification when a newer set of questions arrives                | Nothing                                             | Small     |
| Run status                | Shows that the workflow is running after a push, then loads the questions       | Reading the repository's workflow runs              | Small     |
| Next and previous         | Commands and shortcuts to step through the questions                            | Nothing                                             | Small     |
| Open from the issue       | A link on each question in the issue that opens it in VS Code                   | An action change, probably a redirect page          | Medium    |
| Other interface languages | The extension's own text in French and other languages                          | Translations                                        | Small     |
| Self-practice             | A student generates practice questions before pushing, on their own key or seat | The shared core from phase 6, and a way to reach AI | Not sized |

### For instructors

All build on phase 3, except the last, which builds on phase 7.

| Idea                          | What it does                                                          | Needs                                       | Size   |
| ----------------------------- | --------------------------------------------------------------------- | ------------------------------------------- | ------ |
| Class list                    | Every student in the assignment, with who has questions yet           | Nothing more                                | Medium |
| Resubmission history          | Earlier question sets and the log of runs, for submission tags        | Nothing more                                | Small  |
| Viva helpers                  | A random pick, answers hidden until revealed, a timer, marks exported | The decision on where marks are stored      | Medium |
| Starter-code markers          | Shows which questions are about starter code alone                    | Nothing more                                | Small  |
| Flag a poor question          | Records that a question was unclear or wrong, for tuning the prompt   | Somewhere to keep the flags                 | Small  |
| Build the quiz                | Starts the instructor repository's quiz workflow from the editor      | Nothing more                                | Small  |
| Cost of each run              | Token use and cost per student and per assignment                     | The action to record them as data           | Medium |
| Open a workflow in the Wizard | Reads an existing workflow file back into the Wizard's steps          | A reader from YAML to the Wizard's settings | Medium |

### Reach and upkeep

| Idea                     | What it does                                               | Needs                              | Size   |
| ------------------------ | ---------------------------------------------------------- | ---------------------------------- | ------ |
| Open VSX                 | Publishes to the registry Cursor, VSCodium and similar use | Its own token, and a release step  | Small  |
| The browser editor       | Works in github.dev, where there is no local Git           | Another way to read Git state      | Medium |
| GitHub Enterprise Server | Works for schools that host GitHub themselves              | A setting for the server's address | Medium |
| A JetBrains plugin       | The same student side, in `extensions/jetbrains/`          | Nothing more: phase 4 is released  | Large  |

### Set aside

- **An AI helper that answers the questions.** They are study prompts, and an
  answer on demand removes the reason to study.
- **Recording how code was written**, to target pasted or AI-inserted code. It
  is surveillance of students.
- **Re-matching questions after the code is edited.** Comments are stripped by
  default, so the snippet often does not match the file.
- **Writing answers in the editor.** Where they are kept and who sees them is
  a product decision.
- **Reading the repository without Git**, so questions show in Restricted
  Mode. Each piece of Git state would need its own reader.

---

## Open decisions

- **Who approves a publish.** Today a pushed tag publishes on its own.
- **Which tenant holds the Entra identity:** the college's, if it allows
  registering an application, or another.
- **Whether students may be asked for the `repo` permission.** There is no
  narrower one for private repositories.
- **A release freeze during term** for stable versions.
- **Where viva marks and notes are stored:** locally, or committed to the
  instructor repository. And what a mark is: levels, a number, or a note
  alone.
- **How the extension tells that an account administers a repository.** Which
  permission Classroom 50 gives each role has not been checked.
- **Whether self-practice is wanted at all.** The questions would differ from
  the instructor's.
- **Whether the extension stays free of usage data.** It collects none today.
