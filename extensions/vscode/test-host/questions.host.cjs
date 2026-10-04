// Runs inside VS Code (pnpm test:host), against the throwaway clone that
// .vscode-test.mjs makes. The questions and the answer key come from the
// shared fixtures, handed to the controller directly, so no test needs a
// GitHub sign-in.

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

/**
 * The fixture's answer key, as an account that can read it gets it from
 * findAnswerKey. `own` says the repository is that account's.
 */
function fixtureKey({ own }) {
  const { questions } = JSON.parse(readFileSync(join(FIXTURE, 'questions.json'), 'utf-8'));
  return {
    questions,
    own,
    repo: 'cs-principles-lab-3-grillmycode-instructor',
    path: 'jsmith/data/questions.json',
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
    for (const name of [
      'refresh',
      'signIn',
      'selectIssue',
      'openIssue',
      'openQuestion',
      'showInstructorView',
      'showStudentView',
    ]) {
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

  it('asks for an update when the questions are in a newer layout', async () => {
    const issue = fixtureIssue();
    const body = issue.body.replace(/"version":\d+/, '"version":99');
    assert.notStrictEqual(body, issue.body);
    controller.showIssues([{ ...issue, body }]);
    assert.strictEqual(controller.state, 'needsUpdate');
    controller.showIssues([fixtureIssue()]);
    assert.strictEqual(controller.state, 'ready');
  });

  // The update message links to the extension's own page by this command,
  // which belongs to VS Code and not to this extension.
  it('can open its own page in the Extensions view', async () => {
    const commands = await vscode.commands.getCommands(false);
    assert.ok(commands.includes('extension.open'));
  });

  // The walkthrough's buttons run commands by name, and some of those belong
  // to VS Code: opening a folder, and showing the Questions view.
  it("has every command the walkthrough's buttons run", async () => {
    const { contributes } = require('../package.json');
    const linked = contributes.walkthroughs
      .flatMap(({ steps }) => steps)
      .flatMap(({ description }) => [...description.matchAll(/\(command:([\w.]+)/g)])
      .map(([, command]) => command);
    assert.ok(linked.length > 0);
    const commands = await vscode.commands.getCommands(false);
    for (const command of linked) assert.ok(commands.includes(command), command);
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

  // The tests from here on run in order: the view chosen by hand is remembered
  // for the repository, and the first three need none to have been chosen.
  describe('the views', () => {
    const show = (view) =>
      vscode.commands.executeCommand(
        view === 'instructor' ? 'grillmycode.showInstructorView' : 'grillmycode.showStudentView',
      );

    it('gives an account with no answer key the student view, and no other', async () => {
      controller.showIssues([fixtureIssue()]);
      assert.strictEqual(controller.view, 'student');
      await show('instructor');
      assert.strictEqual(controller.view, 'student');
    });

    it("opens the account's own repository in the student view", async () => {
      controller.showIssues([fixtureIssue()], fixtureKey({ own: true }));
      assert.strictEqual(controller.view, 'student');
      assert.strictEqual(controller.state, 'ready');
    });

    it("opens someone else's repository in the instructor view", async () => {
      controller.showIssues([fixtureIssue()], fixtureKey({ own: false }));
      assert.strictEqual(controller.view, 'instructor');
      assert.strictEqual(controller.state, 'ready');
    });

    it('shows the answer key in a repository that has no questions issue', async () => {
      controller.showIssues([], fixtureKey({ own: false }));
      assert.strictEqual(controller.view, 'instructor');
      assert.strictEqual(controller.state, 'ready');
    });

    it('switches between the views, and remembers the choice', async () => {
      controller.showIssues([fixtureIssue()], fixtureKey({ own: false }));
      await show('student');
      assert.strictEqual(controller.view, 'student');
      assert.strictEqual(controller.state, 'ready');

      controller.showIssues([fixtureIssue()], fixtureKey({ own: false }));
      assert.strictEqual(controller.view, 'student');

      await show('instructor');
      assert.strictEqual(controller.view, 'instructor');
    });

    it('says the student view has no questions when there is no issue', async () => {
      controller.showIssues([], fixtureKey({ own: false }));
      await show('student');
      assert.strictEqual(controller.state, 'noIssue');
      await show('instructor');
      assert.strictEqual(controller.state, 'ready');
    });

    // The instructor view was the last one chosen, and is still not shown.
    it('goes back to the student view when the answer key is gone', async () => {
      controller.showIssues([fixtureIssue()]);
      assert.strictEqual(controller.view, 'student');
      assert.strictEqual(controller.state, 'ready');
    });
  });
});
