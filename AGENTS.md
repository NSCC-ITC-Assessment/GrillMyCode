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

## Documentation Structure — Two Layers

The docs are written for instructors in two layers. Put new content in the right one:

- **Gentle layer** — `intro.md`, `how-gmc-works.md`, `getting-started/`, `guides/`. Task-first,
  plain language, **no input names or YAML in body text**. Assume the reader uses Classroom 50
  and knows Git/GitHub basics, but explain GitHub Actions terms (workflow, secret, Actions tab,
  tag) on first use. Each guide ends with a `**Go deeper:**` line linking its Reference page.
- **Technical layer** — `reference/`, `ai-providers/`. Input names, edge cases, log lines,
  internals.
- **Recipes** — `example-workflows/`. Short: "Use this when…", the YAML, "Change these",
  "Good to know" (2–4 bullets), "Related". Explanations belong in Reference, not recipes.

A functional change usually touches both layers: the technical page gets the detail, and the
guide gets a one-line mention only if it changes what an instructor does or sees.

## One Home Per Fact

Each fact is documented in exactly one place; other pages link to it. Before adding a
paragraph, search `docs-site/docs/` for where that topic already lives and extend that page
instead. Do not paste the same explanation into a guide, a recipe, the FAQ and README.

- The minimal workflow YAML lives in `docs-site/docs/_partials/_minimal-workflow.mdx`.
  Import it rather than pasting another copy. Update it when the canonical workflow changes.
- The FAQ holds 1–3 sentence answers that link elsewhere — never full explanations.
- Troubleshooting entries are symptom-first: the symptom as the heading, then cause, then fix.

## Writing Style

- **Canadian spelling** in prose: organization, recognize, prioritize, analyze, behaviour,
  colour, centre, cancelled, artifact. Leave code, YAML, identifiers and quoted UI labels as
  they are.
- Sentence-case titles and sidebar labels ("Choosing a trigger", not "Choosing a Trigger").
- Guides target ≤ 700 words; recipes ≤ 300 words of prose.

## Verify Against the Code

Documentation must describe what the code does, not what earlier docs said. Before stating
behaviour (defaults, limits, what is created, what fails vs. warns), check the source in
`src/` and `src/constants.js`. Use the constant's value, not a remembered number.

- **Model IDs** in examples must exist in OpenRouter's catalogue
  (`https://openrouter.ai/api/v1/models`). Check before adding or changing one.
- **Workflow Wizard labels** quoted in docs must match the UI text in
  `docs-site/docs/_workflow-wizard/steps/` exactly.

## Security in Examples

- Never place action outputs (`questions`, `code_before_strip`, `code_after_strip`) or other
  student-influenced values directly inside `run:`. Pass them through `env:` and reference the
  environment variable.
- Never show a secret as a `workflow_dispatch` input.
- Screenshots and examples must not contain real student names, logins, IDs, repository or
  organization names, or identicon avatars. Use the fictional set: organization `my-school`,
  classroom `cs-principles`, assignment `lab-3`, student `jsmith`
  (repository `cs-principles-lab-3-jsmith`).

## Links, URLs and Redirects

- A doc's URL is its file path, and the number prefix is stripped: `1-instructor-repo.md` is
  served at `/example-workflows/instructor-repo`. Link to docs by relative `.md` path, never
  by a hand-written URL.
- **Do not rename or move doc files lightly.** `/docs/ai-providers/openrouter` is printed in
  runtime error messages (`src/ai.js`, `src/inputs.js`) and must never break. README and the
  Wizard also link to specific pages.
- When a page is removed or moved, add it to `removedPages` in `docs-site/docusaurus.config.js`.
  That helper handles the fact that the page still exists in the latest release snapshot
  until the next tag.
- When moving a section, update every inbound link to its anchor (search for `page.md#anchor`
  across `docs-site/docs/`, `README.md` and the Wizard).
- Unversioned `https://grillmycode.org/docs/...` links in README resolve through the latest
  release, so links to pages that are new since then return 404 until the next tag.

## Checks Before Finishing a Docs Change

Run from `docs-site/`:

1. `npm run build` — must succeed; it fails on broken links. Broken **anchors** are only
   warned about, so read the output.
2. Preview with `npm start -- --host 0.0.0.0` (the `--host` flag is required for Codespaces
   port forwarding) and review the change under `/docs/next/`.
3. If the change affects the pitch, the setup steps or what students see, update the slide
   deck at `docs-site/static/slides/index.html`. It is written for a non-technical audience:
   no input names or YAML.

## Screenshots

Store screenshots in `docs-site/static/img/screenshots/` and reference them as
`/img/screenshots/<name>.png`, with alt text describing what the image shows. Where a
screenshot is still needed, leave a `:::note[Screenshot needed]` admonition describing the
shot, so gaps can be found with a search.

Before adding any screenshot, check it for **secrets and tokens** (API keys, PATs, secret
values typed into forms) as well as personal details. Replace them with an obviously fake value
(for example `sk-or-v1-••••`); never commit the original.

Optimize screenshots before committing: strip metadata, drop the unused alpha channel, and
reduce UI screenshots to a 256-colour palette, then check the result for banding:

```bash
convert in.png -strip -alpha off -dither None -colors 256 \
  -define png:compression-level=9 PNG8:out.png
```

Aim for under about 100 KB per screenshot. Crop to the relevant area rather than scaling down,
so text stays sharp.

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
5. `docs-site/docs/reference/inputs-outputs.md` — same, plus the provider wording in `docs-site/docs/guides/choosing-a-model.md`, `docs-site/docs/getting-started/openrouter-key.md` and `docs-site/docs/reference/permissions.md`, which currently assume OpenRouter is the only provider
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
