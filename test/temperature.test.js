import * as core from '@actions/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callAI } from '../src/ai.js';
import { readInputs } from '../src/inputs.js';
import { formatRawOutput } from '../src/report.js';

vi.mock('@actions/core', async (importOriginal) => ({
  ...(await importOriginal()),
  warning: vi.fn(),
}));

const ENV_KEYS = ['INPUT_GITHUB_TOKEN', 'INPUT_API_KEY', 'INPUT_AI_TEMPERATURE'];
const saved = {};

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  process.env.INPUT_GITHUB_TOKEN = 'token';
  process.env.INPUT_API_KEY = 'key';
  vi.mocked(core.warning).mockClear();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.unstubAllGlobals();
});

const temperature = (value) => {
  if (value === undefined) delete process.env.INPUT_AI_TEMPERATURE;
  else process.env.INPUT_AI_TEMPERATURE = value;
  return readInputs().aiTemperature;
};

// ai_temperature has no default: unless the instructor sets it, the model runs
// at its own temperature.
describe('ai_temperature input', () => {
  it('is unset when empty', () => {
    expect(temperature(undefined)).toBeNull();
    expect(temperature('  ')).toBeNull();
    expect(core.warning).not.toHaveBeenCalled();
  });

  it('accepts OpenRouter’s whole range, including 0', () => {
    expect(temperature('0')).toBe(0);
    expect(temperature(' 0.7 ')).toBe(0.7);
    expect(temperature('2')).toBe(2);
  });

  it('ignores a value outside the range with a warning, so older workflows keep running', () => {
    expect(temperature('2.5')).toBeNull();
    expect(temperature('-0.1')).toBeNull();
    expect(core.warning).toHaveBeenCalledTimes(2);
    expect(vi.mocked(core.warning).mock.calls[0][0]).toMatch(/from 0 to 2; got "2\.5"/);
  });

  it('ignores a value that is not a number with a warning', () => {
    expect(temperature('warm')).toBeNull();
    expect(core.warning).toHaveBeenCalledWith(expect.stringMatching(/got "warm"/));
  });
});

describe('callAI sampling fields', () => {
  const ok = { choices: [{ message: { content: 'reply' }, finish_reason: 'stop' }] };

  async function call(temperature, response = new Response(JSON.stringify(ok))) {
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetch);
    const result = await callAI({
      provider: 'openrouter',
      model: 'test/model',
      apiKey: 'key',
      messages: [],
      retryMaxAttempts: 1,
      temperature,
    }).catch((error) => ({ error }));
    return { body: JSON.parse(fetch.mock.calls[0][1].body), result };
  }

  it('sends no temperature when none is set', async () => {
    const { body } = await call(null);
    expect(body).not.toHaveProperty('temperature');
  });

  it('sends a set temperature, including 0', async () => {
    expect((await call(0)).body.temperature).toBe(0);
    expect((await call(1.3)).body.temperature).toBe(1.3);
  });

  it('never sends top_p', async () => {
    const { body } = await call(0.7);
    expect(body).not.toHaveProperty('top_p');
  });

  it('explains a 400 when a temperature was set', async () => {
    const { result } = await call(1.5, new Response('{"error":{}}', { status: 400 }));
    expect(result.error.message).toMatch(/ai_temperature to 1\.5/);
  });

  it('adds no temperature note to a 400 when none was set', async () => {
    const { result } = await call(null, new Response('{"error":{}}', { status: 400 }));
    expect(result.error.message).not.toMatch(/ai_temperature/);
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

  it('names a temperature that was sent', () => {
    const out = formatRawOutput({ ...opts, request: { numQuestions: 10, temperature: 0 } });
    expect(out).toContain('10 questions requested · temperature 0');
  });

  it('says nothing when the model ran at its own temperature', () => {
    const out = formatRawOutput({ ...opts, request: { numQuestions: 10, temperature: null } });
    const settings = out.split('\n').find((line) => line.includes('**Settings:**'));
    expect(settings).toBe('> - **Settings:** 10 questions requested');
  });
});
