import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as core from '@actions/core';
import { listTreeFiles, readFileAt } from '../src/git.js';
import { MAX_PROJECT_FOLDERS } from '../src/constants.js';
import { filterFiles, findProjectFolders, underFolder } from '../src/file-selection.js';
import { detectExcludePatterns } from '../src/stack-detection.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), warning: vi.fn(), debug: vi.fn() }));
vi.mock('../src/git.js', () => ({ listTreeFiles: vi.fn(), readFileAt: vi.fn() }));

/** Stubs the GitHub Languages API. */
function stubLanguages(languages) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(languages), { status: 200 })),
  );
}

/** Stubs the commit's tree: `files` maps each path to its content. */
function stubTree(files) {
  listTreeFiles.mockReturnValue(Object.keys(files));
  readFileAt.mockImplementation((sha, path) => files[path] ?? null);
}

const detectRules = () => detectExcludePatterns('token', 'org', 'repo', 'abc123');
const detect = async () => (await detectRules()).patterns;

const manifest = {
  name: 'student-app',
  author: 'José Müller 🚀',
  dependencies: { next: '^15.0.0', react: '^19.0.0' },
};

const laravelComposer = JSON.stringify({ require: { 'laravel/framework': '^12.0' } });

/** A tree with more project folders than are scanned: the root, top/ and 120 labs. */
function manyProjects() {
  const paths = Array.from({ length: MAX_PROJECT_FOLDERS + 20 }, (_, i) => {
    return `labs/lab${String(i).padStart(3, '0')}/package.json`;
  });
  paths.push('top/package.json');
  return paths;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('detectExcludePatterns manifest decoding', () => {
  it('reads the deps of a package.json containing non-ASCII text', async () => {
    stubLanguages({ JavaScript: 1000 });
    stubTree({ 'package.json': JSON.stringify(manifest) });
    await detect();
    expect(core.info).toHaveBeenCalledWith('Scanned package.json — 2 deps');
  });

  it('reads the deps of a package.json that starts with a byte-order mark', async () => {
    stubLanguages({ JavaScript: 1000 });
    stubTree({ 'package.json': '﻿' + JSON.stringify(manifest) });
    await detect();
    expect(core.info).toHaveBeenCalledWith('Scanned package.json — 2 deps');
  });

  it('reads the manifest at the commit being assessed', async () => {
    stubLanguages({ JavaScript: 1000 });
    stubTree({ 'package.json': JSON.stringify(manifest) });
    await detect();
    expect(listTreeFiles).toHaveBeenCalledWith('abc123');
    expect(readFileAt).toHaveBeenCalledWith('abc123', 'package.json');
  });
});

describe('detectExcludePatterns always-excluded editor and asset patterns', () => {
  it('includes them when a stack is detected, with no editor directory at the root', async () => {
    stubLanguages({ Python: 1000 });
    stubTree({ 'main.py': '' });
    const patterns = await detect();
    expect(patterns).toEqual(
      expect.arrayContaining(['**/.vscode/**', '**/.idea/**', '**/*.iml', '**/*.drawio']),
    );
  });
});

describe('detectExcludePatterns fallback', () => {
  it('keeps the always-excluded patterns when nothing is detected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500 })),
    );
    stubTree({});
    const patterns = await detect();
    expect(patterns).toEqual(
      expect.arrayContaining([
        '**/node_modules/**',
        '**/.gitattributes',
        '**/.gitmodules',
        '**/.mailmap',
        '**/.git-blame-ignore-revs',
        '**/.gradio/**',
        '**/.dvc/cache/**',
      ]),
    );
    expect(new Set(patterns).size).toBe(patterns.length);
  });

  it('says where each pattern comes from', async () => {
    stubLanguages({ Python: 1000 });
    stubTree({ 'web/package.json': '{}' });
    const { patterns, origins } = await detectRules();
    expect([...origins.keys()]).toEqual(patterns);
    expect(origins.get('**/__pycache__/**')).toEqual({
      kind: 'template',
      template: 'Python',
      folder: '',
    });
    expect([...origins.values()]).toContainEqual({
      kind: 'template',
      template: 'Node',
      folder: 'web',
    });
  });

  it('still detects languages when the tree cannot be listed', async () => {
    stubLanguages({ Python: 1000 });
    listTreeFiles.mockImplementation(() => {
      throw new Error('git ls-tree failed');
    });
    const patterns = await detect();
    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('git ls-tree failed'));
    expect(patterns).toContain('**/__pycache__/**');
  });
});

describe('detectExcludePatterns project folders', () => {
  it('applies a project at the root exactly as before', async () => {
    stubLanguages({ PHP: 1000 });
    stubTree({ artisan: '', 'composer.json': laravelComposer, 'app/User.php': '' });
    const patterns = await detect();
    expect(patterns).toContain('vendor/**');
    expect(patterns).toContain('bootstrap/compiled.php');
  });

  it('applies a nested Laravel project’s anchored patterns inside its folder', async () => {
    stubLanguages({ PHP: 1000, Blade: 200, JavaScript: 100 });
    stubTree({
      'README.md': '',
      'myapp/artisan': '',
      'myapp/composer.json': laravelComposer,
      'myapp/app/Http/Controllers/HomeController.php': '',
      'myapp/vendor/laravel/framework/composer.json': '{}',
      'myapp/vendor/laravel/framework/src/Foundation/Application.php': '',
    });
    const patterns = await detect();

    expect(patterns).toContain('myapp/vendor/**');
    expect(patterns).toContain('myapp/bootstrap/compiled.php');
    expect(patterns).not.toContain('vendor/**');
    expect(core.info).toHaveBeenCalledWith('Scanned myapp/composer.json — 1 deps');
    expect(core.info).toHaveBeenCalledWith(
      expect.stringMatching(/^Using gitignore templates in myapp\/: .*Laravel/),
    );

    const changed = [
      'myapp/app/Http/Controllers/HomeController.php',
      'myapp/vendor/laravel/framework/src/Foundation/Application.php',
    ];
    expect(filterFiles(changed, patterns)).toEqual([
      'myapp/app/Http/Controllers/HomeController.php',
    ]);
  });

  it('gives each project in a monorepo its own patterns', async () => {
    stubLanguages({ TypeScript: 1000, PHP: 800 });
    stubTree({
      'frontend/package.json': JSON.stringify({ dependencies: { next: '^15.0.0' } }),
      'frontend/src/app/page.tsx': '',
      'backend/artisan': '',
      'backend/composer.json': laravelComposer,
      'backend/routes/web.php': '',
    });
    const patterns = await detect();

    expect(patterns).toContain('frontend/.next/**');
    expect(patterns).toContain('backend/vendor/**');
    expect(patterns).not.toContain('frontend/vendor/**');
    expect(patterns).not.toContain('backend/.next/**');

    const changed = [
      'frontend/src/app/page.tsx',
      'frontend/.next/server/app/page.js',
      'backend/routes/web.php',
      'backend/vendor/autoload.php',
    ];
    expect(filterFiles(changed, patterns)).toEqual([
      'frontend/src/app/page.tsx',
      'backend/routes/web.php',
    ]);
  });

  it('applies hand-written framework patterns inside the folder', async () => {
    stubLanguages({ JavaScript: 1000 });
    stubTree({ 'web/svelte.config.js': '', 'web/src/routes/+page.svelte': '' });
    expect(await detect()).toContain('web/.svelte-kit/**');
  });

  it('keeps language-detected templates at the repository root', async () => {
    stubLanguages({ Ruby: 1000 });
    stubTree({ 'lab1/package.json': '{}', 'lab1/index.js': '' });
    const patterns = await detect();
    expect(patterns).toContain('vendor/bundle');
    expect(patterns).not.toContain('lab1/vendor/bundle');
  });

  it('does not read manifests inside dependency folders', async () => {
    stubLanguages({ JavaScript: 1000 });
    stubTree({
      'app/package.json': '{}',
      'app/node_modules/left-pad/package.json': '{}',
      'app/vendor/acme/lib/composer.json': '{}',
    });
    await detect();
    expect(readFileAt).toHaveBeenCalledWith('abc123', 'app/package.json');
    expect(readFileAt).not.toHaveBeenCalledWith('abc123', 'app/node_modules/left-pad/package.json');
    expect(readFileAt).not.toHaveBeenCalledWith('abc123', 'app/vendor/acme/lib/composer.json');
  });

  it('escapes glob characters in a folder name', async () => {
    stubLanguages({ PHP: 1000 });
    stubTree({ 'lab [1]/artisan': '', 'lab [1]/routes/web.php': '' });
    const patterns = await detect();
    expect(patterns).toContain('lab \\[1\\]/vendor/**');
    expect(filterFiles(['lab [1]/vendor/a.php', 'lab [1]/routes/web.php'], patterns)).toEqual([
      'lab [1]/routes/web.php',
    ]);
  });
});

describe('findProjectFolders', () => {
  it('records the markers found directly in each folder, root first', () => {
    const { folders, found } = findProjectFolders([
      'b/package.json',
      'a/sub/pom.xml',
      'a/package.json',
      'App.xcodeproj/project.pbxproj',
      'src/main.c',
    ]);
    expect(found).toBe(4);
    expect([...folders.keys()]).toEqual(['', 'a', 'b', 'a/sub']);
    expect(folders.get('')).toEqual(new Set(['App.xcodeproj']));
    expect(folders.get('a/sub')).toEqual(new Set(['pom.xml']));
  });

  it('records a marker folder such as ProjectSettings in its parent', () => {
    const { folders } = findProjectFolders(['game/ProjectSettings/ProjectVersion.txt']);
    expect(folders.get('game')).toEqual(new Set(['ProjectSettings']));
  });

  it('ignores names that only look like map keys', () => {
    expect([...findProjectFolders(['x/constructor', 'y/toString']).folders.keys()]).toEqual(['']);
  });

  it(`keeps the ${MAX_PROJECT_FOLDERS} shallowest folders and counts them all`, () => {
    const { folders, found } = findProjectFolders(manyProjects());
    expect(folders.size).toBe(MAX_PROJECT_FOLDERS);
    expect(found).toBe(MAX_PROJECT_FOLDERS + 22);
    expect([...folders.keys()].slice(0, 2)).toEqual(['', 'top']);
  });
});

describe('detectExcludePatterns project folder cap', () => {
  it('warns when a repository holds more project folders than it scans', async () => {
    stubLanguages({});
    stubTree(Object.fromEntries(manyProjects().map((path) => [path, '{}'])));
    await detect();
    expect(core.warning).toHaveBeenCalledWith(
      `Found ${MAX_PROJECT_FOLDERS + 22} project folders; scanning the ${MAX_PROJECT_FOLDERS} ` +
        `shallowest. Deeper folders get only the patterns that apply at any depth — add any ` +
        `build output they commit with additional_exclude_patterns.`,
    );
  });

  it('does not warn below the cap', async () => {
    stubLanguages({});
    stubTree({ 'a/package.json': '{}', 'b/package.json': '{}' });
    await detect();
    expect(core.warning).not.toHaveBeenCalled();
  });
});

describe('underFolder', () => {
  it('leaves the root folder and any-depth patterns unchanged', () => {
    expect(underFolder('', 'vendor/**')).toBe('vendor/**');
    expect(underFolder('app', '**/node_modules/**')).toBe('**/node_modules/**');
  });

  it('prefixes root-anchored patterns with the folder', () => {
    expect(underFolder('apps/web', '.next/**')).toBe('apps/web/.next/**');
    expect(underFolder('x', '*/config/development')).toBe('x/*/config/development');
  });
});
