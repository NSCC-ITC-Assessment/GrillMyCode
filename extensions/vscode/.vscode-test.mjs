// Configuration for `pnpm test:host`: the tests in test-host/, which need a
// running VS Code. Everything that does not is tested from the repository
// root by `pnpm test`.
//
// The tests open a throwaway clone made here: a Git repository with a GitHub
// remote and the files the fixture questions point into. Nothing in it is
// ever pushed, and the tests never sign in to GitHub.

import { spawnSync } from 'child_process';
import { setDefaultResultOrder } from 'dns';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'fs';
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { defineConfig } from '@vscode/test-cli';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';

// ── Getting VS Code ─────────────────────────────────────────────────────────
// The tests run in the latest stable VS Code, fetched from Microsoft's update
// server into .vscode-test/. On a CI runner that fetch has failed with
// ETIMEDOUT before a byte was read: Node gives each address of a host only a
// fraction of a second to answer before giving up on it, and tries IPv6
// addresses the runner has no route to. So IPv4 goes first, each address gets
// longer, and the whole fetch is tried again before the run is failed.

/** How long one address of a host has to accept a connection, in milliseconds. */
const CONNECT_ATTEMPT_MS = 2_000;
/** How many times fetching VS Code is tried. */
const DOWNLOAD_ATTEMPTS = 3;
/** The wait before the second try, in milliseconds. The third waits twice as long. */
const DOWNLOAD_RETRY_MS = 10_000;

setDefaultResultOrder('ipv4first');
setDefaultAutoSelectFamilyAttemptTimeout(CONNECT_ATTEMPT_MS);

// Done here, not left to the test runner, so that only the fetch is retried and
// a failing test is never run twice. The runner then finds the copy in place.
for (let attempt = 1; ; attempt++) {
  try {
    await downloadAndUnzipVSCode();
    break;
  } catch (err) {
    if (attempt === DOWNLOAD_ATTEMPTS) throw err;
    console.warn(`Fetching VS Code failed (${err.code ?? err.message}). Trying again.`);
    await new Promise((resolve) => setTimeout(resolve, attempt * DOWNLOAD_RETRY_MS));
  }
}

// ── The folder the tests open ───────────────────────────────────────────────

// The temporary folder's real path. On a Windows runner tmpdir() is a short
// name (C:\Users\RUNNER~1\…), and on macOS it is a link into /private. Git
// reports the real path either way, and a repository whose root is not the
// folder VS Code opened is not picked up.
const workspace = mkdtempSync(join(realpathSync.native(tmpdir()), 'grillmycode-host-'));

function git(...args) {
  const result = spawnSync('git', args, { cwd: workspace, encoding: 'utf-8' });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr}`);
}

// Thirty numbered lines, so a test can tell exactly which ones are selected.
const lines = Array.from({ length: 30 }, (_, i) => `// line ${i + 1}`).join('\n');
for (const file of ['src/cart.js', 'src/pricing/tax.js']) {
  mkdirSync(join(workspace, file, '..'), { recursive: true });
  writeFileSync(join(workspace, file), `${lines}\n`);
}

git('init', '--initial-branch=main');
git('remote', 'add', 'origin', 'https://github.com/my-school/cs-principles-lab-3-jsmith.git');
git('add', '.');
git('-c', 'user.name=jsmith', '-c', 'user.email=jsmith@example.com', 'commit', '-m', 'Lab 3');

export default defineConfig({
  files: 'test-host/**/*.host.cjs',
  workspaceFolder: workspace,
  mocha: { ui: 'bdd', timeout: 30_000 },
});
