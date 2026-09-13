import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callAI } from '../src/ai.js';

vi.mock('@actions/core', () => ({ warning: vi.fn() }));

/** Stubs fetch to return each body in turn as a 200 JSON response. */
function respondWith(...bodies) {
  const fetch = vi.fn();
  for (const body of bodies) {
    fetch.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
  }
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

/** Runs callAI with retry backoff sleeps fast-forwarded. */
async function run(retryMaxAttempts) {
  const result = callAI({
    provider: 'openrouter',
    model: 'test-model',
    apiKey: 'key',
    messages: [],
    retryMaxAttempts,
  });
  const settled = result.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  await vi.runAllTimersAsync();
  return settled;
}

const ok = { choices: [{ message: { content: '  1. Question?  ' }, finish_reason: 'stop' }] };

describe('callAI response shape handling', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns trimmed content from a well-formed response', async () => {
    respondWith(ok);
    expect(await run(1)).toEqual({ value: '1. Question?' });
  });

  it.each([
    ['a streaming-shaped choice with no message', { delta: { content: 'x' }, finish_reason: null }],
    ['a message with null content', { message: { content: null }, finish_reason: 'stop' }],
    [
      'non-string content',
      { message: { content: [{ type: 'text', text: 'x' }] }, finish_reason: 'stop' },
    ],
  ])('retries %s instead of throwing a TypeError', async (_, badChoice) => {
    const fetch = respondWith({ choices: [badChoice] }, ok);
    expect(await run(2)).toEqual({ value: '1. Question?' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('fails with a descriptive error once retries are exhausted', async () => {
    respondWith({ choices: [{ delta: {} }] }, { choices: [{ delta: {} }] });
    const { error } = await run(2);
    expect(error).not.toBeInstanceOf(TypeError);
    expect(error.message).toMatch(/no text content \(finish_reason: unknown\)/);
  });

  it.each([
    ['an empty choices array', { choices: [] }],
    ['a null choice', { choices: [null] }],
    ['a null body', null],
  ])('reports %s as no choices, not a TypeError', async (_, body) => {
    const fetch = respondWith(body);
    const { error } = await run(3);
    expect(error).not.toBeInstanceOf(TypeError);
    expect(error.message).toMatch(/empty choices array/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('callAI error bodies on a 200', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([429, 500, 502, 503, 504])('retries an error body with code %i', async (code) => {
    const fetch = respondWith({ error: { code, message: 'upstream failed' } }, ok);
    expect(await run(2)).toEqual({ value: '1. Question?' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries a retryable code sent as a string', async () => {
    const fetch = respondWith({ error: { code: '503', message: 'unavailable' } }, ok);
    expect(await run(2)).toEqual({ value: '1. Question?' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      'a non-retryable code',
      { code: 403, message: 'flagged by moderation' },
      /403: flagged by moderation/,
    ],
    ['no code', { message: 'something broke' }, /no code: something broke/],
  ])('fails fast with the provider message for %s', async (_, providerError, message) => {
    const fetch = respondWith({ error: providerError });
    const { error } = await run(3);
    expect(error.message).toMatch(/error during generation/);
    expect(error.message).toMatch(message);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fails with the provider message once retries are exhausted', async () => {
    const body = { error: { code: 502, message: 'bad gateway' } };
    const fetch = respondWith(body, body);
    const { error } = await run(2);
    expect(error.message).toMatch(/502: bad gateway/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('callAI unreadable bodies on a 200', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Stubs fetch to return each raw text body in turn as a 200. */
  function respondWithText(...bodies) {
    const fetch = vi.fn();
    for (const body of bodies) fetch.mockResolvedValueOnce(new Response(body, { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }

  it('retries a body that is not valid JSON', async () => {
    const fetch = respondWithText('<html>502 Bad Gateway</html>', JSON.stringify(ok));
    expect(await run(2)).toEqual({ value: '1. Question?' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries a truncated JSON body', async () => {
    const fetch = respondWithText('{"choices":[{"message":{"con', JSON.stringify(ok));
    expect(await run(2)).toEqual({ value: '1. Question?' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('fails with a descriptive error once retries are exhausted', async () => {
    const fetch = respondWithText('not json', 'not json');
    const { error } = await run(2);
    expect(error.message).toMatch(/not valid JSON/);
    expect(error.cause).toBeInstanceOf(SyntaxError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
