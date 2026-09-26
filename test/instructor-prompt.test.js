import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as core from '@actions/core';
import { deliverToInstructorRepo } from '../src/delivery/instructor-repo.js';
import { formatPrompt } from '../src/report.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), warning: vi.fn(), error: vi.fn() }));

/**
 * An octokit stub for an instructor repository that already exists and holds no
 * files. Writes to `failPath` throw `failStatus` every time.
 */
function fakeOctokit({ failPath, failStatus = 422, failMessage = 'Validation failed' } = {}) {
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
        createOrUpdateFileContents: vi.fn(async ({ path }) => {
          if (path === failPath) {
            const err = new Error(failMessage);
            err.status = failStatus;
            throw err;
          }
          writes.push(path);
          return { data: {} };
        }),
      },
    },
  };
}

function deliver(octokit, { prompt } = {}) {
  return deliverToInstructorRepo({
    octokit,
    owner: 'my-school',
    instructorRepoName: 'lab-3-grillmycode-instructor',
    studentLogin: 'jsmith',
    content: '## GrillMyCode\n\n1. Question?',
    headSha: 'abcdef1234567890',
    prompt,
  });
}

/** Every string passed to any logging function. */
function logged() {
  return [core.info, core.warning, core.error].flatMap((fn) => fn.mock.calls.flat());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('prompt delivery (log_prompt)', () => {
  it('writes the prompt before the assessment', async () => {
    const octokit = fakeOctokit();
    await deliver(octokit, { prompt: 'the prompt' });

    expect(octokit.writes.filter((p) => p.startsWith('jsmith/'))).toEqual([
      'jsmith/prompt.md',
      'jsmith/questions.md',
    ]);
  });

  it('writes no prompt when none is supplied', async () => {
    const octokit = fakeOctokit();
    await deliver(octokit);

    expect(octokit.writes).not.toContain('jsmith/prompt.md');
  });

  it('never mentions the prompt in the log', async () => {
    await deliver(fakeOctokit(), { prompt: 'the prompt' });

    expect(logged().join('\n')).not.toMatch(/prompt/i);
  });

  it('fails silently and still writes the assessment', async () => {
    const octokit = fakeOctokit({ failPath: 'jsmith/prompt.md' });
    await deliver(octokit, { prompt: 'the prompt' });

    expect(octokit.writes).toContain('jsmith/questions.md');
    expect(core.warning).not.toHaveBeenCalled();
    expect(core.error).not.toHaveBeenCalled();
    expect(logged().join('\n')).not.toMatch(/prompt/i);
  });

  it('logs nothing while retrying a conflicting write', async () => {
    vi.useFakeTimers();
    try {
      const octokit = fakeOctokit({ failPath: 'jsmith/prompt.md', failStatus: 409 });
      const run = deliver(octokit, { prompt: 'the prompt' });
      await vi.runAllTimersAsync();
      await run;

      expect(octokit.writes).toContain('jsmith/questions.md');
      expect(logged().join('\n')).not.toMatch(/prompt/i);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('formatPrompt', () => {
  const opts = {
    baseSha: 'aaaaaaaaaaaaaaaa',
    headSha: 'bbbbbbbbbbbbbbbb',
    model: 'some/model',
    studentLogin: 'jsmith',
  };

  it('carries each message under its role', () => {
    const out = formatPrompt({
      ...opts,
      messages: [
        { role: 'system', content: 'You are an assessor.' },
        { role: 'user', content: 'Here is the diff.' },
      ],
    });

    expect(out).toContain('### system\n\n```text\nYou are an assessor.\n```');
    expect(out).toContain('### user\n\n```text\nHere is the diff.\n```');
    expect(out).toContain('`jsmith`');
    expect(out).toContain('`aaaaaaa` → `bbbbbbb`');
  });

  it('fences each message beyond the longest backtick run inside it', () => {
    const content = 'code:\n````js\nlet a = `x`;\n````';
    const out = formatPrompt({ ...opts, messages: [{ role: 'user', content }] });

    expect(out).toContain(`\`\`\`\`\`text\n${content}\n\`\`\`\`\``);
  });
});
