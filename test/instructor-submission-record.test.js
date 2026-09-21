import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as core from '@actions/core';
import { Buffer } from 'node:buffer';
import { deliverToInstructorRepo, readSubmissionHistory } from '../src/delivery/instructor-repo.js';
import { TRIGGER_TAG_PUSH, buildSubmissionEntry } from '../src/submission-history.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), warning: vi.fn(), error: vi.fn() }));

const REPO = 'assignment-grillmycode-instructor';
const FOLDER = 'jsmith/phase1';

/**
 * An instructor repository held in memory: getContent serves what has been
 * written, so a second delivery sees the first one's files. `failPath` makes
 * writes to that path throw a non-retryable error.
 */
function fakeRepo(initial = {}, { failPath } = {}) {
  const files = new Map(Object.entries(initial));
  const writes = [];
  return {
    files,
    writes,
    rest: {
      repos: {
        get: vi.fn(async () => ({ data: { default_branch: 'main' } })),
        getContent: vi.fn(async ({ path }) => {
          if (!files.has(path)) {
            const err = new Error('Not Found');
            err.status = 404;
            throw err;
          }
          return {
            data: {
              sha: `sha-${path}`,
              encoding: 'base64',
              content: Buffer.from(files.get(path), 'utf-8').toString('base64'),
            },
          };
        }),
        createOrUpdateFileContents: vi.fn(async ({ path, content }) => {
          if (path === failPath) {
            const err = new Error('Validation failed');
            err.status = 422;
            throw err;
          }
          files.set(path, Buffer.from(content, 'base64').toString('utf-8'));
          writes.push(path);
          return { data: {} };
        }),
      },
    },
  };
}

/** One tag-run delivery for jsmith/phase1, reading the record first as main.js does. */
async function submit(octokit, { headSha, questions }) {
  const history = await readSubmissionHistory({
    octokit,
    owner: 'org',
    instructorRepoName: REPO,
    folder: FOLDER,
  });
  const entry = buildSubmissionEntry({
    entries: history.entries,
    trigger: TRIGGER_TAG_PUSH,
    actor: 'jsmith',
    studentLogin: 'jsmith',
    tagName: 'phase1',
    headSha,
  });
  await deliverToInstructorRepo({
    octokit,
    owner: 'org',
    instructorRepoName: REPO,
    studentLogin: 'jsmith',
    tagGroup: 'phase1',
    content: questions,
    headSha,
    submission: { history, entry },
  });
  return entry;
}

/** Writes under the tag folder, in order, excluding the action-managed repo files. */
function folderWrites(octokit) {
  return octokit.writes.filter((p) => p.startsWith(`${FOLDER}/`));
}

beforeEach(() => vi.clearAllMocks());

describe('submission record in the instructor repository', () => {
  it('logs a first submission without archiving anything', async () => {
    const octokit = fakeRepo();
    await submit(octokit, { headSha: 'a'.repeat(40), questions: 'first set' });

    expect(folderWrites(octokit)).toEqual([`${FOLDER}/submissions.md`, `${FOLDER}/questions.md`]);
    expect(octokit.files.get(`${FOLDER}/submissions.md`)).toContain('| 1 |');
  });

  it('archives the replaced set and appends a row on resubmission', async () => {
    const octokit = fakeRepo();
    await submit(octokit, { headSha: 'a'.repeat(40), questions: 'first set' });
    octokit.writes.length = 0;

    const second = await submit(octokit, { headSha: 'b'.repeat(40), questions: 'second set' });

    expect(second.number).toBe(2);
    // Archive before log before questions.md, so a log row never names an
    // archive that failed to land and the quiz workflow fires last.
    expect(folderWrites(octokit)).toEqual([
      `${FOLDER}/history/1-questions.md`,
      `${FOLDER}/submissions.md`,
      `${FOLDER}/questions.md`,
    ]);
    expect(octokit.files.get(`${FOLDER}/history/1-questions.md`)).toBe('first set');
    expect(octokit.files.get(`${FOLDER}/questions.md`)).toBe('second set');

    const history = await readSubmissionHistory({
      octokit,
      owner: 'org',
      instructorRepoName: REPO,
      folder: FOLDER,
    });
    expect(history.entries.map((e) => e.number)).toEqual([1, 2]);
  });

  it('archives a questions.md older than the record as 0-questions.md', async () => {
    const octokit = fakeRepo({ [`${FOLDER}/questions.md`]: 'pre-record set' });
    await submit(octokit, { headSha: 'c'.repeat(40), questions: 'new set' });

    expect(octokit.files.get(`${FOLDER}/history/0-questions.md`)).toBe('pre-record set');
  });

  it('still writes the assessment when the record cannot be written', async () => {
    const octokit = fakeRepo({}, { failPath: `${FOLDER}/submissions.md` });
    await submit(octokit, { headSha: 'd'.repeat(40), questions: 'set' });

    expect(octokit.files.get(`${FOLDER}/questions.md`)).toBe('set');
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('Could not update the submission record'),
    );
  });

  it('reads a repository that does not exist yet as an empty record', async () => {
    const history = await readSubmissionHistory({
      octokit: fakeRepo(),
      owner: 'org',
      instructorRepoName: REPO,
      folder: FOLDER,
    });
    expect(history).toEqual({ entries: [], previousQuestions: '' });
  });
});
