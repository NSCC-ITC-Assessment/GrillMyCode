/**
 * Workflow files
 *
 * Finds the steps of a workflow file that run the GrillMyCode action, and the
 * inputs each one sets, with where each is in the text. Positions are offsets
 * into the text, so nothing here needs the editor.
 */

import { isMap, isScalar, isSeq, parseDocument, visit } from 'yaml';
import { ACTION_REPOSITORY } from './constants.js';

/** What marks a value GitHub works out when the workflow runs. */
const EXPRESSION = '${{';

/** True when a step's `uses` names the GrillMyCode action, at any version. */
export function isGrillMyCodeAction(uses) {
  const [repository] = String(uses ?? '')
    .trim()
    .split('@');
  return repository.toLowerCase() === ACTION_REPOSITORY.toLowerCase();
}

/**
 * A scalar as the action receives it. GitHub hands every input over as text:
 * `true` and `True` both arrive as "true", `20` as "20", and an empty value as
 * nothing. A quoted value arrives as written.
 */
function scalarText(node) {
  if (typeof node.value === 'string') return node.value;
  return node.value === null || node.value === undefined ? '' : String(node.value);
}

/** The inputs a step's `with` mapping sets, in the order they are written. */
function readInputs(withNode) {
  if (!isMap(withNode)) return [];
  const inputs = [];
  for (const { key, value } of withNode.items) {
    if (!isScalar(key) || !key.range) continue;
    const input = { name: scalarText(key), start: key.range[0], end: key.range[1] };
    // Anything but a scalar is not a value an input can have, and GitHub's own
    // checks say so. An input written with no value at all is an empty one.
    if (value === null) {
      Object.assign(input, { value: '', valueStart: input.end, valueEnd: input.end });
    } else if (isScalar(value) && value.range) {
      const text = scalarText(value);
      Object.assign(input, {
        value: text,
        valueStart: value.range[0],
        valueEnd: value.range[1],
        expression: text.includes(EXPRESSION),
      });
    }
    inputs.push(input);
  }
  return inputs;
}

/** The tag patterns of `on.push.tags`, or undefined when the workflow has none. */
function readTagFilters(document) {
  const tags = document.getIn(['on', 'push', 'tags'], true);
  const nodes = isSeq(tags) ? tags.items : [tags];
  const filters = nodes.filter(isScalar).map(scalarText).filter(Boolean);
  return filters.length > 0 ? filters : undefined;
}

/**
 * Reads a workflow file's text:
 *
 *   steps       every step that runs the action, each as
 *               `{ uses: { start, end }, with: { start, end }, inputs }`.
 *               `with` is where the `with` key is, and is missing when the
 *               step has none. Each input is `{ name, start, end }` for its
 *               name, and `{ value, valueStart, valueEnd, expression }` when
 *               its value is one an input can have.
 *   tagFilters  the patterns of `on.push.tags`, when there are any.
 *
 * A file that cannot be read as YAML gives whatever was read before the
 * mistake, which may be nothing.
 */
export function readWorkflow(text) {
  const steps = [];
  let tagFilters;
  try {
    const document = parseDocument(text, { logLevel: 'silent' });
    visit(document, {
      Map(_key, map) {
        const pair = (name) => map.items.find(({ key }) => isScalar(key) && key.value === name);
        const uses = pair('uses');
        if (!isScalar(uses?.value) || !uses.value.range) return;
        if (!isGrillMyCodeAction(scalarText(uses.value))) return;
        const withPair = pair('with');
        steps.push({
          uses: { start: uses.value.range[0], end: uses.value.range[1] },
          ...(withPair
            ? { with: { start: withPair.key.range[0], end: withPair.key.range[1] } }
            : {}),
          inputs: readInputs(withPair?.value),
        });
      },
    });
    tagFilters = readTagFilters(document);
  } catch {
    // Left as whatever was found before the parser gave up.
  }
  return { steps, tagFilters };
}
