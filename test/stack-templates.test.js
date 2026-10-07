import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as core from '@actions/core';
import { listTreeFiles, readFileAt } from '../src/git.js';
import { STACK_TEMPLATE_FOLDER_SEPARATOR } from '../src/constants.js';
import {
  FALLBACK_WITH_ALWAYS_EXCLUDE,
  LANGUAGE_TO_TEMPLATES,
  OWN_TEMPLATES,
  buildFileRules,
  detectStack,
  pinnedStack,
  splitStackTemplates,
  stackTemplateEntries,
} from '../src/file-selection.js';
import { readInputs } from '../src/inputs.js';
import { detectExcludePatterns } from '../src/stack-detection.js';
import { DEFAULTS, generateYaml } from '../docs-site/docs/_workflow-wizard/generateYaml.js';

vi.mock('@actions/core', async (importOriginal) => ({
  ...(await importOriginal()),
  info: vi.fn(),
  warning: vi.fn(),
  debug: vi.fn(),
}));
vi.mock('../src/git.js', () => ({ listTreeFiles: vi.fn(), readFileAt: vi.fn() }));

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (...parts) => JSON.parse(readFileSync(join(root, ...parts), 'utf-8'));
const templates = readJson('src', 'data', 'gitignore-templates.json');
const wizardTemplates = readJson(
  'docs-site',
  'docs',
  '_workflow-wizard',
  'excludeLists.json',
).templates;

const pin = (...entries) => pinnedStack({ entries, allTemplates: templates });

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('splitStackTemplates', () => {
  it('splits at commas and line breaks', () => {
    expect(splitStackTemplates('Node, Python\r\n Laravel@api ,\n')).toEqual([
      'Node',
      'Python',
      'Laravel@api',
    ]);
  });

  it('gives nothing for an empty input', () => {
    expect(splitStackTemplates('')).toEqual([]);
    expect(splitStackTemplates(' ,\n, ')).toEqual([]);
  });
});

describe('template names', () => {
  const names = [...Object.keys(templates), ...Object.keys(OWN_TEMPLATES)];

  // pinnedStack reads a name in any case, and an entry ends at a comma.
  it('are still distinct with case ignored', () => {
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
  });

  it('hold nothing an entry gives another meaning', () => {
    for (const name of names) {
      expect(name).not.toMatch(/[,\r\n]/);
      expect(name).not.toContain(STACK_TEMPLATE_FOLDER_SEPARATOR);
      expect(name).toBe(name.trim());
    }
  });
});

describe('pinnedStack', () => {
  it('applies a template at the repository root', () => {
    const { patterns, origins, detected, unknown } = pin('Node');
    expect(unknown).toEqual([]);
    expect([...detected.keys()]).toEqual(['']);
    expect(patterns).toContain('**/node_modules/**');
    expect(patterns).toContain('**/.gitignore');
    expect(origins.get('**/node_modules/**')).toEqual({
      kind: 'template',
      template: 'Node',
      folder: '',
    });
  });

  it('applies a template inside the folder an entry names', () => {
    const { patterns, origins } = pin('Laravel@api');
    const anchored = templates.Laravel.find((p) => !p.startsWith('**/'));
    expect(patterns).toContain(`api/${anchored}`);
    expect(patterns).not.toContain(anchored);
    expect(origins.get(`api/${anchored}`)).toEqual({
      kind: 'template',
      template: 'Laravel',
      folder: 'api',
    });
  });

  it('reads a folder however it is written', () => {
    const folders = (...entries) => [...pin(...entries).detected.keys()];
    expect(folders('Node@./api/', 'Node@/api', 'Node @ api')).toEqual(['api']);
    expect(folders('Node@.', 'Node@/', 'Node@')).toEqual(['']);
    // The first separator ends the name; a folder may hold more.
    expect(folders('Node@packages/@scope/app')).toEqual(['packages/@scope/app']);
  });

  it('reads a name in any case', () => {
    const { detected, unknown } = pin('node', 'GLOBAL/LINUX', 'sveltekit');
    expect(unknown).toEqual([]);
    expect([...detected.get('').keys]).toEqual(['Node', 'Global/Linux']);
    expect([...detected.get('').extraPatterns]).toEqual(OWN_TEMPLATES.SvelteKit);
  });

  it("applies the action's own templates as project file patterns", () => {
    const { patterns, origins } = pin('Nuxt@web');
    for (const p of OWN_TEMPLATES.Nuxt) {
      expect(patterns).toContain(`web/${p}`);
      expect(origins.get(`web/${p}`)).toEqual({ kind: 'project', folder: 'web' });
    }
  });

  it('leaves out a name it does not know, and says so', () => {
    const { patterns, unknown } = pin('Node', 'Nodee@web', '@web');
    expect(patterns).toContain('**/node_modules/**');
    expect(unknown).toEqual([
      { written: 'Nodee@web', name: 'Nodee', language: null },
      { written: '@web', name: '', language: null },
    ]);
  });

  it('says which template a language name means', () => {
    expect(pin('javascript').unknown).toEqual([
      { written: 'javascript', name: 'javascript', language: LANGUAGE_TO_TEMPLATES.JavaScript },
    ]);
  });

  it('gives the fallback list when no entry names a template', () => {
    const { patterns, origins, detected } = pin('Nodee');
    expect(detected.size).toBe(0);
    expect(patterns).toEqual(FALLBACK_WITH_ALWAYS_EXCLUDE);
    expect(origins.get('**/dist/**')).toEqual({ kind: 'fallback' });
  });

  it('flags source a pinned template leaves out, as it does for a detected one', () => {
    const stack = pin('Python');
    const { verdictOn, mayBeOwnWork } = buildFileRules({
      detectedPatterns: stack.patterns,
      detectedOrigins: stack.origins,
    });
    const languageFiles = readJson('src', 'data', 'language-files.json');
    const verdict = verdictOn('src/lib/util.js');
    expect(verdict.assessed).toBe(false);
    expect(mayBeOwnWork('src/lib/util.js', verdict, languageFiles)).toBe(true);
  });
});

describe('stackTemplateEntries', () => {
  const repositories = [
    {
      name: 'a Next.js app with a Laravel API in a subfolder',
      languages: ['JavaScript', 'PHP'],
      files: {
        'package.json': JSON.stringify({ dependencies: { next: '^15.0.0' } }),
        'api/artisan': '',
        'api/composer.json': JSON.stringify({ require: { 'laravel/framework': '^12.0' } }),
      },
      // PHP has no template of its own; Composer is the one its projects reach.
      entries: ['Node', 'Nextjs', 'Composer@api', 'Laravel@api'],
    },
    {
      name: 'frameworks with no upstream template',
      languages: ['Svelte'],
      files: {
        'web/package.json': JSON.stringify({ dependencies: { svelte: '^5.0.0', nuxt: '^4.0.0' } }),
        'web/svelte.config.js': '',
      },
      entries: ['Node@web', 'SvelteKit@web', 'Nuxt@web'],
    },
    {
      name: 'a folder with a space and a bracket in its name',
      languages: ['Python'],
      files: { 'lab [1] final/Cargo.toml': '' },
      entries: ['Python', 'Rust@lab [1] final'],
    },
  ];

  for (const { name, languages, files, entries } of repositories) {
    it(`names the stack of ${name}, and pinning it gives the same exclude list`, () => {
      const detected = detectStack({
        languages,
        paths: Object.keys(files),
        readText: (path) => files[path] ?? null,
        allTemplates: templates,
      });
      const written = stackTemplateEntries(detected.detected);
      expect(written).toEqual({ entries, unnamed: [] });

      // Through the input's own splitter, as a workflow would carry it.
      const pinned = pin(...splitStackTemplates(written.entries.join(', ')));
      expect(pinned.unknown).toEqual([]);
      expect([...pinned.patterns].sort()).toEqual([...detected.patterns].sort());
      for (const pattern of detected.patterns) {
        expect(pinned.origins.get(pattern)).toEqual(detected.origins.get(pattern));
      }

      // The Wizard writes the entries from its own, smaller set of templates.
      const inWizard = pinnedStack({ entries: written.entries, allTemplates: wizardTemplates });
      expect(inWizard.patterns).toEqual(pinned.patterns);
    });
  }

  it('leaves out a folder an entry cannot name', () => {
    const detected = detectStack({
      languages: [],
      paths: ['package.json', 'lab 1, part 2/package.json', ' padded/package.json'],
      readText: () => null,
      allTemplates: templates,
    });
    expect(stackTemplateEntries(detected.detected)).toEqual({
      entries: ['Node'],
      unnamed: [' padded', 'lab 1, part 2'],
    });
  });

  it('gives nothing for the fallback list', () => {
    const { detected } = detectStack({
      languages: [],
      paths: ['notes.txt'],
      readText: () => null,
      allTemplates: templates,
    });
    expect(stackTemplateEntries(detected)).toEqual({ entries: [], unnamed: [] });
  });
});

describe('detectExcludePatterns with stack_templates', () => {
  const run = (stackTemplates) =>
    detectExcludePatterns('token', 'org', 'repo', 'abc123', stackTemplates);

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ Python: 1000 }), { status: 200 })),
    );
    listTreeFiles.mockReturnValue(['package.json', 'api/artisan']);
    readFileAt.mockReturnValue('{}');
  });

  it('applies the named templates without looking at the repository', async () => {
    const { patterns, stack } = await run(['Go', 'Rust@engine']);
    expect(fetch).not.toHaveBeenCalled();
    expect(listTreeFiles).not.toHaveBeenCalled();
    expect(readFileAt).not.toHaveBeenCalled();
    expect(patterns).toContain('**/*.exe');
    expect(patterns).not.toContain('**/__pycache__/**');
    expect(patterns).not.toContain('**/node_modules/**');
    expect(stack).toEqual({ pinned: true, entries: ['Go', 'Rust@engine'] });
    const logged = core.info.mock.calls.map(([m]) => m);
    expect(logged).toContain('Using gitignore templates: Go');
    expect(logged).toContain('Using gitignore templates in engine/: Rust');
    expect(core.warning).not.toHaveBeenCalled();
  });

  it('warns about a name it does not know and applies the rest', async () => {
    const { stack } = await run(['Node', 'TypeScript', 'Nodee']);
    expect(stack).toEqual({ pinned: true, entries: ['Node'] });
    const warnings = core.warning.mock.calls.map(([m]) => m);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/stack_templates: "TypeScript" was ignored/);
    expect(warnings[0]).toMatch(/It is a language; its template is Node\./);
    expect(warnings[1]).toMatch(/"Nodee" is not a template the action knows\.$/);
  });

  it('falls back, with a warning, when no entry names a template', async () => {
    const { patterns, stack } = await run(['Nodee']);
    expect(patterns).toEqual(FALLBACK_WITH_ALWAYS_EXCLUDE);
    expect(stack).toEqual({ pinned: true, entries: [] });
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('No entry in stack_templates names a known template'),
    );
  });

  it('detects the stack when the input is empty, and names it', async () => {
    const { patterns, stack } = await run([]);
    expect(fetch).toHaveBeenCalled();
    expect(patterns).toContain('**/__pycache__/**');
    expect(stack).toEqual({ pinned: false, entries: ['Node', 'Python', 'Laravel@api'] });
  });
});

describe('the stack_templates input', () => {
  const KEYS = ['INPUT_GITHUB_TOKEN', 'INPUT_API_KEY', 'INPUT_STACK_TEMPLATES'];
  const read = (env) => {
    for (const key of KEYS) delete process.env[key];
    Object.assign(process.env, { INPUT_GITHUB_TOKEN: 'token', INPUT_API_KEY: 'key' }, env);
    return readInputs();
  };

  afterEach(() => {
    for (const key of KEYS) delete process.env[key];
  });

  it('is empty unless set, so the stack is detected', () => {
    expect(read({}).stackTemplates).toEqual([]);
  });

  it('is split into its entries', () => {
    expect(read({ INPUT_STACK_TEMPLATES: 'Node, Nextjs\nLaravel@api' }).stackTemplates).toEqual([
      'Node',
      'Nextjs',
      'Laravel@api',
    ]);
  });
});

describe('generateYaml stack_templates', () => {
  it('is left out unless the stack is pinned', () => {
    expect(generateYaml(DEFAULTS)).not.toContain('stack_templates');
  });

  it('writes the entries as the action will split them', () => {
    const yaml = generateYaml({ ...DEFAULTS, stackTemplates: "Node, Laravel@it's api" });
    const line = yaml.split('\n').find((l) => l.trim().startsWith('stack_templates:'));
    expect(line).toBe("          stack_templates: 'Node, Laravel@it''s api'");
  });
});
