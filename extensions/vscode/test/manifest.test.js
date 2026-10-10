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

// A student's copy must show no sign of the instructor view. Both commands are
// in the manifest for everyone, so each place one can appear is conditional on
// the key the extension sets only after reading an answer key.
describe('the view switch', () => {
  const switches = ['grillmycode.showInstructorView', 'grillmycode.showStudentView'];
  const { commands, menus } = manifest.contributes;

  it('is two commands', () => {
    for (const command of switches) {
      expect(commands.some((entry) => entry.command === command)).toBe(true);
    }
  });

  it('is hidden from the Command Palette unless an answer key is readable', () => {
    for (const command of switches) {
      const entry = menus.commandPalette.find((item) => item.command === command);
      expect(entry.when).toContain('grillmycode.answerKey');
    }
  });

  it('is on no menu unless an answer key is readable', () => {
    const entries = Object.values(menus)
      .flat()
      .filter((item) => switches.includes(item.command));
    expect(entries.length).toBeGreaterThan(switches.length);
    for (const entry of entries) expect(entry.when).toContain('grillmycode.answerKey');
  });

  it('has no keybinding, which would run it whatever the menus say', () => {
    const bound = (manifest.contributes.keybindings ?? []).map((entry) => entry.command);
    for (const command of switches) expect(bound).not.toContain(command);
  });
});

// The buttons and the Command Palette entries are there only while questions
// are showing. A state misspelled in one of these hides it for good, and the
// tests in test-host/ would not notice: they run the commands by name.
describe('Next Question and Previous Question', () => {
  const steps = ['grillmycode.nextQuestion', 'grillmycode.previousQuestion'];
  const { commands, menus } = manifest.contributes;

  it.each(steps)('%s has an icon for its button', (command) => {
    expect(commands.find((entry) => entry.command === command).icon).toBeTruthy();
  });

  it.each(steps)('%s is offered only while questions are showing', (command) => {
    const button = menus['view/title'].find((entry) => entry.command === command);
    expect(button.when).toBe('view == grillmycode.questions && grillmycode.state == ready');
    const palette = menus.commandPalette.find((entry) => entry.command === command);
    expect(palette.when).toBe('grillmycode.state == ready');
  });
});

describe('workflow help', () => {
  // A workflow file is YAML until the GitHub Actions extension is installed,
  // which gives it a language of its own. Without both, the help never starts
  // for whoever has one of them.
  it('starts the extension when a workflow file is opened, whichever language it has', () => {
    expect(manifest.activationEvents).toContain('onLanguage:yaml');
    expect(manifest.activationEvents).toContain('onLanguage:github-actions-workflow');
  });

  // The name is written out in src/workflow/help.js as well.
  it('has a setting that switches it off, and is on until then', () => {
    const setting =
      manifest.contributes.configuration.properties['grillmycode.workflowHelp.enabled'];
    expect(setting).toMatchObject({ type: 'boolean', default: true });
    const source = readFileSync(join(root, 'src', 'workflow', 'help.js'), 'utf-8');
    expect(source).toContain("'workflowHelp.enabled'");
  });
});

describe('the Workflow Wizard', () => {
  const read = (...path) => readFileSync(join(root, ...path), 'utf-8');

  // The name is written out in src/workflow/wizard.js as well.
  it('is a command anyone can run from the Command Palette', () => {
    const { commands, menus } = manifest.contributes;
    const command = 'grillmycode.openWorkflowWizard';
    expect(commands.find((entry) => entry.command === command)).toMatchObject({
      title: 'Open Workflow Wizard',
      category: 'GrillMyCode',
    });
    expect(menus.commandPalette.some((entry) => entry.command === command)).toBe(false);
    expect(read('src', 'workflow', 'wizard.js')).toContain(`'${command}'`);
  });

  // The page is a bundle of its own. One of its two files left out of the
  // package is a blank tab for whoever installs the extension, and nothing
  // else fails: the tests in test-host/ run from dist/, not from the package.
  it.each(['wizard.js', 'wizard.css'])('packages dist/%s, which the tab loads', (file) => {
    expect(read('.vscodeignore').split('\n')).toContain(`!dist/${file}`);
    expect(read('src', 'workflow', 'wizard.js')).toContain(`'${file}'`);
  });

  it('builds the page to those two files', () => {
    // esbuild writes the stylesheet beside the script, under the same name.
    expect(read('esbuild.js')).toContain("outfile: 'dist/wizard.js'");
  });

  // What the page is built from is bundled, so none of it is installed with
  // the extension.
  it('needs nothing installed beside it', () => {
    expect(manifest.dependencies).toBeUndefined();
  });
});
