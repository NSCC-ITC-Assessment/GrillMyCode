/**
 * Workflow Wizard, the parts that need no editor
 *
 * The Wizard runs in a page of its own, which asks the extension for what a
 * page cannot do: reading a folder and writing the workflow file. This module
 * holds what the two sides agree on, the page's HTML, and the record of what
 * the page has been shown, which is all it may ask for.
 */

import { OPENROUTER_ORIGIN } from './constants.js';

/**
 * What the page sends the extension. Every request but `ready` carries an
 * `id`, and is answered with `{ id, ok: true, value }` or
 * `{ id, ok: false, error: { name, message } }`.
 *
 *   ready                          the Wizard is on screen
 *   pickFolder   { choose }        → { name }: the folder to read
 *   list         { path }          → [{ name, kind }]: what a folder holds
 *   read         { path, bytes }   → the file's text, or its first `bytes` bytes
 *   saveWorkflow { yaml }          → true once written, false if cancelled
 */
export const REQUESTS = ['ready', 'pickFolder', 'list', 'read', 'saveWorkflow'];

/**
 * A message isRequest has passed. Only `type` and `id` are checked: the rest
 * is whatever the page sent, and is checked where it is used.
 *
 * @typedef {object} WizardRequest
 * @property {string} type
 * @property {number} [id]
 * @property {unknown} [choose]
 * @property {unknown} [path]
 * @property {unknown} [bytes]
 * @property {unknown} [yaml]
 */

/**
 * One thing a folder holds, as the editor's file system describes it.
 *
 * @typedef {{ name: string, isFile: boolean, isFolder: boolean, isLink: boolean }} FolderEntry
 */

/**
 * What the extension sends the page unasked: `{ type: 'folders', openFolder }`,
 * the name of the folder open in the editor, the names of several, or '' when
 * none is.
 */
export const FOLDERS_NOTICE = 'folders';

/** The name of the error a request is refused with when the instructor cancels. */
export const CANCELLED = 'AbortError';

/**
 * True for a message shaped like a request from the page.
 *
 * @param {any} message
 * @returns {message is WizardRequest}
 */
export function isRequest(message) {
  if (!message || typeof message !== 'object') return false;
  if (!REQUESTS.includes(message.type)) return false;
  return message.type === 'ready' || Number.isSafeInteger(message.id);
}

/**
 * A path inside a folder, as the page names it: `src/app.js`.
 *
 * @param {string} folder
 * @param {string} name
 */
export const joinPath = (folder, name) => (folder ? `${folder}/${name}` : name);

/**
 * What the page has been shown of the folder it is reading. The page may list
 * a folder, or read a file, only if an earlier listing named it, so no path it
 * sends is ever trusted: it is looked up here, never parsed.
 *
 * A link is listed as a file, which is what it is to Git, and is never read
 * or followed: what it points to may be outside the folder.
 */
export class FolderRecord {
  #folders = new Set(['']);
  /** @type {Set<string>} */
  #files = new Set();

  /**
   * Records what `folder` holds and returns it as the page is told it.
   * `entries` is `[{ name, isFile, isFolder, isLink }]`; one that is neither a
   * file, a folder nor a link, such as a socket, is left out.
   *
   * @param {string} folder
   * @param {FolderEntry[]} entries
   */
  add(folder, entries) {
    /** @type {{ name: string, kind: 'file' | 'directory' }[]} */
    const listed = [];
    for (const { name, isFile, isFolder, isLink } of entries) {
      const path = joinPath(folder, name);
      if (isLink) {
        listed.push({ name, kind: 'file' });
      } else if (isFolder) {
        this.#folders.add(path);
        listed.push({ name, kind: 'directory' });
      } else if (isFile) {
        this.#files.add(path);
        listed.push({ name, kind: 'file' });
      }
    }
    return listed;
  }

  /**
   * True for the folder itself (''), and for a folder a listing named.
   *
   * @param {unknown} path
   * @returns {path is string}
   */
  hasFolder(path) {
    return typeof path === 'string' && this.#folders.has(path);
  }

  /**
   * True for a file a listing named, other than a link.
   *
   * @param {unknown} path
   * @returns {path is string}
   */
  hasFile(path) {
    return typeof path === 'string' && this.#files.has(path);
  }
}

/**
 * Text as an HTML attribute's value.
 *
 * @param {unknown} text
 */
const attribute = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * The page the Wizard runs in. Its content security policy lets it run the one
 * script named here, by its nonce, load the one stylesheet, show images that
 * are part of the script, and reach OpenRouter for the list of models. Nothing
 * else: no other script, frame or address.
 *
 * `source` is what VS Code calls the page's own origin (webview.cspSource).
 *
 * @param {object} page
 * @param {string} page.nonce
 * @param {string} page.source
 * @param {{ toString(): string }} page.scriptUri
 * @param {{ toString(): string }} page.styleUri
 * @param {string} page.actionRef
 * @param {string} page.docsBase
 */
export function wizardPage({ nonce, source, scriptUri, styleUri, actionRef, docsBase }) {
  const policy = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src ${source}`,
    'img-src data:',
    `connect-src ${OPENROUTER_ORIGIN}`,
  ].join('; ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${attribute(policy)}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${attribute(styleUri)}">
<title>Workflow Wizard</title>
</head>
<body>
<div id="root" data-action-ref="${attribute(actionRef)}" data-docs-base="${attribute(docsBase)}"></div>
<script nonce="${attribute(nonce)}" src="${attribute(scriptUri)}"></script>
</body>
</html>`;
}
