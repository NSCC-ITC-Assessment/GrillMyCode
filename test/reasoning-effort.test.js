import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callAI, reasoningParam } from '../src/ai.js';
import { readInputs } from '../src/inputs.js';
import { formatRawOutput } from '../src/report.js';

vi.mock('@actions/core', async (importOriginal) => ({
  ...(await importOriginal()),
  warning: vi.fn(),
}));

const ENV_KEYS = ['INPUT_GITHUB_TOKEN', 'INPUT_API_KEY', 'INPUT_AI_REASONING_EFFORT'];
const saved = {};

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  process.env.INPUT_GITHUB_TOKEN = 'token';
  process.env.INPUT_API_KEY = 'key';
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.unstubAllGlobals();
});

const reasoningEffort = (value) => {
  if (value === undefined) delete process.env.INPUT_AI_REASONING_EFFORT;
  else process.env.INPUT_AI_REASONING_EFFORT = value;
  return readInputs().aiReasoningEffort;
};

describe('ai_reasoning_effort input', () => {
  it('defaults to the model default', () => {
    expect(reasoningEffort(undefined)).toBe('default');
  });

  it('accepts a level in any case', () => {
    expect(reasoningEffort(' Low ')).toBe('low');
  });

  it('rejects an unknown level and lists the valid ones', () => {
    expect(() => reasoningEffort('lowest')).toThrow(/"default", "none", "minimal"/);
  });
});

describe('reasoningParam', () => {
  it('sends nothing for the model default', () => {
    expect(reasoningParam('default')).toBeNull();
    expect(reasoningParam(undefined)).toBeNull();
  });

  it('switches reasoning off for none', () => {
    expect(reasoningParam('none')).toEqual({ enabled: false });
  });

  it('sends any other level as an effort', () => {
    expect(reasoningParam('xhigh')).toEqual({ effort: 'xhigh' });
  });
});

describe('callAI reasoning field', () => {
  const ok = { choices: [{ message: { content: 'reply' }, finish_reason: 'stop' }] };

  function sentBody(fetch) {
    return JSON.parse(fetch.mock.calls[0][1].body);
  }

  async function call(reasoningEffort, response = new Response(JSON.stringify(ok))) {
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetch);
    const result = await callAI({
      provider: 'openrouter',
      model: 'test/model',
      apiKey: 'key',
      messages: [],
      retryMaxAttempts: 1,
      reasoningEffort,
    }).catch((error) => ({ error }));
    return { fetch, result };
  }

  it('leaves the field out at the model default', async () => {
    const { fetch } = await call('default');
    expect(sentBody(fetch)).not.toHaveProperty('reasoning');
  });

  it('sends the chosen level', async () => {
    const { fetch } = await call('low');
    expect(sentBody(fetch).reasoning).toEqual({ effort: 'low' });
  });

  it('explains a 400 when a reasoning level was set', async () => {
    const { result } = await call('none', new Response('{"error":{}}', { status: 400 }));
    expect(result.error.message).toMatch(/ai_reasoning_effort to "none"/);
  });

  it('adds no reasoning note to a 400 at the model default', async () => {
    const { result } = await call('default', new Response('{"error":{}}', { status: 400 }));
    expect(result.error.message).not.toMatch(/ai_reasoning_effort/);
  });
});

describe('raw output settings line', () => {
  const opts = {
    rawOutput: '{}',
    baseSha: 'a'.repeat(40),
    headSha: 'b'.repeat(40),
    provider: 'openrouter',
    model: 'some/model',
  };
  const request = { numQuestions: 10, temperature: 0.5, topP: 0.95 };

  it('names the level that was sent', () => {
    const out = formatRawOutput({ ...opts, request: { ...request, reasoningEffort: 'low' } });
    expect(out).toContain('temperature 0.5 · reasoning `low`');
  });

  it('says the model decided at the default', () => {
    const out = formatRawOutput({ ...opts, request: { ...request, reasoningEffort: 'default' } });
    expect(out).toContain('temperature 0.5 · reasoning: model default');
  });
});
