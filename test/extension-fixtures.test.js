import { readFileSync, readdirSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURES_DIR, buildFixtures } from '../scripts/build-extension-fixtures.js';
import { ISSUE_LABEL, ISSUE_TITLE } from '../extensions/vscode/src/shared/constants.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), warning: vi.fn() }));

/** Every file under a directory, as `{ 'case/file': content }`. */
function readTree(dir) {
  return Object.fromEntries(
    readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name))
      .map((path) => [relative(dir, path).split(sep).join('/'), readFileSync(path, 'utf-8')]),
  );
}

describe('the extension fixtures', () => {
  // The fixtures are what every editor extension tests its report reader
  // against, so they must be what the action posts today. A change to the
  // report or the issue shows up here first.
  it('match src/ — see extensions/fixtures/README.md if not', async () => {
    expect(await buildFixtures()).toEqual(readTree(FIXTURES_DIR));
  });

  it('carry the label and title the extension looks for', async () => {
    const issues = Object.entries(await buildFixtures())
      .filter(([path]) => path.endsWith('/issue.json'))
      .map(([, content]) => JSON.parse(content));
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(issue.labels).toContain(ISSUE_LABEL);
      expect(issue.title.startsWith(ISSUE_TITLE)).toBe(true);
    }
  });
});
