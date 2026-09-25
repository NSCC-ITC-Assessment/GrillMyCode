# Docs Site Reorganization — Proposed Outline

> **Recorded:** 2026-09-23 (`4efd764`)
> **Status:** Approved 2026-09-23 and implemented on branch
> `docs/reorganize-docs-site` (uncommitted at time of writing). See
> [Implementation notes](#implementation-notes) for deviations and open items.

The docs site has about 32,000 words across 30 pages. It has two problems:

- **It is hard to navigate.** The sidebar comes from the folder layout, so a
  beginner's setup page sits next to a 3,000-word pattern reference.
- **It is overwhelming.** Almost every page, even the introduction, starts
  with YAML, input names and edge cases. A non-technical instructor has no
  gentle way in.

This outline proposes a new structure, a writing standard, and a map
showing where every existing section ends up.

---

## Decisions already made

| Topic             | Decision                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Readers           | Instructors, in two layers: non-technical (gentle, task-first) and technical (reference, implementation detail)             |
| Happy path        | Explain the concept → use the Workflow Wizard → paste → check the first run. Editing YAML by hand is advanced               |
| Example workflows | Become a gallery of short "recipes" linked from the guides. Existing numbered files keep their numbers                      |
| Development docs  | Stay in the main sidebar, last and collapsed                                                                                |
| Structure         | Full freedom                                                                                                                |
| Process           | Approve this outline before any writing starts                                                                              |
| Spelling          | Canadian English (see [Writing standard](#writing-standard))                                                                |
| README            | Restructure it where that makes it easier to digest (see [README](#readme))                                                 |
| Classroom 50      | The gentle layer assumes the reader uses Classroom 50. Non-Classroom 50 use is covered in Reference                         |
| Wizard step order | Trigger stays at step 5, after Instructor and before the file-handling steps (see [Workflow Wizard](#workflow-wizard))      |
| Screenshots       | The user supplies them. The rewrite leaves marked placeholders, listed in the [shot list](#screenshot-shot-list)            |
| Slides            | In scope. Rewrite for a non-technical audience that knows Git and GitHub, and may know Classroom 50 (see [Slides](#slides)) |

---

## The core idea: two layers per topic

Most topics get **one gentle page** and **one technical page**:

- The **gentle page** answers _what is this, should I care, how do I do
  it_. It is written without input names where possible.
- It ends with a **"Go deeper"** link to the technical page.
- The technical page carries the input names, edge cases, log lines and
  internals.

| Topic                        | Gentle page (Guides)                | Technical page (Reference)             |
| ---------------------------- | ----------------------------------- | -------------------------------------- |
| When questions are generated | Choosing a trigger                  | Triggers in depth                      |
| Which code is assessed       | Choosing which files are assessed   | What code is assessed · File filtering |
| The private answer key       | Keeping a private answer key        | Instructor repository internals        |
| Classroom 50                 | Using GrillMyCode with Classroom 50 | Classroom 50 internals                 |
| AI model and cost            | Choosing a model and managing cost  | OpenRouter                             |
| The student's report         | What your students see              | The assessment issue and PDF           |

The existing [Choosing a Trigger](../docs-site/docs/guides/choosing-a-trigger.md)
page is already close to the gentle-page standard: plain language, a
decision table, "Choose this when…" lists and no YAML. It is the model for
the rest of the gentle layer.

---

## Proposed sidebar

A ★ marks a new page. Other pages keep their current file path, and so
keep their URL; only their content changes.

```
Welcome                                   intro.md (slug /)           rewrite
Why GrillMyCode?                          rationale.md                trim + fix
How it works ★                            how-it-works.md             new
Get started                               getting-started/            category
  ├─ Overview                             getting-started/index.md    (keeps /getting-started URL)
  ├─ 1. Set up an OpenRouter key ★        getting-started/openrouter-key.md
  ├─ 2. Build your workflow ★             getting-started/build-your-workflow.md
  ├─ 3. Add it to your assignment ★       getting-started/add-to-assignment.md
  └─ 4. Check the first run ★             getting-started/check-first-run.md
Workflow Wizard                           workflow-wizard.mdx         unchanged
Guides                                    guides/
  ├─ Choosing a trigger                   choosing-a-trigger.md       light edit
  ├─ Tailoring the questions ★            tailoring-questions.md
  ├─ Choosing which files are assessed ★  choosing-files.md
  ├─ Choosing a model and managing cost ★ choosing-a-model.md
  ├─ Running it yourself ★                running-manually.md
  ├─ What your students see ★             what-students-see.md
  ├─ Using with Classroom 50              classroom50.md              heavy trim
  ├─ Keeping a private answer key         instructor-setup.md         heavy trim
  ├─ Importing quizzes into your LMS ★    lms-quizzes.md
  └─ Tracking assessed repositories ★     tracking-repositories.md
Workflow recipes                          example-workflows/          relabelled
  ├─ Push to default branch               pull-request.md
  ├─ Submission tag                       tag-submission.md
  ├─ Milestone tags ★                     3-milestone-tags.md
  ├─ Manual run overrides                 manual-dispatch.md
  ├─ Assignment brief as context          assignment-context.md
  ├─ A more capable model                 openrouter-provider.md
  ├─ Private answer key                   1-instructor-repo.md
  ├─ Repository marker                    2-repo-marker.md
  ├─ Using the action's outputs           post-to-issues.md           repurposed
  └─ Every input, annotated               all-inputs.md
Troubleshooting ★                         troubleshooting.md
FAQ                                       faq.md                      trim by ~60%
Reference                                 reference/                  collapsed
  ├─ Inputs and outputs                   inputs-outputs.md
  ├─ What code is assessed ★              reference/code-selection.md
  ├─ File filtering                       exclude-patterns.md
  ├─ Triggers in depth ★                  reference/triggers.md
  ├─ The assessment issue and PDF ★       reference/assessment-output.md   (absorbs pdf-asset-naming)
  ├─ Instructor repository internals ★    reference/instructor-repository.md
  ├─ Repository marker internals ★        reference/repository-marker.md
  ├─ Classroom 50 internals ★             reference/classroom50-internals.md
  ├─ Tokens, secrets and permissions      permissions.md              expanded
  ├─ Debug mode                           debug-mode.md
  └─ Upgrade notes ★                      reference/upgrade-notes.md
AI provider                               ai-providers/openrouter.md  path frozen (see below)
Release notes                             release-notes.md
Development (collapsed)                   development/*               audit only
```

### Why most file paths stay put

"Full freedom" doesn't make URL changes free:

- `/docs/ai-providers/openrouter` is printed in runtime error messages
  ([src/ai.js:128](../src/ai.js#L128), [src/inputs.js:115](../src/inputs.js#L115)).
  It ships in every released v1 tag, so it must work forever.
- [README.md](../README.md) links to 13 docs URLs.
- The Wizard links to 6 pages via `docsBase`.
- The footer and navbar link to specific doc IDs.
- The v1 snapshot is rebuilt from `docs/` on every tag. A redirect whose
  `from` path still exists in the snapshot fails the build. See the
  conditional GitHub Models redirect in `docusaurus.config.js`: every moved
  page needs the same dance.

The folders already roughly match the new layers (`guides/`, `reference/`,
`example-workflows/`). So the reorganization can happen through
**sidebar position, labels and new pages**, not by moving files. Only
**one URL goes away**: `reference/pdf-asset-naming`, which merges into
_The assessment issue and PDF_ and needs one redirect.

The one awkward result is the OpenRouter page. It lives in `ai-providers/`,
but after the rewrite it is really a Reference page. It stays in its own
top-level "AI provider" category, placed right after Reference. This also
matches `AGENTS.md`, which expects future providers in `ai-providers/`.

`getting-started.md` becomes the category index `getting-started/index.md`.
Docusaurus serves that at `/getting-started/`, so the old URL should keep
working. **This must be checked in a build.**

---

## Page-by-page plan

Word targets are ceilings, not goals.

### Top level — gentle layer

**Welcome** (`intro.md`, ≤350 words, no YAML)

- One-paragraph pitch: a student pushes code, and a moment later there is
  a set of questions about _their_ code, ready for a code viva.
- A three-step picture: student pushes → questions appear as an issue and
  PDF → you use them in conversation.
- A screenshot of a real assessment issue. It is the fastest way to explain
  the tool, and the site has none today.
- Two buttons: **Get started** and **How it works**.
- One line on Classroom 50, linking to the guide.
- _Moves out:_ the Quick start YAML goes to Get started, and the "How it
  works" list goes to its own page.

**Why GrillMyCode?** (`rationale.md`, ≤450 words)

- Keep the problem, the preparation bottleneck and "why not let AI grade".
- **Fix inaccuracies:**
  - It says no credentials beyond `GITHUB_TOKEN` are needed for the
    default provider. An OpenRouter key is required.
  - It says the question file is committed back to the repository.
    Delivery is actually an issue plus a PDF release asset.
- Cut "Why a GitHub Action?" down to three bullets.

**How it works** ★ (`how-it-works.md`, ≤600 words, no input names)

- The life of one submission, in plain language:
  1. Something starts a run (a push, a tag, or you).
  2. GrillMyCode works out which code is the student's own: starter code,
     setup files, non-code files and comments are left out.
  3. The AI writes questions about that code, guided by your instructions.
  4. The student gets an issue and a PDF, with questions only. You can
     also get a private copy with answers and a ready-made LMS quiz.
- A small diagram of those steps.
- Each step ends with a "Go deeper →" link to the matching Reference page.

**Get started** (category; Overview ≤250 words, each step ≤500 words)

- **Overview:** what you need (a Classroom 50 classroom and its GitHub
  organization, an OpenRouter account and about $5 of credit, and the
  assignment's template repository), about 15 minutes, and the four steps.
- **1. Set up an OpenRouter key:** create the account, add credit, create
  the key, and add it as the organization secret `OPENROUTER_API_KEY`.
  Taken from the OpenRouter setup guide, with GitHub UI paths spelled out.
- **2. Build your workflow:** open the Wizard and understand its steps.
  The defaults are fine for a first try. Copy the result.
- **3. Add it to your assignment:** paste it into the _template_
  repository at `.github/workflows/grill-my-code.yml` and commit. Students
  get it when they accept. Link to the empty-repo exception.
- **4. Check the first run:**
  - Where to look (Actions tab, the issue, the PDF).
  - What success looks like.
  - The "green tick but no questions" case, which is normal right after
    accept.
  - Link to Troubleshooting.
- The full minimal workflow YAML appears **once** in this section, inside
  a collapsed `<details>` block titled "Prefer to write the YAML yourself?".

### Guides — gentle layer (each ≤700 words, ends with "Go deeper →")

| Page                                 | Built from                                                                  | Notes                                                                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Choosing a trigger                   | choosing-a-trigger.md                                                       | Already good. Fix the link label "Push to Default Branch", which points at `pull-request.md`                                             |
| Tailoring the questions ★            | getting-started "Customising", FAQ, assignment-context.md                   | Question count, writing good instructor context (with 2–3 examples), attaching the brief or rubric, why comments are ignored             |
| Choosing which files are assessed ★  | exclude-patterns.md (first third), FAQ file-filtering section               | What's left out automatically, and why. How to leave out more and bring something back, using wizard terms and not glob syntax           |
| Choosing a model and managing cost ★ | openrouter.md (recommended models, routing), FAQ                            | Default model, cost per assessment, when to pay for a stronger model, speed versus price, one shared key for a class                     |
| Running it yourself ★                | manual-dispatch.md (first half), FAQ                                        | Running from the Actions tab and changing settings for one run. What _not_ to put on the form, in one short list                         |
| What your students see ★             | FAQ (issue, pinning, answers hidden, withheld questions), tag-submission.md | The issue, the PDF and the note comment. **A copy-paste snippet for assignment instructions**, including tag commands when tags are used |
| Using with Classroom 50              | classroom50.md                                                              | Keep the setup, templates, `gh student submit` versus tags, and empty-repo warning. The commits table and prefix caution go to Reference |
| Keeping a private answer key         | instructor-setup.md, Phases 1–2                                             | Creating the token, the organization secret, and the workflow line. What you get. LMS, resubmissions and troubleshooting move out        |
| Importing quizzes into your LMS ★    | instructor-setup.md (quiz files, Brightspace CSV)                           | `.imscc` for everyone, the Brightspace CSV option, and where to find the files                                                           |
| Tracking assessed repositories ★     | 2-repo-marker.md (top), instructor-setup.md (resubmissions)                 | Repository markers, the zero-setup search, and spotting resubmissions                                                                    |

### Workflow recipes — ≤300 words of prose each

Every recipe follows the same template:

1. **Use this when…** (one sentence)
2. The YAML
3. **Change these:** a short list of lines you would edit
4. **Good to know:** 2–4 bullets at most
5. **Related:** links to the guide and Reference pages

Specific changes:

- `post-to-issues.md` becomes **Using the action's outputs**. Delivery is
  no longer configurable, so it isn't a recipe. Its delivery facts move to
  _The assessment issue and PDF_.
- `tag-submission.md` is split: a single tag here, milestones in the new
  `3-milestone-tags.md`, and matching and syntax detail in _Triggers in
  depth_.
- `manual-dispatch.md` keeps the YAML. The `type: choice`, `env` block and
  10-input limit details move to _Triggers in depth_.
- `2-repo-marker.md` keeps the YAML and the before/after picture. The
  reconciliation sweep moves to _Repository marker internals_.
- `1-instructor-repo.md` keeps the YAML. The five-step "how it works" list
  moves to _Instructor repository internals_.
- **Fix:** `assignment-context.md` triggers on `branches-ignore: main,
master` with no `workflow_dispatch`. Every other recipe uses push to
  main, so this looks stale.
- **Fix:** `2-repo-marker.md` uses `branches: [main]`. Align it with the
  other recipes.
- `all-inputs.md` stays where it is, because `AGENTS.md` names that path.
  **Fix:** its `instructor_repo_token` comment omits the `workflow` scope.

### Troubleshooting ★ — symptom-first, gathered from four places

Each entry is: **the symptom**, one line on the likely cause, then the fix.

- The run is green but no questions appeared. _(FAQ)_
- A tag-triggered run failed. _(FAQ)_
- A file I expected isn't assessed, or too many files are assessed.
  _(exclude-patterns)_
- Nothing arrived in the instructor repository. _(instructor-setup)_
- `Could not update .github/workflows/generate-lms-quiz.yml`.
  _(instructor-setup)_
- Rate limited (403), concurrent-write conflict (409), or timed out.
  _(instructor-setup)_
- OpenRouter returns 404 "No endpoints available…". _(FAQ)_
- Students are hitting rate limits. _(FAQ)_
- Permissions error. _(FAQ)_
- Some questions are missing from a student's report. _(FAQ)_
- "How do I get more detail?" → Debug mode.

### FAQ — short answers only (≤1,200 words, down from 3,600)

Every FAQ answer becomes 1–3 sentences plus a link. Anything longer
already has, or will have, a page of its own. The GitHub Models migration
moves to _Upgrade notes_, which means **updating the redirect target in
`docusaurus.config.js`** that points at the FAQ anchor today.

### Reference — technical layer

| Page                              | Built from                                                                                                                                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inputs and outputs                | Unchanged apart from linking to the new pages                                                                                                                                                                                                           |
| What code is assessed ★           | intro "How it works"; classroom50 "How it works" and "Including the initial commit"; `skip_committers` and `tag_diff_base` detail; comment stripping; question processing (dropped off-scope questions, withheld questions, 65k truncation)             |
| File filtering                    | exclude-patterns.md without its troubleshooting and the gentle intro                                                                                                                                                                                    |
| Triggers in depth ★               | concurrency (FAQ); tag matching syntax, delivery groups and the default-branch check (tag-submission); dispatch mechanics and the "keep out of the form" rationale (manual-dispatch)                                                                    |
| The assessment issue and PDF ★    | post-to-issues.md, pdf-asset-naming.md, FAQ (pinning, Repository line, truncation), issue assignment rules                                                                                                                                              |
| Instructor repository internals ★ | instructor-setup.md (identification, folder layout, `raw-ai-output.md`, provenance header, submission tag folders, resubmission record), 1-instructor-repo.md (sync of action-owned files, report contents), write retries, personal-account workaround |
| Repository marker internals ★     | 2-repo-marker.md (preservation rules, reconciliation sweep, stand-down)                                                                                                                                                                                 |
| Classroom 50 internals ★          | classroom50.md (commits table, "never filter by prefix", how the setup files are excluded)                                                                                                                                                              |
| Tokens, secrets and permissions   | permissions.md plus the token sections spread across the FAQ, instructor-setup and openrouter pages: `github_token`, `api_key`, and the PAT scopes (classic and fine-grained)                                                                           |
| Debug mode                        | **Fix:** it says the raw AI response is not retained. `raw-ai-output.md` now keeps it in the instructor repository                                                                                                                                      |
| Upgrade notes ★                   | The GitHub Models migration, removing `models: read`, the PAT `workflow` scope, instructor repo naming before 1.2.8, the leftover `generate-brightspace-quizzes.yml`, and "the first run after an upgrade rebuilds every quiz"                          |

### AI provider — `ai-providers/openrouter.md`

Becomes the technical OpenRouter page: inputs, routing variants and other
suffixes. The setup steps move to Get started step 1, and the model
choice moves to the Guides page.

**Check:** the example model IDs (`anthropic/claude-3-5-sonnet`,
`openai/gpt-4o`, `meta-llama/llama-3.1-70b-instruct`) are dated. They also
appear in `openrouter-provider.md` and the FAQ.

### Development — audit only

Keep all four pages. Check them for accuracy and don't restyle them.
Category `collapsed: true`.

---

## Writing standard

**Gentle layer (Welcome, How it works, Get started, Guides)**

- Lead with what the reader wants to do, not with how the feature works.
- Short sentences, and one idea per paragraph.
- No input names or YAML in the body text. When an input has to be
  mentioned, name it in the "Go deeper" line or a collapsed `<details>`.
- Use at most one admonition per page, and only for something that would
  otherwise cost the reader time or data.
- Explain GitHub terms (secret, workflow, tag, Actions tab) the first time
  they appear on a page, or link to a glossary entry.

**Technical layer (Reference, AI provider)**

- Precision over brevity, but no repeated content: each fact has one home
  and other pages link to it.
- Behaviour, then edge cases, then log lines.

**Classroom 50 as the default reader**

- Gentle pages say "your classroom", "your assignment's template
  repository" and "when a student accepts the assignment" without
  hedging.
- Using GrillMyCode without Classroom 50 gets one short note on the
  Welcome page, linking to Reference. There is no "if you use
  Classroom 50…" branching in gentle pages.
- Assume the reader knows Git and GitHub basics (repository, commit, push,
  issue). GitHub **Actions** terms (workflow, secret, Actions tab, run) and
  tags are still explained on first use, because many instructors have
  never touched them.

**Canadian spelling**

- _-ize_ / _-yze_: organization, customize, prioritize, analyze.
- _-our_: behaviour, colour, favour.
- _-re_: centre.
- Doubled _l_: cancelled, labelled, modelling.
- catalogue, program (for software as well), licence (noun) / license
  (verb), cheque.
- **Leave alone:** product and UI names, quoted GitHub UI labels, and
  anything in code or YAML (such as `organization` in a URL, or the
  `customise` spelling in existing anchors, until the page is renamed).
- Add an `organisation → organization` sweep to the final step, and check
  it with a grep for the common British forms.
- **Tooling:** `.devcontainer/devcontainer.json` sets `cSpell.language` to
  `en,en-CA`, but cSpell still flags _behaviour_ and _colour_. The
  Canadian dictionary is a separate extension
  (`streetsidesoftware.code-spell-checker-canadian-english`). Add it to the
  dev container's extension list so the editor enforces the standard.

**Everywhere**

- **Single-source the workflow YAML.** The same minimal workflow appears
  about 9 times today. Move it into an MDX partial
  (`docs/_partials/minimal-workflow.mdx`), import it where needed, and
  prefer linking to the recipe.
- Fix stale tense: "GitHub is discontinuing Classroom" and "shutting down
  on August 28, 2026". That date has passed.
- Use the same name for the same thing everywhere: _assessment_,
  _submission_, _template repository_ (not "starter repo"), _instructor
  repository_, _organization secret_.

---

## Fixes found while reading (to apply during the rewrite)

1. `rationale.md`: wrong credentials claim and wrong delivery claim (see
   above).
2. `post-to-issues.md` says the issue is assigned to "the student who
   authored the head commit". The identification rules say it goes to the
   direct collaborator whose login ends the repository name.
3. `debug-mode.md` says the raw AI response is not retained, which is
   stale.
4. `intro.md` "How it works" lists push and manual dispatch as triggers
   but omits tags.
5. `assignment-context.md` has a stale trigger block.
6. `all-inputs.md`: the `instructor_repo_token` comment omits the
   `workflow` scope.
7. FAQ typo: "If you wish any of these file types to be include".
8. `manual-dispatch.md` says "Classroom repository". It should say
   Classroom 50.
9. The Classroom 50 shutdown wording is in the future tense.
10. The footer "Example Workflows" link points at `pull-request`, not at
    the category.
11. Retry caps differ, and both are correct: AI calls wait at most 30s
    (`AI_RETRY_MAX_DELAY_MS`) and instructor-repo writes at most 60s
    (`INSTRUCTOR_RATE_LIMIT_MAX_WAIT_MS`). Troubleshooting must say which
    is which.
12. **Existing broken link (live today):** Docusaurus strips number
    prefixes from file names, so `1-instructor-repo.md` is served at
    `/example-workflows/instructor-repo` and `2-repo-marker.md` at
    `/example-workflows/repo-marker`. README line 360 and the Wizard's
    repository-marker help link (`StepInstructorRepo.js:143`) point at
    `/example-workflows/2-repo-marker`, which is a 404. Fix both in the
    links step. The new `3-milestone-tags.md` is served at
    `/example-workflows/milestone-tags`.

---

## Things outside `docs/` that change

- **`docusaurus.config.js`:** one redirect for `pdf-asset-naming`. Update
  the GitHub Models redirect target to _Upgrade notes_, and update the
  footer links.
- **Workflow Wizard:** see [Workflow Wizard](#workflow-wizard) below.
- **README.md:** see [README](#readme) below.
- **Slides:** see [Slides](#slides) below.
- **Homepage** (`src/pages/index.js`, `HomepageFeatures`): check the three
  feature blurbs against the new wording.
- **Heavily linked anchors that move:**
  - `#how-the-assignment-and-student-are-identified`
  - `#spotting-resubmissions`
  - `#which-quiz-file-to-use`
  - `#empty-repository-assignments`
  - `#classroom-50s-own-commits`

  Every inbound link inside the repository must be updated. External links
  to old anchors will land at the top of the page, which is acceptable.

### Workflow Wizard

**Reorder the steps, keeping Trigger at step 5.** The order was AI →
Questions → Files → File opts → Trigger → Delivery → Instructor → Advanced →
Review. The new order is:

> AI → Questions → Delivery → Instructor → Trigger → Files → File opts →
> Advanced → Review

An earlier draft of this outline moved Trigger to step 1. That was reversed:
Trigger stays at step 5, where it was before the reorganization.

- **Puts the Classroom 50 question earlier.** The Instructor step asks
  "created by Classroom 50?". It moves from step 7 to step 4, ahead of
  the file-handling steps that most readers can skip.
- **Moves the technical steps to the end.** Files, File opts and Advanced
  come just before Review, where a non-technical reader can click through
  on defaults.
- **Update the planning prompt to match.** The step list in
  `.github/prompts/plan-workflowWizard.prompt.md` follows this order.

Implementation notes:

- `getStepError` checks hard-coded step indices (`0`, `4`, `6`). Key those
  checks on the step's `label` instead, so the next reorder can't silently
  move a validation check onto the wrong step.
- Check `StepDelivery`'s subtitle, "Choose one or more destinations". The
  issue and PDF are no longer optional, so the step may only be
  informational now, and its wording should say so.
- Check the 6 `docsBase` help links against the new pages. For example,
  _Keeping a private answer key_ may be a better target than
  `guides/instructor-setup`.
- This is a behaviour change to the Wizard, not a docs change. It lands as
  its own commit (`fix(wizard): reorder steps`), in the same
  branch.

### README

The README is about 420 lines. It walks through every example workflow and
most features, which duplicates the site. `AGENTS.md` requires it to stay
in sync and to keep a full inputs table, so the table stays. Everything
else is restructured:

```
GrillMyCode
  One-paragraph pitch + a screenshot of an assessment issue
How it works           4 plain-language bullets (the "How it works" page, compressed)
Quick start            Set up the OpenRouter secret → use the Wizard (link) → or paste the minimal YAML
What you get           Issue · PDF · optional private answer key + LMS quiz
Choosing a trigger     3-row table (push / submission tag / manual) → link to the guide
Documentation          Links grouped the same way as the site: Get started · Guides · Recipes · Reference
Inputs                 Full table (required by AGENTS.md)
Outputs                Full table
Permissions            The 2-line block
```

- **Removed from the README:**
  - the per-example YAML blocks (only push-to-default-branch stays, as the
    Quick start)
  - the "When nothing is assessed", "Classroom 50", "Instructor repository
    delivery", "Marking assessed repositories", "Using action outputs" and
    "Exclude patterns behaviour" sections

  Each becomes one line in _Documentation_ that links to its page.

- **Target:** under 200 lines, with the inputs table accounting for most
  of them.
- **Links:** all use the unversioned `https://grillmycode.org/docs/...`
  form, as they do today, so they follow the latest major.

### Slides

The deck is `static/slides/index.html`, 15 reveal.js slides loaded in
an iframe by `src/pages/slides.js`. The one-slide summary
`GrillMyCode-slide.md` has a `.pptx` export.

**Audience:** non-technical instructors. They know Git and GitHub and may
know Classroom 50. They don't need jargon, input names or YAML.

Current slides and what happens to each:

| #   | Slide                                                  | Decision                                                                                                                                                                                       |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Title                                                  | Keep                                                                                                                                                                                           |
| 2   | The problem                                            | Keep, with lighter wording                                                                                                                                                                     |
| 3   | What is GrillMyCode?                                   | Keep the four cards. Replace "GitHub Action" in the lead sentence with "runs automatically in each student's repository"                                                                       |
| 4   | How it works (5 steps: commit range, git diff, globs…) | **Rewrite** as 4 plain steps matching the _How it works_ page: something starts a run → find the student's own code → AI writes questions → student gets an issue and PDF; you get the answers |
| 5   | When it runs                                           | Keep. It is already plain                                                                                                                                                                      |
| 6   | Architecture (Docker / module diagram)                 | **Remove**                                                                                                                                                                                     |
| 7   | Comment stripping (before/after)                       | Keep the example, which is concrete and visual. Drop `keep_comments: 'true'` and say "you can turn this off"                                                                                   |
| 8   | Delivery options                                       | Keep the four cards. Replace `instructor_repo_token` with "needs a one-time setup"                                                                                                             |
| 9   | AI provider table (`ai_provider` values)               | **Replace** with "Cost and models": one key for the whole class, usually under a cent per assessment, and a choice of model                                                                    |
| 10  | Classroom 50 integration                               | Keep, but drop `include_initial_commit` and `assignment_context`. It becomes "starter code is skipped · the assignment brief can guide the questions · issues go to the right student"         |
| 11  | Key customization inputs (input table)                 | **Replace** with "What you can adjust": number of questions, what the questions focus on, which files count, and when it runs. Plain words, no input names                                     |
| 12  | Quick start (YAML)                                     | **Replace** with "Getting started in four steps", matching the Get started section and pointing at the Wizard                                                                                  |
| 13  | What the student sees                                  | Keep. Swap in a real screenshot when one is available                                                                                                                                          |
| 14  | _(new)_ "What you see"                                 | The private answer key, the LMS quiz file, and spotting resubmissions                                                                                                                          |
| 15  | Closing                                                | Keep                                                                                                                                                                                           |

- Result: about 13 slides and no code blocks.
- **`GrillMyCode-slide.md`:**
  - Drop its YAML block.
  - Align its "How it works" wording with the deck.
  - Remove the "Looking for participants to pilot" call to action. The
    pilot has ended. End on the grillmycode.org link instead.
- Regenerate the `.pptx` from the updated `.md`.

### Screenshot shot list

The user supplies these. Until each one arrives, the page shows a
`:::note[Screenshot needed]` placeholder naming the shot number, so the gaps
are easy to find with a search for "Screenshot needed".

| #   | Shot                                                                                     | Used on                                           | Status                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | An assessment issue as the student sees it: title, header, first 2–3 questions, PDF link | Welcome, What your students see, README, slide 12 | ✅ `assessment-issue.png` (Welcome, What your students see)                                                                |
| 2   | The note comment added when questions are regenerated                                    | What your students see                            | Dropped — not needed                                                                                                       |
| 3   | The first page of the PDF                                                                | What your students see                            | Dropped — not needed                                                                                                       |
| 4   | The Actions tab with a successful GrillMyCode run                                        | Check the first run                               | ✅ `actions-successful-run.png`                                                                                            |
| 5   | A run summary page for a run with nothing to assess                                      | Check the first run, Troubleshooting              | Dropped — not needed                                                                                                       |
| 6   | The **Run workflow** form with override fields                                           | Running it yourself                               | ✅ `run-workflow-form.png`                                                                                                 |
| 7   | The instructor repository: the student folder list, and one student's folder             | Keeping a private answer key                      | ✅ `instructor-repository.png` (both views in one image)                                                                   |
| 8   | An `.imscc` quiz after import into Brightspace (or any LMS)                              | Importing quizzes into your LMS                   | Dropped — not needed                                                                                                       |
| 9   | The organization repository list with repository markers                                 | Tracking assessed repositories                    | Done — generated mockup (`org-repository-markers.png`)                                                                     |
| 10  | GitHub's "New organization secret" form                                                  | Get started step 1, Keeping a private answer key  | ✅ `new-organization-secret.png` (Get started step 1). The answer-key page still needs one showing `INSTRUCTOR_REPO_TOKEN` |

Crop tightly and replace real names, logins, repositories and avatars with
the fictional set (`my-school`, `cs-principles`, `lab-3`, `jsmith`). Redact
any keys or tokens. Optimize (see the Screenshots section of `AGENTS.md`), and
save as PNG under `docs-site/static/img/screenshots/`.

---

## Sequencing and the release trap

On every tag, the release workflow overwrites `versioned_docs/version-1/`
with `docs/`. **If any v1.x tag is cut while the rewrite is half done, the
half-done state becomes the published v1 docs.**

Proposed order, all on one branch:

1. **Scaffolding:** new empty pages with `sidebar_position`, category
   labels, the MDX partial, and the redirect.
2. **Gentle layer:** Welcome, How it works, Get started. **This is the
   pilot for tone:** review it before continuing.
3. **Guides.**
4. **Reference consolidation**, then Troubleshooting and FAQ. Content moves
   here, and the old pages are cut back only once the new page holds it.
5. **Recipes.**
6. **Links and surroundings:** README restructure, footer, homepage, the
   anchor sweep, and the Canadian spelling sweep.
7. **Wizard reorder** (a separate `fix(wizard):` commit) and **slides**.
8. `npm run build` with broken-link checking, then a check of the
   `/getting-started` URL and the `pdf-asset-naming` redirect.

It can land as one PR, or as several PRs merged with no release until the
last one. Either way, **no tag until step 8 is done.**

Rough size after the rewrite: gentle layer ≈ 7k words, Reference ≈ 14k,
recipes ≈ 4k, FAQ and Troubleshooting ≈ 3k. That is about 28k in total,
down from 32k. The bigger change is that a new instructor reads about 3k
words, not about 8k, before their first run.

---

## Open questions

None. All questions are answered (see
[Decisions already made](#decisions-already-made)).

---

## Implementation notes

Recorded when the rewrite was finished, 2026-09-23.

**Deviations from the plan**

- _How it works_ has no diagram. There is no Mermaid plugin, and the
  numbered sections carry the same structure. Screenshots will do more for
  it.
- `GrillMyCode-slide.pptx` was **not** regenerated. It is a one-slide
  poster designed by hand in PowerPoint, not an export of the `.md`, so
  regenerating it would lose the design. Update it by hand to match
  `GrillMyCode-slide.md`.
- The removed-page redirects became a small helper in `docusaurus.config.js`
  (`removedPages`). It also replaced the one-off GitHub Models redirect,
  whose target anchor moved to _Upgrade notes_.

**Fixed along the way (not in the original list)**

13. `anthropic/claude-3-5-sonnet` is not a valid OpenRouter model ID, so
    workflows that copied the example failed. It was used in the recipe,
    FAQ, OpenRouter page and Wizard placeholder, and is now
    `anthropic/claude-sonnet-5`.
14. The outputs example on _Inputs and outputs_ (and README) put
    `${{ steps.assess.outputs.questions }}` and the code outputs directly
    inside `run:`. That is a script-injection pattern, because the values
    contain student-written text. The examples now pass them through `env:`.
15. README's outputs table was missing `issue_url`, `issue_number` and
    `pdf_url`.
16. The Wizard's planning prompt listed 7 steps and a stale Delivery step.
    It was updated to the 9 steps in the code.

**Open items**

- Screenshots: search the docs for "Screenshot needed" (10 shots, see the
  shot list).
- Wizard reorder: not clicked through in a browser; there are no automated
  tests for the Wizard.
- Slides: not checked visually; no headless browser was available.
- Development pages: spelling swept only, not audited for accuracy.
- README links to new pages (for example `/docs/how-it-works`) redirect
  via the latest release, so they 404 until the next tag. Cut a release
  soon after merging.
- `ISSUE_BODY_LIMIT` is hard-coded in `src/main.js`, against the
  constants rule in `AGENTS.md`. Code, so out of scope here.
