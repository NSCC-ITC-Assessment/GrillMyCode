import { describe, expect, it } from 'vitest';
import { ACTION_INPUTS } from '../src/shared/action-inputs.js';
import {
  completionsAt,
  describeInput,
  escapeMarkdown,
  inputAt,
} from '../src/shared/workflow-help.js';
import { workflow } from './workflow-sample.js';

/**
 * What is offered where `|` stands in a step's inputs: the text that would be
 * replaced, and what each item inserts.
 */
function offered(inputs, options) {
  const marked = workflow(inputs);
  const offset = marked.indexOf('|');
  const text = marked.replace('|', '');
  const found = completionsAt(text, offset, options);
  if (!found) return undefined;
  return {
    replaces: text.slice(found.start, found.end),
    inserts: found.items.map((item) => item.insert),
    items: found.items,
  };
}

describe('completing an input name', () => {
  it('offers the inputs on an empty line of the step', () => {
    const { replaces, inserts } = offered(['api_key: x', '|']);
    expect(replaces).toBe('');
    expect(inserts).toContain('num_questions: ');
    expect(inserts).toContain('starter_code: ');
  });

  it('leaves out inputs already set, deprecated ones and the hidden one', () => {
    const { inserts } = offered(['api_key: x', 'num_questions: 5', '|']);
    expect(inserts).not.toContain('api_key: ');
    expect(inserts).not.toContain('num_questions: ');
    expect(inserts).not.toContain('include_initial_commit: ');
    expect(inserts).not.toContain('log_prompt: ');
    expect(inserts).toHaveLength(Object.keys(ACTION_INPUTS).length - 5);
  });

  it('replaces what has been typed of the name', () => {
    expect(offered(['api_key: x', 'num_q|']).replaces).toBe('num_q');
  });

  it('replaces only the name of an input that already has a value', () => {
    const { replaces, inserts } = offered(['api_key: x', 'num_|question: 5']);
    expect(replaces).toBe('num_question');
    expect(inserts).toContain('num_questions');
  });

  it('offers the inputs in a step that has none yet', () => {
    expect(offered(['|']).inserts).toContain('api_key: ');
  });

  it('offers nothing where input names are left to the GitHub Actions extension', () => {
    expect(offered(['api_key: x', '|'], { names: false })).toBeUndefined();
  });

  it('offers nothing outside the step', () => {
    const text = workflow(['api_key: x']);
    // In the checkout step's inputs, and on the step's own level.
    expect(completionsAt(text, text.indexOf('fetch-depth'))).toBeUndefined();
    expect(completionsAt(`${text}        `, text.length + 8)).toBeUndefined();
    expect(completionsAt('', 0)).toBeUndefined();
  });

  it('offers nothing inside the text of another input', () => {
    expect(offered(['instructor_context: >', '  Lab 3', '  sta|', 'api_key: x'])).toBeUndefined();
  });
});

describe('completing a value', () => {
  it('offers the values of an input with a fixed set, the default marked', () => {
    const { replaces, inserts, items } = offered(['starter_code: |']);
    expect(replaces).toBe('');
    expect(inserts).toEqual(['none', 'ignore', 'context', 'ask']);
    expect(items.filter((item) => item.isDefault).map((item) => item.label)).toEqual(['ignore']);
  });

  it('replaces the value being typed, inside quotes or not', () => {
    expect(offered(['starter_code: con|text']).replaces).toBe('context');
    expect(offered(['starter_code: "con|"']).replaces).toBe('con');
  });

  it('offers true and false, and the tag: form of tag_diff_base', () => {
    expect(offered(['label_repos: |']).inserts).toEqual(['true', 'false']);
    expect(offered(['tag_diff_base: |']).inserts).toEqual(['cumulative', 'previous-tag', 'tag:']);
  });

  it('is offered whether or not input names are', () => {
    expect(offered(['starter_code: |'], { names: false }).inserts).toHaveLength(4);
  });

  it('offers nothing for free text or a number', () => {
    expect(offered(['instructor_context: |'])).toBeUndefined();
    expect(offered(['num_questions: |'])).toBeUndefined();
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
