# Plan: Workflow Wizard Page in Docusaurus

## TL;DR

Add a multi-step wizard React page to the existing Docusaurus docs-site that guides an instructor through all 24 action inputs and generates a copyable GitHub Actions workflow YAML. Built entirely with existing React + CSS Modules — no new dependencies.

---

## Wizard Steps (9 total)

1. **AI Provider** — The API key secret name, a collapsed **Reminders about cost and OpenRouter** notice (cost, trial runs, and that OpenRouter's details change constantly), model selection, then a collapsible **Advanced settings** section (collapsed unless one of its settings is already changed; its header shows how many are) holding reasoning effort (`aiReasoningEffort`), OpenRouter model routing variant (`aiModelVariant`, appended to the model ID) and temperature. Temperature is opt-in: a "Set a temperature" checkbox (`aiTemperatureEnabled`, unticked by default) enables an empty number box (`aiTemperature`, 0 to 2 — OpenRouter's range — with at most two decimal places; the box steps by 0.01). Its explanation says any value must come from the instructor's own knowledge of the chosen model, that they are responsible for its validity and the resulting questions, and to leave it unticked if unsure. Unticking clears the value; `ai_temperature` is emitted only while the box is ticked and holds one of those values, and `temperatureError` blocks the step otherwise. It is not offered as a run-time option. The model's price stays visible under the selected model, outside the section. The Wizard never warns about a model's own default reasoning level, since that would push unsure instructors to lower it needlessly; it warns only when the chosen level is above the model's catalogue default (`isAboveDefaultEffort`; no warning when the default is unknown or the model is free). Once a model is chosen, its providers are fetched live (`useModelEndpoints`, `/api/v1/models/{id}/endpoints`) and `routingSummary` shows each routing option's output price range, notes when routing makes little or no difference to cost, and warns when a provider runs a compressed copy below fp8 (fp6, fp4, int4) — flex and priority tiers are read from the endpoint tag's suffix. The reasoning dropdown lists only the levels OpenRouter's catalogue gives for the chosen model (see `modelCatalog.js`, which fetches OpenRouter's catalogue live once per page load; there is no saved copy, so if OpenRouter can't be reached the dropdown lists every level), and the step shows the model's price per million tokens, marked live. "Own Choice" adds a searchable model list (`steps/ModelPicker.js`): text-output models from the catalogue, always without OpenRouter's routers, `~…-latest` aliases, `:batch` entries, and models `modelConcerns` flags (context under 128K tokens, reply limit under 16K, a retirement date — also shown as a warning under the Model field for any model); filters for structured outputs and "Released in the last year" (both on by default), "Free models only", and an output price limit (any, $1 or $5 per million tokens); sortable by Artificial Analysis coding score (default), output price or name; the dropdown's tested models are badged. Picking a row sets `aiModel`. Under the "Select your model" field a "Currently Selected Model:" heading shows the chosen model's catalogue name and ID on the line below it; when the catalogue knows the model it adds a "Model details on OpenRouter ↗" link to `https://openrouter.ai/{id}` (the catalogue ID, so any routing variant is dropped), opened in a new tab
2. **Questions** — num_questions, question_emphasis (Balanced / Research / Tracing radio group), include_answers, instructor_context, assignment_context
3. **Delivery** — Informational only: the assessment issue and PDF are always delivered, so there is nothing to choose
4. **Instructor** — "Created by Classroom 50?" question, instructor repository delivery + token secret name, and `labelRepos`
5. **Files** — auto-detected stack patterns (shown as callout), additional_exclude_patterns, exclude_pattern_overrides
6. **File opts** — keep_comments; "How do students' repositories start?" (Empty / From a template, with no starter code / From a template, with starter code), which sets `starterCode`, and, for starter code, "What should the AI do with the starter code?" (Ignore it / Use it as background / Ask about it too); skip_committers
7. **Trigger** — Placed after the file steps so most values it can expose as manual run overrides are already set. Which event triggers the workflow: push + manual, **submission tag + manual**, or manual only. Push and tag are mutually exclusive (an instructor who wants both keeps two workflow files). Tag mode collects the instructor's own tag names (`submissionTags`) and `tagDiffBase`, and, when `tagDiffBase` isn't `cumulative`, the "Give the AI the student's earlier work as context" checkbox (`previousWork`). Tags are never inferred — there is deliberately no preset for Classroom 50's own `submit/*` tags
8. **Advanced** (titled "Other advanced settings", so it isn't confused with the AI step's Advanced settings section) — Edge-case inputs shown with their defaults and explanations (retry attempts, context max chars, codebase context max chars — shown only while `sendsCodebaseContext` is true, SHA overrides)
9. **Review** — Generated YAML in styled code block with one-click copy button + checklist of prerequisites

---

## Config State Shape

```
{
  triggerEvent: 'pull_request' | 'push' | 'workflow_dispatch' | 'push+workflow_dispatch' | 'tag+workflow_dispatch',
  prTypes: ['opened', 'synchronize'],    // pull_request only
  pushBranches: ['main'],                // push only
  submissionTags: '',                    // tag only — comma/newline-separated tag names
  tagDiffBase: 'cumulative',             // tag only — 'cumulative' | 'previous-tag' | 'tag:<name>'

  aiProvider: 'openrouter',                  // only supported value
  aiModel: 'google/gemini-3.5-flash-lite',
  aiModelVariant: '',                        // OpenRouter routing variant: '' | 'nitro' (fastest) | 'floor' (cheapest)
  aiReasoningEffort: 'default',              // 'default' (model decides) | 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  aiTemperatureEnabled: false,               // opt-in; unticking clears aiTemperature
  aiTemperature: '',                         // '' | 0 to 2, at most two decimal places, emitted only while enabled
  apiKeySecret: 'OPENROUTER_API_KEY',        // required

  numQuestions: 5,
  questionEmphasis: 'balanced',            // 'balanced' | 'research' | 'tracing'
  includeAnswers: false,
  instructorContext: '',
  assignmentContext: '',

  postPrComment: false,
  postIssue: false,
  postDiscussion: false,
  discussionCategory: 'GrillMyCode',
  usesClassroom50: null,                     // true | false; null until answered on the Instructor step
  instructorRepoEnabled: false,
  instructorRepoTokenSecret: 'INSTRUCTOR_REPO_TOKEN',
  labelRepos: true,                          // ticked by default; the action default is false

  excludePatternOverrides: '',
  additionalExcludePatterns: '',
  excludeWorkflowFiles: true,
  keepComments: false,
  repoStart: 'template-code',               // UI only — 'empty' | 'template' | 'template-code'
  starterCode: 'ignore',                     // 'none' | 'ignore' | 'context' | 'ask'
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
  Trigger step, and emitted, only in tag mode — `resolveDispatchOverrides(selected, { tagTrigger })`
- `question_emphasis` is emitted only when not `balanced`. It is a dispatch override (`type: 'choice'`,
  options `balanced` / `research` / `tracing`), ticked by default: it only changes which kinds of
  question are asked, so it cannot narrow or empty the assessment. Research and Tracing are
  all-or-nothing — the step's hint says so
- `api_key` always emitted — OpenRouter requires it and the action fails without it
- `ai_reasoning_effort` emitted only when not `default`. It is not a dispatch override: the
  levels on offer depend on the model, and `ai_model` can itself be overridden on the run form,
  so a fixed list of options could not follow it. When the chosen model changes, a level its
  catalogue entry does not offer is reset to `default`
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
  default — lives on the Instructor step, under the token field, for the same reason; it is not an
  Advanced-step option
- `starter_code` is set by the File opts radios: **Empty** → `none`; **From a template, with
  no starter code** → `ignore`; **From a template, with starter code** → the second radio
  group, **Ignore it** (`ignore`), **Use it as background** (`context`, marked **(Recommended)**
  with a caveat that it will likely increase the cost of each run) or **Ask about it too**
  (`ask`). `repoStart` records the first choice only for the UI, since two of its answers emit
  the same value. The default, `ignore`, matches the action default and is not emitted.
  `starter_code` is offered as a `type: 'choice'` dispatch override on the Trigger step,
  unticked (a manual run that switches context on costs more). The deprecated
  `include_initial_commit` and `include_codebase_context` are never emitted
- `previous_work` is emitted, when not `context`, only if `hasEarlierWork(cfg)`: a tag run with
  `tagDiffBase` other than `cumulative`, or a `base_sha` override. Other runs have no earlier
  work, so the Trigger step shows its checkbox only for a non-cumulative `tagDiffBase`. It is not
  a dispatch override
- `codebase_context_max_chars` is emitted only when it differs from the default and either
  `sendsCodebaseContext(cfg)` (starter code under `context` or `ask`, or earlier work where there
  is any) or `starter_code` is overridden. It is not a dispatch override — it is a structural
  cap, like `assignment_context_max_chars`
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
5. `docs-site/docs/_workflow-wizard/steps/StepDelivery.js`
6. `docs-site/docs/_workflow-wizard/steps/StepInstructorRepo.js` — Required "created by Classroom 50?" question; only a "Yes" reveals instructor repository delivery + token secret name, and a "No" explains the feature is unavailable. Enabling delivery also reveals the `labelRepos` checkbox (checked by default), which shares the same PAT
7. `docs-site/docs/_workflow-wizard/steps/StepFiles.js`
8. `docs-site/docs/_workflow-wizard/steps/StepFileOptions.js`
9. `docs-site/docs/_workflow-wizard/steps/StepTrigger.js`
10. `docs-site/docs/_workflow-wizard/steps/StepAdvanced.js`
11. `docs-site/docs/_workflow-wizard/steps/StepReview.js`
12. `docs-site/docs/_workflow-wizard/generateYaml.js` — Pure function: config → YAML string
13. `docs-site/docs/_workflow-wizard/styles.module.css` — Wizard CSS (progress bar, form, navigation)

The `docs-site/versioned_docs/version-0/_workflow-wizard/` copy is generated by the release
snapshot — never edit it directly.

## Files to Modify

1. `docs-site/docusaurus.config.js` — Add "Workflow Wizard" navbar item (position: left)

---

## Verification

1. `cd docs-site && pnpm start` — site starts without build errors
2. Navigate to `/workflow-wizard` — wizard renders with correct step 1
3. Step through all 7 steps — Back/Next navigation works, progress bar updates
4. Select each trigger type — `on:` YAML block changes correctly; in tag mode `on.push.tags` and
   `submission_tags` carry the same list, the step blocks with no tags or an unsupported pattern,
   and switching back to push drops `tag_diff_base` from both the output and the override list
5. Choose a pre-tested model, then "Own Choice" — the custom model ID field appears and validates `provider/model` format
6. Clear the API key secret name — the step blocks with a validation message; `api_key` is always present in the output
7. Enable discussion — discussion_category appears; enable instructor repo — instructor_repo_token appears
8. Advanced step — defaults pre-filled; changing values reflects in YAML
9. Review step — copy button writes YAML to clipboard
10. YAML output is valid and parseable (paste into a YAML validator)

---

## Decisions

- No new npm dependencies — uses only React, Docusaurus Layout, CSS Modules, and `navigator.clipboard`
- Edge-case inputs (retries, SHA overrides, context max chars) are in the Advanced step with defaults pre-filled and explanatory text; only appear in YAML output if changed from default
- Secret names are free-text inputs (e.g. "OPENROUTER_KEY") that get wrapped in `${{ secrets.NAME }}` — users enter just the secret name, not the full expression
- Wizard is stateful but NOT persisted (no localStorage) — keeping scope minimal
