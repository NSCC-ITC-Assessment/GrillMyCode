import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Buffer } from 'node:buffer';
import * as core from '@actions/core';
import { detectExcludePatterns } from '../src/stack-detection.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), warning: vi.fn() }));

/** GitHub contents-API payload for raw bytes, base64 with GitHub's line wrapping. */
function contentsPayload(bytes) {
  const base64 = bytes.toString('base64').replace(/(.{60})/g, '$1\n');
  return { content: base64, encoding: 'base64' };
}

/** Stubs the GitHub API for a repository whose root holds only package.json. */
function stubRepoWithPackageJson(bytes) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const body = url.endsWith('/languages')
        ? { JavaScript: 1000 }
        : url.endsWith('/contents/')
          ? [{ name: 'package.json' }]
          : contentsPayload(bytes);
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

const manifest = {
  name: 'student-app',
  author: 'José Müller 🚀',
  dependencies: { next: '^15.0.0', react: '^19.0.0' },
};

describe('detectExcludePatterns manifest decoding', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('reads the deps of a package.json containing non-ASCII text', async () => {
    stubRepoWithPackageJson(Buffer.from(JSON.stringify(manifest), 'utf-8'));
    await detectExcludePatterns('token', 'org', 'repo');
    expect(core.info).toHaveBeenCalledWith('Scanned package.json — 2 deps');
  });

  it('reads the deps of a package.json that starts with a byte-order mark', async () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    stubRepoWithPackageJson(Buffer.concat([bom, Buffer.from(JSON.stringify(manifest), 'utf-8')]));
    await detectExcludePatterns('token', 'org', 'repo');
    expect(core.info).toHaveBeenCalledWith('Scanned package.json — 2 deps');
  });
});
