# Agent Instructions

## Documentation & Example Workflow Updates

Any change to the action's functionality — including new inputs, changed defaults, modified behaviors, or removed features — **must** be accompanied by:

1. **Documentation updates** — Update all affected files under `docs-site/docs/` and the inputs/outputs tables in `README.md` to reflect the change accurately.
2. **Example workflow updates** — Update any affected example workflows under `docs-site/docs/example-workflows/`, and add a new example if the change introduces a capability not covered by an existing one.
3. **Workflow Wizard updates** — Update the Workflow Wizard (`docs-site/src/components/WorkflowWizard/`) so the generated YAML and UI stay consistent with the change. This includes the `DEFAULTS` object in `generateYaml.js`, any relevant step component under `steps/`, and the planning prompt at `.github/prompts/plan-workflowWizard.prompt.md`.

Do not implement a functional change in isolation. Documentation and example workflows are part of the same deliverable.

## New Inputs

New inputs must be added consistently across **all six locations**:

1. `action.yml` — input declaration, description, and default
2. `src/inputs.js` — parsing and normalization
3. `src/constants.js` — any associated defaults, limits, or threshold values
4. `README.md` — inputs table row
5. `docs-site/docs/example-workflows/all-inputs.md` — active or commented-out entry with an inline explanatory comment
6. `docs-site/src/components/WorkflowWizard/` — add the input to the `DEFAULTS` object in `generateYaml.js`, wire up the UI control in the appropriate step component under `steps/`, and update `.github/prompts/plan-workflowWizard.prompt.md`

## New AI Providers

Adding a new `ai_provider` value requires changes in all of the following places:

1. `src/ai.js` — new `case` in the provider `switch`
2. `action.yml` — updated `ai_provider` input description listing the new value
3. `README.md` — updated `ai_provider` description in the inputs table
4. A new dedicated example workflow page under `docs-site/docs/example-workflows/` following the naming and style of `openrouter-provider.md`

## Constants vs Magic Numbers

Numeric limits, default values, threshold values, and external API version strings must be defined as named, documented exports in `src/constants.js`. Do not hard-code them inline in other modules.

### DEFAULT_EXCLUDE_PATTERNS sync

`src/constants.js` exports `DEFAULT_EXCLUDE_PATTERNS`. This list is **duplicated** in `docs-site/src/components/WorkflowWizard/steps/StepFiles.js` to power the "Load defaults" button. If `DEFAULT_EXCLUDE_PATTERNS` is ever changed, the copy in `StepFiles.js` **must** be updated to match. A comment in that file marks the duplication.

## No Shell Interpolation

All `git` and external process invocations must use `spawnSync` with a plain args array. Do not use `exec`, `execSync`, or template-string shell commands. This prevents shell-injection vulnerabilities.

## Commit Messages

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/) as enforced by the `commit-msg` hook:

```
<type>(<optional scope>): <subject>
```

Functional changes use `feat:` or `fix:`. Documentation-only changes use `docs:`. A full list of allowed types is in `docs-site/docs/development/contributing.md`.

## Example Workflow Numbering

New example workflow pages must be named `<N>-<short-description>.md` where `<N>` is one greater than the current highest number in `docs-site/docs/example-workflows/`. Existing example workflow numbers must never be changed.

## Using the most up-to-date documentation

Use Context7 when available, as it will have the most up-to-date documentation. If Context7 is unavailable, use the most recent version of the documentation that you have access to, but be aware that it may not reflect the latest changes. Always check the commit history for any recent updates to the documentation that may not be included in your version.