# Plan: Workflow Wizard Page in Docusaurus

## TL;DR

Add a multi-step wizard React page to the existing Docusaurus docs-site that guides an instructor through all 23 action inputs and generates a copyable GitHub Actions workflow YAML. Built entirely with existing React + CSS Modules — no new dependencies.

---

## Wizard Steps (9 total)

1. **Trigger** — Which event triggers the workflow: push + manual, **submission tag + manual**, or manual only. Push and tag are mutually exclusive (an instructor who wants both keeps two workflow files). Tag mode collects the instructor's own tag names (`submissionTags`) and `tagDiffBase`. Tags are never inferred — there is deliberately no preset for Classroom 50's own `submit/*` tags
2. **AI Provider** — Model selection, OpenRouter model routing variant (`aiModelVariant`, appended to the model ID), and the API key secret name
3. **Questions** — num_questions, include_answers, instructor_context, assignment_context
4. **Delivery** — Informational only: the assessment issue and PDF are always delivered, so there is nothing to choose
5. **Instructor** — "Created by Classroom 50?" question, instructor repository delivery + token secret name, and `labelRepos`
6. **Files** — auto-detected stack patterns (shown as callout), additional_exclude_patterns, exclude_pattern_overrides
7. **File opts** — keep_comments, include_initial_commit, skip_committers
8. **Advanced** — Edge-case inputs shown with their defaults and explanations (temperature, retry attempts, context max chars, SHA overrides)
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
  apiKeySecret: 'OPENROUTER_API_KEY',        // required

  numQuestions: 5,
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
  includeInitialCommit: false,
  skipCommitters: 'github-actions[bot]',

  outputFile: 'grill-my-code.md',
  aiTemperature: 0.5,
  aiRetryMaxAttempts: 5,
  assignmentContextMaxChars: 20000,
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
- `api_key` always emitted — OpenRouter requires it and the action fails without it
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
- Include inline YAML comments on non-obvious inputs
- Secret references use `${{ secrets.SECRET_NAME }}` format

---

## Files

The wizard lives inside the docs tree so it is captured by the versioned-docs snapshot along with
the pages that link to it. Do not add it under `docs-site/src/components/` — that path is not where
the shipped wizard lives.

1. `docs-site/docs/workflow-wizard.mdx` — Docs page that imports and renders the wizard
2. `docs-site/docs/_workflow-wizard/index.js` — Wizard orchestrator: step state, navigation, config state. `STEPS` follows the step order above, and `getStepError` keys each validation check on the step's `label`, never its index, so reordering `STEPS` cannot move a check onto the wrong step
3. `docs-site/docs/_workflow-wizard/steps/StepTrigger.js`
4. `docs-site/docs/_workflow-wizard/steps/StepAIProvider.js`
5. `docs-site/docs/_workflow-wizard/steps/StepQuestions.js`
6. `docs-site/docs/_workflow-wizard/steps/StepDelivery.js`
7. `docs-site/docs/_workflow-wizard/steps/StepInstructorRepo.js` — Required "created by Classroom 50?" question; only a "Yes" reveals instructor repository delivery + token secret name, and a "No" explains the feature is unavailable. Enabling delivery also reveals the `labelRepos` checkbox (checked by default), which shares the same PAT
8. `docs-site/docs/_workflow-wizard/steps/StepFiles.js`
9. `docs-site/docs/_workflow-wizard/steps/StepFileOptions.js`
10. `docs-site/docs/_workflow-wizard/steps/StepAdvanced.js`
11. `docs-site/docs/_workflow-wizard/steps/StepReview.js`
12. `docs-site/docs/_workflow-wizard/generateYaml.js` — Pure function: config → YAML string
13. `docs-site/docs/_workflow-wizard/styles.module.css` — Wizard CSS (progress bar, form, navigation)

The `docs-site/versioned_docs/version-1/_workflow-wizard/` copy is generated by the release
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
5. Choose a pre-defined model, then "Own Choice" — the custom model ID field appears and validates `provider/model` format
6. Clear the API key secret name — the step blocks with a validation message; `api_key` is always present in the output
7. Enable discussion — discussion_category appears; enable instructor repo — instructor_repo_token appears
8. Advanced step — defaults pre-filled; changing values reflects in YAML
9. Review step — copy button writes YAML to clipboard
10. YAML output is valid and parseable (paste into a YAML validator)

---

## Decisions

- No new npm dependencies — uses only React, Docusaurus Layout, CSS Modules, and `navigator.clipboard`
- Edge-case inputs (temperature, retries, SHA overrides, context max chars) are in the Advanced step with defaults pre-filled and explanatory text; only appear in YAML output if changed from default
- Secret names are free-text inputs (e.g. "OPENROUTER_KEY") that get wrapped in `${{ secrets.NAME }}` — users enter just the secret name, not the full expression
- Wizard is stateful but NOT persisted (no localStorage) — keeping scope minimal
