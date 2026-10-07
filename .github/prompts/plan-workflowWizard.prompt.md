# Plan: Workflow Wizard Page in Docusaurus

## TL;DR

Add a multi-step wizard React page to the existing Docusaurus docs-site that guides an instructor through all 24 action inputs and generates a copyable GitHub Actions workflow YAML. Built entirely with existing React + CSS Modules — no new dependencies.

---

## Wizard Steps (10 total)

Steps run from the student repositories, through what the AI should know about the assignment and which files it assesses, to how questions are made and who receives them, and then when the workflow runs. The Repositories and Assignment steps both come before the AI step, so what sets most of how much is sent to the model (starter code, brief) is decided before choosing one; Repositories must also precede the Delivery step, which depends on its answers. The Trigger step follows Delivery, so when the workflow runs is decided once what it produces is settled. The Manual runs step comes after every setting it can expose, so each override the instructor ticks is a setting they have already seen.

1. **Repositories** (titled "Student repositories") — Facts about the student repositories. First the required "Created by Classroom 50?" question (`usesClassroom50`; the step cannot be left until it is answered), which decides whether the Delivery step offers the instructor repository. The rest of the step stays hidden until it is answered, and the Empty option names `gh teacher assignment add --empty-repo` only after a "Yes". Then "How do students' repositories start?" (Empty / From a starter template), which sets `starterCode`, and, for a template, "What should the AI do with the starter template?" (Ignore it / Use it as background context / Allow GrillMyCode to also generate questions about available starter code), followed by the codebase context limit when the answer sends starter code
2. **Assignment** — What the AI should know about the assignment: assignment_context, whose hint points to the instructor instructions on the Questions step. Skipped when the Repositories step's answer is **Empty** (`skippedWhen` on its `STEPS` entry): an empty repository holds only the student's own files, so any brief listed would be one the student wrote. Next and Back jump over a skipped step, and the progress bar keeps it, greyed out with a dash and a tooltip giving `skippedReason`, so step numbers don't shift. Choosing **Empty** also clears `assignmentContext`, and the `assignment_context` dispatch override is `templateOnly`, so neither reaches the YAML for empty repositories
3. **Files** — auto-detected stack patterns, as a collapsible notice box styled like the AI step's cost reminders (collapsed by default, its one-line summary always visible) listing every pattern the action applies on its own in collapsible sections: always excluded, editor and IDE files (plus the IDE templates a project folder turns on), diagrams and data files, the templates each GitHub Languages API language adds, the templates and patterns project files and dependencies add (found at the root or in any folder below it, with root-anchored patterns applied inside that folder), and the fallback list. Each template is its own nested collapsible, linking to its github/gitignore file. One search box above the sections filters all of them by group, template, language, project file or pattern: sections without a match hide, those with one open showing "N of M patterns", and a template whose patterns (not its name) match opens to show just those patterns; clearing it collapses everything again. The data is `excludeLists.json`, generated from `src/` by `scripts/build-wizard-exclude-lists.js` and loaded only when opened. Then additional_exclude_patterns and exclude_pattern_overrides. Both textareas accept one pattern per line, commas, or a mix; `generateYaml.js` splits them with the action's own `splitPatternList` (commas inside braces stay with their pattern, so `*.{js,ts}` survives), imported from `fileSelection.js`, the generated copy of `src/file-selection.js`. Their hints state the forms the action accepts (a plain name or a trailing `/` covers a folder, case is ignored) and that environment files, lock files and dependency folders come back only under an override that names them. Last, "Try the patterns on your files" (optional): a file preview. "Choose a folder…" reads a folder on the instructor's computer in the browser (the folder picker where the browser has one, otherwise a `webkitdirectory` file input), or "Or paste a list of files" takes paths one per line; nothing is uploaded. The preview runs the action's own rules from `fileSelection.js` (`detectStack`, `buildFileRules`) and shows: a headline count; a collapsed note on why it is an estimate, ending with how to check a real repository (a manual run with `preview_only` set to `true`); the languages found, as tick boxes (worked out from file names with `languageFiles.json`, since there is no Languages API result for a folder; an extension several languages share is listed unticked); the stack templates in use by folder; warnings (source files left out by a stack template, found by the action's `mayBeOwnWork` so the run summary flags the same files, with a "Bring these back" link that adds the override; a dependency folder no rule leaves out, with "Leave it out"; the file and project folder limits); the files that would be assessed; and the files left out, grouped by the pattern responsible and its origin, then the binary files (found by reading the start of each file with the action's `isBinary`; a pasted list has no contents, so the preview says its binary files are listed as assessed). Under each pattern box, one line per pattern says what it does to the chosen files (leaves out or brings back N, matches nothing, protected files it matches without naming), and a leading `!` or `#` is flagged even before a folder is chosen. The preview recalculates after a short pause in typing. `.git` and the dependency folders of the protected set are not opened, and at most `PREVIEW_MAX_FILES` files are read. The chosen files are wizard state (`previewSource`, `previewLanguages`) so they survive leaving the step, and are never written to the workflow
4. **AI Provider** — A collapsed **Reminders about cost and OpenRouter** notice (cost, trial runs, and that OpenRouter's details change constantly), the API key secret name, model selection (the dropdown starts on a disabled **Select Model…** and the step can't be left until a model is chosen; then a pre-tested model, or **Own Choice**, which is picked from OpenRouter's live catalogue in `ModelPicker` — there is no free-text model ID field, so the ID always exists and passes the picker's filters, which sit collapsed under **Additional criteria** below the search and sort; if the catalogue can't be loaded, the picker says to reload or choose a pre-tested model), then, once a model is chosen, a collapsible **Advanced settings** section (hidden until then, since each setting depends on the model; collapsed unless one of its settings is already changed; its header shows how many are) holding reasoning effort (`aiReasoningEffort`), OpenRouter model routing variant (`aiModelVariant`, appended to the model ID) and temperature. Temperature is opt-in: a "Set a temperature" checkbox (`aiTemperatureEnabled`, unticked by default) enables an empty number box (`aiTemperature`, 0 to 2 — OpenRouter's range — with at most two decimal places; the box steps by 0.01). Its explanation says any value must come from the instructor's own knowledge of the chosen model, that they are responsible for its validity and the resulting questions, and to leave it unticked if unsure. Unticking clears the value; `ai_temperature` is emitted only while the box is ticked and holds one of those values, and `temperatureError` blocks the step otherwise. It is not offered as a run-time option. The model's price stays visible under the selected model, outside the section. The Wizard never warns about a model's own default reasoning level, since that would push unsure instructors to lower it needlessly; it warns only when the chosen level is above the model's catalogue default (`isAboveDefaultEffort`; no warning when the default is unknown or the model is free). Once a model is chosen, its providers are fetched live (`useModelEndpoints`, `/api/v1/models/{id}/endpoints`) and `routingSummary` shows each routing option's output price range, notes when routing makes little or no difference to cost, and says how many endpoints run a compressed copy (any precision outside `ALLOWED_PRECISIONS`, which mirrors the action's `AI_ALLOWED_QUANTIZATIONS` allow-list: fp6 and the 4-bit formats). The action never routes to those, so they are left out of every price; when every endpoint is compressed, a warning under the Model field says every run with the model would fail — flex and priority tiers are read from the endpoint tag's suffix. The reasoning dropdown lists only the levels OpenRouter's catalogue gives for the chosen model (see `modelCatalog.js`, which fetches OpenRouter's catalogue live once per page load; there is no saved copy, so if OpenRouter can't be reached the dropdown lists every level), and the step shows the model's price per million tokens, marked live. "Own Choice" adds a searchable model list (`steps/ModelPicker.js`): text-output models from the catalogue, always without OpenRouter's routers, `~…-latest` aliases, `:batch` entries, and models `modelConcerns` flags (context under 128K tokens, reply limit under 16K, a retirement date — also shown as a warning under the Model field for any model); filters for structured outputs and "Released in the last year" (both on by default), "Free models only", and a two-handled output price slider (`PriceRangeSlider`) whose stops are every distinct output price in the catalogue (`outputPriceSteps`, lowest to highest, taken with no optional filter so its ends stay put; with a "Reset" link to its right, shown once either handle has moved; disabled and ignored while "Free models only" is ticked); sortable by Artificial Analysis coding score (default), output price or name; the dropdown's tested models are badged. Picking a row sets `aiModel`. Under the "Select your model" field a "Currently Selected Model:" heading shows the chosen model's catalogue name and ID on the line below it; when the catalogue knows the model it adds a "Model details on OpenRouter ↗" link to `https://openrouter.ai/{id}` (the catalogue ID, so any routing variant is dropped), opened in a new tab
5. **Questions** — num_questions; under `starter_code` ask only, "Ask up to 1 in # questions about non student submitted code" (`starterQuestionsOneIn`); question_emphasis (Balanced / Tracing / Research radio group), instructor_context, then keep_comments (here rather than on the Files step, since keeping comments is a choice about what the questions focus on)
6. **Delivery** — What students and instructors get. The issue and PDF are always delivered (shown as fixed, ticked items), then include_answers, so both places answers can go are decided together. Under "What Classroom 50 instructors get", a Classroom 50 "Yes" on the Repositories step reveals the instructor repository checkbox; ticking it reveals `labelRepos` and then the token secret name, last, at the same indent as the checkbox; a "No" explains the instructor repository is unavailable
7. **Trigger** — Which event triggers the workflow: push + manual, **submission tag + manual**, or manual only. Push and tag are mutually exclusive (an instructor who wants both keeps two workflow files). Tag mode collects the instructor's own tag names (`submissionTags`) and `tagDiffBase`, and, when `tagDiffBase` isn't `cumulative`, the "Give the AI the student's earlier work as context" checkbox (`previousWork`), followed by the codebase context limit when earlier work is the first thing that sends codebase context (otherwise a note says it shares the limit set on the Repositories step). Tags are never inferred — there is deliberately no preset for Classroom 50's own `submit/*` tags
8. **Manual runs** — First "Do you want to be able to change various settings for a single manual run?" (`dispatchOverridesEnabled`, `null` until answered; the step can't be left until it is). Under Yes, the manual run overrides checklist (`dispatchOverrides`): which settings to expose as `workflow_dispatch` inputs on the Run workflow form. No hides the checklist and passes `enabled: false` to `resolveDispatchOverrides`, so no input reaches the YAML or the Review checklist, but keeps `dispatchOverrides`, so answering Yes again brings the ticks back. Every trigger allows a manual run, so it applies whichever trigger was picked. `preview_only` is first on the list and ticked by default: a run with it set to `true` lists the files it would assess and stops before the AI call. No step sets it in the file (`previewOnly` stays `false`), since a workflow that always previews assesses nobody, so it reaches the YAML only as an override, and the Review step's checklist then says to do a preview run before the first assessed one
9. **Advanced** (titled "Other advanced settings", so it isn't confused with the AI step's Advanced settings section) — Edge-case inputs shown with their defaults and explanations (retry attempts, context max chars, codebase context max chars — here only for earlier work left by a `base_sha` override (see `codebaseLimitStep`), skip_committers, SHA overrides)
10. **Review** — Generated YAML in styled code block with one-click copy button + checklist of prerequisites

---

## Config State Shape

```
{
  triggerEvent: 'pull_request' | 'push' | 'workflow_dispatch' | 'push+workflow_dispatch' | 'tag+workflow_dispatch',
  prTypes: ['opened', 'synchronize'],    // pull_request only
  pushBranches: ['main'],                // push only
  submissionTags: '',                    // tag only — comma/newline-separated tag names
  tagDiffBase: 'cumulative',             // tag only — 'cumulative' | 'previous-tag' | 'tag:<name>'
  dispatchOverridesEnabled: null,        // Manual runs step's Yes/No; null until answered
  dispatchOverrides: [...],              // ticked override keys, kept while the answer is No
  previewOnly: false,                    // never changed by a step; the default of the preview_only override

  aiProvider: 'openrouter',                  // only supported value
  aiModel: null,                             // null until chosen | '' (Own Choice, nothing picked) | model ID
  aiModelVariant: '',                        // OpenRouter routing variant: '' | 'nitro' (fastest) | 'floor' (cheapest)
  aiReasoningEffort: 'default',              // 'default' (model decides) | 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  aiTemperatureEnabled: false,               // opt-in; unticking clears aiTemperature
  aiTemperature: '',                         // '' | 0 to 2, at most two decimal places, emitted only while enabled
  apiKeySecret: 'OPENROUTER_API_KEY',        // required

  numQuestions: 5,
  questionEmphasis: 'balanced',            // 'balanced' | 'tracing' | 'research'
  includeAnswers: false,
  instructorContext: '',
  assignmentContext: '',

  postPrComment: false,
  postIssue: false,
  postDiscussion: false,
  discussionCategory: 'GrillMyCode',
  usesClassroom50: null,                     // true | false; null until answered on the Repositories step
  instructorRepoEnabled: false,
  instructorRepoTokenSecret: 'INSTRUCTOR_REPO_TOKEN',
  labelRepos: true,                          // ticked by default; the action default is false

  excludePatternOverrides: '',
  additionalExcludePatterns: '',
  previewSource: null,                       // UI only — the Files step's preview: null | { kind: 'folder' | 'list', label, paths, unopened, truncated, texts, binary }
  previewLanguages: {},                      // UI only — languages ticked or unticked against the preview's guess: name → true | false
  excludeWorkflowFiles: true,
  keepComments: false,
  repoStart: null,                           // UI only — null until chosen | 'empty' | 'template'
  starterCode: null,                         // null until chosen | 'none' | 'ignore' | 'context' | 'ask'
  starterQuestionsOneIn: 5,                  // starter_questions_one_in; 2 to numQuestions
  previousWork: 'context',                   // 'context' | 'ignore'
  skipCommitters: 'github-actions[bot]',

  outputFile: 'grill-my-code.md',
  aiRetryMaxAttempts: 5,
  assignmentContextMaxChars: 20000,
  codebaseContextMaxChars: 50000,
  baseSha: '',
  headSha: '',
}
```

---

## YAML Generation Rules (generateYaml.js)

- Only emit inputs that differ from defaults (keeps output minimal and readable)
- `ai_model` is emitted as `effectiveAiModel(cfg)` — the chosen model with `aiModelVariant` appended
  as a `:suffix`. The variant is never a separate action input, and is only appended while
  `aiProvider` is `openrouter`, so a future provider is unaffected
- Exception: `ai_model` is always shown. At the default it is emitted **commented out**, with a
  pointer to https://openrouter.ai/models, so instructors can switch models by uncommenting one
  line rather than discovering the input name from the docs
- `permissions:` block built dynamically:
  - `contents: write` — always
  - `pull-requests: write` — if postPrComment
  - `issues: write` — if postIssue
  - `discussions: write` — if postDiscussion
- `on:` block varies by triggerEvent
- Tag trigger (`tag+workflow_dispatch`): `on.push.tags` lists `submissionTagList(cfg)` with **no**
  `branches:` line, and the step always emits `submission_tags` with the same list (the action fails
  a tag run whose tag the input does not match). `tag_diff_base` is emitted only in tag mode, and
  only when non-default or exposed as a dispatch override. Patterns are validated against the same
  charset as the action's `isSafeTagPattern` (`src/tags.js`) before the step can be left. The
  "Only work since a tag you name" radio stores `tag:<name>` from a text box shown beneath it;
  `namedDiffBaseTagError` mirrors the action's `isSafeTagName` and blocks the step on an empty or
  unusable name
- `tag_diff_base` is a `tagTriggerOnly` dispatch override (`type: 'choice'`, options
  `cumulative` / `previous-tag`, plus the configured `tag:<name>` value appended by
  `dispatchInputLines` when one is set): it is offered on the
  Manual runs step, and emitted, only in tag mode — `resolveDispatchOverrides(selected, { tagTrigger })`
- `question_emphasis` is emitted only when not `balanced`. It is a dispatch override (`type: 'choice'`,
  options `balanced` / `tracing` / `research`), ticked by default: it only changes which kinds of
  question are asked, so it cannot narrow or empty the assessment. Research and Tracing are
  all-or-nothing — the step's hint says so
- `api_key` always emitted — OpenRouter requires it and the action fails without it
- `ai_reasoning_effort` emitted only when not `default`, or as a dispatch override (`type:
'choice'`, every level from `default` to `max`, unticked by default since it can multiply a
  run's cost). The run form lists every level because `ai_model` can be overridden too, and the
  action maps a level the model doesn't support to its nearest one; the hint warns that `none`
  fails on a model that always reasons. When the chosen model changes, a level its
  catalogue entry does not offer is reset to `default`. The dropdown lists Off (unless reasoning
  is mandatory) and then the model's levels as "Low Effort", "Medium Effort" and so on. The level
  the model uses by default is labelled "… — Model Default" (such as "Medium Effort — Model
  Default") and carries the value `default`, so it is
  preselected and choosing it emits nothing; a model whose default isn't a named level keeps a
  "Model default — …" option at the top instead
- `discussion_category` only emitted if postDiscussion
- `instructor_repo_token` only emitted if `usesClassroom50 === true` and instructorRepoEnabled
  (`instructorRepoActive`), preceded by a comment that it works in Classroom 50 assignment
  repositories only — the action identifies the assignment and student from Classroom 50's
  repository naming and skips instructor delivery anywhere else
- `label_repos` is emitted only inside the `instructorRepoActive` block, and only when non-default
  (unchecked, so `label_repos: "false"`). It writes to the student repository's topics and
  description, which `GITHUB_TOKEN` cannot reach at any `permissions:` setting (that key has no
  `administration` scope), so it shares `instructor_repo_token`. Offering it without that token
  would configure a label that is never written. Its checkbox — checked and marked Recommended by
  default — lives on the Delivery step, between the instructor repository checkbox and the token field, for the same reason; it is not an
  Advanced-step option
- `starter_code` is set by the Repositories step's radios: **Empty** → `none`; **From a starter template**
  → the second radio group, **Ignore it** (`ignore`, which also covers a template that holds only
  instructions, such as a README), **Use it as background context** (`context`) or **Allow GrillMyCode to also generate questions about available starter code** (`ask`), both
  with a caveat that it will likely increase the input token cost of each run. No option is marked
  Recommended, since the right one depends on whether the template holds code. `repoStart` records
  the first choice only for the UI, since the starter code question needs its own answer under
  **From a starter template**. `ignore` matches the action default and is not emitted.
  Neither "How do students' repositories start?" nor "What should the AI do with the starter template?"
  has a preselected answer: `repoStart` and `starterCode` are `null` until chosen, and the
  Repositories step can't be left until both are set. Empty sets `starterCode` itself; switching
  to **From a starter template** from Empty clears it.
  `starter_code` is offered as a `type: 'choice'` dispatch override on the Manual runs step,
  unticked (a manual run that switches context on costs more). The deprecated
  `include_initial_commit` and `include_codebase_context` are never emitted
- `starter_questions_one_in` is emitted only when it differs from the default (`5`) and either
  `starterCode` is `ask` or `starter_code` is a dispatch override. Its field is on the Questions
  step, not beside the **Allow GrillMyCode to also generate questions about available starter code** option on the
  Repositories step, because the share depends on the number of questions: it sits under
  "Number of questions", appears only under `ask` with two or more questions (a single question
  is always about the student's own work), and shows how many questions that allows, as
  `maxStarterQuestions(cfg)` mirrors `src/prompt/prompt.js`. It runs from
  `MIN_STARTER_QUESTIONS_ONE_IN` (2) to `numQuestions`; lowering the number of questions below it
  lowers it too, and `starterQuestionsOneInError` blocks the step on any other value. It is a
  dispatch override (unticked by default) marked `starterAskOnly`: offered only when `starterCode`
  is `ask` or the `starter_code` override is ticked, since only then can a run use it; unticking
  `starter_code` drops it. When the starter code answer isn't `ask`, the Questions step never shows
  the share, so the Manual runs step shows a number field under its ticked checkbox for the run
  form's pre-filled value, from 2 to 50 (`starterShareDefaultError`, since the run may change the
  number of questions too)
- `previous_work` is emitted, when not `context`, only if `hasEarlierWork(cfg)`: a tag run with
  `tagDiffBase` other than `cumulative`, or a `base_sha` override. Other runs have no earlier
  work, so the Trigger step shows its checkbox only for a non-cumulative `tagDiffBase`. It is not
  a dispatch override
- `codebase_context_max_chars` is emitted only when it differs from the default and either
  `sendsCodebaseContext(cfg)` (starter code under `context` or `ask`, or earlier work where there
  is any) or `starter_code` is overridden. It is not a dispatch override — it is a structural
  cap, like `assignment_context_max_chars`. Its field appears only while `sendsCodebaseContext(cfg)`
  is true, on the step whose setting first switches codebase context on, as
  `codebaseLimitStep(cfg)` decides: Repositories for starter code under `context` or `ask`,
  Trigger for earlier work on a tag run, Advanced for earlier work left by a `base_sha` override.
  The shared field is `steps/CodebaseContextLimit.js`. It has no optional badge: the number is
  disabled at the default until a **Change the limit** checkbox is ticked, and unticking it puts
  the default back, like the temperature field on the AI step
- Include inline YAML comments on non-obvious inputs
- Secret references use `${{ secrets.SECRET_NAME }}` format

---

## Files

The wizard lives inside the docs tree so it is captured by the versioned-docs snapshot along with
the pages that link to it. Do not add it under `docs-site/src/components/` — that path is not where
the shipped wizard lives.

1. `docs-site/docs/workflow-wizard.mdx` — Docs page that imports and renders the wizard
2. `docs-site/docs/_workflow-wizard/index.js` — Wizard orchestrator: step state, navigation, config state. `STEPS` follows the step order above, and `getStepError` keys each validation check on the step's `label`, never its index, so reordering `STEPS` cannot move a check onto the wrong step
3. `docs-site/docs/_workflow-wizard/steps/StepAIProvider.js`
4. `docs-site/docs/_workflow-wizard/steps/StepQuestions.js`
5. `docs-site/docs/_workflow-wizard/steps/StepAssignment.js` — The assignment context files
6. `docs-site/docs/_workflow-wizard/steps/StepRepositories.js` — Required "Are you using this workflow alongside Classroom 50?" question, then how students' repositories start and what the AI does with starter code
7. `docs-site/docs/_workflow-wizard/steps/StepDelivery.js` — Fixed issue and PDF, include_answers, then the instructor repository: only a Classroom 50 "Yes" reveals delivery + token secret name, and a "No" explains the feature is unavailable. Enabling delivery also reveals the `labelRepos` checkbox (checked by default), which shares the same PAT
8. `docs-site/docs/_workflow-wizard/steps/StepFiles.js`
9. `docs-site/docs/_workflow-wizard/steps/StepTrigger.js`
10. `docs-site/docs/_workflow-wizard/steps/StepManualRuns.js`
11. `docs-site/docs/_workflow-wizard/steps/StepAdvanced.js`
12. `docs-site/docs/_workflow-wizard/steps/StepReview.js`
13. `docs-site/docs/_workflow-wizard/steps/CodebaseContextLimit.js` — The codebase context limit field, shared by the Repositories, Trigger and Advanced steps, and `codebaseLimitStep`, which picks the one that shows it
14. `docs-site/docs/_workflow-wizard/generateYaml.js` — Pure function: config → YAML string
15. `docs-site/docs/_workflow-wizard/steps/ExcludeListsDisclosure.js` — The Files step's collapsible list of auto-detected exclude patterns
16. `docs-site/docs/_workflow-wizard/excludeLists.json` — Generated by `scripts/build-wizard-exclude-lists.js`; never edited by hand
17. `docs-site/docs/_workflow-wizard/fileSelection.js` — The action's file selection rules. Generated from `src/file-selection.js` by `scripts/build-wizard-file-selection.js`; never edited by hand. Needs `minimatch` in `docs-site/package.json`, at the range the root `package.json` declares
18. `docs-site/docs/_workflow-wizard/filePreview.js` — The file preview's logic: reads a pasted list, guesses languages from file names, and asks `fileSelection.js` for each file's verdict, the rule behind it and what each pattern does. No React or browser APIs, so the repository's tests run it (`test/wizard-file-preview.test.js`)
19. `docs-site/docs/_workflow-wizard/readFolder.js` — Reads the chosen folder in the browser: file paths, the text of the dependency manifests the rules ask for, and the start of each file to find the binary ones
20. `docs-site/docs/_workflow-wizard/steps/FilePreview.js` — The preview's UI, the `useFilePreview` hook the Files step calls, and `PatternChecks`, shown under each pattern box
21. `docs-site/docs/_workflow-wizard/languageFiles.json` — Linguist's file extensions and file names by language, the Wizard's copy of `src/data/language-files.json`. Generated by `scripts/build-wizard-exclude-lists.js`; never edited by hand
22. `docs-site/docs/_workflow-wizard/styles.module.css` — Wizard CSS (progress bar, form, navigation)

The `docs-site/versioned_docs/version-0/_workflow-wizard/` copy is generated by the release
snapshot — never edit it directly.

## Files to Modify

1. `docs-site/docusaurus.config.js` — Add "Workflow Wizard" navbar item (position: left)

---

## Verification

1. `cd docs-site && pnpm start` — site starts without build errors
2. Navigate to `/workflow-wizard` — wizard renders with correct step 1
3. Step through all 10 steps — Back/Next navigation works, progress bar updates
4. Select each trigger type — `on:` YAML block changes correctly; in tag mode `on.push.tags` and
   `submission_tags` carry the same list, the step blocks with no tags or an unsupported pattern,
   and switching back to push drops `tag_diff_base` from both the output and the override list
5. Choose a pre-tested model, then "Own Choice" — the model picker appears, Next is blocked until a model is picked from it, and the picked ID reaches the YAML
6. Clear the API key secret name — the step blocks with a validation message; `api_key` is always present in the output
7. Enable discussion — discussion_category appears; answer Classroom 50 "Yes" and enable instructor repo — instructor_repo_token appears
8. Advanced step — defaults pre-filled; changing values reflects in YAML
9. Review step — copy button writes YAML to clipboard
10. YAML output is valid and parseable (paste into a YAML validator)

---

## Decisions

- No new npm dependencies — uses only React, Docusaurus Layout, CSS Modules, and `navigator.clipboard`
- Edge-case inputs (retries, SHA overrides, context max chars) are in the Advanced step with defaults pre-filled and explanatory text; only appear in YAML output if changed from default
- Secret names are free-text inputs (e.g. "OPENROUTER_KEY") that get wrapped in `${{ secrets.NAME }}` — users enter just the secret name, not the full expression
- Wizard is stateful but NOT persisted (no localStorage) — keeping scope minimal
