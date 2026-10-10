// Reads a folder on the instructor's computer for the Files step's preview:
// the paths of its files, the text of the few dependency manifests the rules
// read (package.json and so on), and the start of each file, to tell which are
// binary. It all happens in the browser — nothing is sent anywhere.
//
// Two ways in, since browsers differ. Chrome and Edge offer a folder picker
// that lets this code walk the folder itself and skip what it doesn't need.
// Firefox and Safari hand over the whole folder's file list at once, through
// a file input.

import {
  PREVIEW_BINARY_CHECK_BYTES,
  PREVIEW_MAX_FILES,
  isDependencyFolder,
  manifestPaths,
} from './filePreview';
import { isBinary } from './fileSelection';

// Files read at once when checking for binary ones.
const READS_AT_ONCE = 32;

/** Whether the browser has the folder picker (the File System Access API). */
export function canPickFolder() {
  // Not every browser has it, so the page's own types leave it out.
  return typeof window !== 'undefined' && typeof (/** @type {any} */ (window).showDirectoryPicker) === 'function';
}

const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

// Both readers return a source:
//   { label, paths, unopened, truncated, read, readStart }
// `unopened` lists the dependency folders that were not looked into,
// `truncated` says the folder held more than PREVIEW_MAX_FILES files,
// read(path) resolves to a file's text, and readStart(path) to the text of its
// first PREVIEW_BINARY_CHECK_BYTES bytes.

const start = (file) => file.slice(0, PREVIEW_BINARY_CHECK_BYTES).text();

/**
 * Walks a folder picked with showDirectoryPicker. Shallower folders are read
 * first, so the files that are cut off above the limit are the deepest ones.
 * `.git` is passed over: it is never part of a commit.
 */
export async function readDirectoryHandle(root) {
  const files = new Map();
  const unopened = [];
  let truncated = false;
  const queue = [['', root]];
  while (queue.length > 0 && !truncated) {
    const [prefix, folder] = /** @type {[string, any]} */ (queue.shift());
    const entries = [];
    for await (const entry of folder.values()) entries.push(entry);
    for (const entry of entries.sort(byName)) {
      const path = prefix + entry.name;
      if (entry.kind === 'file') {
        if (files.size >= PREVIEW_MAX_FILES) {
          truncated = true;
          break;
        }
        files.set(path, entry);
      } else if (isDependencyFolder(entry.name)) {
        unopened.push(path);
      } else if (entry.name !== '.git') {
        queue.push([`${path}/`, entry]);
      }
    }
  }
  return {
    label: root.name,
    paths: [...files.keys()].sort(),
    unopened: unopened.sort(),
    truncated,
    read: async (path) => (await files.get(path).getFile()).text(),
    readStart: async (path) => start(await files.get(path).getFile()),
  };
}

/**
 * The same from the files of an `<input type="file" webkitdirectory>`. Each
 * file's webkitRelativePath starts with the picked folder's own name, which
 * is dropped.
 */
export function readFileInput(fileList) {
  const files = new Map();
  const unopened = new Set();
  let label = '';
  for (const file of fileList) {
    const parts = (file.webkitRelativePath || file.name).split('/');
    if (parts.length > 1) label = parts.shift();
    const folders = parts.slice(0, -1);
    const stop = folders.findIndex((name) => name === '.git' || isDependencyFolder(name));
    if (stop === -1) files.set(parts.join('/'), file);
    else if (folders[stop] !== '.git') unopened.add(folders.slice(0, stop + 1).join('/'));
  }
  const depth = (path) => path.split('/').length;
  const shallowestFirst = [...files.keys()].sort(
    (a, b) => depth(a) - depth(b) || (a < b ? -1 : a > b ? 1 : 0),
  );
  return {
    label,
    paths: shallowestFirst.slice(0, PREVIEW_MAX_FILES).sort(),
    unopened: [...unopened].sort(),
    truncated: shallowestFirst.length > PREVIEW_MAX_FILES,
    read: (path) => files.get(path).text(),
    readStart: (path) => start(files.get(path)),
  };
}

/**
 * The text of each dependency manifest the rules would read in a source, as
 * path → text. One that can't be read is left out, which the rules treat as
 * listing no dependencies, as the action does.
 */
export async function readManifests({ paths, read }) {
  const texts = {};
  for (const path of manifestPaths(paths)) {
    try {
      texts[path] = await read(path);
    } catch {
      // Unreadable: left out.
    }
  }
  return texts;
}

/**
 * The binary files in a source, such as images: the paths whose first bytes
 * the rules call binary. One that can't be read is taken to be text.
 */
export async function readBinaryFiles({ paths, readStart }) {
  const binary = [];
  for (let i = 0; i < paths.length; i += READS_AT_ONCE) {
    const batch = paths.slice(i, i + READS_AT_ONCE);
    const found = await Promise.all(
      batch.map(async (path) => {
        try {
          return isBinary(await readStart(path));
        } catch {
          return false;
        }
      }),
    );
    binary.push(...batch.filter((_, n) => found[n]));
  }
  return binary;
}
