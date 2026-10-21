# Editor extensions

Extensions that bring GrillMyCode's questions into an editor. Each editor has
its own folder, with its own dependencies, checks and releases. None of this
is part of the action: nothing here is copied into the action's container
image.

| Folder       | What it is                                                            |
| ------------ | --------------------------------------------------------------------- |
| `vscode/`    | GrillMyCode Companion, the VS Code extension                          |
| `jetbrains/` | GrillMyCode Companion for JetBrains IDEs. Early access                |
| `fixtures/`  | Sample questions issues that every extension tests its reader against |

The plans these follow are in `docs-internal/vscode-extension-plan.md` and
`docs-internal/jetbrains-plugin-plan.md`.

## Working on the VS Code extension

From `extensions/vscode/`:

```bash
pnpm install          # once
pnpm build            # bundle to dist/: the extension, and the Workflow Wizard's page
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

The Workflow Wizard's tab is the docs site's Wizard. `pnpm build` bundles it
from `docs-site/docs/_workflow-wizard/` where it stands, with this project's
own React, so `docs-site/` need not be installed. After changing the Wizard,
run `pnpm build` and `pnpm test:host` here: the first test of the Wizard fails
if it no longer opens. What only the editor can do reaches the Wizard through
its `host` (`vscode/src/webview/host.js`), and is answered by
`vscode/src/workflow/wizard.js`.

## Releasing the VS Code extension

The extension has its own version numbers and its own tags, `vscode-v*`. A
`v*` tag releases the action and must not be used here.

1. Check what main holds. A release carries the action's inputs and the
   Workflow Wizard as they stand on main. If an input has changed there since
   the last `v*` tag, release the action first: otherwise workflow help
   describes, and the Wizard writes, an input the released action does not
   have.
2. Choose the version. An odd minor number (`0.1.x`, `0.3.x`) is a
   pre-release, which only people who opt in receive. An even one (`0.2.x`) is
   a stable release, which every student's install updates to.
3. Set `version` in `extensions/vscode/package.json`, add the version to
   `extensions/vscode/CHANGELOG.md`, which the Marketplace shows on the
   listing's Changelog tab, and merge both to main. If the screenshot in
   `extensions/vscode/README.md` is new or changed, wait for the docs site to
   deploy before tagging: the listing loads the image from there.
4. Tag that commit on main and push the tag:

   ```bash
   git checkout main && git pull
   git tag vscode-v0.2.0
   git push origin vscode-v0.2.0
   ```

5. `vscode-extension-release.yml` builds, tests and packages the extension,
   then waits for approval if the `vscode-marketplace` environment has a
   required reviewer. Once approved it publishes to the Marketplace and creates
   a GitHub Release with the `.vsix` attached.

The workflow signs in to the Marketplace with a Microsoft Entra identity, which
the `vscode-marketplace` environment names in two variables. No secret is
stored. `docs-internal/vscode-extension-plan.md`, under "Accounts and secrets",
has the steps for setting one up.

To try the sign-in without publishing, run **VS Code Extension Publisher
Check** from the Actions tab. Do that after any change to the sign-in, before
the next tag depends on it.

A version number can be published only once. If the workflow fails after
publishing, re-run it: it skips the Marketplace and finishes the rest.

## Working on the JetBrains plugin

The plugin is Kotlin, built by Gradle with the IntelliJ Platform Gradle Plugin.
It needs JDK 21, which the devcontainer has. From `extensions/jetbrains/`:

```bash
./gradlew check          # ktlint and the tests
./gradlew buildPlugin    # build/distributions/*.zip, installable by hand
./gradlew runIde         # an IDE with the plugin installed, to try it
./gradlew verifyPlugin   # the Plugin Verifier, against the supported IDEs
./gradlew ktlintFormat   # fix what ktlint can
```

The first build downloads IntelliJ IDEA 2025.1, the oldest release the plugin
supports and the one it compiles against. `verifyPlugin` downloads every IDE
the verifier checks, several of them over a gigabyte, and needs more disk than
a codespace has free. Leave it to **JetBrains Plugin Checks**, which runs on
every pull request that touches the plugin.

`runIde` opens a window, so it needs a desktop: run it on your own machine, not
in a codespace.

To try a build from a codespace instead, download
`build/distributions/*.zip` and install it in an IDE on your own machine with
**Settings | Plugins | ⚙ | Install Plugin from Disk…**. Then sign in from
**Tools | GrillMyCode | Sign In to GitHub…** and open the **GrillMyCode** tool
window in a clone of an assignment repository. The `build/` folder is ignored
by Git, so an editor set to hide ignored files does not show it.

The oldest supported IDE is `pluginSinceBuild` and `platformVersion` in
`gradle.properties`. Raise both together, deliberately: a higher minimum drops
support for older IDEs. The Kotlin `apiVersion` in `build.gradle.kts` follows
the Kotlin that the oldest IDE bundles.

## Releasing the JetBrains plugin

The plugin's tags are `jetbrains-v*`. A version with a suffix, such as
`0.1.0-eap.1`, goes to the Marketplace's `eap` channel, which only people who
add that channel receive. A version without one, such as `0.2.0`, goes to the
default channel, which every install updates to.

1. Set `version` in `extensions/jetbrains/gradle.properties`, add a section for
   it to `extensions/jetbrains/CHANGELOG.md`, which the Marketplace shows on the
   listing's "What's New" tab, and merge both to main.
2. Tag that commit on main and push the tag:

   ```bash
   git checkout main && git pull
   git tag jetbrains-v0.1.0-eap.1
   git push origin jetbrains-v0.1.0-eap.1
   ```

3. `jetbrains-plugin-release.yml` checks the plugin and runs the verifier, then
   waits for approval if the `jetbrains-marketplace` environment has a required
   reviewer. Once approved it signs the plugin, publishes it to the Marketplace
   and creates a GitHub Release with the signed ZIP attached.

A version number can be published only once. If the workflow fails after
publishing, do not re-run it: create the GitHub Release by hand.

### The first upload

The Marketplace takes a new plugin's first version only through its site,
where uploading it creates the listing. JetBrains reviews it by hand, which
can take days, so do this well before a term starts.

1. Sign in to the [JetBrains Marketplace](https://plugins.jetbrains.com) with
   the vendor's account, and create the vendor if there is none.
2. On the machine that holds the signing key, never in a codespace, build the
   plugin and sign it with the certificate below:

   ```bash
   CERTIFICATE_CHAIN="$(cat chain.crt)" PRIVATE_KEY="$(cat private_encrypted.pem)" \
     PRIVATE_KEY_PASSWORD='…' ./gradlew signPlugin
   ```

3. Upload `build/distributions/*-signed.zip` on the Marketplace's **Upload
   plugin** page, under the vendor. If the page offers a channel, choose `eap`.

Every later version goes through the workflow.

### The environment's secrets

The `jetbrains-marketplace` environment holds four secrets. The workflow stops
before publishing if one is missing.

| Secret                 | What it is                                                            |
| ---------------------- | --------------------------------------------------------------------- |
| `PUBLISH_TOKEN`        | A token made on the vendor's Marketplace profile, under **My Tokens** |
| `CERTIFICATE_CHAIN`    | The signing certificate, `chain.crt` below, the whole PEM text        |
| `PRIVATE_KEY`          | Its private key, `private_encrypted.pem` below, the whole PEM text    |
| `PRIVATE_KEY_PASSWORD` | The password the key is encrypted with                                |

Make the key and certificate once, on your own machine, and keep them
somewhere safe outside the repository:

```bash
openssl genpkey -aes-256-cbc -algorithm RSA -out private_encrypted.pem -pkeyopt rsa_keygen_bits:4096
openssl rsa -in private_encrypted.pem -out private.pem
openssl req -key private.pem -new -x509 -days 3650 -out chain.crt
rm private.pem
```

The certificate lasts ten years.
