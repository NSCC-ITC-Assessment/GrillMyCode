---
sidebar_position: 3
---

# Versioning & Releases

## Versioning philosophy

This action follows [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`):

- **Major** — breaking changes that prevent existing workflow files from running without modification (e.g. removing an input, changing required behaviour)
- **Minor** — backwards-compatible new functionality (e.g. new optional input, new AI provider, new delivery mechanism)
- **Patch** — backwards-compatible bug fixes only

Consumers pin to a major tag (e.g. `@v1`) and automatically receive both bug fixes and non-breaking new features. A major bump is reserved for changes that would genuinely break existing workflow files — this means instructors are not forced to update mid-semester unless something they rely on has been removed or fundamentally changed.

Previous major versions enter **maintenance mode** when a new major is released — they continue to receive bug fixes but no new functionality.

---

## Build environments

Every push to the repository triggers one of three build pipelines, depending on where the code lives. Together these form a DEV → STAGING → PROD lifecycle.

| Environment | Trigger | Image tag produced | Purpose |
|---|---|---|---|
| **DEV** | Push to any feature / fix branch | `:branch-name` (sanitized) | Validate the build compiles and passes checks before review |
| **STAGING** | Merge to `main` | `:next` | Integration point — code that has been reviewed and merged but not yet versioned |
| **PROD** | Push of a `v*` tag | `:v1.x.x`, `:v1.x`, `:v1`, `:latest` | Stable, versioned releases consumed by instructors |

### DEV — branch builds

When you push source-code changes to any branch other than `main`, `branch-build.yml` fires. It builds the Docker image and pushes it to `ghcr.io` under a sanitized form of the branch name (e.g. `feat/add-provider` → `:feat-add-provider`). This tag exists solely for internal validation and is not intended for use in production workflow files.

### STAGING — `main` after merge

Once a PR is merged to `main`, `staging-build.yml` fires and pushes the image under `:next`. At this point the code is complete and reviewed but has not been assigned a version number. The `:next` tag represents "what would ship next" — it is useful for integration testing but should not be pinned in instructor workflow files because it is a moving target.

### PROD — versioned releases

Pushing a `v*` tag (e.g. `v1.2.0`) triggers `release.yml`, which produces four immutable-or-rolling tags (see the [tag strategy](#tag-strategy) section below) and creates a GitHub Release. Only at this point should instructor workflows be updated to reference a new version — and most never need to, because they pin to a major tag like `@v1` that is updated automatically.

---

## Tag strategy

When you push a tag like `v2.1.3`, the release workflow produces four image tags on `ghcr.io`:

| Image Tag | Updates When | Use Case |
|---|---|---|
| `v2.1.3` | Never (immutable) | Pinning to an exact known-good build |
| `v2.1` | Any `v2.1.x` is released | Rollback channel within a minor line |
| `v2` | Any `v2.x.x` is released | Receiving all fixes and features automatically (recommended) |
| `latest` | Any release | Always the newest stable build — not recommended for consumers |
| `next` | Any merge to `main` | Pre-release staging build — for integration testing only |

All consumer repos should reference the **major** tag (e.g. `v1`) in their workflow files. This is the value hard-coded in `action.yml` — it only changes when a new major version is released.

:::note
`action.yml` always references the **major** tag (e.g. `:v1`) and is **never modified by the release workflow**. It is only updated manually when a breaking-change major version is released.
:::

---

## How a release works

Pushing a tag is the single action that triggers everything. When you run `git push origin vX.Y.Z`:

1. The `release.yml` workflow fires
2. It builds the Docker image and pushes it to `ghcr.io` with four version tags (`vX.Y.Z`, `vX.Y`, `vX`, `latest`)
3. It automatically creates a **GitHub Release** with auto-generated release notes

No files are committed or modified during release. The repository is not touched after the tag is pushed — the release is a pure build-and-publish operation.

You do not need to manually create the GitHub Release through the UI.

---

## Releasing a patch (bug fix)

Use when: fixing a bug, correcting a typo in output, or addressing a regression. No new functionality.

```bash
# Example: current version on main is v1.1.2

# 1. Create a branch, make the fix, merge to main
git checkout -b fix/null-output
# ... make changes ...
git add -A && git commit -m "fix: handle null output case"
git push origin fix/null-output
# merge to main via PR

# 2. Tag the patch release from main
git checkout main && git pull
git tag v1.1.3
git push origin v1.1.3
```

**What happens:** `v1.1.3` is created, `v1` and `latest` are updated. Consumers referencing `v1` get the fix on their next run automatically.

---

## Releasing new functionality (minor)

Use when: adding any new backwards-compatible capability — new optional input, new AI provider, new output, new delivery mechanism, new event support, etc.

```bash
# Example: current version on main is v1.1.3

# 1. Create a branch, implement the feature, merge to main
git checkout -b feat/add-anthropic-provider
# ... make changes ...
git add -A && git commit -m "feat: add anthropic as a supported ai_provider"
git push origin feat/add-anthropic-provider
# merge to main via PR

# 2. Tag the minor release from main
git checkout main && git pull
git tag v1.2.0
git push origin v1.2.0
```

**What happens:** `v1.2.0` is created, `v1` and `latest` are updated. Consumers referencing `v1` get the new feature on their next run automatically.

---

## Releasing a breaking change (major)

Use when: making a change that prevents existing workflow files from running without modification. This should be rare.

```bash
# Example: current version on main is v1.2.0

# 1. Create a branch, implement the breaking change, merge to main
git checkout -b feat/redesign-inputs
# ... make changes ...
git add -A && git commit -m "feat!: remove deprecated inputs in favour of unified config"
git push origin feat/redesign-inputs
# merge to main via PR

# 2. Tag the new major release from main
git checkout main && git pull
git tag v2.0.0
git push origin v2.0.0
```

**What happens:** `v2.0.0`, `v2.0`, and `v2` are created. `latest` is updated. `v1` is **not affected** — consumers stay on the previous version until they deliberately update to `@v2`.

Because this is a breaking change, you must also manually update `action.yml` to reference the new major tag before merging:

```yaml
# action.yml — runs section
image: "docker://ghcr.io/nscc-itc-assessment/grillmycode:v2"
```

---

## Patching an older major (maintenance mode)

When a bug exists in a previous major line, apply the fix there independently.

```bash
# Example: main is on v2.x.x but a bug needs fixing in v1

# 1. Create a release branch from the latest v1 patch tag
git checkout -b release/v1 v1.2.0

# 2. Apply the fix
git cherry-pick <commit-hash>
git push origin release/v1

# 3. Tag from the release branch
git tag v1.2.1
git push origin v1.2.1
```

This updates `v1` without affecting `v2` or `latest`.

---

## Docs versioning

The documentation site uses Docusaurus versioning to mirror the action's release lifecycle. A version dropdown in the navbar lets readers toggle between **stable** docs (the latest release) and **Next (unreleased)** docs (whatever is currently on `main`).

### How it works

| Docs URL | Content | Updated when |
|---|---|---|
| `/docs/` | Redirects to the current stable major (`/docs/vN`) | Automatically — follows the newest released major |
| `/docs/vN/` | Stable — snapshot of major version `N` | That major is snapshotted at release time |
| `/docs/next/` | Unreleased — live `docs/` on `main` | Every merge to `main` that touches `docs-site/` |

The `Next (unreleased)` version shows an automatic banner warning readers they are viewing pre-release documentation. Older majors (any `vN` that is no longer the latest) show a banner pointing readers to the current version.

`versions.json` is the single source of truth for which majors exist. `docusaurus.config.js` derives every version's path (`/docs/vN`), its label (`vN`), the default version (`lastVersion`), and the unversioned-link redirects from that file — so cutting a new major requires **no config changes**. No version is ever pinned to the bare `/docs/` root, which would otherwise collide with the next major's root route and break the build.

Because the latest major lives at `/docs/vN` (not the bare root), bare/unversioned URLs like `/docs` and `/docs/getting-started` are redirected to the current version (`/docs/vN/...`) by `@docusaurus/plugin-client-redirects`. These redirects exist only to keep external links and bookmarks working — internal links never rely on them: in-content links are written relative (so they resolve within their own version), and navbar/footer/homepage links are derived from the current version path in `docusaurus.config.js`. Because nothing internal points at an unversioned `/docs/*` path, `onBrokenLinks` stays at `throw` for full build-time link safety.

### Snapshotting docs at release time

The `snapshot-docs` job in `.github/workflows/release.yml` runs on every `v*` tag:

- **New major** — runs `pnpm docusaurus docs:version N`, which copies the current `docs/` into `versioned_docs/version-N/`, appends `N` to `versions.json`, and registers it as the new stable major.
- **Patch or minor** — rebuilds the existing major snapshot in-place: deletes `versioned_docs/version-N/`, copies the current `docs/` back in (preserving `release-notes.md`), and prepends a new release notes entry.

In both cases the job commits the result back to `main` automatically.

To snapshot manually — for example, to preview the result locally before tagging a new major — run:

```bash
# Run from the docs-site/ directory. N is the MAJOR version only, e.g. 2
cd docs-site
pnpm docusaurus docs:version N
```

---

## What counts as a patch, minor, or major?

### Patch — bug fix, no behaviour change for consumers

- A supported AI provider returns an unexpected response shape and the action crashes
- The diff truncation cuts mid-line and produces malformed Markdown
- `sanitiseSha` rejects a valid short SHA format that GitHub legitimately produces
- `resolveOutputFile` generates an invalid filename for an edge-case branch name
- `include_initial_commit` logic incorrectly identifies the initial commit on a shallow clone
- Whitespace or encoding issue in the generated Markdown output

### Minor — new backwards-compatible functionality

- New AI provider (e.g. adding `anthropic` or `google-gemini`)
- New optional input (e.g. `question-style`, `language`)
- New output (e.g. `question-count`, `truncated`)
- New delivery mechanism (e.g. Teams/Slack webhook, workflow artefact)
- New event support (e.g. `workflow_run`, `schedule`)

### Major — breaking change (existing workflow files would stop working)

- Removing or renaming an existing input
- Changing an input's default behaviour in a way that alters existing results
- Changing the output file format
- Removing a supported `ai_provider` value
- Changing the `output_file` naming convention
- Removing an output
- Requiring a new mandatory input
