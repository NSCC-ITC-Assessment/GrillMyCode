// Runs inside VS Code (pnpm test:host), on the throwaway clone that
// .vscode-test.mjs makes. The Wizard's own steps are the docs site's code and
// are not driven from here: these tests cover what the extension adds, which is
// the tab, and the answers it gives the page.

const assert = require('assert');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');
const vscode = require('vscode');

const WORKFLOW_FILE = ['.github', 'workflows', 'grill-my-code.yml'];

describe('GrillMyCode Workflow Wizard', () => {
  let wizard;
  let folder;
  let workflowUri;

  const wizardTabs = () =>
    vscode.window.tabGroups.all
      .flatMap((group) => group.tabs)
      .filter(
        (tab) => tab.input instanceof vscode.TabInputWebview && tab.label === 'Workflow Wizard',
      );

  const onDisk = (uri) => readFileSync(uri.fsPath, 'utf-8');

  const names = (entries, kind) =>
    entries.filter((entry) => entry.kind === kind).map((entry) => entry.name);

  before(async () => {
    const extension = vscode.extensions.getExtension('GrillMyCode.grillmycode');
    ({ workflowWizard: wizard } = await extension.activate());
    [folder] = vscode.workspace.workspaceFolders;
    workflowUri = vscode.Uri.joinPath(folder.uri, ...WORKFLOW_FILE);
  });

  describe('the tab', () => {
    // The command resolves once the page says the Wizard is on screen. A
    // bundle that fails to load, or a script its page refuses to run, never
    // says so, and this times out.
    it('opens with the Wizard on screen', async () => {
      await vscode.commands.executeCommand('grillmycode.openWorkflowWizard');
      assert.strictEqual(wizardTabs().length, 1);
    });

    // One tab, so going back to the Wizard finds the answers given so far.
    it('is the same tab when the command is run again', async () => {
      await vscode.commands.executeCommand('grillmycode.openWorkflowWizard');
      assert.strictEqual(wizardTabs().length, 1);
      assert.ok(wizardTabs()[0].isActive);
    });
  });

  describe('reading a folder', () => {
    it('gives the open folder without asking', async () => {
      wizard.prompts.chooseFolder = () => assert.fail('asked for a folder');
      assert.deepStrictEqual(await wizard.pickFolder(), {
        name: folder.name,
        ignoredLeftOut: true,
      });
    });

    it('lists a folder as files and folders', async () => {
      await wizard.pickFolder();
      const top = await wizard.list('');
      // .git is listed like any folder: the Wizard is what passes over it.
      assert.deepStrictEqual(names(top, 'directory').sort(), ['.git', '.github', 'src']);
      const src = await wizard.list('src');
      assert.deepStrictEqual(names(src, 'file'), ['cart.js']);
      assert.deepStrictEqual(names(src, 'directory'), ['pricing']);
    });

    it('reads a file, or only its first bytes', async () => {
      await wizard.pickFolder();
      await wizard.list('');
      await wizard.list('src');
      assert.match(
        await wizard.read('src/cart.js'),
        /^\/\/ line 1\n\/\/ line 2\n[^]*\/\/ line 30\n$/,
      );
      assert.strictEqual(await wizard.read('src/cart.js', 9), '// line 1');
    });

    // The page is our own script, but what it may ask for is still only what
    // it has been shown.
    it('refuses a path no listing has named', async () => {
      await wizard.pickFolder();
      await wizard.list('');
      await assert.rejects(wizard.read('src/cart.js'), /not a file the Wizard was shown/i);
      await assert.rejects(wizard.list('src/pricing'), /not a folder the Wizard was shown/i);
      await assert.rejects(wizard.list('..'), /not a folder the Wizard was shown/i);
      await assert.rejects(wizard.read('../outside.txt'), /not a file the Wizard was shown/i);
    });

    it('starts again from nothing when a folder is picked again', async () => {
      await wizard.pickFolder();
      await wizard.list('');
      await wizard.list('src');
      await wizard.pickFolder();
      await assert.rejects(wizard.read('src/cart.js'), /not a file the Wizard was shown/i);
    });

    it('reads another folder when asked to choose one', async () => {
      const elsewhere = vscode.Uri.joinPath(folder.uri, 'src', 'pricing');
      wizard.prompts.chooseFolder = async () => elsewhere;
      assert.deepStrictEqual(await wizard.pickFolder(true), {
        name: 'pricing',
        ignoredLeftOut: true,
      });
      assert.deepStrictEqual(names(await wizard.list(''), 'file'), ['tax.js']);
    });

    it('says so when choosing a folder is cancelled', async () => {
      wizard.prompts.chooseFolder = async () => undefined;
      await assert.rejects(wizard.pickFolder(true), { name: 'AbortError' });
    });

    // Build output and downloaded tools are never committed, so no run sees
    // them, and a folder of them can hold thousands of files.
    it('leaves out what Git ignores, but not a committed file', async () => {
      const root = folder.uri.fsPath;
      const made = ['.gitignore', 'build', 'debug.log'].map((name) => join(root, name));
      // src/cart.js is committed, so the rule naming it does not apply to it.
      writeFileSync(made[0], 'build/\n*.log\ncart.js\n!keep.log\n');
      mkdirSync(made[1]);
      writeFileSync(join(made[1], 'bundle.js'), 'built\n');
      writeFileSync(made[2], 'ignored\n');
      writeFileSync(join(root, 'keep.log'), 'kept\n');
      made.push(join(root, 'keep.log'));
      try {
        await wizard.pickFolder();
        const top = await wizard.list('');
        assert.ok(!names(top, 'directory').includes('build'));
        assert.ok(!names(top, 'file').includes('debug.log'));
        assert.ok(names(top, 'file').includes('keep.log'));
        assert.ok(names(top, 'file').includes('.gitignore'));
        assert.ok(names(top, 'directory').includes('.git'));
        assert.deepStrictEqual(names(await wizard.list('src'), 'file'), ['cart.js']);
        // Not listed, so not to be had by asking for it either.
        await assert.rejects(wizard.list('build'), /not a folder the Wizard was shown/i);
        await assert.rejects(wizard.read('debug.log'), /not a file the Wizard was shown/i);
      } finally {
        for (const path of made) rmSync(path, { recursive: true, force: true });
      }
    });

    it('lists everything in a folder that is in no repository', async () => {
      const outside = mkdtempSync(join(tmpdir(), 'grillmycode-plain-'));
      writeFileSync(join(outside, '.gitignore'), '*.log\n');
      writeFileSync(join(outside, 'debug.log'), 'listed\n');
      wizard.prompts.chooseFolder = async () => vscode.Uri.file(outside);
      try {
        assert.strictEqual((await wizard.pickFolder(true)).ignoredLeftOut, false);
        assert.deepStrictEqual(names(await wizard.list(''), 'file'), ['.gitignore', 'debug.log']);
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }
    });

    // A link is a file to Git, and is listed as one. It is never read: what
    // it points to may be outside the folder.
    it('lists a link as a file and does not read through it', async function () {
      // Making a link on Windows needs a right the runner's account lacks.
      if (process.platform === 'win32') this.skip();
      const target = join(tmpdir(), `grillmycode-link-target-${process.pid}.txt`);
      const link = join(folder.uri.fsPath, 'linked.txt');
      const folderLink = join(folder.uri.fsPath, 'linked-folder');
      writeFileSync(target, 'outside the folder\n');
      symlinkSync(target, link);
      symlinkSync(tmpdir(), folderLink);
      try {
        await wizard.pickFolder();
        const top = await wizard.list('');
        assert.ok(names(top, 'file').includes('linked.txt'));
        assert.ok(names(top, 'file').includes('linked-folder'));
        await assert.rejects(wizard.read('linked.txt'), /not a file the Wizard was shown/i);
        await assert.rejects(wizard.list('linked-folder'), /not a folder the Wizard was shown/i);
      } finally {
        for (const path of [link, folderLink, target]) rmSync(path, { force: true });
      }
    });
  });

  describe('writing the workflow file', () => {
    const workflow = 'name: GrillMyCode\non: workflow_dispatch\n';
    let original;

    before(() => {
      original = onDisk(workflowUri);
    });

    // Other tests read this file, so it goes back as it was.
    after(async () => {
      wizard.prompts.confirmReplace = async () => true;
      await wizard.saveWorkflow(original);
      assert.strictEqual(onDisk(workflowUri), original);
    });

    it('leaves a file that is there alone unless told to replace it', async () => {
      const asked = [];
      wizard.prompts.confirmReplace = async (name) => {
        asked.push(name);
        return false;
      };
      assert.strictEqual(await wizard.saveWorkflow(workflow), false);
      assert.deepStrictEqual(asked, [folder.name]);
      assert.strictEqual(onDisk(workflowUri), original);
    });

    it('replaces it when told to, and shows it', async () => {
      wizard.prompts.confirmReplace = async () => true;
      assert.strictEqual(await wizard.saveWorkflow(workflow), true);
      assert.strictEqual(onDisk(workflowUri), workflow);
      assert.strictEqual(
        vscode.window.activeTextEditor.document.uri.toString(),
        workflowUri.toString(),
      );
      assert.strictEqual(vscode.window.activeTextEditor.document.isDirty, false);
    });

    it('creates the file, and its folders, where there is none', async () => {
      await vscode.workspace.fs.delete(vscode.Uri.joinPath(folder.uri, '.github'), {
        recursive: true,
      });
      wizard.prompts.confirmReplace = () => assert.fail('asked about a file that is not there');
      assert.strictEqual(await wizard.saveWorkflow(workflow), true);
      assert.strictEqual(onDisk(workflowUri), workflow);
    });

    it('refuses what is not a workflow', async () => {
      await assert.rejects(wizard.saveWorkflow(''), /not a workflow/i);
      await assert.rejects(wizard.saveWorkflow({ yaml: workflow }), /not a workflow/i);
      await assert.rejects(wizard.saveWorkflow('a'.repeat(200_001)), /not a workflow/i);
      assert.strictEqual(onDisk(workflowUri), workflow);
    });
  });
});
