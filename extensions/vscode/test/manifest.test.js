import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));

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

describe('the update message', () => {
  // The link opens this extension's own page, by an identifier that is
  // written out in the manifest's text and so cannot follow a rename.
  it('links to the extension by its own identifier', () => {
    const welcome = manifest.contributes.viewsWelcome.find(
      (entry) => entry.when === 'grillmycode.state == needsUpdate',
    );
    const args = encodeURIComponent(JSON.stringify([`${manifest.publisher}.${manifest.name}`]));
    expect(welcome.contents).toContain(`(command:extension.open?${args})`);
  });
});

describe('the walkthrough', () => {
  const [walkthrough] = manifest.contributes.walkthroughs;

  // .vscodeignore packages media/ and nothing else a step could point at, and
  // VS Code refuses a walkthrough that has a step with no media.
  it.each(walkthrough.steps)('packages the media of step $id', ({ media }) => {
    const file = media.markdown ?? media.image;
    expect(file).toMatch(/^media\//);
    expect(existsSync(join(root, file))).toBe(true);
    if (media.image) expect(media.altText).toBeTruthy();
  });

  // A step is ticked by the state the Questions view is in. A state that is
  // misspelled here never matches, and the step is never ticked.
  it('ticks its steps on states the Questions view has', () => {
    const known = new Set(['ready']);
    for (const { when } of manifest.contributes.viewsWelcome) {
      for (const [, state] of when.matchAll(/grillmycode\.state == (\w+)/g)) known.add(state);
    }
    const named = walkthrough.steps
      .flatMap((step) => step.completionEvents)
      .filter((event) => event.startsWith('onContext:'))
      .flatMap((event) => [...event.matchAll(/grillmycode\.state == (\w+)/g)])
      .map(([, state]) => state);
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((state) => !known.has(state))).toEqual([]);
  });

  it('ticks a step on a command only if the extension has that command', () => {
    const contributed = manifest.contributes.commands.map(({ command }) => command);
    const named = walkthrough.steps
      .flatMap((step) => step.completionEvents)
      .filter((event) => event.startsWith('onCommand:'))
      .map((event) => event.slice('onCommand:'.length));
    expect(named.filter((command) => !contributed.includes(command))).toEqual([]);
  });
});
