import * as core from '@actions/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  ALWAYS_EXCLUDE,
  ALWAYS_EXCLUDE_GROUPS,
  createFileFilter,
  filterFiles,
  instructorPatterns,
  isBinary,
  patternProblem,
  splitPatternList,
} from '../src/file-selection.js';
import {
  EDITOR_CONFIG_EXCLUDE_PATTERNS,
  FALLBACK_EXCLUDE_PATTERNS,
  NON_CODE_ASSET_EXCLUDE_PATTERNS,
  PROTECTED_EXCLUDE_GROUPS,
  PROTECTED_EXCLUDE_PATTERNS,
} from '../src/constants.js';
import { readInputs } from '../src/inputs.js';

vi.mock('@actions/core', async (importOriginal) => ({
  ...(await importOriginal()),
  warning: vi.fn(),
}));
import { parseGitignore } from '../scripts/fetch-gitignore-templates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templates = JSON.parse(
  readFileSync(join(__dirname, '..', 'src', 'data', 'gitignore-templates.json'), 'utf-8'),
);

describe('parseGitignore anchoring', () => {
  it('emits unanchored patterns with a **/ prefix so they match at any depth', () => {
    expect(parseGitignore('node_modules/')).toEqual(['**/node_modules/**']);
    expect(parseGitignore('__pycache__/')).toEqual(['**/__pycache__/**']);
    expect(parseGitignore('*.pyc')).toEqual(['**/*.pyc']);
  });

  it('keeps a leading slash root-anchored', () => {
    expect(parseGitignore('/dist/')).toEqual(['dist/**']);
    expect(parseGitignore('/config.json')).toEqual(['config.json', 'config.json/**']);
  });

  it('treats a mid-pattern separator as root-anchored, as gitignore does', () => {
    expect(parseGitignore('build/Release')).toEqual(['build/Release', 'build/Release/**']);
    expect(parseGitignore('share/python-wheels/')).toEqual(['share/python-wheels/**']);
  });

  it('emits both file and directory forms for a bare name', () => {
    expect(parseGitignore('coverage')).toEqual(['**/coverage', '**/coverage/**']);
  });

  it('skips comments, blank lines, and negations', () => {
    expect(parseGitignore('# comment\n\n!keep.js\n')).toEqual([]);
  });
});

describe('bundled templates exclude nested vendor directories', () => {
  const cases = [
    ['Node', 'frontend/node_modules/react/index.js'],
    ['Node', 'node_modules/react/index.js'],
    ['Python', 'backend/venv/lib/site.py'],
    ['Python', 'src/__pycache__/x.pyc'],
    ['Java', 'services/a/b/target/Main.class'],
  ];

  for (const [template, path] of cases) {
    it(`${template} excludes ${path}`, () => {
      expect(filterFiles([path], templates[template])).toEqual([]);
    });
  }

  it('leaves student source alongside the vendor tree in place', () => {
    const kept = ['frontend/src/app.js', 'backend/api/views.py'];
    expect(filterFiles(kept, [...templates.Node, ...templates.Python])).toEqual(kept);
  });
});

describe('FALLBACK_EXCLUDE_PATTERNS', () => {
  it('excludes vendor and build directories at any depth', () => {
    const files = [
      'frontend/node_modules/react/index.js',
      'packages/ui/dist/bundle.js',
      'services/worker/__pycache__/tasks.pyc',
      'api/vendor/autoload.php',
      'apps/web/.next/server/page.js',
      'deep/nested/path/.env',
    ];
    expect(filterFiles(files, FALLBACK_EXCLUDE_PATTERNS)).toEqual([]);
  });

  it('keeps student source', () => {
    const files = ['frontend/src/app.js', 'src/main.py', 'lib/helper.rb'];
    expect(filterFiles(files, FALLBACK_EXCLUDE_PATTERNS)).toEqual(files);
  });

  it('is entirely depth-independent — no pattern relies on matchBase', () => {
    const rootAnchored = FALLBACK_EXCLUDE_PATTERNS.filter((p) => !p.startsWith('**/'));
    expect(rootAnchored).toEqual([]);
  });
});

describe('editor configuration and non-code assets', () => {
  const nonCode = [
    '.vscode/settings.json',
    'app/.vscode/launch.json',
    'workspace.code-workspace',
    '.idea/misc.xml',
    'backend/.idea/modules.xml',
    'backend/backend.iml',
    '.vs/proj/v17/DocumentLayout.json',
    '.fleet/settings.json',
    '.project',
    '.classpath',
    '.settings/org.eclipse.jdt.core.prefs',
    'nbproject/project.xml',
    'App.xcodeproj/project.pbxproj',
    'proj.sublime-project',
    '.zed/settings.json',
    'src/.main.py.swp',
    'src/main.py~',
    'src/.#main.py',
    'src/#main.py#',
    '.cursor/rules/style.mdc',
    '.cursorrules',
    '.windsurf/rules.md',
    '.claude/settings.local.json',
    '.editorconfig',
    '.devcontainer/devcontainer.json',
    'diagram.drawio',
    'docs/architecture.dio',
    'design/flow.excalidraw',
    'docs/process.bpmn',
    'docs/classes.puml',
    'docs/sequence.mmd',
    'data/grades.csv',
    'data/grades.tsv',
  ];
  const source = [
    'src/project.py',
    'src/settings/config.py',
    'app/models/Session.java',
    'src/editorconfig.js',
    'src/data/loader.py',
  ];

  it('are excluded at any depth by the always-excluded lists', () => {
    const patterns = [...EDITOR_CONFIG_EXCLUDE_PATTERNS, ...NON_CODE_ASSET_EXCLUDE_PATTERNS];
    expect(filterFiles(nonCode, patterns)).toEqual([]);
  });

  it('are excluded by the fallback list too', () => {
    expect(filterFiles(nonCode, FALLBACK_EXCLUDE_PATTERNS)).toEqual([]);
  });

  it('leave similarly named student source in place', () => {
    const patterns = [...EDITOR_CONFIG_EXCLUDE_PATTERNS, ...NON_CODE_ASSET_EXCLUDE_PATTERNS];
    expect(filterFiles(source, patterns)).toEqual(source);
  });

  it('can be re-included with an override', () => {
    expect(filterFiles(['data/grades.csv'], NON_CODE_ASSET_EXCLUDE_PATTERNS, ['**/*.csv'])).toEqual(
      ['data/grades.csv'],
    );
  });
});

describe('root-anchored template patterns without a slash', () => {
  it('match only at the root, not by file name at any depth', () => {
    expect(filterFiles(['index.php', 'blog/index.php'], templates.WordPress)).toEqual([
      'blog/index.php',
    ]);
    expect(filterFiles(['Makefile', 'lab1/Makefile'], templates.Perl)).toEqual(['lab1/Makefile']);
    expect(filterFiles(['site', 'src/site'], templates.Python)).toEqual(['src/site']);
  });
});

describe('instructorPatterns', () => {
  it('makes a pattern with no slash match by file name at any depth', () => {
    expect(instructorPatterns('*.py')).toEqual(['**/*.py']);
    expect(instructorPatterns('*.{md,txt}')).toEqual(['**/*.{md,txt}']);
    expect(filterFiles(['starter.py', 'lab/starter.py'], instructorPatterns('starter.py'))).toEqual(
      [],
    );
  });

  it('leaves a pattern with a slash anchored at the root', () => {
    expect(instructorPatterns('tests/**')).toEqual(['tests/**']);
    expect(instructorPatterns('src/*.{js,ts}')).toEqual(['src/*.{js,ts}']);
  });

  it('judges brace alternatives one by one', () => {
    expect(instructorPatterns('{*.sql,data/**}')).toEqual(['{**/*.sql,data/**}']);
    const kept = filterFiles(
      ['db/q.sql', 'data/raw/a.bin', 'x/data/a.bin'],
      instructorPatterns('{*.sql,data/**}'),
    );
    expect(kept).toEqual(['x/data/a.bin']);
  });

  it('keeps a leading ! in front', () => {
    expect(instructorPatterns('!README.md')).toEqual(['!**/README.md']);
  });

  it('is applied to overrides, so a file name re-includes it at any depth', () => {
    expect(filterFiles(['docs/README.md', 'notes.md'], ['**/*.md'], ['README.md'])).toEqual([
      'docs/README.md',
    ]);
  });

  it('gives a plain name both its file and its folder form', () => {
    expect(instructorPatterns('starter.py')).toEqual(['**/starter.py', '**/starter.py/**']);
    expect(instructorPatterns('src/lib')).toEqual(['src/lib', 'src/lib/**']);
    const files = ['data', 'data/a.json', 'src/data/b.json', 'src/database.py'];
    expect(filterFiles(files, instructorPatterns('data'))).toEqual(['src/database.py']);
  });

  it('reads a trailing slash as a folder, at any depth unless the path has another slash', () => {
    expect(instructorPatterns('data/')).toEqual(['**/data/**']);
    expect(instructorPatterns('tests/fixtures/')).toEqual(['tests/fixtures/**']);
    expect(instructorPatterns('*.xcodeproj/')).toEqual(['**/*.xcodeproj/**']);
    expect(
      filterFiles(['data', 'data/a.json', 'x/data/b.json'], instructorPatterns('data/')),
    ).toEqual(['data']);
  });

  it('reads a leading ./ or / as the repository root and drops it', () => {
    expect(instructorPatterns('./data/**')).toEqual(['data/**']);
    expect(instructorPatterns('/data/**')).toEqual(['data/**']);
    expect(instructorPatterns('/config.json')).toEqual(['config.json', 'config.json/**']);
    expect(instructorPatterns('./data/')).toEqual(['data/**']);
    expect(instructorPatterns('/*.sql')).toEqual(['*.sql']);
    const files = ['config.json', 'src/config.json'];
    expect(filterFiles(files, instructorPatterns('/config.json'))).toEqual(['src/config.json']);
  });

  it('keeps a pattern with wildcards to the one form it had', () => {
    expect(instructorPatterns('test*')).toEqual(['**/test*']);
    expect(instructorPatterns('lab \\[1\\]/notes')).toEqual([
      'lab \\[1\\]/notes',
      'lab \\[1\\]/notes/**',
    ]);
  });

  it('gives a pattern that names nothing no forms', () => {
    expect(instructorPatterns('/')).toEqual([]);
    expect(instructorPatterns('./')).toEqual([]);
  });
});

describe('splitPatternList', () => {
  it('splits on commas and line breaks', () => {
    expect(splitPatternList('data/**, *.sql\n  tests/fixtures/**\r\n\nREADME.md,')).toEqual([
      'data/**',
      '*.sql',
      'tests/fixtures/**',
      'README.md',
    ]);
    expect(splitPatternList('')).toEqual([]);
  });

  it('keeps a comma inside braces with its pattern', () => {
    expect(splitPatternList('*.{js,ts}, src/{a,b{c,d}}/**')).toEqual([
      '*.{js,ts}',
      'src/{a,b{c,d}}/**',
    ]);
    expect(
      filterFiles(
        ['a.js', 'b.ts', 'c.py'],
        splitPatternList('*.{js, ts}').flatMap(instructorPatterns),
      ),
    ).toEqual(['c.py']);
  });

  it('splits at a comma after a brace that never closes', () => {
    expect(splitPatternList('{a,b')).toEqual(['{a', 'b']);
    expect(splitPatternList('a},{b,c}')).toEqual(['a}', '{b,c}']);
  });

  it('leaves an escaped brace out of the pairing', () => {
    expect(splitPatternList('lab \\{1,2\\}')).toEqual(['lab \\{1', '2\\}']);
  });
});

describe('case-insensitive matching', () => {
  const files = ['Readme.MD', 'Data/x.json', 'src/Main.PY', 'Build/out.js'];

  it('applies to the patterns named as case-insensitive only', () => {
    const excludes = ['**/*.md', 'data/**', '**/build/**'];
    expect(filterFiles(files, excludes)).toEqual(files);
    expect(filterFiles(files, excludes, [], ['**/*.md', 'data/**'])).toEqual([
      'src/Main.PY',
      'Build/out.js',
    ]);
  });

  it('always applies to overrides', () => {
    expect(filterFiles(['README.md', 'notes.md'], ['**/*.md'], ['readme.MD'])).toEqual([
      'README.md',
    ]);
  });
});

describe('the verdict on a file', () => {
  it('names the exclude pattern as written, a leading ! included', () => {
    const verdictOn = createFileFilter({ excludePatterns: instructorPatterns('!src/**') });
    expect(verdictOn('README.md')).toEqual({ assessed: false, pattern: '!src/**' });
    expect(verdictOn('src/app.js')).toEqual({ assessed: true });
  });

  it('names the exclude pattern an override beat', () => {
    const verdictOn = createFileFilter({
      excludePatterns: ['**/*.md', 'data/**'],
      overridePatterns: ['README.md'],
    });
    expect(verdictOn('README.md')).toEqual({ assessed: true, pattern: '**/*.md' });
    expect(verdictOn('notes.md')).toEqual({ assessed: false, pattern: '**/*.md' });
  });
});

describe('patternProblem', () => {
  it('names the two .gitignore habits that mean something else here', () => {
    expect(patternProblem('!src/**')).toBe('negated');
    expect(patternProblem('# starter files')).toBe('comment');
    expect(patternProblem('data/**')).toBeNull();
    expect(patternProblem('src/#notes.txt')).toBeNull();
  });
});

describe('isBinary', () => {
  it('calls content with a null byte binary', () => {
    expect(isBinary('\x89PNG\r\n\x1a\n\0\0\0\rIHDR')).toBe(true);
    expect(isBinary('const a = 1;\n')).toBe(false);
    expect(isBinary('')).toBe(false);
  });
});

describe('protected files', () => {
  const excludes = ['**/*.md', ...PROTECTED_EXCLUDE_PATTERNS];
  const files = [
    'frontend/.env',
    'frontend/package-lock.json',
    'frontend/node_modules/x/index.js',
    'frontend/node_modules/x/README.md',
    'frontend/notes.md',
    'vendor/pkg/a.php',
    'vendor/pkg/.env',
  ];
  const kept = (...overrides) => filterFiles(files, excludes, overrides);

  it('stay out under an override that does not name them', () => {
    expect(kept('frontend/**')).toEqual(['frontend/notes.md']);
    expect(kept('frontend/')).toEqual(['frontend/notes.md']);
    expect(kept('*.md')).toEqual(['frontend/notes.md']);
    expect(kept('**')).toEqual(['frontend/notes.md']);
    expect(kept('*.json')).toEqual([]);
  });

  it('come back under an override that names them', () => {
    expect(kept('frontend/.env')).toEqual(['frontend/.env']);
    expect(kept('package-lock.json')).toEqual(['frontend/package-lock.json']);
    expect(kept('*.lock', '**/package-lock.json')).toEqual(['frontend/package-lock.json']);
    expect(kept('**/node_modules/**')).toEqual([
      'frontend/node_modules/x/index.js',
      'frontend/node_modules/x/README.md',
    ]);
    expect(kept('frontend/node_modules/x/index.js')).toEqual(['frontend/node_modules/x/index.js']);
  });

  it('come back only when every protected pattern matching them is named', () => {
    expect(kept('vendor/')).toEqual(['vendor/pkg/a.php']);
    expect(kept('vendor/', '.env')).toEqual(['frontend/.env', 'vendor/pkg/a.php']);
    expect(kept('vendor/pkg/.env')).toEqual(['vendor/pkg/.env']);
  });

  it('judge a brace override one alternative at a time', () => {
    expect(kept('{.env,*.md}')).toEqual(['frontend/.env', 'frontend/notes.md']);
    expect(kept('!*.php')).toEqual(['frontend/notes.md']);
  });

  it('do not limit an override on any other file', () => {
    expect(filterFiles(['tests/a.py', 'tests/b.py'], ['tests/**'], ['tests/a.py'])).toEqual([
      'tests/a.py',
    ]);
  });

  it('are reported with the protected pattern the override left unnamed', () => {
    const verdictOn = createFileFilter({ excludePatterns: excludes, overridePatterns: ['*.md'] });
    expect(verdictOn('frontend/node_modules/x/README.md')).toEqual({
      assessed: false,
      pattern: '**/node_modules/**',
      guard: '**/node_modules/**',
    });
    expect(verdictOn('frontend/.env')).toEqual({ assessed: false, pattern: '**/.env' });
    expect(verdictOn('frontend/notes.md')).toEqual({ assessed: true, pattern: '**/*.md' });
    expect(verdictOn('src/app.js')).toEqual({ assessed: true });
  });

  it('cover every always-excluded environment and lock file pattern', () => {
    const always = ALWAYS_EXCLUDE_GROUPS.filter((g) =>
      ['Environment files', 'Lock files'].includes(g.label),
    ).flatMap((g) => g.patterns);
    expect(always.length).toBeGreaterThan(0);
    expect(PROTECTED_EXCLUDE_PATTERNS).toEqual(expect.arrayContaining(always));
    expect(PROTECTED_EXCLUDE_GROUPS.map((g) => g.label)).toContain('Dependency folders');
    expect(ALWAYS_EXCLUDE).toEqual(expect.arrayContaining(always));
  });
});

describe('pattern list inputs', () => {
  const KEYS = [
    'INPUT_GITHUB_TOKEN',
    'INPUT_API_KEY',
    'INPUT_ADDITIONAL_EXCLUDE_PATTERNS',
    'INPUT_EXCLUDE_PATTERN_OVERRIDES',
    'INPUT_ASSIGNMENT_CONTEXT',
  ];
  const read = (env) => {
    for (const key of KEYS) delete process.env[key];
    Object.assign(process.env, { INPUT_GITHUB_TOKEN: 'token', INPUT_API_KEY: 'key' }, env);
    return readInputs();
  };

  afterEach(() => {
    for (const key of KEYS) delete process.env[key];
    core.warning.mockClear();
  });

  it('are split outside braces and across lines', () => {
    const inputs = read({
      INPUT_ADDITIONAL_EXCLUDE_PATTERNS: '*.{sql,csv}, data/\nfixtures',
      INPUT_EXCLUDE_PATTERN_OVERRIDES: 'README.md',
      INPUT_ASSIGNMENT_CONTEXT: 'docs/*.{md,txt}, brief.pdf',
    });
    expect(inputs.additionalExcludePatterns).toEqual(['*.{sql,csv}', 'data/', 'fixtures']);
    expect(inputs.excludePatternOverrides).toEqual(['README.md']);
    expect(inputs.assignmentContextGlobs).toEqual(['docs/*.{md,txt}', 'brief.pdf']);
  });

  it('are empty when the input is', () => {
    const inputs = read({});
    expect(inputs.additionalExcludePatterns).toEqual([]);
    expect(inputs.excludePatternOverrides).toEqual([]);
  });

  it('warn about a leading ! or #, and keep the pattern', () => {
    const inputs = read({
      INPUT_ADDITIONAL_EXCLUDE_PATTERNS: '!src/**, # starter files, data/**',
      INPUT_EXCLUDE_PATTERN_OVERRIDES: '!keep.py',
    });
    expect(inputs.additionalExcludePatterns).toEqual(['!src/**', '# starter files', 'data/**']);
    const messages = core.warning.mock.calls.map(([m]) => m);
    expect(messages).toHaveLength(3);
    expect(messages[0]).toMatch(/additional_exclude_patterns: "!src\/\*\*" starts with "!"/);
    expect(messages[0]).toMatch(/excludes every file that does not match "src\/\*\*"/);
    expect(messages[1]).toMatch(/"# starter files" starts with "#"/);
    expect(messages[2]).toMatch(/exclude_pattern_overrides: "!keep.py"/);
  });
});
