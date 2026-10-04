/**
 * Selected question
 *
 * The view under the list that shows the selected question in full: a tree row
 * holds one line, and a question and its code need more.
 *
 * The page runs no script and loads nothing. Its content security policy
 * allows only the style block below, and every piece of text from the issue is
 * escaped by shared/html.js before it gets here.
 */

import { randomBytes } from 'crypto';
import { questionToHtml } from '../shared/html.js';

const STYLE = `
  body { padding: 0 16px 16px; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); line-height: 1.5; }
  h2, h3 { font-size: 1em; font-weight: 600; margin: 12px 0 4px; }
  p { margin: 0 0 10px; }
  .hint, .caption { color: var(--vscode-descriptionForeground); }
  .caption { margin: 12px 0 4px; }
  code { font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }
  p code { background: var(--vscode-textCodeBlock-background); border-radius: 3px; padding: 1px 4px; }
  pre { background: var(--vscode-textCodeBlock-background); border-radius: 4px; margin: 0 0 10px; overflow-x: auto; padding: 8px 10px; }
  pre code { background: none; color: var(--vscode-editor-foreground); padding: 0; }
`;

export class QuestionView {
  /**
   * Turns the question into the page's body. The instructor view puts its own
   * here, which adds the answer.
   */
  toHtml = questionToHtml;

  #view;
  #question;

  /** Called by VS Code when the view first becomes visible. */
  resolveWebviewView(view) {
    this.#view = view;
    view.webview.options = { enableScripts: false, localResourceRoots: [] };
    view.onDidDispose(() => (this.#view = undefined));
    this.#render();
  }

  /** Shows a question, or the prompt to select one when given undefined. */
  show(question) {
    this.#question = question;
    this.#render();
  }

  #render() {
    if (!this.#view) return;
    const nonce = randomBytes(16).toString('base64');
    this.#view.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style nonce="${nonce}">${STYLE}</style>
</head>
<body>${this.toHtml(this.#question)}</body>
</html>`;
  }
}
