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

  const request = {
    numQuestions: 10,
    temperature: 0.2,
    topP: 0.95,
    promptHash: 'abc123def456',
    actionRef: 'v1',
  };
  const response = {
    finishReason: 'length',
    nativeFinishReason: 'MAX_TOKENS',
    usage: { promptTokens: 1200, completionTokens: 4096, reasoningTokens: null },
    attempts: 2,
    durationMs: 12_345,
    generationId: 'gen-1',
    servedModel: 'some/model',
    servedProvider: 'SomeHost',
  };

  /** Returns the parsed JSON from the gmc:provenance comment. */
  function provenanceOf(out) {
    const match = out.match(/<!-- gmc:provenance (.*) -->/);
    return JSON.parse(match[1]);
  }

  it('says in plain words when a reply was cut off', () => {
    const out = formatRawOutput({ ...opts, rawOutput: '1. Q?', request, response });

    expect(out).toContain('`length` (native: `MAX_TOKENS`) — the output token limit was reached');
    expect(out).toContain('1,200 in · 4,096 out');
    expect(out).toContain('- **Attempts:** 2 (1 retry) · 12.3 s');
    expect(out).toContain('10 questions requested · temperature 0.2 · prompt `abc123def456`');
    // Only the host is worth a line when the model served is the one requested.
    expect(out).toContain('- **Served by:** via SomeHost');
  });

  it('embeds the full record as JSON above the reply', () => {
    const out = formatRawOutput({ ...opts, rawOutput: '1. Q?', request, response });
    const record = provenanceOf(out);

    expect(record).toMatchObject({
      version: 1,
      baseSha: opts.baseSha,
      headSha: opts.headSha,
      model: 'some/model',
      request,
      response,
    });
    expect(out.indexOf('gmc:provenance')).toBeLessThan(out.indexOf('\n---\n'));
  });

  it('cannot have its comment closed early by a value', () => {
    const out = formatRawOutput({
      ...opts,
      rawOutput: '1. Q?',
      request,
      response: { ...response, servedProvider: 'evil --> <b>x</b>' },
    });
    const comment = out.match(/<!-- gmc:provenance .* -->/)[0];

    expect(comment.slice(0, -3)).not.toContain('>');
    expect(provenanceOf(out).response.servedProvider).toBe('evil --> <b>x</b>');
  });

  it('still renders without response or request metadata', () => {
    const out = formatRawOutput({ ...opts, rawOutput: '1. Q?' });

    expect(out).not.toContain('Stopped because');
    expect(provenanceOf(out)).toMatchObject({ request: null, response: null });
  });
});
