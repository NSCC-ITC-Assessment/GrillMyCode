# Editor extensions

Extensions that bring GrillMyCode's questions into an editor. Each editor has
its own folder, with its own dependencies, checks and releases. None of this
is part of the action: nothing here is copied into the action's container
image.

| Folder      | What it is                                                            |
| ----------- | --------------------------------------------------------------------- |
| `vscode/`   | GrillMyCode Companion, the VS Code extension                          |
| `fixtures/` | Sample questions issues that every extension tests its reader against |

The plan these follow is in `docs-internal/vscode-extension-plan.md`.

## Working on the VS Code extension

From `extensions/vscode/`:

```bash
pnpm install          # once
pnpm build            # bundle to dist/extension.cjs
pnpm test:host        # the tests that need a running VS Code
pnpm package          # dist/grillmycode.vsix, installable by hand
pnpm package:pre-release   # the same, marked as a pre-release for the Marketplace
```

`pnpm test:host` downloads a copy of VS Code the first time. It needs a
display, so on Linux without one run `xvfb-run -a pnpm test:host`.

To try the extension, use **Run Extension** from the Run and Debug view, then
open an assignment's folder in the window that appears.

Lint, formatting and the unit tests in `vscode/test/` run from the repository
root with everything else: `pnpm lint`, `pnpm format:check` and `pnpm test`.

The extension's list of the action's inputs, `vscode/src/shared/action-inputs.js`,
is generated from `action.yml`. After changing an input, run
`node scripts/build-extension-action-inputs.js` from the repository root.

## Releasing the VS Code extension

The extension has its own version numbers and its own tags, `vscode-v*`. A
`v*` tag releases the action and must not be used here.

1. Choose the version. An odd minor number (`0.1.x`, `0.3.x`) is a
   pre-release, which only people who opt in receive. An even one (`0.2.x`) is
   a stable release, which every student's install updates to.
2. Set `version` in `extensions/vscode/package.json`, add the version to
   `extensions/vscode/CHANGELOG.md`, which the Marketplace shows on the
   listing's Changelog tab, and merge both to main. If the screenshot in
   `extensions/vscode/README.md` is new or changed, wait for the docs site to
   deploy before tagging: the listing loads the image from there.
3. Tag that commit on main and push the tag:

   ```bash
   git checkout main && git pull
   git tag vscode-v0.2.0
   git push origin vscode-v0.2.0
   ```

4. `vscode-extension-release.yml` builds, tests and packages the extension,
   then waits for approval if the `vscode-marketplace` environment has a
   required reviewer. Once approved it publishes to the Marketplace and creates
   a GitHub Release with the `.vsix` attached.

The workflow signs in to the Marketplace with a Microsoft Entra identity when
the `vscode-marketplace` environment names one, and with the `VSCE_PAT` secret
otherwise. That token stops working on 2026-12-01.
`docs-internal/vscode-extension-plan.md`, under "Accounts and secrets", has the
steps for replacing it.

To try the sign-in without publishing, run **VS Code Extension Publisher
Check** from the Actions tab. Do that after any change to the sign-in, before
the next tag depends on it.

A version number can be published only once. If the workflow fails after
publishing, re-run it: it skips the Marketplace and finishes the rest.
