import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readAssignmentContextFiles } from '../src/files.js';

vi.mock('@actions/core', () => ({
  warning: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));

let workspace;
const originalWorkspace = process.env.GITHUB_WORKSPACE;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'gmc-context-'));
  process.env.GITHUB_WORKSPACE = workspace;
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
  if (originalWorkspace === undefined) delete process.env.GITHUB_WORKSPACE;
  else process.env.GITHUB_WORKSPACE = originalWorkspace;
});

const write = (rel, content) => {
  const full = join(workspace, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content, 'utf-8');
};

describe('readAssignmentContextFiles return shape', () => {
  // Every exit must destructure safely. A bare '' yields undefined for both
  // names, which took the whole job summary down on every successful run.
  it('returns the object shape when no globs are configured', async () => {
    expect(await readAssignmentContextFiles([], 10_000)).toEqual({
      content: '',
      matchedFiles: [],
    });
    expect(await readAssignmentContextFiles(undefined, 10_000)).toEqual({
      content: '',
      matchedFiles: [],
    });
  });

  it('returns the object shape when the workspace cannot be read', async () => {
    process.env.GITHUB_WORKSPACE = join(workspace, 'does-not-exist');
    expect(await readAssignmentContextFiles(['**/*.md'], 10_000)).toEqual({
      content: '',
      matchedFiles: [],
    });
  });

  it('returns the object shape when no file matches', async () => {
    write('README.md', 'hello');
    expect(await readAssignmentContextFiles(['**/*.pdf'], 10_000)).toEqual({
      content: '',
      matchedFiles: [],
    });
  });

  it('survives the destructure the caller performs on every exit', async () => {
    for (const globs of [[], undefined, ['**/*.nothing']]) {
      const { content, matchedFiles } = await readAssignmentContextFiles(globs, 10_000);
      expect(content).toBe('');
      expect(() => matchedFiles.length).not.toThrow();
      expect(matchedFiles).toEqual([]);
    }
  });
});

describe('readAssignmentContextFiles matchedFiles', () => {
  it('names the files it read', async () => {
    write('brief.md', 'the brief');
    write('docs/rubric.md', 'the rubric');
    const { content, matchedFiles } = await readAssignmentContextFiles(['**/*.md'], 10_000);
    expect(matchedFiles.sort()).toEqual(['brief.md', 'docs/rubric.md']);
    expect(content).toContain('the brief');
    expect(content).toContain('the rubric');
  });

  it('omits files the maxChars cap never sent', async () => {
    write('a.md', 'A'.repeat(400));
    write('b.md', 'B'.repeat(400));
    write('c.md', 'C'.repeat(400));

    const { content, matchedFiles } = await readAssignmentContextFiles(['**/*.md'], 500);

    // Whatever fits is reported; whatever the break skipped is not.
    expect(matchedFiles.length).toBeLessThan(3);
    for (const named of matchedFiles) {
      expect(content).toContain(named);
    }
    expect(content).toContain('[assignment context truncated due to size]');
  });

  it('reports nothing when the cap leaves no room at all', async () => {
    write('a.md', 'A'.repeat(400));
    const { matchedFiles } = await readAssignmentContextFiles(['**/*.md'], 1);
    expect(matchedFiles).toEqual([]);
  });
});
