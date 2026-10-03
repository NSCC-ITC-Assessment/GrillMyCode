// Configuration for `pnpm test:host`: the tests in test-host/, which need a
// running VS Code. Everything that does not is tested from the repository
// root by `pnpm test`.
//
// The tests open a throwaway clone made here: a Git repository with a GitHub
// remote and the files the fixture questions point into. Nothing in it is
// ever pushed, and the tests never sign in to GitHub.

import { spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { defineConfig } from '@vscode/test-cli';

const workspace = mkdtempSync(join(tmpdir(), 'grillmycode-host-'));

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
