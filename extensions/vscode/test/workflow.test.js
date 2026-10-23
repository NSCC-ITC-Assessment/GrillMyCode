import { describe, expect, it } from 'vitest';
import { isGrillMyCodeAction, readWorkflow } from '../src/shared/workflow.js';
import { questionSets } from '../src/shared/input-checks.js';
import { caseText, cases } from './workflow-sample.js';

describe('isGrillMyCodeAction', () => {
  it('accepts the action at any version, in any letter case', () => {
    expect(isGrillMyCodeAction('NSCC-ITC-Assessment/GrillMyCode@v0')).toBe(true);
    expect(isGrillMyCodeAction('nscc-itc-assessment/grillmycode@v0.29.0')).toBe(true);
    expect(isGrillMyCodeAction(' NSCC-ITC-Assessment/GrillMyCode@4f2c1ab ')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isGrillMyCodeAction('actions/checkout@v6')).toBe(false);
    expect(isGrillMyCodeAction('my-school/GrillMyCode@v0')).toBe(false);
    expect(isGrillMyCodeAction('NSCC-ITC-Assessment/GrillMyCode-fork@v0')).toBe(false);
    expect(isGrillMyCodeAction(undefined)).toBe(false);
  });
});

// The cases are in extensions/fixtures/workflow-help/read.json, which the
// JetBrains plugin's tests run as well. A field a case leaves out is not
// checked; `with` and `value` set to null mean there is none.
describe('readWorkflow', () => {
  it.each(cases('read.json'))('$name', (testCase) => {
    const text = caseText(testCase);
    const slice = (/** @type {number} */ start, /** @type {number} */ end) =>
      text.slice(start, end);
    const { steps, tagFilters, name } = readWorkflow(text);
    if ('tagFilters' in testCase) expect(tagFilters).toEqual(testCase.tagFilters ?? undefined);
    if ('questionSets' in testCase) {
      expect(questionSets(text, { path: testCase.path })).toEqual(testCase.questionSets);
    }
    if ('workflowName' in testCase) {
      expect(name ? { value: name.value, text: slice(name.start, name.end) } : null).toEqual(
        testCase.workflowName,
      );
    }
    if (!testCase.steps) return;
    expect(steps).toHaveLength(testCase.steps.length);
    testCase.steps.forEach((expected, index) => {
      const step = steps[index];
      if ('uses' in expected) expect(slice(step.uses.start, step.uses.end)).toBe(expected.uses);
      if ('with' in expected) {
        expect(step.with ? slice(step.with.start, step.with.end) : null).toBe(expected.with);
      }
      if (!expected.inputs) return;
      expect(step.inputs).toHaveLength(expected.inputs.length);
      expected.inputs.forEach((want, i) => {
        const input = step.inputs[i];
        if ('name' in want) expect(input.name).toBe(want.name);
        if ('text' in want) expect(slice(input.start, input.end)).toBe(want.text);
        if ('value' in want) expect(input.value).toBe(want.value ?? undefined);
        if ('valueText' in want) {
          expect(slice(input.valueStart, input.valueEnd)).toBe(want.valueText);
        }
        if ('expression' in want) expect(input.expression).toBe(want.expression);
      });
    });
  });
});
