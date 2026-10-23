/**
 * Workflow help
 *
 * Help with the GrillMyCode step of a workflow file: problems with its inputs
 * underlined as they are typed, the values of an input offered where it has a
 * fixed set, and, where nothing else does it, the inputs themselves offered
 * and described.
 *
 * The GitHub Actions extension already offers and describes every action's
 * inputs, and reports one the action does not declare. Where it is installed
 * those three are left to it, so nothing is shown twice. It knows nothing of
 * what a value may be, or of inputs that depend on one another, which is what
 * this adds either way.
 *
 * What is wrong and what to offer is decided in shared/, from the text alone,
 * and the question sets of the other workflow files beside it. This module
 * reads those files, and puts the answers into the editor.
 */

import * as vscode from 'vscode';
import { OTHER_WORKFLOW_MAX_BYTES } from '../shared/constants.js';
import { checkWorkflow, questionSets } from '../shared/input-checks.js';
import { completionsAt, describeInput, escapeMarkdown, inputAt } from '../shared/workflow-help.js';

/** @import { InputDescription } from '../shared/workflow-help.js' */
/** @import { OtherWorkflow } from '../shared/input-checks.js' */

/**
 * Workflow files, whatever language the editor gives them: the GitHub Actions
 * extension takes them over from YAML when it is installed.
 */
const WORKFLOW_FILES = { pattern: '**/.github/workflows/**/*.{yml,yaml}' };

/** Where a workflow file's path from its repository starts. */
const WORKFLOWS_FOLDER = '.github/workflows/';

/**
 * A workflow file's path from its repository, as github.workflow gives it for
 * a workflow with no name: `.github/workflows/grill-my-code.yml`.
 *
 * @param {vscode.Uri} uri
 */
function repositoryPath(uri) {
  return uri.path.slice(uri.path.lastIndexOf(`/${WORKFLOWS_FOLDER}`) + 1);
}

/** The GitHub Actions extension, which has its own help for an action's inputs. */
const GITHUB_ACTIONS_EXTENSION = 'github.vscode-github-actions';

/** The setting that switches all of this off. */
const SETTINGS_SECTION = 'grillmycode';
const ENABLED_SETTING = 'workflowHelp.enabled';

/** How long a file must be left alone before it is checked again, in milliseconds. */
const CHECK_DELAY_MS = 300;

const SEVERITIES = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
};

/**
 * An input's description, default and values, as hover and completion show them.
 *
 * @param {InputDescription} input
 */
function documentation(input) {
  const text = new vscode.MarkdownString(escapeMarkdown(input.description));
  if (input.values.length > 0) {
    const values = input.values.map((value) => `\`${value}\``).join(', ');
    text.appendMarkdown(`\n\nValues: ${values}`);
  }
  if (input.default !== '') text.appendMarkdown(`\n\nDefault: \`${input.default}\``);
  return text;
}

export class WorkflowHelp {
  #problems = vscode.languages.createDiagnosticCollection('grillmycode');
  /**
   * The pending check of each file that has changed, by its URI.
   *
   * @type {Map<string, ReturnType<typeof setTimeout>>}
   */
  #pending = new Map();
  /**
   * The latest check of each file, by its URI. A check reads the other
   * workflow files first, and one overtaken meanwhile shows nothing.
   *
   * @type {Map<string, number>}
   */
  #latest = new Map();
  #checks = 0;
  /** @type {vscode.Disposable[]} */
  #disposables = [this.#problems];

  start() {
    this.#disposables.push(
      vscode.languages.registerCompletionItemProvider(
        WORKFLOW_FILES,
        { provideCompletionItems: (document, position) => this.#complete(document, position) },
        ' ',
      ),
      vscode.languages.registerHoverProvider(WORKFLOW_FILES, {
        provideHover: (document, position) => this.#hover(document, position),
      }),
      vscode.workspace.onDidOpenTextDocument((document) => this.#check(document)),
      // A change to one workflow file can change what the others share with it.
      vscode.workspace.onDidChangeTextDocument(({ document }) => {
        if (vscode.languages.match(WORKFLOW_FILES, document) > 0) this.#checkAllSoon();
      }),
      vscode.workspace.onDidCloseTextDocument((document) => this.#forget(document)),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(`${SETTINGS_SECTION}.${ENABLED_SETTING}`)) this.#checkAll();
      }),
      // The GitHub Actions extension being installed or removed changes what
      // is left to it.
      vscode.extensions.onDidChange(() => this.#checkAll()),
    );
    // A workflow file added, removed or saved from outside the editor.
    const watcher = vscode.workspace.createFileSystemWatcher(WORKFLOW_FILES.pattern);
    this.#disposables.push(
      watcher,
      watcher.onDidCreate(() => this.#checkAllSoon()),
      watcher.onDidDelete(() => this.#checkAllSoon()),
      watcher.onDidChange(() => this.#checkAllSoon()),
    );
    this.#checkAll();
  }

  /** @param {vscode.TextDocument} document */
  #enabled(document) {
    return (
      vscode.languages.match(WORKFLOW_FILES, document) > 0 &&
      vscode.workspace.getConfiguration(SETTINGS_SECTION, document).get(ENABLED_SETTING, true)
    );
  }

  /** True when the GitHub Actions extension is there to do its part. */
  #hasGitHubActions() {
    return vscode.extensions.getExtension(GITHUB_ACTIONS_EXTENSION) !== undefined;
  }

  #checkAll() {
    for (const document of vscode.workspace.textDocuments) this.#check(document);
  }

  #checkAllSoon() {
    for (const document of vscode.workspace.textDocuments) {
      if (vscode.languages.match(WORKFLOW_FILES, document) > 0) this.#checkSoon(document);
    }
  }

  /** @param {vscode.TextDocument} document */
  #checkSoon(document) {
    const key = document.uri.toString();
    clearTimeout(this.#pending.get(key));
    this.#pending.set(
      key,
      setTimeout(() => this.#check(document), CHECK_DELAY_MS),
    );
  }

  /** @param {vscode.TextDocument} document */
  async #check(document) {
    const key = document.uri.toString();
    clearTimeout(this.#pending.get(key));
    this.#pending.delete(key);
    const check = ++this.#checks;
    this.#latest.set(key, check);
    if (document.isClosed || !this.#enabled(document)) {
      this.#problems.delete(document.uri);
      return;
    }
    const otherWorkflows = await this.#otherWorkflows(document.uri);
    if (this.#latest.get(key) !== check || document.isClosed) return;
    const problems = checkWorkflow(document.getText(), {
      unknownInputs: !this.#hasGitHubActions(),
      path: repositoryPath(document.uri),
      otherWorkflows,
    });
    this.#problems.set(
      document.uri,
      problems.map(({ start, end, severity, code, message, deprecated }) => {
        const range = new vscode.Range(document.positionAt(start), document.positionAt(end));
        const diagnostic = new vscode.Diagnostic(range, message, SEVERITIES[severity]);
        diagnostic.source = 'GrillMyCode';
        diagnostic.code = code;
        if (deprecated) diagnostic.tags = [vscode.DiagnosticTag.Deprecated];
        return diagnostic;
      }),
    );
  }

  /**
   * The other workflow files in a workflow file's folder, with the question
   * sets each files under. A file open in the editor is read as it stands
   * there, saved or not; one that cannot be read, or is too large, is left out.
   *
   * @param {vscode.Uri} uri
   * @returns {Promise<OtherWorkflow[]>}
   */
  async #otherWorkflows(uri) {
    const folder = vscode.Uri.joinPath(uri, '..');
    let entries;
    try {
      entries = await vscode.workspace.fs.readDirectory(folder);
    } catch {
      return [];
    }
    /** @type {OtherWorkflow[]} */
    const others = [];
    for (const [name, type] of entries) {
      if (type !== vscode.FileType.File || !/\.ya?ml$/.test(name)) continue;
      const other = vscode.Uri.joinPath(folder, name);
      if (other.toString() === uri.toString()) continue;
      const open = vscode.workspace.textDocuments.find(
        (document) => document.uri.toString() === other.toString(),
      );
      let text = open?.getText();
      if (text === undefined) {
        try {
          if ((await vscode.workspace.fs.stat(other)).size > OTHER_WORKFLOW_MAX_BYTES) continue;
          text = new TextDecoder().decode(await vscode.workspace.fs.readFile(other));
        } catch {
          continue;
        }
      }
      const path = repositoryPath(other);
      others.push({ path, sets: questionSets(text, { path }) });
    }
    return others;
  }

  /** @param {vscode.TextDocument} document */
  #forget(document) {
    clearTimeout(this.#pending.get(document.uri.toString()));
    this.#pending.delete(document.uri.toString());
    this.#latest.delete(document.uri.toString());
    this.#problems.delete(document.uri);
  }

  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.Position} position
   */
  #complete(document, position) {
    if (!this.#enabled(document)) return undefined;
    const offered = completionsAt(document.getText(), document.offsetAt(position), {
      names: !this.#hasGitHubActions(),
    });
    if (!offered) return undefined;
    const range = new vscode.Range(
      document.positionAt(offered.start),
      document.positionAt(offered.end),
    );
    return offered.items.map(({ kind, label, insert, isDefault }, index) => {
      const item = new vscode.CompletionItem(
        label,
        kind === 'input' ? vscode.CompletionItemKind.Property : vscode.CompletionItemKind.Value,
      );
      item.insertText = insert;
      item.range = range;
      // Kept in the order the action declares them, not sorted by name.
      item.sortText = String(index).padStart(3, '0');
      if (isDefault) item.detail = 'default';
      const input = kind === 'input' ? describeInput(label) : undefined;
      if (input) {
        item.documentation = documentation(input);
        // An input with a fixed set of values goes straight on to offer them.
        if (input.values.length > 0 && insert !== label) {
          item.command = { command: 'editor.action.triggerSuggest', title: 'Suggest' };
        }
      }
      return item;
    });
  }

  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.Position} position
   */
  #hover(document, position) {
    if (!this.#enabled(document) || this.#hasGitHubActions()) return undefined;
    const found = inputAt(document.getText(), document.offsetAt(position));
    if (!found) return undefined;
    return new vscode.Hover(
      documentation(found.input),
      new vscode.Range(document.positionAt(found.start), document.positionAt(found.end)),
    );
  }

  dispose() {
    for (const timer of this.#pending.values()) clearTimeout(timer);
    for (const disposable of this.#disposables) disposable.dispose();
  }
}
