import { describe, expect, it } from 'vitest';
import { checkWorkflow, closestInput } from '../src/shared/input-checks.js';
import { caseText, cases } from './workflow-sample.js';

// The cases are in extensions/fixtures/workflow-help/checks.json, which the
// JetBrains plugin's tests run as well. Each lists every problem the text has,
// in order, with what each must say.
describe('checkWorkflow', () => {
  it.each(cases('checks.json'))('$name', (testCase) => {
    const text = caseText(testCase);
    const found = checkWorkflow(text, {
      unknownInputs: testCase.unknownInputs ?? true,
      path: testCase.path,
      otherWorkflows: testCase.otherWorkflows,
    });
    expect(found).toHaveLength(testCase.problems.length);
    testCase.problems.forEach((expected, index) => {
      const { start, end, message, ...problem } = found[index];
      const { messageContains = [], messageLacks = [], ...fields } = expected;
      expect({ ...problem, text: text.slice(start, end) }).toMatchObject(fields);
      for (const words of messageContains) expect(message).toContain(words);
      for (const words of messageLacks) expect(message).not.toContain(words);
    });
  });
});

describe('closestInput', () => {
  it('never offers the hidden input', () => {
    expect(closestInput('log_prompts')).toBeUndefined();
    expect(closestInput('api_keys')).toBe('api_key');
  });
});
