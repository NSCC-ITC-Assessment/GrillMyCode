// Writes the Workflow Wizard's copy of the file selection rules to
// docs-site/docs/_workflow-wizard/fileSelection.js, so the Wizard decides
// which files are assessed with the action's own code rather than a second
// implementation. The Wizard cannot import src/ (it is snapshotted into
// versioned_docs/, where a path into src/ would not resolve), so the copy is
// src/file-selection.js with the constants it imports written in.
//
// Run after changing src/file-selection.js, or a constant it imports from
// src/constants.js:
//   node scripts/build-wizard-file-selection.js
//
// A test checks the committed file against src/.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import * as constants from '../src/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const SOURCE_PATH = join(__dirname, '..', 'src', 'file-selection.js');
export const OUT_PATH = join(
  __dirname,
  '..',
  'docs-site',
  'docs',
  '_workflow-wizard',
  'fileSelection.js',
);

const BANNER = `// GENERATED FILE — do not edit. This is src/file-selection.js with the constants
// it imports from src/constants.js written in. To change it, edit those files
// and run: node scripts/build-wizard-file-selection.js

`;

const CONSTANTS_IMPORT = /^import \{([^}]*)\} from '\.\/constants\.js';\n/m;

/** Whether a value survives being written out as JSON: no functions, patterns, Sets or Maps. */
function isPlainData(value) {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isPlainData);
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.values(value).every(isPlainData);
}

/**
 * The Wizard's copy of src/file-selection.js, given its source: the import
 * from ./constants.js is replaced by the constants themselves, since nothing
 * beside the copy can supply them. What is left may import packages only.
 */
export function buildWizardFileSelection(source) {
  const found = source.match(CONSTANTS_IMPORT);
  if (!found) {
    throw new Error("src/file-selection.js no longer has its import from './constants.js'.");
  }
  const names = found[1]
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const inlined = names.map((name) => {
    if (!Object.hasOwn(constants, name) || !isPlainData(constants[name])) {
      throw new Error(`${name} cannot be written into the Wizard's copy: it is not plain data.`);
    }
    return `const ${name} = ${JSON.stringify(constants[name], null, 2)};`;
  });

  const body = source.replace(CONSTANTS_IMPORT, `${inlined.join('\n')}\n`);
  if (/\bfrom\s+'\.{1,2}\//.test(body)) {
    throw new Error(
      'src/file-selection.js imports another file by path, which the Wizard cannot resolve. ' +
        'It may import only minimatch and ./constants.js.',
    );
  }
  return BANNER + body;
}

// Only write when the script is run directly; the test suite imports it.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(OUT_PATH, buildWizardFileSelection(readFileSync(SOURCE_PATH, 'utf-8')), 'utf-8');
  console.log(`Wrote ${OUT_PATH}.`);
}
