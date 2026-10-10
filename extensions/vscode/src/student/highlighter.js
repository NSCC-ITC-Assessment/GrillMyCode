/**
 * Jump to code
 *
 * Opens the files a question's snippets name, each in a tab of its own, and
 * highlights their lines. The tabs it opened for one question are closed when
 * another is shown, as VS Code reuses a preview tab. A tab that was open
 * already, or that the reader has since edited or pinned, is left alone.
 */

import * as vscode from 'vscode';

/** @import { Snippet } from '../shared/report.js' */

/**
 * A file a question shows, with its lines cut to fit the file as it is now.
 *
 * @typedef {object} OpenFile
 * @property {string} key - The file's URI, as text.
 * @property {vscode.TextDocument} document
 * @property {vscode.Range[]} ranges - The first is the one the file opens at.
 */

/**
 * The URI of the file a tab shows, as text. Undefined for a tab that shows
 * anything else, such as a diff or a webview.
 *
 * @param {vscode.Tab} tab
 */
const fileOf = (tab) =>
  tab.input instanceof vscode.TabInputText ? tab.input.uri.toString() : undefined;

/**
 * True when a group of tabs has one on the file.
 *
 * @param {vscode.TabGroup} group
 * @param {string} key
 */
const hasTab = (group, key) => group.tabs.some((tab) => fileOf(tab) === key);

/**
 * @param {vscode.Range[] | undefined} a
 * @param {vscode.Range[]} b
 */
const sameRanges = (a, b) => a?.length === b.length && a.every((range, i) => range.isEqual(b[i]));

export class Highlighter {
  #decoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor('editor.rangeHighlightBackground'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.rangeHighlightForeground'),
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  });
  /**
   * The lines highlighted in each file, by the file's URI.
   *
   * @type {Map<string, vscode.Range[]>}
   */
  #ranges = new Map();
  /**
   * The tabs opened here on files that had none, by the file's URI: the view
   * column each is in. These are the tabs closed when another question is shown.
   *
   * @type {Map<string, vscode.ViewColumn>}
   */
  #opened = new Map();
  #subscriptions = [
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.contentChanges.length === 0) return;
      const key = event.document.uri.toString();
      // An edit can move the lines out from under the highlight, so it goes.
      if (this.#ranges.delete(key)) this.#paint();
      // And a file the reader is working in is theirs to close.
      this.#opened.delete(key);
    }),
    // A tab brought to the front is a new editor, which has no highlight yet.
    vscode.window.onDidChangeVisibleTextEditors(() => this.#paint()),
    // A tab the reader closes and opens again is theirs too.
    vscode.window.tabGroups.onDidChangeTabs(({ closed }) => {
      for (const tab of closed) {
        const key = fileOf(tab);
        if (key && this.#opened.get(key) === tab.group.viewColumn) this.#opened.delete(key);
      }
    }),
  ];

  /**
   * Opens the file of each snippet under `root`, in a tab of its own, and
   * highlights the snippets' lines. The file of `target`, one of the snippets,
   * is left in front with the keyboard, at that snippet. Then the tabs opened
   * here for the question before, on files this one does not show, are closed.
   *
   * The caller has already checked each path stays inside the repository
   * (openableSnippets). A range that runs past the end of the file is cut to
   * fit: the file has changed since the report, which the moved-code warning
   * says.
   *
   * Returns false when the target's file cannot be opened. The reader is told
   * of every file that cannot.
   *
   * @param {vscode.Uri} root
   * @param {Snippet[]} snippets
   * @param {Snippet} target
   */
  async show(root, snippets, target) {
    /** @type {Map<string, { uri: vscode.Uri, snippets: Snippet[] }>} */
    const named = new Map();
    for (const snippet of snippets) {
      const uri = vscode.Uri.joinPath(root, snippet.file);
      const entry = named.get(uri.toString()) ?? { uri, snippets: [] };
      named.set(uri.toString(), entry);
      // The target goes first, so that its file opens at it.
      if (snippet === target) entry.snippets.unshift(snippet);
      else entry.snippets.push(snippet);
    }

    /** @type {OpenFile[]} */
    const files = [];
    /** @type {OpenFile | undefined} */
    let front;
    /** @type {string[]} */
    const missing = [];
    for (const [key, entry] of named) {
      let document;
      try {
        document = await vscode.workspace.openTextDocument(entry.uri);
      } catch {
        missing.push(entry.snippets[0].file);
        continue;
      }
      const last = document.lineCount - 1;
      const ranges = entry.snippets.map((snippet) => {
        const start = Math.min(snippet.start_line - 1, last);
        const end = Math.min(snippet.end_line - 1, last);
        return new vscode.Range(start, 0, end, document.lineAt(end).text.length);
      });
      const file = { key, document, ranges };
      files.push(file);
      if (entry.snippets[0] === target) front = file;
    }
    if (missing.length > 0) {
      const names = new Intl.ListFormat('en').format(missing);
      vscode.window.showWarningMessage(
        `${names} could not be opened. ${missing.length === 1 ? 'It' : 'They'} may have been moved, renamed or deleted since these questions were written.`,
      );
    }

    const before = this.#ranges;
    this.#ranges = new Map(files.map((file) => [file.key, file.ranges]));

    // Each file is shown in turn, so the tabs stand in the question's order,
    // and the target's last, which leaves it in front. A file that already has
    // its tab is not shown again for that: the target's is shown once, and
    // another's not at all while its highlight is the one it was opened at.
    const group = vscode.window.tabGroups.activeTabGroup;
    const sequence = files.filter((file) =>
      file === front
        ? !hasTab(group, file.key)
        : !hasTab(group, file.key) || !sameRanges(before.get(file.key), file.ranges),
    );
    if (front && sequence.at(-1) !== front) sequence.push(front);
    for (const [i, file] of sequence.entries()) {
      await this.#open(file, file !== front || i < sequence.length - 1);
    }

    this.#paint();
    await this.#closeOthers();
    return Boolean(front);
  }

  /**
   * Shows a file in a tab that stays, at the first of its highlighted lines.
   *
   * @param {OpenFile} file
   * @param {boolean} preserveFocus - Leaves the keyboard where it is.
   */
  async #open({ key, document, ranges: [first] }, preserveFocus) {
    const had = vscode.window.tabGroups.all
      .filter((group) => hasTab(group, key))
      .map((group) => group.viewColumn);
    const editor = await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus,
      selection: new vscode.Range(first.start, first.start),
    });
    editor.revealRange(first, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    if (editor.viewColumn && !had.includes(editor.viewColumn)) {
      this.#opened.set(key, editor.viewColumn);
    }
  }

  /**
   * Closes the tabs opened here on files that are no longer highlighted. One
   * with unsaved changes, or one the reader has pinned, is left open.
   */
  async #closeOthers() {
    /** @type {vscode.Tab[]} */
    const stale = [];
    for (const [key, column] of this.#opened) {
      if (this.#ranges.has(key)) continue;
      this.#opened.delete(key);
      const group = vscode.window.tabGroups.all.find((g) => g.viewColumn === column);
      stale.push(
        ...(group?.tabs ?? []).filter(
          (tab) => fileOf(tab) === key && !tab.isDirty && !tab.isPinned,
        ),
      );
    }
    if (stale.length > 0) await vscode.window.tabGroups.close(stale, true);
  }

  /** Puts each highlight on the editors showing its file, and takes it off the rest. */
  #paint() {
    for (const editor of vscode.window.visibleTextEditors) {
      const ranges = this.#ranges.get(editor.document.uri.toString());
      editor.setDecorations(this.#decoration, ranges ?? []);
    }
  }

  /** Takes the highlights away. The tabs stay until another question is shown. */
  clear() {
    this.#ranges.clear();
    this.#paint();
  }

  dispose() {
    for (const subscription of this.#subscriptions) subscription.dispose();
    this.#decoration.dispose();
  }
}
