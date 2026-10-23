// The workflow help's test cases, from extensions/fixtures/workflow-help/,
// which the JetBrains plugin's tests read as well.

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const CASES = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'fixtures',
  'workflow-help',
);

const read = (/** @type {string} */ name) => JSON.parse(readFileSync(join(CASES, name), 'utf-8'));

const sample = read('sample.json');

/** The cases of one file of extensions/fixtures/workflow-help/. */
export const cases = (/** @type {string} */ name) => read(name).cases;

/** A workflow with one GrillMyCode step, whose `with` block is `inputs`. */
export function workflow(inputs, { on = sample.defaultOn } = {}) {
  return sample.lines
    .flatMap((line) => {
      if (line === '{on}') return [on];
      if (line === '{inputs}') return inputs.map((input) => `${sample.inputIndent}${input}`);
      return [line];
    })
    .join('\n');
}

/** A case's text: its own, or the sample filled in with its inputs. */
export const caseText = (testCase) => testCase.text ?? workflow(testCase.inputs, testCase);
