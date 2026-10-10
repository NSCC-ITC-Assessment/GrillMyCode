/**
 * Jump to code
 *
 * Opens the file a snippet names and highlights its lines.
 */

import * as vscode from 'vscode';

/** @import { Snippet } from '../shared/report.js' */

export class Highlighter {
  #decoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor('editor.rangeHighlightBackground'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.rangeHighlightForeground'),
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  });
  /** @type {vscode.TextEditor | undefined} */
  #editor;
  #subscription = vscode.workspace.onDidChangeTextDocument((event) => {
    // An edit can move the lines out from under the highlight, so it goes.
    if (event.document === this.#editor?.document && event.contentChanges.length > 0) this.clear();
  });

  /**
   * Opens `snippet.file` under `root` and highlights its lines. The caller has
   * already checked the path stays inside the repository (openableSnippets).
   * A range that runs past the end of the file is cut to fit: the file has
   * changed since the report, which the moved-code warning says.
   *
   * Returns false, after telling the reader, when the file cannot be opened.
   *
   * @param {vscode.Uri} root
   * @param {Snippet} snippet
   */
  async show(root, snippet) {
    const uri = vscode.Uri.joinPath(root, snippet.file);
    let document;
    try {
      document = await vscode.workspace.openTextDocument(uri);
    } catch {
      vscode.window.showWarningMessage(
        `${snippet.file} could not be opened. It may have been moved, renamed or deleted since these questions were written.`,
      );
      return false;
    }

    const last = document.lineCount - 1;
    const start = Math.min(snippet.start_line - 1, last);
    const end = Math.min(snippet.end_line - 1, last);
    const range = new vscode.Range(start, 0, end, document.lineAt(end).text.length);

    const editor = await vscode.window.showTextDocument(document, {
      selection: new vscode.Range(start, 0, start, 0),
    });
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);

    this.clear();
    editor.setDecorations(this.#decoration, [range]);
    this.#editor = editor;
    return true;
  }

  clear() {
    this.#editor?.setDecorations(this.#decoration, []);
    this.#editor = undefined;
  }

  dispose() {
    this.#subscription.dispose();
    this.#decoration.dispose();
  }
}
