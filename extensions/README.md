# Editor extensions

Extensions that bring GrillMyCode's questions into an editor. Each editor has
its own folder, with its own dependencies, checks and releases. None of this
is part of the action: nothing here is copied into the action's container
image.

| Folder      | What it is                                                            |
| ----------- | --------------------------------------------------------------------- |
| `vscode/`   | The VS Code extension                                                 |
| `fixtures/` | Sample questions issues that every extension tests its reader against |

The plan these follow is in `docs-internal/vscode-extension-plan.md`.

## Working on the VS Code extension

From `extensions/vscode/`:

```bash
pnpm install          # once
pnpm build            # bundle to dist/extension.cjs
pnpm test:host        # the tests that need a running VS Code
pnpm package          # dist/grillmycode.vsix, installable by hand
```

`pnpm test:host` downloads a copy of VS Code the first time. It needs a
display, so on Linux without one run `xvfb-run -a pnpm test:host`.

To try the extension, use **Run Extension** from the Run and Debug view, then
open an assignment's folder in the window that appears.

Lint, formatting and the unit tests in `vscode/test/` run from the repository
root with everything else: `pnpm lint`, `pnpm format:check` and `pnpm test`.
