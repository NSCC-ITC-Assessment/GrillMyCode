import { describe, expect, it } from 'vitest';
import { isGrillMyCodeAction, readWorkflow } from '../src/shared/workflow.js';
import { workflow } from './workflow-sample.js';

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

describe('readWorkflow', () => {
  it('finds the GrillMyCode step and leaves the others', () => {
    const text = workflow(['api_key: ${{ secrets.OPENROUTER_API_KEY }}', 'num_questions: 10']);
    const { steps } = readWorkflow(text);
    expect(steps).toHaveLength(1);
    expect(steps[0].inputs.map((input) => input.name)).toEqual(['api_key', 'num_questions']);
    expect(text.slice(steps[0].uses.start, steps[0].uses.end)).toBe(
      'NSCC-ITC-Assessment/GrillMyCode@v0',
    );
    expect(text.slice(steps[0].with.start, steps[0].with.end)).toBe('with');
  });

  it('says where each name and value is', () => {
    const text = workflow(['starter_code: "ask" # a comment']);
    const [input] = readWorkflow(text).steps[0].inputs;
    expect(text.slice(input.start, input.end)).toBe('starter_code');
    expect(text.slice(input.valueStart, input.valueEnd)).toBe('"ask"');
    expect(input.value).toBe('ask');
  });

  // GitHub hands the action text, whatever YAML made of the value.
  it('gives each value as the action receives it', () => {
    const { inputs } = readWorkflow(
      workflow([
        'keep_comments: True',
        'num_questions: 20',
        'include_answers: "True"',
        'instructor_context: |',
        '  Lab 3',
        '  Loops',
        'base_sha:',
      ]),
    ).steps[0];
    expect(inputs.map((input) => input.value)).toEqual([
      'true',
      '20',
      'True',
      'Lab 3\nLoops\n',
      '',
    ]);
  });

  it('marks a value GitHub works out at run time', () => {
    const { inputs } = readWorkflow(
      workflow(['num_questions: ${{ inputs.num_questions }}', 'starter_code: ask']),
    ).steps[0];
    expect(inputs.map((input) => input.expression)).toEqual([true, false]);
  });

  it('gives no value for something an input cannot be', () => {
    const [input] = readWorkflow(workflow(['submission_tags: [phase1, phase2]'])).steps[0].inputs;
    expect(input.name).toBe('submission_tags');
    expect(input.value).toBeUndefined();
  });

  it('reads a step with no inputs', () => {
    const { steps } = readWorkflow('steps:\n  - uses: NSCC-ITC-Assessment/GrillMyCode@v0\n');
    expect(steps).toHaveLength(1);
    expect(steps[0].with).toBeUndefined();
    expect(steps[0].inputs).toEqual([]);
  });

  it('reads the tag patterns the workflow runs on', () => {
    const read = (on) => readWorkflow(workflow([], { on })).tagFilters;
    expect(read('on:\n  push:\n    tags: ["phase1", "phase2"]')).toEqual(['phase1', 'phase2']);
    expect(read('on:\n  push:\n    tags:\n      - submit/*')).toEqual(['submit/*']);
    expect(read('on:\n  push:\n    tags: final')).toEqual(['final']);
    expect(read('on:\n  push:\n    branches: [main]')).toBeUndefined();
    expect(read('on: push')).toBeUndefined();
    expect(read('on: [push, workflow_dispatch]')).toBeUndefined();
  });

  it('reads nothing from a file that is not a workflow', () => {
    expect(readWorkflow('').steps).toEqual([]);
    expect(readWorkflow('just some text').steps).toEqual([]);
    expect(readWorkflow('a: [1\n b: {').steps).toEqual([]);
  });
});
