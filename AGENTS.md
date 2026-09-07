# Agent Instructions

## Documentation & Example Workflow Updates

Any change to the action's functionality — including new inputs, changed defaults, modified behaviors, or removed features — **must** be accompanied by:

1. **Documentation updates** — Update all affected files under `docs-site/docs/` **and** `README.md` to reflect the change accurately. Both must stay in sync — `README.md` is the first thing users see on GitHub and must not lag behind the docs site.
2. **Example workflow updates** — Update any affected example workflows under `docs-site/docs/example-workflows/`, and add a new example if the change introduces a capability not covered by an existing one.
3. **Workflow Wizard updates** — Update the Workflow Wizard (`docs-site/docs/_workflow-wizard/`) so the generated YAML and UI stay consistent with the change. This includes the `DEFAULTS` object in `generateYaml.js`, any relevant step component under `steps/`, and the planning prompt at `.github/prompts/plan-workflowWizard.prompt.md`.

Do not implement a functional change in isolation. Documentation and example workflows are part of the same deliverable.

## Versioned Docs Are Auto-Generated — Do Not Edit Manually

**Never edit files under `docs-site/versioned_docs/` directly.** On every tag push the release workflow snapshots the current `docs-site/docs/` tree into the appropriate `versioned_docs/version-{MAJOR}/` directory, overwriting it completely. Any manual changes to versioned docs will be silently lost on the next release.

All documentation work must target `docs-site/docs/` (the "Next / unreleased" version). The versioned snapshot is produced automatically.

## New Inputs

New inputs must be added consistently across **all six locations**:

1. `action.yml` — input declaration, description, and default
2. `src/inputs.js` — parsing and normalization
3. `src/constants.js` — any associated defaults, limits, or threshold values
4. `README.md` — inputs table row
5. `docs-site/docs/example-workflows/all-inputs.md` — active or commented-out entry with an inline explanatory comment
6. `docs-site/docs/_workflow-wizard/` — add the input to the `DEFAULTS` object in `generateYaml.js`, wire up the UI control in the appropriate step component under `steps/`, and update `.github/prompts/plan-workflowWizard.prompt.md`

## New AI Providers

OpenRouter is currently the **only** supported provider, so parts of the UI that existed to
_choose_ between providers have been collapsed. The `ai_provider` input itself is fully preserved
— input, parsing, default constant, and the `switch` in `src/ai.js` — so adding a second provider
is an additive change, not a restoration.

Adding a new `ai_provider` value requires changes in all of the following places:

1. `src/ai.js` — new `case` in the provider `switch` (URL + auth headers)
2. `src/constants.js` — update `DEFAULT_AI_PROVIDER` / `DEFAULT_AI_MODEL` only if the new provider becomes the default
3. `action.yml` — updated `ai_provider` input description listing the new value
4. `README.md` — updated `ai_provider` description in the inputs table
5. `docs-site/docs/reference/inputs-outputs.md` — same, plus the provider table in `docs-site/docs/faq.md`
6. A new provider page under `docs-site/docs/ai-providers/` following the style of `openrouter.md`
7. A new dedicated example workflow page under `docs-site/docs/example-workflows/`
8. **Workflow Wizard** — `docs-site/docs/_workflow-wizard/steps/StepAIProvider.js` currently has
   **no provider selector**: with one provider there was nothing to choose, so the radio group was
   removed and the step configures only the model and API key secret. Re-introduce a provider
   control there, keyed on `cfg.aiProvider` (the field is still carried in `INITIAL_CONFIG` and
   `DEFAULTS`). Note that `generateYaml.js` emits `ai_provider` only when it differs from the
   default, and currently emits `api_key` unconditionally — revisit that if the new provider does
   not require a key.

Also note: `src/ai.js` keeps a `case 'github-models'` that throws a migration error. It is not a
supported provider — it exists so old workflows fail with an actionable message. Leave it in place.

## Constants vs Magic Numbers

Numeric limits, default values, threshold values, and external API version strings must be defined as named, documented exports in `src/constants.js`. Do not hard-code them inline in other modules.

### Exclude pattern templates

`src/constants.js` exports `FALLBACK_EXCLUDE_PATTERNS` — a broad list used only when the GitHub Languages API is unreachable at runtime. Prefer adding coverage to `scripts/fetch-gitignore-templates.js` (language/template mappings) or `src/stack-detection.js` (detection logic) over editing the fallback list directly.

The bundled template data lives in `src/data/gitignore-templates.json` (generated — do not edit by hand). Run `node scripts/fetch-gitignore-templates.js` to refresh it.

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
