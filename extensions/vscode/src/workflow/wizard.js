/**
 * Workflow Wizard
 *
 * The docs site's Workflow Wizard in an editor tab. The Wizard itself is the
 * docs site's code, bundled into dist/wizard.js from
 * docs-site/docs/_workflow-wizard/ (see ../webview/wizard.js), so there is one
 * Wizard to keep.
 *
 * This module is the editor's half: it opens the tab, and answers what the
 * page asks for. A page cannot read a folder or write a file, so it asks, and
 * the answers are what make the Wizard worth having here: its file preview
 * reads the folder that is open, and its last step writes the workflow file.
 *
 * The page runs a script, which the Selected Question view never may. It can,
 * because it shows nothing from an issue: only the Wizard, and the names of
 * the instructor's own files. What it may ask for is still kept narrow. It is
 * given files only from a folder the instructor chose, and only those a
 * listing has named (FolderRecord in ../shared/wizard.js).
 */

import { randomBytes } from 'crypto';
import { open } from 'fs/promises';
import * as vscode from 'vscode';
import {
  ACTION_REF,
  DOCS_URL,
  WIZARD_MAX_FILE_BYTES,
  WIZARD_MAX_WORKFLOW_CHARS,
  WORKFLOW_FILE,
} from '../shared/constants.js';
import {
  CANCELLED,
  FOLDERS_NOTICE,
  FolderRecord,
  isRequest,
  wizardPage,
} from '../shared/wizard.js';

/** @import { WizardRequest } from '../shared/wizard.js' */

const PANEL_TYPE = 'grillmycode.workflowWizard';
const PANEL_TITLE = 'Workflow Wizard';

/** The bundle's two files, in dist/ beside the extension's own. */
const SCRIPT_FILE = 'wizard.js';
const STYLE_FILE = 'wizard.css';

/** Refuses a request because the instructor closed a prompt without choosing. */
function cancelled() {
  const err = new Error('cancelled');
  err.name = CANCELLED;
  return err;
}

/** @param {vscode.Uri} uri */
async function exists(uri) {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * The first `limit` bytes of a file. A folder on this computer is read
 * through Node, which can stop there; the editor's own file system reads a
 * file whole.
 *
 * @param {vscode.Uri} uri
 * @param {number} limit
 */
async function readStart(uri, limit) {
  if (uri.scheme !== 'file') return (await vscode.workspace.fs.readFile(uri)).subarray(0, limit);
  const file = await open(uri.fsPath, 'r');
  try {
    const { bytesRead, buffer } = await file.read(Buffer.alloc(limit), 0, limit, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
}

export class WorkflowWizard {
  /**
   * The questions put to the instructor. Properties, so that test-host/ can
   * answer them: a test cannot press a button in a dialog.
   */
  prompts = {
    /**
     * Which of several open folders: resolves to one, or undefined.
     *
     * @param {string} placeHolder
     */
    pickOpenFolder: (placeHolder) => vscode.window.showWorkspaceFolderPick({ placeHolder }),
    /** A folder from anywhere on the computer: resolves to its URI, or undefined. */
    chooseFolder: async () => {
      const chosen = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Use This Folder',
        title: 'Choose a folder of the kind of work your students will submit',
      });
      return chosen?.[0];
    },
    /**
     * Whether to replace the workflow file a folder already has.
     *
     * @param {string} folderName
     */
    confirmReplace: async (folderName) => {
      const replace = 'Replace';
      const answer = await vscode.window.showWarningMessage(
        `${folderName} already has ${WORKFLOW_FILE}. Replace what is in it?`,
        { modal: true, detail: 'You can undo the change in the file once it is open.' },
        replace,
      );
      return answer === replace;
    },
  };

  #extensionUri;
  /** @type {vscode.WebviewPanel | undefined} */
  #panel;
  /**
   * The folder the page is reading: `{ uri, record }`.
   *
   * @type {{ uri: vscode.Uri, record: FolderRecord } | undefined}
   */
  #folder;
  /**
   * `{ promise, resolve }`: settled when the page says the Wizard is on screen.
   *
   * @type {{ promise: Promise<void>, resolve: () => void } | undefined}
   */
  #mounted;
  /** @type {vscode.Disposable[]} */
  #disposables = [];

  /** @param {vscode.ExtensionContext} context */
  constructor(context) {
    this.#extensionUri = context.extensionUri;
  }

  start() {
    this.#disposables.push(
      vscode.commands.registerCommand('grillmycode.openWorkflowWizard', () => this.open()),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.#tellFolders()),
    );
  }

  dispose() {
    this.#panel?.dispose();
    for (const disposable of this.#disposables) disposable.dispose();
  }

  /**
   * Opens the Wizard's tab, or brings it to the front if it is open: there is
   * one, so going back to it finds the answers given so far. Resolves once the
   * Wizard is on screen.
   */
  open() {
    if (this.#panel) {
      this.#panel.reveal();
      return this.#mounted?.promise;
    }
    const dist = vscode.Uri.joinPath(this.#extensionUri, 'dist');
    const panel = vscode.window.createWebviewPanel(
      PANEL_TYPE,
      PANEL_TITLE,
      vscode.ViewColumn.Active,
      // Kept while another tab is in front, so the answers are not lost.
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [dist] },
    );
    this.#panel = panel;
    /** @type {() => void} */
    let resolve = () => {};
    /** @type {Promise<void>} */
    const promise = new Promise((settle) => (resolve = settle));
    this.#mounted = { promise, resolve };
    panel.onDidDispose(() => {
      this.#panel = undefined;
      this.#folder = undefined;
    });
    panel.webview.onDidReceiveMessage((message) => this.#receive(panel, message));
    panel.webview.html = wizardPage({
      nonce: randomBytes(16).toString('base64'),
      source: panel.webview.cspSource,
      scriptUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(dist, SCRIPT_FILE)),
      styleUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(dist, STYLE_FILE)),
      actionRef: ACTION_REF,
      docsBase: DOCS_URL,
    });
    return promise;
  }

  /**
   * @param {vscode.WebviewPanel} panel
   * @param {unknown} message
   */
  async #receive(panel, message) {
    if (!isRequest(message)) return;
    if (message.type === 'ready') {
      this.#mounted?.resolve();
      this.#tellFolders();
      return;
    }
    let reply;
    try {
      reply = { id: message.id, ok: true, value: await this.#answer(message) };
    } catch (err) {
      reply = { id: message.id, ok: false, error: { name: err.name, message: err.message } };
    }
    // The tab may have been closed while the answer was worked out.
    if (this.#panel === panel) panel.webview.postMessage(reply);
  }

  /** @param {WizardRequest} message */
  #answer(message) {
    switch (message.type) {
      case 'pickFolder':
        return this.pickFolder(message.choose === true);
      case 'list':
        return this.list(message.path);
      case 'read':
        return this.read(message.path, message.bytes);
      case 'saveWorkflow':
        return this.saveWorkflow(message.yaml);
      default:
        throw new Error(`Unknown request: ${message.type}`);
    }
  }

  /** Tells the page whether a folder is open, which changes what it offers. */
  #tellFolders() {
    const folders = vscode.workspace.workspaceFolders ?? [];
    this.#panel?.webview.postMessage({
      type: FOLDERS_NOTICE,
      openFolder: folders.map((folder) => folder.name).join(', '),
    });
  }

  /**
   * Settles which folder the page reads, and returns its name: the open one,
   * or with `choose`, or with none open, one the instructor picks. From then
   * on `list` and `read` answer for that folder alone.
   */
  async pickFolder(choose = false) {
    const folders = vscode.workspace.workspaceFolders ?? [];
    let uri;
    let name;
    if (choose || folders.length === 0) {
      uri = await this.prompts.chooseFolder();
      name = uri?.path.split('/').filter(Boolean).pop() ?? '/';
    } else {
      const folder =
        folders.length === 1
          ? folders[0]
          : await this.prompts.pickOpenFolder('The folder to try the patterns on');
      ({ uri, name } = folder ?? {});
    }
    if (!uri) throw cancelled();
    this.#folder = { uri, record: new FolderRecord() };
    return { name };
  }

  /**
   * What a folder holds, as `[{ name, kind }]`. `path` is '' for the folder picked.
   *
   * @param {unknown} path
   */
  async list(path) {
    const folder = this.#folder;
    if (!folder?.record.hasFolder(path)) throw new Error('Not a folder the Wizard was shown.');
    const uri = path ? vscode.Uri.joinPath(folder.uri, ...path.split('/')) : folder.uri;
    const entries = await vscode.workspace.fs.readDirectory(uri);
    return folder.record.add(
      path,
      entries.map(([name, type]) => ({
        name,
        isFile: type === vscode.FileType.File,
        isFolder: type === vscode.FileType.Directory,
        isLink: (type & vscode.FileType.SymbolicLink) !== 0,
      })),
    );
  }

  /**
   * A file's text, or with `bytes` the text of that many of its first bytes.
   * A file too large to give in full is refused, which the Wizard takes as a
   * file it could not read.
   *
   * @param {unknown} path
   * @param {unknown} [bytes]
   */
  async read(path, bytes) {
    const folder = this.#folder;
    if (!folder?.record.hasFile(path)) throw new Error('Not a file the Wizard was shown.');
    const uri = vscode.Uri.joinPath(folder.uri, ...path.split('/'));
    const whole = typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes <= 0;
    const limit = whole ? WIZARD_MAX_FILE_BYTES + 1 : Math.min(bytes, WIZARD_MAX_FILE_BYTES);
    const content = await readStart(uri, limit);
    if (whole && content.length > WIZARD_MAX_FILE_BYTES) throw new Error('The file is too large.');
    return new TextDecoder().decode(content);
  }

  /**
   * Writes the workflow to WORKFLOW_FILE in the open folder and shows it.
   * Resolves to false if the instructor backs out. With no folder open there
   * is nowhere to write it, so it is shown as a new file to save.
   *
   * @param {unknown} yaml
   */
  async saveWorkflow(yaml) {
    if (typeof yaml !== 'string' || !yaml.trim() || yaml.length > WIZARD_MAX_WORKFLOW_CHARS) {
      throw new Error('Not a workflow.');
    }
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 0) {
      await this.#show(
        await vscode.workspace.openTextDocument({ language: 'yaml', content: yaml }),
      );
      vscode.window.showInformationMessage(
        `No folder is open, so the workflow is in a new file. Save it as ${WORKFLOW_FILE} in your assignment template repository.`,
      );
      return true;
    }
    const folder =
      folders.length === 1
        ? folders[0]
        : await this.prompts.pickOpenFolder('The folder to create the workflow file in');
    if (!folder) return false;

    const uri = vscode.Uri.joinPath(folder.uri, ...WORKFLOW_FILE.split('/'));
    if (await exists(uri)) {
      if (!(await this.prompts.confirmReplace(folder.name))) return false;
      // Replaced as an edit, so it can be undone, and so a copy of the file
      // that is open with changes of its own is replaced too.
      const document = await vscode.workspace.openTextDocument(uri);
      const all = document.validateRange(new vscode.Range(0, 0, document.lineCount, 0));
      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, all, yaml);
      if (!(await vscode.workspace.applyEdit(edit))) throw new Error('The edit was refused.');
      await document.save();
    } else {
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
      await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(yaml));
    }
    await this.#show(await vscode.workspace.openTextDocument(uri));
    return true;
  }

  /**
   * Shows a file beside the Wizard, whose last step says what to do next.
   *
   * @param {vscode.TextDocument} document
   */
  #show(document) {
    return vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: false,
    });
  }
}
