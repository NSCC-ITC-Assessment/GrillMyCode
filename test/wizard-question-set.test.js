import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { DEFAULT_QUESTION_SET_SLUG, QUESTION_SET_MAX_CHARS } from '../src/constants.js';
import { questionSetSlug } from '../src/context.js';
import {
  DEFAULTS,
  DEFAULT_WORKFLOW_NAME,
  WORKFLOW_NAME_MAX_CHARS,
  generateYaml,
  questionSetSlug as wizardSlug,
  workflowFileName,
  workflowNameError,
} from '../docs-site/docs/_workflow-wizard/generateYaml.js';

const NAMES = [
  '',
  'GrillMyCode',
  'grillmycode',
  'Grill My Code',
  'Lab 3',
  'lab-3',
  'Lab 3: Checkout (part A)',
  'GrillMyCode phase 2',
  '__init__',
  '-x-',
  '!!!',
  '🧪 Lab',
  'Été 2026',
];

describe("the Wizard's question set", () => {
  it('slugs a name as the action does', () => {
    for (const name of NAMES) expect(wizardSlug(name), name).toBe(questionSetSlug(name));
    expect(questionSetSlug(DEFAULT_WORKFLOW_NAME)).toBe('');
    expect(wizardSlug(DEFAULT_QUESTION_SET_SLUG)).toBe('');
    expect(WORKFLOW_NAME_MAX_CHARS).toBe(QUESTION_SET_MAX_CHARS);
  });

  it('writes the name and passes it to question_set', () => {
    const workflow = (workflowName) => parse(generateYaml({ ...DEFAULTS, workflowName }));
    const step = (doc) => doc.jobs['generate-questions'].steps[1].with;

    expect(workflow('GrillMyCode').name).toBe('GrillMyCode');
    expect(step(workflow('GrillMyCode')).question_set).toBe('${{ github.workflow }}');
    expect(step(workflow('Lab 3')).question_set).toBe('${{ github.workflow }}');
    for (const name of ['Lab 3', "Lab 3: it's 'quoted'", 'true', '2026', 'x # not a comment']) {
      expect(workflow(name).name).toBe(name);
    }
    // White space is made single spaces, as the action does.
    expect(workflow('  Lab   3 ').name).toBe('Lab 3');
  });

  it('names the file after the set', () => {
    const file = (workflowName) => workflowFileName({ ...DEFAULTS, workflowName });
    expect(file('GrillMyCode')).toBe('grill-my-code.yml');
    expect(file('Lab 3')).toBe('grill-my-code-lab-3.yml');
    expect(file('Lab 3: Checkout')).toBe('grill-my-code-lab-3-checkout.yml');
  });

  it('refuses a name the action would fail on', () => {
    const error = (workflowName) => workflowNameError({ ...DEFAULTS, workflowName });
    expect(error('Lab 3')).toBe('');
    expect(error('  ')).toMatch(/enter a name/);
    expect(error('!!!')).toMatch(/at least one letter or digit/);
    expect(error('x'.repeat(WORKFLOW_NAME_MAX_CHARS))).toBe('');
    expect(error('x'.repeat(WORKFLOW_NAME_MAX_CHARS + 1))).toMatch(/at most/);
  });
});
