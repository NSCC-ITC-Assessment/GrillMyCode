import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as core from '@actions/core';
import { deliverToInstructorRepo } from '../src/delivery/instructor-repo.js';
import { formatRawOutput } from '../src/report.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), warning: vi.fn(), error: vi.fn() }));

/**
 * An octokit stub for an instructor repository that already exists and holds no
 * files. `failPath` makes every write to that path throw a non-retryable error.
 */
function fakeOctokit({ failPath } = {}) {
  const writes = [];
  return {
    writes,
    rest: {
      repos: {
        get: vi.fn(async () => ({ data: { default_branch: 'main' } })),
        getContent: vi.fn(async () => {
          const err = new Error('Not Found');
          err.status = 404;
          throw err;
        }),
        createOrUpdateFileContents: vi.fn(async ({ path, message }) => {
          if (path === failPath) {
            const err = new Error('Validation failed: path is invalid');
            err.status = 422;
            throw err;
          }
          writes.push({ path, message });
          return { data: {} };
        }),
      },
    },
  };
}

function deliver(octokit, { rawOutput } = {}) {
  return deliverToInstructorRepo({
    octokit,
    owner: 'org',
    instructorRepoName: 'assignment-grillmycode-instructor',
    studentLogin: 'student',
    content: '## GrillMyCode\n\n1. Question?',
    headSha: 'abcdef1234567890',
    rawOutput,
  });
}

/** Paths written, excluding the two action-managed files synced on every run. */
function studentWrites(octokit) {
  return octokit.writes.map((w) => w.path).filter((p) => p.startsWith('student/'));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('raw AI output delivery', () => {
  it('writes the raw copy before the assessment', async () => {
    const octokit = fakeOctokit();
    await deliver(octokit, { rawOutput: 'verbatim model reply' });

    expect(studentWrites(octokit)).toEqual(['student/raw-ai-output.md', 'student/questions.md']);
  });

  it('omits the raw copy when no raw output is supplied', async () => {
    const octokit = fakeOctokit();
    await deliver(octokit);

    expect(studentWrites(octokit)).toEqual(['student/questions.md']);
  });

  it('still writes the assessment when the raw copy fails', async () => {
    const octokit = fakeOctokit({ failPath: 'student/raw-ai-output.md' });
    await deliver(octokit, { rawOutput: 'verbatim model reply' });

    expect(studentWrites(octokit)).toEqual(['student/questions.md']);
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('Could not write the raw AI output'),
    );
  });

  it('propagates a failure of the assessment write itself', async () => {
    const octokit = fakeOctokit({ failPath: 'student/questions.md' });

    await expect(deliver(octokit, { rawOutput: 'verbatim model reply' })).rejects.toThrow(
      'Validation failed',
    );
  });
});

describe('formatRawOutput', () => {
  const opts = {
    baseSha: 'aaaaaaaaaaaaaaaa',
    headSha: 'bbbbbbbbbbbbbbbb',
    provider: 'openrouter',
    model: 'some/model',
    studentLogin: 'student',
    sourceRepo: 'org/classroom-assignment-student',
  };

  it('carries the reply through byte for byte', () => {
    // Fences, answer-container markers and trailing whitespace are exactly what
    // a postprocessing bug hides, so none of them may be touched here.
    const raw = '1. Q?\n\n```js\ncode`` ```\n```\n\n<!-- answer -->\n**Answer:** A   \n';
    const out = formatRawOutput({ ...opts, rawOutput: raw });

    expect(out).toContain(raw);
    expect(out.endsWith(raw)).toBe(true);
  });

  it('records the provenance an instructor needs to place the file', () => {
    const out = formatRawOutput({ ...opts, rawOutput: '1. Q?' });

    expect(out).toContain('`student`');
    expect(out).toContain('org/classroom-assignment-student');
    expect(out).toContain('`aaaaaaa` → `bbbbbbb`');
    expect(out).toContain('`some/model` via openrouter');
  });
});
