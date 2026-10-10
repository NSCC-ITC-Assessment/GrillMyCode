/**
 * The page's line to the extension
 *
 * A page in the editor cannot read a folder or write a file. It asks the
 * extension, which answers (WorkflowWizard in ../workflow/wizard.js). The
 * requests and their answers are listed in ../shared/wizard.js.
 */

/* global acquireVsCodeApi */

import { FOLDERS_NOTICE, joinPath } from '../shared/wizard.js';

const editor = acquireVsCodeApi();

/** The requests not answered yet: id → { resolve, reject }. */
const waiting = new Map();
let lastId = 0;
let onFolders = () => {};

window.addEventListener('message', ({ data }) => {
  if (data?.type === FOLDERS_NOTICE) {
    onFolders(String(data.openFolder ?? ''));
    return;
  }
  const asked = waiting.get(data?.id);
  if (!asked) return;
  waiting.delete(data.id);
  if (data.ok) {
    asked.resolve(data.value);
  } else {
    const err = new Error(data.error?.message);
    // The name says a prompt was cancelled, which the Wizard does not report.
    err.name = data.error?.name ?? 'Error';
    asked.reject(err);
  }
});

function ask(type, details) {
  return new Promise((resolve, reject) => {
    lastId += 1;
    waiting.set(lastId, { resolve, reject });
    editor.postMessage({ ...details, type, id: lastId });
  });
}

/**
 * Says the Wizard is on screen, and has `listener` called with the name of the
 * folder open in the editor, now and whenever that changes.
 */
export function ready(listener) {
  onFolders = listener;
  editor.postMessage({ type: 'ready' });
}

// The Wizard's own readFolder.js walks a folder the browser's folder picker
// hands it. These two give a folder in the editor the same shape, so that code
// walks it as it stands: which folders it skips and where it stops is decided
// there, once.

function fileHandle(name, path) {
  return {
    kind: 'file',
    name,
    getFile: async () => ({
      text: () => ask('read', { path }),
      // readFolder.js takes only the start of a file, to tell text from binary.
      slice: (start, end) => ({
        text: () =>
          start === 0
            ? ask('read', { path, bytes: end })
            : Promise.reject(new Error('Only the start of a file can be read.')),
      }),
    }),
  };
}

function folderHandle(name, path) {
  return {
    kind: 'directory',
    name,
    async *values() {
      for (const entry of await ask('list', { path })) {
        const child = joinPath(path, entry.name);
        yield entry.kind === 'directory'
          ? folderHandle(entry.name, child)
          : fileHandle(entry.name, child);
      }
    },
  };
}

/** The Wizard's `host` (see docs-site/docs/_workflow-wizard/index.js). */
export function wizardHost(openFolder) {
  return {
    openFolder,
    pickFolder: async ({ choose = false } = {}) => {
      const { name, ignoredLeftOut } = await ask('pickFolder', { choose });
      return { ...folderHandle(name, ''), ignoredLeftOut: ignoredLeftOut === true };
    },
    saveWorkflow: (yaml) => ask('saveWorkflow', { yaml }),
  };
}
