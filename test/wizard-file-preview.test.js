import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  ACTION_LANGUAGE_FILES_PATH,
  LANGUAGE_FILES_PATH,
  buildLanguageFiles,
  parseLinguistLanguages,
} from '../scripts/build-wizard-exclude-lists.js';
import * as action from '../src/file-selection.js';
import { MAX_PROJECT_FOLDERS, PROTECTED_EXCLUDE_GROUPS } from '../src/constants.js';
import {
  DEPENDENCY_FOLDERS,
  PREVIEW_BINARY_CHECK_BYTES,
  PREVIEW_MAX_FILES,
  asOverride,
  guessLanguages,
  isDependencyFolder,
  languageOptions,
  languageTemplates,
  manifestPaths,
  parseFileList,
  patternProblems,
  previewFiles,
} from '../docs-site/docs/_workflow-wizard/filePreview.js';
import {
  readBinaryFiles,
  readDirectoryHandle,
  readFileInput,
  readManifests,
} from '../docs-site/docs/_workflow-wizard/readFolder.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (...parts) => JSON.parse(readFileSync(join(root, ...parts), 'utf-8'));
const lists = readJson('docs-site', 'docs', '_workflow-wizard', 'excludeLists.json');
const languageFiles = JSON.parse(readFileSync(LANGUAGE_FILES_PATH, 'utf-8'));

const LINGUIST_SAMPLE = [
  '# Defines all languages known to GitHub.',
  '---',
  'C:',
  '  type: programming',
  '  extensions:',
  '  - ".c"',
  '  - ".h"',
  '  interpreters:',
  '  - tcc',
  'C#:',
  '  type: programming',
  '  aliases:',
  '  - csharp',
  '  extensions:',
  '  - ".cs"',
  '  - ".csx"',
  'C++:',
  '  type: programming',
  '  extensions:',
  '  - ".cpp"',
  '  - ".h"',
  '  - ".C"',
  'GCC Machine Description:',
  '  type: programming',
  '  extensions:',
  '  - ".md"',
  'JSON:',
  '  type: data',
  '  extensions:',
  '  - ".json"',
  '  filenames:',
  '  - ".watchmanconfig"',
  'Markdown:',
  '  type: prose',
  '  extensions:',
  '  - ".md"',
  'Ruby:',
  '  type: programming',
  '  extensions:',
  '  - ".rb"',
  '  filenames:',
  '  - Gemfile',
  '  - ".irbrc"',
  'Smalltalk:',
  '  type: programming',
  '  extensions:',
  '  - ".st"',
  '  - ".cs"',
  'TSX:',
  '  type: programming',
  '  group: TypeScript',
  '  extensions:',
  '  - ".tsx"',
  'TypeScript:',
  '  type: programming',
  '  extensions:',
  '  - ".ts"',
  'XML:',
  '  type: data',
  '  extensions:',
  '  - ".xml"',
  '  - ".ts"',
].join('\n');

describe('parseLinguistLanguages', () => {
  const languages = parseLinguistLanguages(LINGUIST_SAMPLE);

  it('reads each language with its type, group, extensions and file names', () => {
    expect(languages.find((l) => l.name === 'Ruby')).toEqual({
      name: 'Ruby',
      type: 'programming',
      group: null,
      extensions: ['.rb'],
      filenames: ['Gemfile', '.irbrc'],
    });
    expect(languages.find((l) => l.name === 'TSX').group).toBe('TypeScript');
  });

  it('keeps other lists out of the extensions', () => {
    expect(languages.find((l) => l.name === 'C').extensions).toEqual(['.c', '.h']);
    expect(languages.find((l) => l.name === 'C#').extensions).toEqual(['.cs', '.csx']);
  });
});

describe('buildLanguageFiles', () => {
  const built = buildLanguageFiles(parseLinguistLanguages(LINGUIST_SAMPLE));

  it('gives an extension to its only language', () => {
    expect(built.extensions['.rb']).toBe('Ruby');
    expect(built.extensions['.cpp']).toBe('C++');
  });

  it('gives a shared extension to the only language that has it first', () => {
    expect(built.extensions['.cs']).toBe('C#');
    expect(built.extensions['.ts']).toBe('TypeScript');
  });

  it('lists the languages of an extension none of them, or several, have first', () => {
    expect(built.extensions['.h']).toEqual(['C', 'C++']);
  });

  it('reports a language under its group, and folds case', () => {
    expect(built.extensions['.tsx']).toBe('TypeScript');
    // C++ lists `.C`, which is the same extension here; C has it first.
    expect(built.extensions['.c']).toBe('C');
    expect(built.extensions).not.toHaveProperty('.C');
  });

  it('names only the languages GitHub counts', () => {
    expect(built.extensions).not.toHaveProperty('.json');
    expect(built.extensions).not.toHaveProperty('.xml');
    expect(built.filenames).toEqual({ '.irbrc': 'Ruby', Gemfile: 'Ruby' });
  });

  // Markdown is prose, so `.md` can only be reported as the other language —
  // and nearly never is. A list of one keeps it from counting as a sure sign.
  it('keeps an extension shared with an uncounted language as a list', () => {
    expect(built.extensions['.md']).toEqual(['GCC Machine Description']);
  });
});

describe("the Workflow Wizard's language files", () => {
  it('map the common extensions to the languages GitHub reports', () => {
    expect(languageFiles.extensions).toMatchObject({
      '.py': 'Python',
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.cs': 'C#',
      '.java': 'Java',
      '.php': 'PHP',
      '.html': 'HTML',
    });
    expect(languageFiles.extensions['.h']).toEqual(['C', 'C++', 'Objective-C']);
    expect(languageFiles.filenames.Gemfile).toBe('Ruby');
  });

  it("are the action's — run node scripts/build-wizard-exclude-lists.js if not", () => {
    expect(JSON.parse(readFileSync(ACTION_LANGUAGE_FILES_PATH, 'utf-8'))).toEqual(languageFiles);
  });
});

describe('parseFileList', () => {
  it('reads one path per line, in the forms a listing prints them', () => {
    const text =
      './src/app.js\r\n"my notes.py"\nsrc\\lib\\util.js\n\n  /abs.txt  \nbuild/\nsrc/app.js';
    expect(parseFileList(text)).toEqual([
      'src/app.js',
      'my notes.py',
      'src/lib/util.js',
      'abs.txt',
    ]);
  });
});

describe('the folders the reader does not open', () => {
  it("are the protected set's dependency folders", () => {
    const group = PROTECTED_EXCLUDE_GROUPS.find((g) => g.label === 'Dependency folders');
    expect(DEPENDENCY_FOLDERS.map((name) => `**/${name}/**`)).toEqual(group.patterns);
  });

  it('are matched whatever the case', () => {
    expect(isDependencyFolder('Node_Modules')).toBe(true);
    expect(isDependencyFolder('src')).toBe(false);
  });
});

describe('guessLanguages', () => {
  it('is sure of a language with a file only it can own', () => {
    expect(guessLanguages(['src/main.c', 'src/main.h', 'Gemfile'], languageFiles)).toEqual([
      { name: 'C', sure: true, via: ['.c'] },
      { name: 'C++', sure: false, via: ['.h'] },
      { name: 'Objective-C', sure: false, via: ['.h'] },
      { name: 'Ruby', sure: true, via: ['Gemfile'] },
    ]);
  });

  it('tries a longer extension before a shorter one, ignoring case', () => {
    const names = (paths) => guessLanguages(paths, languageFiles).map((l) => l.name);
    expect(names(['App.PY'])).toEqual(['Python']);
    expect(names(['types.d.ts'])).toEqual(['TypeScript']);
  });

  it('finds none in data and prose', () => {
    expect(guessLanguages(['data.json', 'notes.txt', 'config.yml'], languageFiles)).toEqual([]);
  });
});

describe('languageOptions', () => {
  const paths = ['web/app.js', 'web/index.html', 'native/a.h'];

  it('offers the languages that turn on a template, sure ones ticked', () => {
    const options = languageOptions(paths, languageFiles, lists.templates);
    expect(options.map((o) => [o.name, o.on, o.templates])).toEqual([
      ['C', false, ['C']],
      ['C++', false, ['C++']],
      ['JavaScript', true, ['Node']],
      ['Objective-C', false, ['Objective-C']],
    ]);
  });

  it("follows the instructor's choice over the guess", () => {
    const options = languageOptions(paths, languageFiles, lists.templates, {
      JavaScript: false,
      'C++': true,
    });
    expect(options.filter((o) => o.on).map((o) => o.name)).toEqual(['C++']);
  });

  it('reaches the templates the action reaches', () => {
    for (const { template, languages } of lists.languages) {
      for (const language of languages) {
        expect(languageTemplates(language, lists.templates)).toContain(template);
      }
    }
    expect(languageTemplates('HTML', lists.templates)).toEqual([]);
  });
});

describe('manifestPaths', () => {
  it('lists the manifests of the project folders, and no others', () => {
    const paths = ['package.json', 'api/composer.json', 'api/src/x.php', 'docs/package.json.bak'];
    expect(manifestPaths(paths)).toEqual(['package.json', 'api/composer.json']);
  });
});

describe('asOverride', () => {
  it('gives the pattern back when an override means the same', () => {
    expect(asOverride('**/lib/**')).toBe('**/lib/**');
    expect(asOverride('api/storage/*.key')).toBe('api/storage/*.key');
  });

  it('gives nothing when the overrides box would read it differently', () => {
    // No slash: an override matches it at any depth, the template at the root.
    expect(asOverride('index.php')).toBeNull();
    // Read as two patterns.
    expect(asOverride('a,b/**')).toBeNull();
    // A plain path gets a folder form too.
    expect(asOverride('api/vendor')).toBeNull();
  });
});

describe('patternProblems', () => {
  it('lists only the patterns with a problem', () => {
    expect(patternProblems('data/**, !src/**\n# starter files')).toEqual([
      { written: '!src/**', problem: 'negated' },
      { written: '# starter files', problem: 'comment' },
    ]);
  });
});

describe('previewFiles', () => {
  const files = {
    'package.json': JSON.stringify({ dependencies: { next: '^15.0.0' } }),
    'package-lock.json': '',
    'README.md': '',
    'src/app.js': '',
    'src/lib/util.js': '',
    'src/lib/notes.txt': '',
    'api/main.py': '',
    'api/requirements.txt': '',
    'frontend/.env': '',
    'frontend/page.ts': '',
    'data/table.csv': '',
    'data/seed.sql': '',
    '.github/workflows/grill.yml': '',
  };
  const preview = (settings = {}) =>
    previewFiles({
      paths: Object.keys(files),
      texts: files,
      languages: ['JavaScript', 'Python', 'TypeScript'],
      lists,
      languageFiles,
      ...settings,
    });
  const group = (result, pattern) => result.leftOut.find((g) => g.pattern === pattern);

  it('gives the verdicts the action gives', () => {
    const settings = {
      additionalExcludePatterns: 'data/, *.{txt, sql}',
      excludePatternOverrides: 'README.md\nfrontend/**',
    };
    const result = preview(settings);

    const paths = Object.keys(files);
    const stack = action.detectStack({
      languages: ['JavaScript', 'Python', 'TypeScript'],
      paths,
      readText: (path) => files[path] ?? null,
      allTemplates: readJson('src', 'data', 'gitignore-templates.json'),
    });
    const { verdictOn } = action.buildFileRules({
      detectedPatterns: stack.patterns,
      additionalExcludePatterns: action.splitPatternList(settings.additionalExcludePatterns),
      excludePatternOverrides: action.splitPatternList(settings.excludePatternOverrides),
    });
    const expected = paths.filter((path) => verdictOn(path).assessed).sort();

    expect(result.assessed.map((f) => f.path)).toEqual(expected);
    expect(result.total).toBe(paths.length);
    expect(result.leftOutCount).toBe(paths.length - expected.length);
    for (const { pattern, files: left } of result.leftOut) {
      for (const path of left) expect(verdictOn(path)).toMatchObject({ assessed: false, pattern });
    }
  });

  it('reports the detected stack by folder', () => {
    expect(preview().stack).toEqual([
      { folder: '', templates: ['Node', 'Nextjs', 'Python'], patterns: [] },
      { folder: 'api', templates: ['Python'], patterns: [] },
    ]);
    expect(preview().usedFallback).toBe(false);
  });

  it('names the rule behind each file left out', () => {
    const result = preview({ additionalExcludePatterns: 'data/' });
    expect(group(result, '**/package-lock.json').origin).toEqual({
      kind: 'always',
      label: 'Lock files',
    });
    expect(group(result, '.github/workflows/**').origin).toEqual({
      kind: 'always',
      label: 'GitHub Actions workflows',
    });
    expect(group(result, '**/lib/**').origin).toEqual({
      kind: 'template',
      template: 'Python',
      folder: '',
    });
    expect(group(result, '**/data/**')).toMatchObject({
      origin: { kind: 'yours', written: 'data/' },
      files: ['data/seed.sql'],
    });
  });

  it("lists the instructor's patterns first, then the stack's, then the fixed lists", () => {
    const kinds = preview({ additionalExcludePatterns: 'data/' }).leftOut.map((g) => g.origin.kind);
    expect([...new Set(kinds)]).toEqual(['yours', 'template', 'always']);
  });

  it('flags source files a stack pattern leaves out, with the override that brings them back', () => {
    expect(group(preview(), '**/lib/**')).toMatchObject({
      files: ['src/lib/notes.txt', 'src/lib/util.js'],
      codeFiles: ['src/lib/util.js'],
      override: '**/lib/**',
    });
  });

  it("flags none the instructor's own pattern leaves out as well", () => {
    const result = preview({ additionalExcludePatterns: 'src/lib/' });
    expect(group(result, '**/lib/**')).toMatchObject({
      files: ['src/lib/notes.txt', 'src/lib/util.js'],
      codeFiles: [],
      override: null,
    });
  });

  it('flags none in the fixed lists, or in a dependency folder', () => {
    const result = previewFiles({
      paths: ['package.json', 'app.js', 'vendor/pkg/index.js', 'styles.min.css'],
      languages: ['JavaScript'],
      lists,
      languageFiles,
      additionalExcludePatterns: 'vendor/',
    });
    expect(result.assessed.map((f) => f.path)).toEqual(['app.js', 'package.json']);
    expect(result.leftOut.flatMap((g) => g.codeFiles)).toEqual([]);
  });

  it('marks a file an override brought back with the pattern it beat', () => {
    const result = preview({ excludePatternOverrides: 'README.md' });
    expect(result.assessed.find((f) => f.path === 'README.md').pattern).toBe('**/*.md');
    expect(result.assessed.find((f) => f.path === 'src/app.js').pattern).toBeNull();
  });

  it('uses the fallback list when nothing is detected', () => {
    const result = previewFiles({
      paths: ['notes.txt', 'out/report.txt'],
      lists,
      languageFiles,
    });
    expect(result.usedFallback).toBe(true);
    expect(result.stack).toEqual([]);
    expect(result.leftOut.map((g) => g.origin.kind)).toEqual(['fallback']);
  });

  it('says what each additional exclude pattern does', () => {
    const { excludeChecks } = preview({
      additionalExcludePatterns: 'data/, tests/fixtures/**, *.md, !src/**',
      excludePatternOverrides: 'README.md',
    });
    expect(excludeChecks).toEqual([
      // data/table.csv is left out as tabular data before this pattern is tried.
      {
        written: 'data/',
        problem: null,
        matched: 2,
        leftOut: 1,
        already: 1,
        overridden: 0,
        unopened: [],
      },
      {
        written: 'tests/fixtures/**',
        problem: null,
        matched: 0,
        leftOut: 0,
        already: 0,
        overridden: 0,
        unopened: [],
      },
      {
        written: '*.md',
        problem: null,
        matched: 1,
        leftOut: 0,
        already: 0,
        overridden: 1,
        unopened: [],
      },
      // Everything outside src/: four files of its own and the workflow file,
      // whose own pattern is tried last; the rest were left out before it.
      {
        written: '!src/**',
        problem: 'negated',
        matched: 10,
        leftOut: 5,
        already: 4,
        overridden: 1,
        unopened: [],
      },
    ]);
  });

  it('says what each override does', () => {
    const { overrideChecks } = preview({
      excludePatternOverrides: 'README.md, frontend/**, src/app.js, docs/**',
    });
    expect(overrideChecks).toEqual([
      {
        written: 'README.md',
        problem: null,
        matched: 1,
        broughtBack: 1,
        notLeftOut: 0,
        binary: 0,
        blocked: [],
        unopened: [],
      },
      {
        written: 'frontend/**',
        problem: null,
        matched: 2,
        broughtBack: 0,
        notLeftOut: 1,
        binary: 0,
        blocked: ['frontend/.env'],
        unopened: [],
      },
      {
        written: 'src/app.js',
        problem: null,
        matched: 1,
        broughtBack: 0,
        notLeftOut: 1,
        binary: 0,
        blocked: [],
        unopened: [],
      },
      {
        written: 'docs/**',
        problem: null,
        matched: 0,
        broughtBack: 0,
        notLeftOut: 0,
        binary: 0,
        blocked: [],
        unopened: [],
      },
    ]);
  });

  it('does not count a protected file another override names', () => {
    const { overrideChecks, assessed } = preview({
      excludePatternOverrides: 'frontend/**, frontend/.env',
    });
    expect(assessed.map((f) => f.path)).toContain('frontend/.env');
    expect(overrideChecks[0]).toMatchObject({ matched: 2, broughtBack: 0, blocked: [] });
    expect(overrideChecks[1]).toMatchObject({ matched: 1, broughtBack: 1, blocked: [] });
  });

  it('says which rule leaves an unopened dependency folder out, if any does', () => {
    const { unopened } = preview({ unopened: ['node_modules', 'api/vendor'] });
    expect(unopened).toEqual([
      { folder: 'node_modules', pattern: '**/node_modules/**', assessed: false },
      // Neither the Node nor the Python template names vendor/.
      { folder: 'api/vendor', pattern: null, assessed: true },
    ]);
  });

  it('counts an unopened folder a pattern covers, though none of its files are listed', () => {
    const result = preview({
      unopened: ['node_modules', 'api/vendor'],
      additionalExcludePatterns: 'api/vendor/',
      excludePatternOverrides: '**/node_modules/**',
    });
    expect(result.unopened).toEqual([
      { folder: 'node_modules', pattern: '**/node_modules/**', assessed: true },
      { folder: 'api/vendor', pattern: 'api/vendor/**', assessed: false },
    ]);
    expect(result.excludeChecks[0]).toMatchObject({ matched: 0, unopened: ['api/vendor'] });
    expect(result.overrideChecks[0]).toMatchObject({ matched: 0, unopened: ['node_modules'] });
  });

  it('leaves out a binary file no pattern matched, as a run does', () => {
    const paths = [...Object.keys(files), 'src/logo.png', 'docs/brief.docx', 'docs/shot.png'];
    const result = preview({ paths, binary: ['src/logo.png', 'docs/brief.docx', 'docs/shot.png'] });
    const assessed = result.assessed.map((f) => f.path);
    expect(assessed).toContain('src/app.js');
    expect(assessed).not.toContain('src/logo.png');
    expect(result.binary).toEqual(['docs/brief.docx', 'docs/shot.png', 'src/logo.png']);
    expect(result.leftOutCount).toBe(paths.length - assessed.length);
  });

  it('lists a binary file a pattern leaves out under that pattern', () => {
    const result = preview({
      paths: [...Object.keys(files), 'src/logo.png'],
      binary: ['src/logo.png'],
      additionalExcludePatterns: '**/*.png',
    });
    expect(result.binary).toEqual([]);
    expect(group(result, '**/*.png').files).toEqual(['src/logo.png']);
  });

  it('says an override cannot bring a binary file back', () => {
    const result = preview({
      paths: [...Object.keys(files), 'src/logo.png'],
      binary: ['src/logo.png'],
      excludePatternOverrides: '**/*.png',
    });
    expect(result.binary).toEqual(['src/logo.png']);
    expect(result.overrideChecks[0]).toMatchObject({
      matched: 1,
      broughtBack: 0,
      notLeftOut: 0,
      binary: 1,
    });
  });

  it('counts the project folders above the cap as found, not scanned', () => {
    const paths = Array.from(
      { length: MAX_PROJECT_FOLDERS + 5 },
      (_, i) => `p${String(i).padStart(3, '0')}/package.json`,
    );
    const result = previewFiles({ paths, lists, languageFiles });
    // The repository root counts as a project folder too.
    expect(result.foldersFound).toBe(MAX_PROJECT_FOLDERS + 6);
    expect(result.foldersScanned).toBe(MAX_PROJECT_FOLDERS);
  });
});

// Stand-ins for the browser's folder picker and file input.
// Only the parts of a File the readers use.
const blob = (text) => ({
  text: async () => text,
  slice: (from, to) => blob(text.slice(from, to)),
});
const fileHandle = (name, text = '') => ({
  kind: 'file',
  name,
  getFile: async () => blob(text),
});
const folderHandle = (name, entries) => ({
  kind: 'directory',
  name,
  async *values() {
    yield* entries;
  },
});
const inputFile = (webkitRelativePath, text = '') => ({
  name: webkitRelativePath.split('/').pop(),
  webkitRelativePath,
  ...blob(text),
});

describe('readDirectoryHandle', () => {
  const tree = folderHandle('lab-3', [
    folderHandle('src', [fileHandle('app.js'), folderHandle('node_modules', [fileHandle('x.js')])]),
    folderHandle('.git', [fileHandle('HEAD')]),
    folderHandle('node_modules', [fileHandle('index.js')]),
    fileHandle('package.json', '{"dependencies":{"next":"1"}}'),
    fileHandle('README.md'),
  ]);

  it('lists the files, passing over .git and the dependency folders', async () => {
    const source = await readDirectoryHandle(tree);
    expect(source).toMatchObject({
      label: 'lab-3',
      paths: ['README.md', 'package.json', 'src/app.js'],
      unopened: ['node_modules', 'src/node_modules'],
      truncated: false,
    });
    expect(await readManifests(source)).toEqual({
      'package.json': '{"dependencies":{"next":"1"}}',
    });
  });

  it('stops at the file limit, keeping the shallowest files', async () => {
    const many = (prefix, n) => Array.from({ length: n }, (_, i) => fileHandle(`${prefix}${i}.js`));
    const source = await readDirectoryHandle(
      folderHandle('big', [folderHandle('deep', many('d', 10)), ...many('top', PREVIEW_MAX_FILES)]),
    );
    expect(source.truncated).toBe(true);
    expect(source.paths).toHaveLength(PREVIEW_MAX_FILES);
    expect(source.paths.every((path) => path.startsWith('top'))).toBe(true);
  });
});

describe('readFileInput', () => {
  it("lists the same files from a file input's list", async () => {
    const source = readFileInput([
      inputFile('lab-3/package.json', '{}'),
      inputFile('lab-3/src/app.js'),
      inputFile('lab-3/.git/HEAD'),
      inputFile('lab-3/node_modules/react/index.js'),
      inputFile('lab-3/src/Vendor/lib.php'),
    ]);
    expect(source).toMatchObject({
      label: 'lab-3',
      paths: ['package.json', 'src/app.js'],
      unopened: ['node_modules', 'src/Vendor'],
      truncated: false,
    });
    expect(await readManifests(source)).toEqual({ 'package.json': '{}' });
  });

  it('leaves out a manifest that cannot be read', async () => {
    const unreadable = {
      ...inputFile('lab-3/package.json'),
      text: async () => {
        throw new Error('gone');
      },
    };
    expect(await readManifests(readFileInput([unreadable]))).toEqual({});
  });
});

describe('readBinaryFiles', () => {
  const PNG = '\x89PNG\r\n\x1a\n\0\0\0\rIHDR';

  it('finds the binary files of a picked folder', async () => {
    const source = await readDirectoryHandle(
      folderHandle('lab-3', [
        folderHandle('img', [fileHandle('logo.png', PNG)]),
        fileHandle('app.js', 'const a = 1;'),
        fileHandle('empty.txt'),
      ]),
    );
    expect(await readBinaryFiles(source)).toEqual(['img/logo.png']);
  });

  it("finds them among a file input's files", async () => {
    const source = readFileInput([
      inputFile('lab-3/app.js', 'const a = 1;'),
      inputFile('lab-3/img/logo.png', PNG),
    ]);
    expect(await readBinaryFiles(source)).toEqual(['img/logo.png']);
  });

  it('reads only the start of each file', async () => {
    const late = `${'a'.repeat(PREVIEW_BINARY_CHECK_BYTES)}\0`;
    const source = readFileInput([
      inputFile('lab-3/late.txt', late),
      inputFile('lab-3/early.bin', `\0${late}`),
    ]);
    expect(await readBinaryFiles(source)).toEqual(['early.bin']);
  });

  it('checks every file of a folder larger than one batch', async () => {
    const source = readFileInput(
      Array.from({ length: 100 }, (_, i) => inputFile(`lab-3/f${i}.dat`, i % 2 ? PNG : 'text')),
    );
    expect(await readBinaryFiles(source)).toHaveLength(50);
  });

  it('takes a file that cannot be read to be text', async () => {
    const unreadable = {
      ...inputFile('lab-3/logo.png'),
      slice: () => ({
        text: async () => {
          throw new Error('gone');
        },
      }),
    };
    expect(await readBinaryFiles(readFileInput([unreadable]))).toEqual([]);
  });
});
