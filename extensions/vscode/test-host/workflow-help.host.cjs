// Runs inside VS Code (pnpm test:host), on the workflow file that
// .vscode-test.mjs puts in the throwaway clone. The copy of VS Code the tests
// run in has no GitHub Actions extension, so the help is all this extension's.

const assert = require('assert');
const vscode = require('vscode');

/** Waits until `check` returns something truthy, and returns it. */
async function until(check, what) {
  for (let i = 0; i < 100; i++) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for ${what}`);
}

describe('GrillMyCode workflow help', () => {
  let document;

  /** The problems this extension reports for the workflow file. */
  const problems = () =>
    vscode.languages
      .getDiagnostics(document.uri)
      .filter((diagnostic) => diagnostic.source === 'GrillMyCode');

  /** The position just after the first `text` in the file. */
  const after = (text) => {
    const at = document.getText().indexOf(text);
    assert.notStrictEqual(at, -1, text);
    return document.positionAt(at + text.length);
  };

  /** Replaces the first `from` in the file with `to`. */
  async function replace(from, to) {
    const end = after(from);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(document.positionAt(document.offsetAt(end) - from.length), end),
      to,
    );
    assert.ok(await vscode.workspace.applyEdit(edit));
  }

  before(async () => {
    const [folder] = vscode.workspace.workspaceFolders;
    const uri = vscode.Uri.joinPath(folder.uri, '.github', 'workflows', 'grill-my-code.yml');
    document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);
    await vscode.extensions.getExtension('GrillMyCode.grillmycode').activate();
  });

  it('underlines a value the action rejects', async () => {
    const [problem] = await until(() => problems().length > 0 && problems(), 'a problem');
    assert.strictEqual(problems().length, 1);
    assert.strictEqual(problem.code, 'invalid-value');
    assert.strictEqual(problem.severity, vscode.DiagnosticSeverity.Error);
    assert.strictEqual(document.getText(problem.range), 'asks');
    assert.match(problem.message, /starter_code must be one of/);
  });

  it('offers the values of an input', async () => {
    const list = await vscode.commands.executeCommand(
      'vscode.executeCompletionItemProvider',
      document.uri,
      after('starter_code: '),
    );
    const values = list.items.filter((item) => item.kind === vscode.CompletionItemKind.Value);
    assert.deepStrictEqual(
      values.map((item) => item.label),
      ['none', 'ignore', 'context', 'ask'],
    );
    assert.strictEqual(values.find((item) => item.label === 'ignore').detail, 'default');
  });

  it('offers the inputs the step does not set yet', async () => {
    await replace('asks\n', 'asks\n          \n');
    const list = await vscode.commands.executeCommand(
      'vscode.executeCompletionItemProvider',
      document.uri,
      after('asks\n          '),
    );
    const inputs = list.items
      .filter((item) => item.kind === vscode.CompletionItemKind.Property)
      .map((item) => item.label);
    assert.ok(inputs.includes('num_questions'));
    assert.ok(!inputs.includes('api_key'));
    assert.ok(!inputs.includes('starter_code'));
    await replace('asks\n          \n', 'asks\n');
  });

  it('describes an input under the pointer', async () => {
    const position = after('starter_co');
    const hovers = await vscode.commands.executeCommand(
      'vscode.executeHoverProvider',
      document.uri,
      position,
    );
    const text = hovers
      .flatMap((hover) => hover.contents.map((part) => part.value ?? part))
      .join('\n');
    assert.match(text, /What the repository's first commit is/);
    assert.match(text, /Default: `ignore`/);
  });

  it('checks the file again as it is edited', async () => {
    await replace('starter_code: asks', 'starter_code: ask');
    await until(() => problems().length === 0, 'the problem to go');
    await replace('starter_code: ask', 'starter_code: asks');
    await until(() => problems().length === 1, 'the problem to come back');
  });

  it('leaves every other step alone', async () => {
    const list = await vscode.commands.executeCommand(
      'vscode.executeCompletionItemProvider',
      document.uri,
      after('fetch-depth: 0'),
    );
    const ours = list.items.filter((item) =>
      [vscode.CompletionItemKind.Value, vscode.CompletionItemKind.Property].includes(item.kind),
    );
    assert.deepStrictEqual(ours, []);
  });

  it('stops when its setting is switched off', async () => {
    const settings = vscode.workspace.getConfiguration('grillmycode');
    await settings.update('workflowHelp.enabled', false, vscode.ConfigurationTarget.Workspace);
    await until(() => problems().length === 0, 'the problem to go');
    await settings.update('workflowHelp.enabled', undefined, vscode.ConfigurationTarget.Workspace);
    await until(() => problems().length === 1, 'the problem to come back');
  });
});
