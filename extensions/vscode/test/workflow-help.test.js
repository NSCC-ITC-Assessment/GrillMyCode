import { describe, expect, it } from 'vitest';
import { ACTION_INPUTS } from '../src/shared/action-inputs.js';
import {
  completionsAt,
  describeInput,
  escapeMarkdown,
  inputAt,
} from '../src/shared/workflow-help.js';
import { caseText, cases, workflow } from './workflow-sample.js';

/**
 * Where a case's cursor is, and its text without the mark: the first `|`, the
 * start of `cursorAt`, or the end of the text.
 */
function cursor(testCase) {
  const marked = caseText(testCase) + (testCase.suffix ?? '');
  if (testCase.cursorAt) return { text: marked, offset: marked.indexOf(testCase.cursorAt) };
  if (testCase.cursorAtEnd) return { text: marked, offset: marked.length };
  return { text: marked.replace('|', ''), offset: marked.indexOf('|') };
}

// The cases are in extensions/fixtures/workflow-help/completions.json, which
// the JetBrains plugin's tests run as well.
describe('completionsAt', () => {
  it.each(cases('completions.json'))('$name', (testCase) => {
    const { text, offset } = cursor(testCase);
    const found = completionsAt(text, offset, { names: testCase.names ?? true });
    if (testCase.offered === false) {
      expect(found).toBeUndefined();
      return;
    }
    expect(found).toBeDefined();
    const inserts = found.items.map((item) => item.insert);
    if ('replaces' in testCase) expect(text.slice(found.start, found.end)).toBe(testCase.replaces);
    if (testCase.inserts) expect(inserts).toEqual(testCase.inserts);
    for (const insert of testCase.insertsInclude ?? []) expect(inserts).toContain(insert);
    if (testCase.insertsAllInputsExcept) {
      const left = Object.keys(ACTION_INPUTS).filter(
        (name) => !testCase.insertsAllInputsExcept.includes(name),
      );
      expect(inserts).toEqual(left.map((name) => `${name}: `));
    }
    if (testCase.defaults) {
      const defaults = found.items.filter((item) => item.isDefault).map((item) => item.label);
      expect(defaults).toEqual(testCase.defaults);
    }
  });
});

describe('describing an input', () => {
  it('gives the description and default from action.yml', () => {
    expect(describeInput('num_questions')).toMatchObject({
      name: 'num_questions',
      default: '20',
      required: false,
      deprecated: false,
      values: [],
    });
    expect(describeInput('num_questions').description).toContain('maximum 50');
  });

  it("gives the default the action uses where action.yml's own is empty", () => {
    expect(describeInput('starter_code').default).toBe('ignore');
    expect(describeInput('previous_work').default).toBe('context');
  });

  it('knows nothing of a name the action does not declare', () => {
    expect(describeInput('rubric_file')).toBeUndefined();
    expect(describeInput('constructor')).toBeUndefined();
  });

  it('finds the input under an offset, on its name only', () => {
    const text = workflow(['api_key: x', 'starter_code: ask']);
    const at = text.indexOf('starter_code');
    expect(inputAt(text, at + 3)).toMatchObject({
      start: at,
      end: at + 12,
      input: { name: 'starter_code' },
    });
    expect(inputAt(text, text.indexOf('ask') + 1)).toBeUndefined();
    expect(inputAt(text, text.indexOf('fetch-depth') + 1)).toBeUndefined();
  });
});

describe('escapeMarkdown', () => {
  it('keeps the characters of a description from being read as formatting', () => {
    expect(escapeMarkdown('**/*.md and <username>_x')).toBe(
      '\\*\\*/\\*\\.md and \\<username\\>\\_x',
    );
    expect(escapeMarkdown('Plain words, kept as they are')).toBe('Plain words, kept as they are');
  });
});
