import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { ACTION_PATH, buildActionInputs } from '../scripts/build-extension-action-inputs.js';
import { ACTION_INPUTS } from '../extensions/vscode/src/shared/action-inputs.js';
import { ACTION_REPOSITORY } from '../extensions/vscode/src/shared/constants.js';
import { checkWorkflow } from '../extensions/vscode/src/shared/input-checks.js';
import * as extensionTags from '../extensions/vscode/src/shared/tags.js';
import { readWorkflow } from '../extensions/vscode/src/shared/workflow.js';
import * as actionTags from '../src/tags.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (...path) => JSON.parse(readFileSync(join(root, ...path), 'utf-8'));

describe("the extension's list of the action's inputs", () => {
  it('matches action.yml and src/ — run node scripts/build-extension-action-inputs.js if not', () => {
    expect(buildActionInputs(readFileSync(ACTION_PATH, 'utf-8'))).toEqual(ACTION_INPUTS);
  });

  // The two inputs the action still reads for older workflows, and the one it
  // keeps out of its documentation. Each is found from the wording of its
  // description, which a rewrite could change without anything else failing.
  it('marks the deprecated inputs and the hidden one', () => {
    const marked = (flag) => Object.keys(ACTION_INPUTS).filter((name) => ACTION_INPUTS[name][flag]);
    expect(marked('deprecated')).toEqual(['include_initial_commit', 'include_codebase_context']);
    expect(marked('hidden')).toEqual(['log_prompt']);
    for (const name of marked('deprecated')) expect(ACTION_INPUTS[name].replacement).toBeTruthy();
  });

  it('names the action as its own README does', () => {
    expect(readFileSync(join(root, 'README.md'), 'utf-8')).toContain(`uses: ${ACTION_REPOSITORY}@`);
  });
});

// The extension's tests run from the repository root, where they load the
// root's copy of the parser, and the packaged extension bundles its own.
describe('the YAML parser', () => {
  it('is the same range for the repository and the extension', () => {
    const range = readJson('package.json').devDependencies.yaml;
    expect(range).toBeTruthy();
    expect(readJson('extensions', 'vscode', 'package.json').devDependencies.yaml).toBe(range);
  });
});

describe("the extension's copy of the tag rules", () => {
  const samples = [
    'phase1',
    'v1.0',
    'submit/*',
    'v[0-9]+',
    '**',
    'a..b',
    'phase1/',
    '-phase1',
    '/phase1',
    '!phase1',
    'two words',
    '+phase',
    'v*+',
    'a?b',
    '',
  ];

  it.each(samples)('agrees with src/tags.js about "%s"', (sample) => {
    expect(extensionTags.isSafeTagName(sample)).toBe(actionTags.isSafeTagName(sample));
    expect(extensionTags.isSafeTagPattern(sample)).toBe(actionTags.isSafeTagPattern(sample));
  });
});

// Every workflow the documentation shows is one the checks must have nothing
// to say about. A check that fires here would fire for every instructor who
// copies the example.
describe('the workflows in the documentation', () => {
  const docs = join(root, 'docs-site', 'docs');
  const pages = readdirSync(docs, { recursive: true })
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) => join('docs-site', 'docs', file));
  const workflows = [...pages, 'README.md'].flatMap((page) =>
    [...readFileSync(join(root, page), 'utf-8').matchAll(/```ya?ml[^\n]*\n([\s\S]*?)```/g)]
      .map(([, yaml], index) => ({ name: `${page} #${index + 1}`, yaml }))
      // A whole workflow, not a fragment that shows one input.
      .filter(({ yaml }) => /^on:/m.test(yaml) && readWorkflow(yaml).steps.length > 0),
  );

  it('are found', () => {
    expect(workflows.length).toBeGreaterThan(10);
  });

  it.each(workflows)('$name has no problems', ({ yaml }) => {
    expect(checkWorkflow(yaml)).toEqual([]);
  });
});
