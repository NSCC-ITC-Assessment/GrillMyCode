import { describe, expect, it } from 'vitest';
import { OPENROUTER_ORIGIN } from '../src/shared/constants.js';
import {
  CANCELLED,
  FolderRecord,
  REQUESTS,
  isRequest,
  joinPath,
  wizardPage,
} from '../src/shared/wizard.js';

describe('isRequest', () => {
  it('takes each request the page makes, with a number to answer it by', () => {
    for (const type of REQUESTS) expect(isRequest({ type, id: 1 })).toBe(true);
  });

  it('takes "ready" without one: nothing answers it', () => {
    expect(isRequest({ type: 'ready' })).toBe(true);
  });

  it.each([
    ['nothing', undefined],
    ['text', 'list'],
    ['a request it does not know', { type: 'delete', id: 1 }],
    ['a request with no number', { type: 'list' }],
    ['a request numbered with text', { type: 'list', id: '1' }],
    ['a request numbered with a fraction', { type: 'list', id: 1.5 }],
  ])('refuses %s', (_what, message) => {
    expect(isRequest(message)).toBe(false);
  });
});

describe('joinPath', () => {
  it('names a file in the folder itself by its name alone', () => {
    expect(joinPath('', 'app.js')).toBe('app.js');
  });

  it('puts a folder before the name', () => {
    expect(joinPath('src/lib', 'app.js')).toBe('src/lib/app.js');
  });
});

describe('FolderRecord', () => {
  const file = (name) => ({ name, isFile: true, isFolder: false, isLink: false });
  const folder = (name) => ({ name, isFile: false, isFolder: true, isLink: false });

  it('knows the folder itself before anything is listed, and nothing else', () => {
    const record = new FolderRecord();
    expect(record.hasFolder('')).toBe(true);
    expect(record.hasFolder('src')).toBe(false);
    expect(record.hasFile('app.js')).toBe(false);
  });

  it('tells the page what a folder holds, as a folder picker would', () => {
    const record = new FolderRecord();
    expect(record.add('', [file('app.js'), folder('src')])).toEqual([
      { name: 'app.js', kind: 'file' },
      { name: 'src', kind: 'directory' },
    ]);
  });

  it('knows what a listing named, under the folder it was in', () => {
    const record = new FolderRecord();
    record.add('', [file('app.js'), folder('src')]);
    record.add('src', [file('cart.js'), folder('lib')]);
    expect(record.hasFile('app.js')).toBe(true);
    expect(record.hasFile('src/cart.js')).toBe(true);
    expect(record.hasFolder('src')).toBe(true);
    expect(record.hasFolder('src/lib')).toBe(true);
    // The same names, somewhere they were never listed.
    expect(record.hasFile('cart.js')).toBe(false);
    expect(record.hasFolder('lib')).toBe(false);
  });

  it('keeps files and folders apart', () => {
    const record = new FolderRecord();
    record.add('', [file('app.js'), folder('src')]);
    expect(record.hasFolder('app.js')).toBe(false);
    expect(record.hasFile('src')).toBe(false);
  });

  // No path the page sends is parsed, so one that climbs out matches nothing.
  it.each(['..', '../secret', 'src/../../secret', '/etc/passwd', 'src/', './app.js'])(
    'does not know %s',
    (path) => {
      const record = new FolderRecord();
      record.add('', [file('app.js'), folder('src')]);
      expect(record.hasFile(path)).toBe(false);
      expect(record.hasFolder(path)).toBe(false);
    },
  );

  // Git keeps a link as a file. What it points to may be outside the folder.
  it('lists a link as a file, and lets it be neither read nor opened', () => {
    const record = new FolderRecord();
    const listed = record.add('', [
      { name: 'to-file', isFile: true, isFolder: false, isLink: true },
      { name: 'to-folder', isFile: false, isFolder: true, isLink: true },
      { name: 'broken', isFile: false, isFolder: false, isLink: true },
    ]);
    expect(listed.map((entry) => entry.kind)).toEqual(['file', 'file', 'file']);
    for (const name of ['to-file', 'to-folder', 'broken']) {
      expect(record.hasFile(name)).toBe(false);
      expect(record.hasFolder(name)).toBe(false);
    }
  });

  it('leaves out what is neither a file, a folder nor a link', () => {
    const record = new FolderRecord();
    expect(
      record.add('', [{ name: 'socket', isFile: false, isFolder: false, isLink: false }]),
    ).toEqual([]);
  });
});

describe('wizardPage', () => {
  const page = (overrides = {}) =>
    wizardPage({
      nonce: 'abc123',
      source: 'https://file.vscode-cdn.net',
      scriptUri: 'https://file.vscode-cdn.net/dist/wizard.js',
      styleUri: 'https://file.vscode-cdn.net/dist/wizard.css',
      actionRef: 'v0',
      docsBase: 'https://grillmycode.org/docs',
      ...overrides,
    });

  const policy = (html) =>
    Object.fromEntries(
      html
        .match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)[1]
        .split('; ')
        .map((rule) => [rule.split(' ')[0], rule.split(' ').slice(1)]),
    );

  it('allows nothing it does not name', () => {
    expect(policy(page())['default-src']).toEqual(["'none'"]);
  });

  // A script the page did not come with, or one written into it, does not run.
  it('runs the one script, by its nonce', () => {
    expect(policy(page())['script-src']).toEqual(["'nonce-abc123'"]);
    expect(page()).toContain(
      '<script nonce="abc123" src="https://file.vscode-cdn.net/dist/wizard.js"></script>',
    );
    expect(page().match(/<script/g)).toHaveLength(1);
  });

  it('loads styles from the extension alone, and none written into the page', () => {
    expect(policy(page())['style-src']).toEqual(['https://file.vscode-cdn.net']);
    expect(page()).not.toContain('<style');
  });

  // The list of models is the one thing the Wizard fetches.
  it('reaches OpenRouter and nowhere else', () => {
    expect(policy(page())['connect-src']).toEqual([OPENROUTER_ORIGIN]);
  });

  it('shows only images that are part of the bundle', () => {
    expect(policy(page())['img-src']).toEqual(['data:']);
  });

  it('names no rule beyond those', () => {
    expect(Object.keys(policy(page())).sort()).toEqual([
      'connect-src',
      'default-src',
      'img-src',
      'script-src',
      'style-src',
    ]);
  });

  it('gives the Wizard its action version and where the docs are', () => {
    expect(page()).toContain('data-action-ref="v0"');
    expect(page()).toContain('data-docs-base="https://grillmycode.org/docs"');
  });

  it('writes a value into an attribute as text', () => {
    const html = page({ docsBase: '"><script>alert(1)</script>' });
    expect(html).toContain('data-docs-base="&quot;>&lt;script>alert(1)&lt;/script>"');
    expect(html.match(/<script/g)).toHaveLength(1);
  });
});

describe('a cancelled prompt', () => {
  // The Wizard's file preview stays quiet about an error of this name, as it
  // does when the browser's folder picker is closed (FilePreview.js).
  it('has the name the browser gives a closed folder picker', () => {
    expect(CANCELLED).toBe('AbortError');
  });
});
