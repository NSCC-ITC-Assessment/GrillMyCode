/**
 * Workflow help
 *
 * What to offer while a GrillMyCode step is being written: the inputs it can
 * set, the values of an input that has a fixed set of them, and what an input
 * is for. Positions are offsets into the text, so nothing here needs the
 * editor.
 */

import { ACTION_INPUTS } from './action-inputs.js';
import { readWorkflow } from './workflow.js';

/** An input's name being typed: the indent, then what there is of the name. */
const NAME_BEFORE_RE = /^(\s*)([A-Za-z_][\w-]*)?$/;
/** An input's value being typed: the indent, the name, then what there is of the value. */
const VALUE_BEFORE_RE = /^(\s*)([A-Za-z_][\w-]*):[ \t]+["']?([\w:-]*)$/;
/** The rest of a name or value, to the right of the cursor. */
const REST_OF_WORD_RE = /^[\w:-]*/;

/** A line that is blank or holds only a comment, which ends no block. */
const EMPTY_LINE_RE = /^\s*(#.*)?$/;

/**
 * Text as Markdown shows it unchanged. The descriptions are the action's own,
 * and hold characters Markdown reads as formatting: `**\/*.md`, `<username>`.
 */
export function escapeMarkdown(text) {
  return String(text).replace(/[\\`*_{}[\]()#+\-.!|<>~&]/g, '\\$&');
}

/** What is known about an input, or undefined for a name the action does not declare. */
export function describeInput(name) {
  const key = String(name).toLowerCase();
  if (!Object.hasOwn(ACTION_INPUTS, key)) return undefined;
  const input = ACTION_INPUTS[key];
  return {
    name: key,
    description: input.description,
    default: input.default,
    required: input.required,
    deprecated: input.deprecated === true,
    values: inputValues(input),
  };
}

/** The values an input can take, when it has a fixed set of them. */
function inputValues(input) {
  if (input.kind === 'boolean') return ['true', 'false'];
  if (input.kind === 'enum') return [...input.values, ...(input.prefix ? [input.prefix] : [])];
  return [];
}

/** Where each line of `text` starts, and the line an offset is on. */
function lineIndex(text) {
  const starts = [0];
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  const lineOf = (offset) => {
    let line = starts.length - 1;
    while (starts[line] > offset) line--;
    return line;
  };
  const textOf = (line) =>
    text.slice(starts[line], starts[line + 1] ?? text.length).replace(/\r?\n$/, '');
  return { starts, lineOf, textOf };
}

/**
 * The GrillMyCode step whose `with` block holds a line, given the column that
 * line's own text starts at. The line is in the block when it comes after the
 * `with` key, is indented further than it, lines up with the inputs already
 * there, and nothing indented as little as `with` comes between.
 */
function enclosingStep(steps, lines, line, column) {
  return steps.find((step) => {
    if (!step.with) return false;
    const withLine = lines.lineOf(step.with.start);
    const withColumn = step.with.start - lines.starts[withLine];
    if (line <= withLine || column <= withColumn) return false;
    const [first] = step.inputs;
    if (first) {
      const firstLine = lines.lineOf(first.start);
      // Inputs written on the `with` line itself, in braces, are not a block.
      if (firstLine === withLine || first.start - lines.starts[firstLine] !== column) return false;
    }
    for (let between = withLine + 1; between < line; between++) {
      const text = lines.textOf(between);
      if (!EMPTY_LINE_RE.test(text) && text.search(/\S/) <= withColumn) return false;
    }
    return true;
  });
}

/**
 * What to offer at an offset in a workflow file's text, as
 * `{ start, end, items }`, or undefined where there is nothing to offer.
 * `start` to `end` is the text an item replaces. Each item is
 * `{ kind, label, insert, isDefault }`, with `kind` either `input` or `value`.
 *
 * `names: false` leaves out input names, for when something else in the editor
 * already offers them.
 */
export function completionsAt(text, offset, { names = true } = {}) {
  const lines = lineIndex(text);
  const line = lines.lineOf(offset);
  const lineStart = lines.starts[line];
  const lineText = lines.textOf(line);
  const before = lineText.slice(0, offset - lineStart);
  const after = lineText.slice(offset - lineStart);

  // The line being typed is often not YAML yet, so the rest of the file is
  // read without it. Blanks keep every other offset where it was.
  const blanked =
    text.slice(0, lineStart) +
    ' '.repeat(lineText.length) +
    text.slice(lineStart + lineText.length);
  const { steps } = readWorkflow(blanked);
  if (steps.length === 0) return undefined;

  const value = before.match(VALUE_BEFORE_RE);
  if (value) {
    const [, indent, name, typed] = value;
    if (!enclosingStep(steps, lines, line, indent.length)) return undefined;
    const input = describeInput(name);
    if (!input || input.values.length === 0) return undefined;
    return {
      start: offset - typed.length,
      end: offset + after.match(REST_OF_WORD_RE)[0].length,
      items: input.values.map((label) => ({
        kind: 'value',
        label,
        insert: label,
        isDefault: label === input.default,
      })),
    };
  }

  const name = names && before.match(NAME_BEFORE_RE);
  if (!name) return undefined;
  const [, indent, typed = ''] = name;
  const rest = after.match(REST_OF_WORD_RE)[0];
  const tail = after.slice(rest.length);
  // Offered on a line with nothing else on it, or over the name of an input
  // that is already written out.
  const renaming = /^\s*:/.test(`${rest}${tail}`) || rest.includes(':');
  if (!renaming && tail.trim() !== '') return undefined;
  const step = enclosingStep(steps, lines, line, indent.length);
  if (!step) return undefined;

  const taken = new Set(step.inputs.map((input) => input.name.toLowerCase()));
  return {
    start: offset - typed.length,
    end: offset + (renaming ? rest.split(':')[0].length : rest.length),
    items: Object.entries(ACTION_INPUTS)
      .filter(([key, input]) => !input.hidden && !input.deprecated && !taken.has(key))
      .map(([key]) => ({
        kind: 'input',
        label: key,
        insert: renaming ? key : `${key}: `,
        isDefault: false,
      })),
  };
}

/**
 * The input named at an offset in a workflow file's text, as
 * `{ start, end, input }` with `input` as describeInput gives it, or undefined
 * when the offset is not on the name of an input the action declares.
 */
export function inputAt(text, offset) {
  for (const step of readWorkflow(text).steps) {
    for (const { name, start, end } of step.inputs) {
      if (offset < start || offset > end) continue;
      const input = describeInput(name);
      return input ? { start, end, input } : undefined;
    }
  }
  return undefined;
}
