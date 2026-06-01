---
sidebar_position: 4
---

# GrillMyCode GitHub App

## What it is

The **GrillMyCode GitHub App** is an installation-level bot identity registered in the `nscc-itc-assessment` organization. It exists because `GITHUB_TOKEN` — the default token available inside GitHub Actions — is intentionally limited: it cannot push to protected branches, and commits made with it do not trigger subsequent workflow runs (to prevent recursive loops).

The app provides a token with elevated, narrowly-scoped permissions that two workflows depend on.

---

## Where it is used

### Release workflow (`release.yml`)

The `snapshot-docs` job checks out `main` and pushes a documentation snapshot commit back to `main` immediately after every release tag. Because `main` is protected, the push requires a token belonging to an identity that has been granted bypass on the branch protection rule — the app satisfies this where `GITHUB_TOKEN` cannot.

The app token is also used to read the GitHub Release body via the `gh` CLI when building the release notes entry.

### Renovate workflow (`renovate.yml`)

Renovate runs as the app identity so that dependency-update PRs appear under a consistent bot account rather than a personal access token. The app token also allows Renovate to open PRs that update files inside `.github/workflows/`, which `GITHUB_TOKEN` blocks by default.

---

## Required permissions

These are the repository permissions that must be granted to the app installation. All other permission categories should remain **No access**.

| Permission | Level | Why |
|---|---|---|
| **Contents** | Read & write | Push doc snapshots to protected `main`; Renovate commits dependency updates |
| **Pull requests** | Read & write | Renovate creates and updates dependency PRs |
| **Workflows** | Read & write | Renovate can update `.github/workflows/` files as part of dependency updates |
| **Vulnerability alerts** | Read | Renovate reads Dependabot alerts to prioritize security-related PRs |
| **Metadata** | Read | Always required by GitHub for any app installation |

---

## Required secrets

The workflow steps that generate the app token (`actions/create-github-app-token`) read two repository secrets. These must be set on the repository (or at the organization level):

| Secret | Value |
|---|---|
| `GRILLMYCODE_APP_ID` | The **Client ID** from the app's settings page |
| `GRILLMYCODE_APP_PRIVATE_KEY` | A private key generated on the app's settings page (PEM format) |

---

## Branch protection bypass

For the release doc-snapshot push to work, the app installation must be added to the **bypass list** of the `main` branch protection rule:

*Repository → Settings → Branches → `main` → Edit → Allow specified actors to bypass required pull requests → add the app*
