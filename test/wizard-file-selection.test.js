import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  OUT_PATH,
  SOURCE_PATH,
  buildWizardFileSelection,
} from '../scripts/build-wizard-file-selection.js';
import * as action from '../src/file-selection.js';
import * as wizard from '../docs-site/docs/_workflow-wizard/fileSelection.js';
import { DEFAULTS, generateYaml } from '../docs-site/docs/_workflow-wizard/generateYaml.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (...parts) => JSON.parse(readFileSync(join(root, ...parts), 'utf-8'));
const source = readFileSync(SOURCE_PATH, 'utf-8');

describe("the Workflow Wizard's copy of the file selection rules", () => {
  it('matches src/ — run node scripts/build-wizard-file-selection.js if not', () => {
    expect(readFileSync(OUT_PATH, 'utf-8')).toBe(buildWizardFileSelection(source));
  });

  it('exports what the action exports', () => {
    expect(Object.keys(wizard).sort()).toEqual(Object.keys(action).sort());
  });

  // The copy imports minimatch from the docs site's own dependencies. A
  // different version there could match a pattern differently from the action.
  it('runs on the minimatch range the action declares', () => {
    expect(readJson('docs-site', 'package.json').dependencies.minimatch).toBe(
      readJson('package.json').dependencies.minimatch,
    );
  });
});

describe('buildWizardFileSelection', () => {
  it('writes the imported constants in', () => {
    const built = buildWizardFileSelection(source);
    expect(built).not.toContain("from './constants.js'");
    expect(built).toContain('const MAX_PROJECT_FOLDERS = ');
  });

  it('refuses a source that imports another file by path', () => {
    expect(() => buildWizardFileSelection(`import { git } from './git.js';\n${source}`)).toThrow(
      /imports another file by path/,
    );
  });

  it('refuses a source without the constants import', () => {
    expect(() => buildWizardFileSelection("import { Minimatch } from 'minimatch';\n")).toThrow(
      /constants\.js/,
    );
  });
});

// The Wizard has no src/data/gitignore-templates.json: it reads the templates
// from its generated excludeLists.json, which holds only those a language or a
// project file can reach. These repositories check that the two give the same
// answers, each through its own copy of the rules.
describe('the Wizard and the action select the same files', () => {
  const actionTemplates = readJson('src', 'data', 'gitignore-templates.json');
  const wizardTemplates = readJson(
    'docs-site',
    'docs',
    '_workflow-wizard',
    'excludeLists.json',
  ).templates;

  const repositories = [
    {
      name: 'a Node project with a Laravel app in a subfolder',
      languages: ['JavaScript', 'PHP'],
      files: {
        'package.json': JSON.stringify({ dependencies: { next: '^15.0.0' } }),
        'src/index.js': '',
        'src/lib/util.js': '',
        'dist/bundle.js': '',
        '.next/cache/x': '',
        'node_modules/react/index.js': '',
        'api/artisan': '',
        'api/composer.json': JSON.stringify({ require: { 'laravel/framework': '^12.0' } }),
        'api/vendor/autoload.php': '',
        'api/routes/web.php': '',
        'api/.env': '',
        'README.md': '',
        'Data/Seed.SQL': '',
      },
      additionalExcludePatterns: 'data/, *.{sql, csv}',
      excludePatternOverrides: 'README.md\napi/**',
    },
    {
      name: 'a Python repository detected by language alone',
      languages: ['Python', 'Jupyter Notebook'],
      files: {
        'main.py': '',
        'lib/helpers.py': '',
        'build/out.py': '',
        'notes.ipynb': '',
        '.venv/bin/python': '',
        'poetry.lock': '',
      },
      additionalExcludePatterns: './notes.ipynb',
      excludePatternOverrides: '*.lock, .venv/**',
    },
    {
      name: 'a C# solution',
      languages: ['C#'],
      files: { 'App/Program.cs': '', 'App/bin/Debug/App.dll': '', 'App/obj/x.json': '' },
      additionalExcludePatterns: '',
      excludePatternOverrides: '',
    },
    {
      name: 'a repository where nothing is detected',
      languages: [],
      files: { 'notes.txt': '', 'out/report.txt': '', 'vendor/tool.sh': '' },
      additionalExcludePatterns: '',
      excludePatternOverrides: 'vendor/',
    },
  ];

  /** The exclude list and each file's verdict, through one copy of the rules. */
  function select(rules, allTemplates, repository) {
    const paths = Object.keys(repository.files);
    const stack = rules.detectStack({
      languages: repository.languages,
      paths,
      readText: (path) => repository.files[path] ?? null,
      allTemplates,
    });
    const { excludePatterns, verdictOn } = rules.buildFileRules({
      detectedPatterns: stack.patterns,
      additionalExcludePatterns: rules.splitPatternList(repository.additionalExcludePatterns),
      excludePatternOverrides: rules.splitPatternList(repository.excludePatternOverrides),
    });
    return {
      templates: [...stack.detected].map(([folder, { keys }]) => [folder, [...keys]]),
      manifests: stack.manifests,
      excludePatterns,
      verdicts: paths.map((path) => [path, verdictOn(path)]),
    };
  }

  for (const repository of repositories) {
    it(`in ${repository.name}`, () => {
      const fromAction = select(action, actionTemplates, repository);
      expect(select(wizard, wizardTemplates, repository)).toEqual(fromAction);
      // Guards against both sides agreeing on nothing.
      expect(fromAction.verdicts.some(([, verdict]) => verdict.assessed)).toBe(true);
      expect(fromAction.verdicts.some(([, verdict]) => !verdict.assessed)).toBe(true);
    });
  }
});

describe('generateYaml pattern lists', () => {
  it('writes each list as the action will split it', () => {
    const yaml = generateYaml({
      ...DEFAULTS,
      additionalExcludePatterns: '*.{js, ts}\n data/ ,\n',
      excludePatternOverrides: 'README.md\nsrc/{a,b}/**',
    });
    expect(yaml).toContain('*.{js,ts}, data/');
    expect(yaml).toContain('README.md, src/{a,b}/**');
  });
});
