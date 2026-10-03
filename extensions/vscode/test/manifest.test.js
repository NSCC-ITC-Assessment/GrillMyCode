import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf-8'));

// In Restricted Mode the view has to load, to say the folder needs trusting.
// Either of these being undone switches the extension off there instead, and
// nothing else fails: the tests in test-host/ run in a trusted folder.
describe('Restricted Mode', () => {
  it('declares limited support for a folder that is not trusted', () => {
    const { supported, description } = manifest.capabilities.untrustedWorkspaces;
    expect(supported).toBe('limited');
    expect(description).toBeTruthy();
  });

  // VS Code switches Git off in Restricted Mode, and with it every extension
  // that lists Git as one it depends on.
  it('does not depend on the Git extension', () => {
    expect(manifest.extensionDependencies ?? []).not.toContain('vscode.git');
  });

  it('has a message for the untrusted state', () => {
    const welcome = manifest.contributes.viewsWelcome.find(
      (entry) => entry.when === 'grillmycode.state == untrusted',
    );
    expect(welcome.contents).toContain('command:workbench.trust.manage');
  });
});
