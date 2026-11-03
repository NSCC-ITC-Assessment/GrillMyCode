import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { checkWorkflow } from '../extensions/vscode/src/shared/input-checks.js';
import { readInputs } from '../src/inputs.js';
import {
  DEFAULTS,
  generateYaml,
  hasEarlierWork,
  offersTagRange,
  tagRangeError,
  tagRangeValue,
} from '../docs-site/docs/_workflow-wizard/generateYaml.js';

const cfg = (over = {}) => ({ ...DEFAULTS, triggerEvent: 'workflow_dispatch', ...over });
const range = (tagRangeFrom, tagRangeTo = '', over = {}) =>
  cfg({ tagRangeFrom, tagRangeTo, ...over });

const actionInputs = (config) => {
  const workflow = parse(generateYaml(config));
  return workflow.jobs['generate-questions'].steps.find((step) => step.with?.api_key).with;
};

describe('the tag range the Wizard writes', () => {
  it('is left out when none is set', () => {
    expect(actionInputs(cfg())).not.toHaveProperty('tag_range');
  });

  it('writes both tags on a manual trigger', () => {
    expect(actionInputs(range('phase1', 'phase2')).tag_range).toBe('phase1..phase2');
  });

  it('writes a range with no end tag', () => {
    expect(actionInputs(range('phase1')).tag_range).toBe('phase1..');
  });

  it('writes it on a push trigger', () => {
    const config = range('phase1', 'phase2', { triggerEvent: 'push+workflow_dispatch' });
    expect(actionInputs(config).tag_range).toBe('phase1..phase2');
  });

  it('does not touch the trigger', () => {
    const { on } = parse(generateYaml(range('phase1', 'phase2')));
    expect(Object.keys(on)).toEqual(['workflow_dispatch']);
  });

  it('is not offered, or written, on a submission tag trigger', () => {
    const config = range('phase1', 'phase2', {
      triggerEvent: 'tag+workflow_dispatch',
      submissionTags: 'phase2',
    });
    expect(offersTagRange(config)).toBe(false);
    expect(tagRangeError(config)).toBe('');
    expect(tagRangeValue(config)).toBe('');
    expect(actionInputs(config)).not.toHaveProperty('tag_range');
  });

  it('gives the editors nothing to report', () => {
    const config = range('phase1', 'phase2', {
      aiModel: 'provider/model',
      previousWork: 'ignore',
    });
    expect(checkWorkflow(generateYaml(config))).toEqual([]);
  });

  it('is never written when the action would reject it', () => {
    expect(actionInputs(range('phase*', 'phase2'))).not.toHaveProperty('tag_range');
    expect(actionInputs(range('', 'phase2'))).not.toHaveProperty('tag_range');
  });

  it('counts as leaving earlier work, so previous_work can be written', () => {
    expect(hasEarlierWork(cfg())).toBe(false);
    expect(hasEarlierWork(range('phase1'))).toBe(true);
    expect(hasEarlierWork(range('phase*'))).toBe(false);
    expect(actionInputs(range('phase1', '', { previousWork: 'ignore' })).previous_work).toBe(
      'ignore',
    );
  });
});

describe("the Wizard's tag range check", () => {
  const ENV_KEYS = ['INPUT_GITHUB_TOKEN', 'INPUT_API_KEY', 'INPUT_TAG_RANGE'];
  const saved = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    process.env.INPUT_GITHUB_TOKEN = 'token';
    process.env.INPUT_API_KEY = 'key';
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  const actionAccepts = (from, to) => {
    process.env.INPUT_TAG_RANGE = `${from}..${to}`;
    try {
      readInputs();
      return true;
    } catch {
      return false;
    }
  };

  // Every pair the Wizard can type, so a range it lets through never fails a
  // run, and one the action accepts is never refused here.
  const NAMES = [
    'phase1',
    'Phase1',
    'v1.0',
    'release/v2',
    '.hidden',
    'trailing.',
    'phase*',
    'two words',
    '-phase',
    '/phase',
    'phase/',
    'a..b',
  ];
  const pairs = NAMES.flatMap((from) => ['', ...NAMES].map((to) => [from, to]));

  it.each(pairs)('agrees with the action about "%s" and "%s"', (from, to) => {
    expect(tagRangeError(range(from, to)) === '').toBe(actionAccepts(from, to));
  });

  it('accepts nothing set', () => {
    expect(tagRangeError(cfg())).toBe('');
  });

  it('asks for a start tag when only an end tag is set', () => {
    expect(tagRangeError(range('', 'phase2'))).toMatch(/starts from/);
  });

  it('names a tag it cannot use', () => {
    expect(tagRangeError(range('phase1', 'phase*'))).toMatch(/"phase\*" is not a usable tag name/);
  });

  it('ignores spaces around the names, as the action does', () => {
    expect(tagRangeValue(range(' phase1 ', ' phase2 '))).toBe('phase1..phase2');
  });
});
