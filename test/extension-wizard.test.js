// The VS Code extension shows the docs site's Workflow Wizard in an editor
// tab. It bundles docs-site/docs/_workflow-wizard/ where it stands, so there is
// one Wizard to keep, and stands in for the three things the docs site gives
// it: its theme's colours, its packages and its static files. These tests fail
// when the Wizard starts to use one the extension does not supply. Whether the
// bundle builds and the Wizard opens is checked where the extension is built,
// by `pnpm test:host` in extensions/vscode/.

import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_DISPATCH_OVERRIDES } from '../docs-site/docs/_workflow-wizard/dispatchInputs.js';
import {
  DEFAULTS,
  generateYaml,
  workflowFileName,
} from '../docs-site/docs/_workflow-wizard/generateYaml.js';
import { ACTION_REF, WORKFLOW_FILE } from '../extensions/vscode/src/shared/constants.js';
import { checkWorkflow } from '../extensions/vscode/src/shared/input-checks.js';
import { workflowFilePath } from '../extensions/vscode/src/shared/wizard.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...path) => readFileSync(join(root, ...path), 'utf-8');
const readJson = (...path) => JSON.parse(read(...path));

const WIZARD = ['docs-site', 'docs', '_workflow-wizard'];
const WEBVIEW = ['extensions', 'vscode', 'src', 'webview'];

/** Every file of the Wizard, as [path from the Wizard's folder, text]. */
const wizardFiles = readdirSync(join(root, ...WIZARD), { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => join(entry.parentPath, entry.name))
  .map((path) => [path.slice(join(root, ...WIZARD).length + 1), readFileSync(path, 'utf-8')]);

const wizardSource = wizardFiles.filter(([path]) => /\.(js|css)$/.test(path));

/** Every distinct match of `pattern`'s first group in the Wizard's code and styles. */
const inWizard = (pattern) => [
  ...new Set(wizardSource.flatMap(([, text]) => [...text.matchAll(pattern)].map((m) => m[1]))),
];

describe("the Wizard's colours in the editor", () => {
  const theme = read(...WEBVIEW, 'wizard.css');
  const used = inWizard(/var\((--(?:ifm|gmc)-[a-z0-9-]+)/g);

  it('finds the variables the Wizard takes from the docs site', () => {
    expect(used.length).toBeGreaterThan(20);
    expect(used).toContain('--ifm-color-primary');
  });

  // One that is missing is no colour at all: a border or a background gone.
  it.each(used)('gives %s a value', (name) => {
    expect(theme).toMatch(new RegExp(`^\\s*${name}:`, 'm'));
  });
});

describe("the Wizard's packages in the editor", () => {
  const build = read('extensions', 'vscode', 'esbuild.js');
  const manifest = readJson('extensions', 'vscode', 'package.json');
  const packages = inWizard(/^import [^;]*? from '([^.'][^']*)';/gm);
  const aliased = (name) =>
    new RegExp(`^\\s*(?:'${name}'|${name.replace(/[^\w]/g, '\\$&')}):`, 'm').test(build);

  it('finds the packages the Wizard imports', () => {
    expect(packages).toEqual(expect.arrayContaining(['react', 'clsx', 'minimatch']));
  });

  // Left to itself the build looks for a package beside the Wizard's files, in
  // docs-site/node_modules, which is not there when the extension is built on
  // its own.
  it.each(packages)('points %s at something the extension has', (name) => {
    expect(aliased(name)).toBe(true);
    if (!name.startsWith('@docusaurus/')) expect(manifest.devDependencies[name]).toBeTruthy();
  });

  // A pattern must match the same files in the action, on the docs site and in
  // the editor. test/wizard-file-selection.test.js checks the first two.
  it('runs the file rules on the minimatch range the action declares', () => {
    expect(manifest.devDependencies.minimatch).toBe(
      readJson('package.json').dependencies.minimatch,
    );
  });
});

describe("the Wizard's static files in the editor", () => {
  const shim = read(...WEBVIEW, 'use-base-url.js');
  const asked = inWizard(/useBaseUrl\(\s*'([^']+)'/g);

  it('finds the files the Wizard asks the docs site for', () => {
    expect(asked).toContain('/img/grillmycode-wizard.svg');
  });

  it.each(asked)('bundles %s', (path) => {
    expect(shim).toContain(`'${path}':`);
    // The shim imports it from the docs site's static folder by the same path.
    expect(shim).toContain(`docs-site/static${path}'`);
  });

  // Anything else it imports from the docs site has nothing to stand in for it.
  it('asks nothing else of the docs site', () => {
    expect(inWizard(/from '(@(?:docusaurus|theme|site)[^']*)'/g)).toEqual([
      '@docusaurus/useBaseUrl',
    ]);
  });
});

describe('what the editor adds to the Wizard', () => {
  const wizardText = (name) => wizardFiles.find(([path]) => path === name)[1];

  // The docs site derives it from its released versions (docusaurus.config.js).
  it("pins the action to the docs site's current major version", () => {
    expect(ACTION_REF).toBe(`v${readJson('docs-site', 'versions.json')[0]}`);
  });

  // The Review step names the file and the editor writes it there, for the
  // default name and for a question set's.
  it('writes the file the Review step names', () => {
    const review = wizardText(join('steps', 'StepReview.js'));
    expect(review).toContain('<code>.github/workflows/{fileName}</code>');
    expect(review).toMatch(/host\?\.saveWorkflow\(yaml, fileName\)/);
    const file = (workflowName) =>
      workflowFilePath(workflowFileName({ ...DEFAULTS, workflowName }));
    expect(file('GrillMyCode')).toBe(WORKFLOW_FILE);
    expect(file('Lab 3: Checkout')).toBe('.github/workflows/grill-my-code-lab-3-checkout.yml');
    expect(file('x'.repeat(100))).toBe(`.github/workflows/grill-my-code-${'x'.repeat(100)}.yml`);
  });

  // The page's half of the host: each is used by the step that needs it.
  it.each([
    ['pickFolder', join('steps', 'FilePreview.js')],
    ['openFolder', join('steps', 'FilePreview.js')],
    ['saveWorkflow', join('steps', 'StepReview.js')],
  ])('gives the Wizard host.%s, which %s uses', (member, file) => {
    expect(read(...WEBVIEW, 'host.js')).toMatch(new RegExp(`^\\s*${member}[:,]`, 'm'));
    expect(wizardText(file)).toMatch(new RegExp(`host\\??\\.${member}\\b`));
  });
});

// The Wizard writes the file the extension's workflow help then checks. A
// problem reported on a file the Wizard has just written means the two
// disagree about the action.
describe("the Wizard's workflow under the extension's checks", () => {
  const answered = {
    ...DEFAULTS,
    apiKeySecret: 'OPENROUTER_API_KEY',
    usesClassroom50: true,
    instructorRepoEnabled: true,
    instructorRepoTokenSecret: 'INSTRUCTOR_REPO_TOKEN',
    labelRepos: true,
    repoStart: 'template',
    starterCode: 'ask',
    triggerEvent: 'workflow_dispatch',
    branchMode: 'specify',
    pushBranches: ['main'],
    submissionTags: '',
    dispatchOverrides: [...DEFAULT_DISPATCH_OVERRIDES],
    dispatchOverridesEnabled: true,
  };

  it.each([
    ['as it comes', {}],
    ['run by hand, with nothing on the run form', { dispatchOverridesEnabled: false }],
    ['on every push', { triggerEvent: 'push+workflow_dispatch' }],
    ['on a submission tag', { triggerEvent: 'tag+workflow_dispatch', submissionTags: 'submit/*' }],
    [
      'on a tag that starts from a named one',
      {
        triggerEvent: 'tag+workflow_dispatch',
        submissionTags: 'part-1, part-2',
        tagDiffBase: 'tag:part-1',
        previousWork: 'ignore',
      },
    ],
    ['for empty repositories', { repoStart: 'empty', starterCode: 'none', usesClassroom50: false }],
    [
      'with every setting moved off its default',
      {
        aiModel: 'openai/gpt-6-luna-pro',
        aiModelVariant: 'nitro',
        aiReasoningEffort: 'high',
        aiTemperatureEnabled: true,
        aiTemperature: '0.5',
        aiRetryMaxAttempts: 3,
        numQuestions: 10,
        questionEmphasis: 'conceptual',
        includeAnswers: true,
        instructorContext: 'A second-year course.',
        assignmentContext: 'README.md, docs/brief.md',
        assignmentContextMaxChars: 10000,
        additionalExcludePatterns: 'data/**',
        excludePatternOverrides: 'README.md',
        stackTemplates: 'Node',
        keepComments: true,
        starterCode: 'context',
        starterQuestionsOneIn: 4,
        codebaseContextMaxChars: 20000,
        skipCommitters: 'github-actions[bot], jsmith',
      },
    ],
  ])('reports nothing on a workflow %s', (_what, changes) => {
    const yaml = generateYaml({ ...answered, ...changes }, { actionRef: ACTION_REF });
    expect(yaml).toContain(`@${ACTION_REF}`);
    expect(checkWorkflow(yaml)).toEqual([]);
  });
});

// The JetBrains plugin shows the same bundle in JCEF, where there is no VS
// Code. Its page runs wizard-bridge.js first, which gives the page's half of
// the host (host.js) the one call it makes of VS Code.
describe("the JetBrains plugin's page", () => {
  const host = read(...WEBVIEW, 'host.js');
  const bridge = read('extensions', 'jetbrains', 'src', 'main', 'resources', 'wizard-bridge.js');

  it('asks of VS Code only what the bridge gives', () => {
    expect([...host.matchAll(/\bacquireVsCodeApi\(\)/g)]).toHaveLength(1);
    const calls = [...host.matchAll(/\beditor\.(\w+)/g)].map(([, call]) => call);
    expect(new Set(calls)).toEqual(new Set(['postMessage']));
    // Answers arrive as `message` events on the window.
    expect(host).toContain("window.addEventListener('message'");
  });

  it('sends each message as JSON, and hands back each answer as an event', () => {
    /** @type {string[]} */
    const sent = [];
    /** @type {unknown[]} */
    const received = [];
    const window = {
      dispatchEvent: (/** @type {{ data: unknown }} */ event) => received.push(event.data),
    };
    class MessageEvent {
      /** @param {string} type @param {{ data: unknown }} init */
      constructor(type, { data }) {
        expect(type).toBe('message');
        this.data = data;
      }
    }
    const run = new Function(
      'window',
      'MessageEvent',
      'sent',
      bridge.replace('SEND_REQUEST', 'sent.push(request)'),
    );
    run(window, MessageEvent, sent);
    window.acquireVsCodeApi().postMessage({ type: 'list', id: 2, path: 'src' });
    expect(sent.map((text) => JSON.parse(text))).toEqual([{ type: 'list', id: 2, path: 'src' }]);
    window.gmcReceive({ id: 2, ok: true, value: [] });
    expect(received).toEqual([{ id: 2, ok: true, value: [] }]);
  });

  it('has the one place the plugin writes its call into', () => {
    expect(bridge.match(/SEND_REQUEST/g)).toHaveLength(1);
  });
});
