import { readFileSync, readdirSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURES_DIR, buildFixtures } from '../scripts/build-extension-fixtures.js';
import { INSTRUCTOR_REPO_SUFFIX, SUBMISSION_TAG_GROUP_FALLBACK } from '../src/constants.js';
import { tagGroupSlug } from '../src/context.js';
import { ASSESSMENT_DATA_DIR } from '../src/delivery/instructor-repo.js';
import { matchSubmissionIdentity } from '../src/submission-identity.js';
import * as extension from '../extensions/vscode/src/shared/constants.js';
import * as extensionIdentity from '../extensions/vscode/src/shared/identity.js';

const { ISSUE_LABEL, ISSUE_TITLE } = extension;

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

// The extension finds a student's answer key by the rules the action files it
// under. It carries its own copy of them, since nothing under extensions/
// imports the action's code, and these fail when the two stop agreeing.
describe("the extension's copy of where the answer key is filed", () => {
  it('names the instructor repository and the file as the action does', () => {
    expect(extension.INSTRUCTOR_REPO_SUFFIX).toBe(INSTRUCTOR_REPO_SUFFIX);
    expect(extension.ANSWER_KEY_FILE).toBe(`${ASSESSMENT_DATA_DIR}/questions.json`);
    expect(extension.TAG_GROUP_FALLBACK).toBe(SUBMISSION_TAG_GROUP_FALLBACK);
  });

  it.each([
    ['cs-principles-lab-3-jsmith', ['jsmith']],
    ['cs-principles-lab-3-JSmith', ['jsmith', 'instructor']],
    ['cs-principles-lab-3-group-2', ['jsmith', 'adoe']],
    ['cs-principles-lab-3-Group-12', []],
    ['lab-3-a-jsmith', ['jsmith', 'a-jsmith']],
    ['scratch', ['jsmith']],
    ['jsmith', ['jsmith']],
  ])('reads the identity of %s as the action does', (repo, logins) => {
    expect(extensionIdentity.matchSubmissionIdentity(repo, logins)).toEqual(
      matchSubmissionIdentity(repo, logins),
    );
  });

  it.each(['submit/*', 'milestone-1/v*', 'v[0-9]*', '*', '', 'final_submission'])(
    'names the folder of the tag pattern "%s" as the action does',
    (pattern) => {
      expect(extensionIdentity.tagGroupSlug(pattern)).toBe(tagGroupSlug(pattern));
    },
  );
});
