---
sidebar_position: 2
---

# Contributing

## Dev Container (recommended)

A fully configured dev container is included in `.devcontainer/`. It comes pre-loaded with the correct Node and pnpm versions, all VS Code extensions, and every other tool needed to work on this project.

**Option 1 — VS Code locally:** Requires the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension and a local container runtime such as [Docker Desktop](https://www.docker.com/products/docker-desktop/) or [Podman](https://podman.io/). Open the repository and accept the prompt to _Reopen in Container_.

**Option 2 — GitHub Codespaces:** Open the repository on GitHub and click **Code → Open with Codespaces → New codespace**. The same dev container configuration is used, so you get an identical environment in the browser — no local tooling required.

---

## Prerequisites

:::note

These prerequisites apply only if you are **not** using the dev container.

:::

| Tool | Version | Notes |
|---|---|---|
| Node | ≥ 24 | The Dockerfile image uses 26 but only 24 is required |
| pnpm | ≥ 11 | Enforced via `engines` — `npm install` is blocked |
| Docker | any | Required to test the action end-to-end locally |
| git | any | Commit hooks are installed automatically |

---

## Setup

```bash
git clone https://github.com/NSCC-ITC-Assessment/GrillMyCode.git
cd GrillMyCode
pnpm install
git config merge.ours.driver true
```

`pnpm install` installs all dependencies **and** sets up the Husky pre-commit hooks automatically via the `prepare` script.

`git config merge.ours.driver true` registers the merge driver that prevents the branch-image reference in `action.yml` from overwriting the `main` reference when a branch is merged. This is configured automatically inside the dev container and Codespaces — it only needs to be run manually for a plain local clone. The command is scoped to this repository only (it writes to `.git/config`) and has no effect on any other projects.

---

## Running lint and format checks

```bash
# Lint source files
pnpm lint

# Auto-fix lint issues
pnpm lint:fix

# Check formatting
pnpm format:check

# Auto-fix formatting
pnpm format
```

Lint (ESLint) and formatting (Prettier) are also run automatically on staged files before every commit via `lint-staged`.

---

## Commit message conventions

This project enforces [Conventional Commits](https://www.conventionalcommits.org/) via `commitlint`. Every commit message must follow the pattern:

```
<type>(<optional scope>): <subject>
```

### Allowed types

| Type | When to use |
|---|---|
| `feat` | New feature, new input or output |
| `fix` | Bug fix |
| `chore` | Maintenance, dependency updates, config changes |
| `docs` | Documentation only |
| `style` | Formatting (no logic change) |
| `refactor` | Code change with no behaviour difference |
| `test` | Adding or updating tests |
| `perf` | Performance improvements |
| `ci` | Workflow / CI changes |
| `build` | Build system changes |
| `revert` | Reverts a previous commit |

### Rules

- Subject must not be empty and must not end with a period
- Header (type + subject) must be ≤ 100 characters
- Body lines must be ≤ 200 characters

### Examples

```
feat: add anthropic as a supported ai_provider
fix: handle null output when AI returns empty choices array
docs: add GitHub Classroom usage example to README
chore: update @actions/core to v3
ci: fix sed quote mismatch in release workflow
```

---

## Pre-commit hooks

Three hooks run automatically:

1. **`pre-commit`** — `lint-staged` runs ESLint and Prettier on staged `.js` files, and Prettier on staged `.json`, `.yml`/`.yaml`, and `.md` files. The commit is blocked if any check fails.
2. **`commit-msg`** — `commitlint` validates the commit message against the conventional commit rules above.
3. **`pre-push`** — blocks direct pushes to `main`. Tag pushes (e.g. `git push origin v1.0.0`) are allowed through so that releases can be triggered from `main`.

---

## Testing locally with Docker

To run the action exactly as it would run in GitHub Actions:

```bash
# Build the image
docker build -t grillmycode-local .

# Run it (replace values as appropriate)
docker run --rm \
  -e GITHUB_WORKSPACE=/workspace \
  -e INPUT_GITHUB_TOKEN=<your-token> \
  -e INPUT_AI_PROVIDER=github-models \
  -e INPUT_NUM_QUESTIONS=5 \
  -v $(pwd):/workspace \
  grillmycode-local
```

:::note

The action relies on `git` and a GitHub API token to resolve commit SHAs and post results. For a fully accurate local test, clone a real repository and bind-mount it as the workspace.

:::

---

## Branch and PR process

1. Create a feature or fix branch from `main`:
   ```bash
   git checkout -b feat/my-new-feature
   ```
2. Make your changes, commit following the conventions above
3. Push and open a PR against `main`
4. The `build-and-push.yml` workflow will build and push a `:latest` dev image automatically once merged

---

## Releasing

Releases are triggered by pushing a version tag. See [Versioning](versioning) for the complete guide.
