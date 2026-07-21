# Plan: Workflow Wizard Page in Docusaurus

## TL;DR

Add a multi-step wizard React page to the existing Docusaurus docs-site that guides an instructor through all 26 action inputs and generates a copyable GitHub Actions workflow YAML. Built entirely with existing React + CSS Modules — no new dependencies.

---

## Wizard Steps (7 total)

1. **Trigger** — Which event triggers the workflow (pull_request, push, workflow_dispatch, or combined)
2. **AI Provider** — Provider selection + conditional API key secret name / Azure endpoint
3. **Questions** — num_questions, include_answers, instructor_context, assignment_context
4. **Delivery** — Post targets (PR comment, issue, discussion, instructor repo)
5. **File Filters** — auto-detected stack patterns (shown as callout), additional_exclude_patterns, exclude_pattern_overrides, exclude_workflow_files, keep_comments, include_initial_commit, skip_committers
6. **Advanced** — Edge-case inputs shown with their defaults and explanations (temperature, retry attempts, context max chars, output_file, SHA overrides)
7. **Review** — Generated YAML in styled code block with one-click copy button + checklist of prerequisites

---

## Config State Shape

```
{
  triggerEvent: 'pull_request' | 'push' | 'workflow_dispatch' | 'push+workflow_dispatch',
  prTypes: ['opened', 'synchronize'],    // pull_request only
  pushBranches: ['main'],                // push only

  aiProvider: 'github-models' | 'openrouter',
  aiModel: 'gpt-4o',
  apiKeySecret: 'OPENROUTER_API_KEY',        // openrouter only

  numQuestions: 5,
  includeAnswers: false,
  instructorContext: '',
  assignmentContext: '',

  postPrComment: false,
  postIssue: false,
  postDiscussion: false,
  discussionCategory: 'GrillMyCode',
  instructorRepoEnabled: false,
  instructorRepoTokenSecret: 'INSTRUCTOR_REPO_TOKEN',

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
- `permissions:` block built dynamically:
  - `contents: write` — always
  - `pull-requests: write` — if postPrComment
  - `models: read` — if aiProvider === 'github-models'
  - `issues: write` — if postIssue
  - `discussions: write` — if postDiscussion
- `on:` block varies by triggerEvent
- `api_key` only emitted for non-github-models providers
- `discussion_category` only emitted if postDiscussion
- `instructor_repo_token` only emitted if instructorRepoEnabled
- Include inline YAML comments on non-obvious inputs
- Secret references use `${{ secrets.SECRET_NAME }}` format

---

## Files to Create

1. `docs-site/src/pages/workflow-wizard.js` — Docusaurus page wrapper (Layout + WorkflowWizard)
2. `docs-site/src/components/WorkflowWizard/index.js` — Wizard orchestrator: step state, navigation, config state
3. `docs-site/src/components/WorkflowWizard/steps/StepTrigger.js`
4. `docs-site/src/components/WorkflowWizard/steps/StepAIProvider.js`
5. `docs-site/src/components/WorkflowWizard/steps/StepQuestions.js`
6. `docs-site/src/components/WorkflowWizard/steps/StepDelivery.js`
7. `docs-site/src/components/WorkflowWizard/steps/StepFiles.js`
8. `docs-site/src/components/WorkflowWizard/steps/StepAdvanced.js`
9. `docs-site/src/components/WorkflowWizard/steps/StepReview.js`
10. `docs-site/src/components/WorkflowWizard/generateYaml.js` — Pure function: config → YAML string
11. `docs-site/src/components/WorkflowWizard/styles.module.css` — Wizard CSS (progress bar, form, navigation)

## Files to Modify

1. `docs-site/docusaurus.config.js` — Add "Workflow Wizard" navbar item (position: left)

---

## Verification

1. `cd docs-site && pnpm start` — site starts without build errors
2. Navigate to `/workflow-wizard` — wizard renders with correct step 1
3. Step through all 7 steps — Back/Next navigation works, progress bar updates
4. Select each trigger type — `on:` YAML block changes correctly
5. Select github-models — no api_key in output
6. Select openrouter — api_key appears
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
