import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { filterFiles } from '../src/files.js';
import {
  EDITOR_CONFIG_EXCLUDE_PATTERNS,
  FALLBACK_EXCLUDE_PATTERNS,
  NON_CODE_ASSET_EXCLUDE_PATTERNS,
} from '../src/constants.js';
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
