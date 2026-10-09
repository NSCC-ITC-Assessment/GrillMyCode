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
 * What is wrong and what to offer is decided in shared/, from the text alone.
 * This module puts the answers into the editor.
 */

import * as vscode from 'vscode';
import { checkWorkflow } from '../shared/input-checks.js';
import { completionsAt, describeInput, escapeMarkdown, inputAt } from '../shared/workflow-help.js';

/**
 * Workflow files, whatever language the editor gives them: the GitHub Actions
 * extension takes them over from YAML when it is installed.
 */
const WORKFLOW_FILES = { pattern: '**/.github/workflows/**/*.{yml,yaml}' };

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

/** An input's description, default and values, as hover and completion show them. */
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
  /** The pending check of each file that has changed, by its URI. */
  #pending = new Map();
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
      vscode.workspace.onDidChangeTextDocument(({ document }) => this.#checkSoon(document)),
      vscode.workspace.onDidCloseTextDocument((document) => this.#forget(document)),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(`${SETTINGS_SECTION}.${ENABLED_SETTING}`)) this.#checkAll();
      }),
      // The GitHub Actions extension being installed or removed changes what
      // is left to it.
      vscode.extensions.onDidChange(() => this.#checkAll()),
    );
    this.#checkAll();
  }

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

  #checkSoon(document) {
    const key = document.uri.toString();
    clearTimeout(this.#pending.get(key));
    this.#pending.set(
      key,
      setTimeout(() => this.#check(document), CHECK_DELAY_MS),
    );
  }

  #check(document) {
    const key = document.uri.toString();
    clearTimeout(this.#pending.get(key));
    this.#pending.delete(key);
    if (document.isClosed || !this.#enabled(document)) {
      this.#problems.delete(document.uri);
      return;
    }
    const problems = checkWorkflow(document.getText(), {
      unknownInputs: !this.#hasGitHubActions(),
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

  #forget(document) {
    clearTimeout(this.#pending.get(document.uri.toString()));
    this.#pending.delete(document.uri.toString());
    this.#problems.delete(document.uri);
  }

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
      if (kind === 'input') {
        const input = describeInput(label);
        item.documentation = documentation(input);
        // An input with a fixed set of values goes straight on to offer them.
        if (input.values.length > 0 && insert !== label) {
          item.command = { command: 'editor.action.triggerSuggest', title: 'Suggest' };
        }
      }
      return item;
    });
  }

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
