---
sidebar_position: 3
---

# Versioning & Releases

## Versioning philosophy

This action follows [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`):

- **Major** — breaking changes that prevent existing workflow files from running without modification (e.g. removing an input, changing required behaviour)
- **Minor** — backwards-compatible new functionality (e.g. new optional input, new AI provider, new delivery mechanism)
- **Patch** — backwards-compatible bug fixes only

Consumers pin to a major tag (e.g. `@v0`) and automatically receive both bug fixes and non-breaking new features. A major bump is reserved for changes that would genuinely break existing workflow files — this means instructors are not forced to update mid-semester unless something they rely on has been removed or fundamentally changed.

A consumer who wants nothing to change for the length of an assignment can name a minor tag instead (e.g. `@v0.30`), which stays on that minor line. See [What a workflow's `uses:` line runs](#what-a-workflows-uses-line-runs).

Previous major versions enter **maintenance mode** when a new major is released — they continue to receive bug fixes but no new functionality.

---

## Build environments

Every push to the repository triggers one of three build pipelines, depending on where the code lives. Together these form a DEV → STAGING → PROD lifecycle.

![Three boxes joined by arrows. DEV: a push to a branch runs branch-build.yml, which pushes the image tagged branch-name, for validation only. STAGING: a merge to main runs staging-build.yml, which pushes the image tagged next, for integration testing only. PROD: pushing a v* tag runs release.yml, which pushes the image tagged vX.Y.Z, vX.Y, vX and latest. Below, what release.yml does after git push origin vX.Y.Z: 1, it builds and pushes the image with four tags on ghcr.io; 2, it creates the GitHub Release with generated release notes; 3, it moves the floating git tags vX and vX.Y; 4, it snapshots the docs and commits the snapshot to main. A footnote says action.yml on main runs the major image, such as v0, and the vX.Y git tag carries a copy that runs the vX.Y image.](/img/release-pipeline.svg)

| Environment | Trigger | Image tag produced | Purpose |
|---|---|---|---|
| **DEV** | Push to any feature / fix branch | `:branch-<name>` (sanitized) | Validate the build compiles and passes checks before review |
| **STAGING** | Merge to `main` | `:next` | Integration point — code that has been reviewed and merged but not yet versioned |
| **PROD** | Push of a `v*` tag | `:v0.x.x`, `:v0.x`, `:v0`, `:latest` | Stable, versioned releases consumed by instructors |

### DEV — branch builds

When you push source-code changes to any branch other than `main`, `branch-build.yml` fires. It builds the Docker image and pushes it to `ghcr.io` under a sanitized form of the branch name (e.g. `feat/add-provider` → `:branch-feat-add-provider`). This tag exists solely for internal validation and is not intended for use in production workflow files.

### STAGING — `main` after merge

Once a PR is merged to `main`, `staging-build.yml` fires and pushes the image under `:next`. At this point the code is complete and reviewed but has not been assigned a version number. The `:next` tag represents "what would ship next" — it is useful for integration testing but should not be pinned in instructor workflow files because it is a moving target.

### PROD — versioned releases

Pushing a `v*` tag (e.g. `v0.14.0`) triggers `release.yml`, which produces four immutable-or-rolling tags (see the [tag strategy](#tag-strategy) section below) and creates a GitHub Release. Only at this point should instructor workflows be updated to reference a new version — and most never need to, because they pin to a major tag like `@v0` that is updated automatically.

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

`v2` and `latest` follow the **newest** release only. A patch to an older minor line (see [Patching an older minor line](#patching-an-older-minor-line)) pushes its exact and minor image tags and leaves the other two alone.

### What a workflow's `uses:` line runs

A workflow names a **git** tag, and the `action.yml` at that tag names the image that runs. The release workflow keeps three kinds of git tag:

| `uses:` ref | Sits on | Image it runs | Result |
|---|---|---|---|
| `@v2` | The newest release's commit | `:v2` | Follows every `v2.x.x` release (recommended) |
| `@v2.1` | A commit of its own, one past the newest `v2.1.x` release | `:v2.1` | Stays on the `v2.1` line |
| `@v2.1.3` | That release's commit | `:v2` | Follows every `v2.x.x` release — **not pinned** |

On `main`, `action.yml` always names the **major** image (e.g. `:v0`). The release workflow never changes it there, and the `action-image-tag` PR check fails if a branch does. It is only updated by hand when a breaking-change major version is released.

For the minor tag, the release workflow makes one commit on top of the release commit, on no branch, in which that line names the minor image instead, and moves the minor git tag to it. So `@v2.1` gets both the code and the input declarations of the `v2.1` line. The release fails before publishing anything if `action.yml` at the tagged commit does not name the major image.

An exact tag stays where it was pushed, on a commit whose `action.yml` names the major image, so it is not a pin. Consumers who want a fixed version name the minor tag.

:::note
This holds for `v0.30` and later. Earlier minor tags were placed on their release commits, and one that has not been moved since runs the major image.
:::

---

## How a release works

Pushing a tag is the single action that triggers everything. When you run `git push origin vX.Y.Z`:

1. The `release.yml` workflow fires
2. It builds the Docker image and pushes it to `ghcr.io` with four version tags (`vX.Y.Z`, `vX.Y`, `vX`, `latest`)
3. It automatically creates a **GitHub Release** with auto-generated release notes
4. It moves the floating `vX` git tag to the new release, and the `vX.Y` git tag to a commit that runs the `vX.Y` image (see [What a workflow's `uses:` line runs](#what-a-workflows-uses-line-runs))
5. It snapshots the docs and commits the snapshot to `main` (see [Docs versioning](#docs-versioning))

When the tag is not the highest version released so far, `vX`, `latest` and the docs snapshot are left as they are: see [Patching an older minor line](#patching-an-older-minor-line).

You do not need to manually create the GitHub Release through the UI.

---

## Releasing a patch (bug fix)

Use when: fixing a bug, correcting a typo in output, or addressing a regression. No new functionality.

```bash
# Example: current version on main is v0.13.2

# 1. Create a branch, make the fix, merge to main
git checkout -b fix/null-output
# ... make changes ...
git add -A && git commit -m "fix: handle null output case"
git push origin fix/null-output
# merge to main via PR

# 2. Tag the patch release from main
git checkout main && git pull
git tag v0.13.3
git push origin v0.13.3
```

**What happens:** `v0.13.3` is created, `v0` and `latest` are updated. Consumers referencing `v0` get the fix on their next run automatically.

---

## Patching an older minor line

Use when: a consumer who names a minor tag needs a fix and cannot move to the newest release. This should be rare; the default answer is to move to the newest release.

```bash
# Example: v0.32.0 is the newest release, and the v0.30 line needs a fix

# 1. Branch from the line's newest exact tag and bring the fix over
git checkout -b release/v0.30 v0.30.2
git cherry-pick <commit-with-the-fix>
git push origin release/v0.30

# 2. Tag the patch from that branch
git tag v0.30.3
git push origin v0.30.3
```

**What happens:** the `:v0.30.3` and `:v0.30` images are pushed and the `v0.30` git tag moves. Because a higher version exists, `v0`, `:latest` and the docs snapshot stay on `v0.32.0`. The GitHub Release is created, and its entry is still added to the release notes.

:::warning
A tag push runs `release.yml` as it stands **at the tagged commit**, not the one on `main`. A line that was released before the workflow checked for the highest version would move `v0` and `:latest` back to the patch. Before tagging, confirm the branch's `release.yml` has the `newest` output, and bring the current workflow over if it does not.
:::

---

## Releasing new functionality (minor)

Use when: adding any new backwards-compatible capability — new optional input, new AI provider, new output, new delivery mechanism, new event support, etc.

```bash
# Example: current version on main is v0.13.3

# 1. Create a branch, implement the feature, merge to main
git checkout -b feat/add-anthropic-provider
# ... make changes ...
git add -A && git commit -m "feat: add anthropic as a supported ai_provider"
git push origin feat/add-anthropic-provider
# merge to main via PR

# 2. Tag the minor release from main
git checkout main && git pull
git tag v0.14.0
git push origin v0.14.0
```

**What happens:** `v0.14.0` is created, `v0` and `latest` are updated. Consumers referencing `v0` get the new feature on their next run automatically.

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
