// Runs inside VS Code (pnpm test:host), against the throwaway clone that
// .vscode-test.mjs makes. The questions come from the shared fixtures, handed
// to the controller directly, so no test needs a GitHub sign-in.

const assert = require('assert');
const { readFileSync } = require('fs');
const { join } = require('path');
const vscode = require('vscode');

const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'current', 'default-branch');

/** The fixture as the GitHub REST API would list it. */
function fixtureIssue() {
  const { title, labels } = JSON.parse(readFileSync(join(FIXTURE, 'issue.json'), 'utf-8'));
  return {
    number: 1,
    title,
    labels: labels.map((name) => ({ name })),
    html_url: 'https://github.com/my-school/cs-principles-lab-3-jsmith/issues/1',
    updated_at: '2026-01-15T14:30:00Z',
    body: readFileSync(join(FIXTURE, 'body.md'), 'utf-8'),
  };
}

/** Waits until `check` returns something truthy, and returns it. */
async function until(check, what) {
  for (let i = 0; i < 100; i++) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for ${what}`);
}

describe('GrillMyCode', () => {
  let controller;

  before(async () => {
    const extension = vscode.extensions.getExtension('GrillMyCode.grillmycode');
    assert.ok(extension, 'the extension is installed');
    ({ controller } = await extension.activate());
  });

  it('registers its commands', async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const name of ['refresh', 'signIn', 'selectIssue', 'openIssue', 'openQuestion']) {
      assert.ok(commands.includes(`grillmycode.${name}`), `grillmycode.${name}`);
    }
  });

  // The clone has a GitHub remote and nobody is signed in, so the extension
  // finds the repository and stops at the sign-in prompt without asking.
  it('finds the repository and waits for a sign-in', async () => {
    await until(() => controller.state === 'signedOut', 'the signed-out state');
  });

  it('shows the questions of a report', async () => {
    controller.showIssues([fixtureIssue()]);
    assert.strictEqual(controller.state, 'ready');
  });

  it('shows nothing for an issue that is not a report', async () => {
    controller.showIssues([{ ...fixtureIssue(), body: 'Not a report.' }]);
    assert.strictEqual(controller.state, 'noIssue');
    controller.showIssues([fixtureIssue()]);
  });

  it('opens a question at the lines it asks about', async () => {
    // Question 2 of the fixture shows src/cart.js, line 16.
    await vscode.commands.executeCommand('grillmycode.openQuestion', {
      question: {
        number: 2,
        broader: false,
        question: 'Why is the total rounded?',
        snippets: [{ file: 'src/cart.js', start_line: 16, end_line: 16, language: 'js', code: '' }],
      },
    });
    const editor = vscode.window.activeTextEditor;
    assert.ok(editor.document.uri.path.endsWith('/src/cart.js'));
    assert.strictEqual(editor.document.lineAt(editor.selection.active.line).text, '// line 16');
  });

  it('cuts a range that runs past the end of the file', async () => {
    await vscode.commands.executeCommand('grillmycode.openQuestion', {
      question: { number: 3, broader: false, question: 'Past the end?', snippets: [] },
      snippet: { file: 'src/pricing/tax.js', start_line: 400, end_line: 410 },
    });
    const editor = vscode.window.activeTextEditor;
    assert.ok(editor.document.uri.path.endsWith('/src/pricing/tax.js'));
    assert.strictEqual(editor.selection.active.line, editor.document.lineCount - 1);
  });

  it('opens nothing for a path that leaves the repository', async () => {
    const before = vscode.window.activeTextEditor.document.uri.toString();
    await vscode.commands.executeCommand('grillmycode.openQuestion', {
      question: {
        number: 4,
        broader: false,
        question: 'Outside?',
        snippets: [{ file: '../outside.js', start_line: 1, end_line: 1, language: '', code: '' }],
      },
    });
    assert.strictEqual(vscode.window.activeTextEditor.document.uri.toString(), before);
  });
});
