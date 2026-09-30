import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as core from '@actions/core';
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

/**
 * Runs callAI with retry backoff sleeps fast-forwarded. Settles to the reply
 * text as `value`; `full` passes callAI's whole result through instead.
 */
async function run(retryMaxAttempts, { full = false, ...extra } = {}) {
  const result = callAI({
    provider: 'openrouter',
    model: 'test-model',
    apiKey: 'key',
    messages: [],
    retryMaxAttempts,
    ...extra,
  });
  const settled = result.then(
    (value) => ({ value: full ? value : value.content }),
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

describe('callAI response metadata', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reports the finish reason, usage and what OpenRouter served', async () => {
    respondWith({
      id: 'gen-123',
      model: 'upstream/model-v2',
      provider: 'SomeHost',
      choices: [
        {
          message: { content: '1. Q?' },
          finish_reason: 'length',
          native_finish_reason: 'MAX_TOKENS',
        },
      ],
      usage: {
        prompt_tokens: 1200,
        completion_tokens: 4096,
        total_tokens: 5296,
        completion_tokens_details: { reasoning_tokens: 300 },
        cost: 0.0123,
      },
    });
    const { value } = await run(1, { full: true });

    expect(value.content).toBe('1. Q?');
    expect(value.metadata).toMatchObject({
      finishReason: 'length',
      nativeFinishReason: 'MAX_TOKENS',
      usage: {
        promptTokens: 1200,
        completionTokens: 4096,
        reasoningTokens: 300,
        totalTokens: 5296,
        cost: 0.0123,
      },
      attempts: 1,
      generationId: 'gen-123',
      servedModel: 'upstream/model-v2',
      servedProvider: 'SomeHost',
    });
    expect(value.metadata.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('counts the attempts a retried reply took', async () => {
    respondWith({ choices: [{ delta: {} }] }, { choices: [{ delta: {} }] }, ok);
    const { value } = await run(3, { full: true });

    expect(value.metadata.attempts).toBe(3);
  });

  it('records null rather than trusting a missing or malformed usage block', async () => {
    respondWith({ ...ok, usage: { prompt_tokens: '12', completion_tokens: null } }, ok);
    expect((await run(1, { full: true })).value.metadata.usage).toEqual({
      promptTokens: null,
      completionTokens: null,
      reasoningTokens: null,
      totalTokens: null,
      cost: null,
    });
    expect((await run(1, { full: true })).value.metadata).toMatchObject({
      usage: null,
      nativeFinishReason: null,
      generationId: null,
    });
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

describe('callAI Retry-After on a 429', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(core.warning).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /**
   * Stubs fetch to return one 429, then a success. The 429 carries the given
   * Retry-After, or no header when it is undefined.
   */
  function rateLimitedThenOk(retryAfter) {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('rate limited', {
          status: 429,
          statusText: 'Too Many Requests',
          headers: retryAfter === undefined ? {} : { 'Retry-After': retryAfter },
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(ok), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }

  /** Starts callAI and returns a probe for how many requests have been sent. */
  function start(fetch) {
    const result = callAI({
      provider: 'openrouter',
      model: 'test-model',
      apiKey: 'key',
      messages: [],
      retryMaxAttempts: 2,
    });
    return { result, calls: () => fetch.mock.calls.length };
  }

  it('honours a Retry-After below the cap exactly', async () => {
    const fetch = rateLimitedThenOk('2');
    const { result, calls } = start(fetch);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls()).toBe(2);
    expect((await result).content).toBe('1. Question?');
    expect(core.warning).toHaveBeenCalledWith(expect.not.stringContaining('capped'));
  });

  it.each([
    ['integer seconds', () => '3600'],
    ['an HTTP date', () => new Date(Date.now() + 3_600_000).toUTCString()],
  ])('caps a Retry-After given as %s at 30 seconds', async (_, header) => {
    const fetch = rateLimitedThenOk(header());
    const { result, calls } = start(fetch);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls()).toBe(2);
    expect((await result).content).toBe('1. Question?');
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringMatching(/in 30000ms \(Retry-After .*capped\)/),
    );
  });

  it('waits at least 5 seconds when there is no Retry-After', async () => {
    // Math.random() of 0 would make the plain backoff retry immediately.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fetch = rateLimitedThenOk(undefined);
    const { result, calls } = start(fetch);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls()).toBe(2);
    expect((await result).content).toBe('1. Question?');
    vi.restoreAllMocks();
  });

  it('waits at least 5 seconds for a 429 error body on a 200', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fetch = respondWith({ error: { code: 429, message: 'rate limited upstream' } }, ok);
    const { result, calls } = start(fetch);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls()).toBe(2);
    expect((await result).content).toBe('1. Question?');
    vi.restoreAllMocks();
  });
});

describe('callAI response format and parsing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(core.warning).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const reply = (content, finishReason = 'stop') => ({
    choices: [{ message: { content }, finish_reason: finishReason }],
  });
  const strict = (content) => {
    if (content !== 'good') throw new Error('the reply is not usable');
    return { parsed: content };
  };

  it('sends response_format only when one is given', async () => {
    const fetch = respondWith(ok, ok);
    await run(1);
    await run(1, { responseFormat: { type: 'json_object' } });
    const bodies = fetch.mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(bodies[0]).not.toHaveProperty('response_format');
    expect(bodies[1].response_format).toEqual({ type: 'json_object' });
    // A routing preference, never a requirement: a model without structured
    // outputs must still be reachable.
    expect(bodies[1].provider ?? {}).not.toHaveProperty('require_parameters');
  });

  it('returns what parse made of the trimmed reply', async () => {
    respondWith(reply('  good  '));
    const { value } = await run(1, { full: true, parse: strict });
    expect(value.content).toBe('good');
    expect(value.parsed).toEqual({ parsed: 'good' });
  });

  it('passes the content through when there is no parse', async () => {
    respondWith(ok);
    const { value } = await run(1, { full: true });
    expect(value.parsed).toBe('1. Question?');
  });

  it('retries a reply parse rejects', async () => {
    const fetch = respondWith(reply('bad'), reply('good'));
    const { value } = await run(2, { full: true, parse: strict });
    expect(value.parsed).toEqual({ parsed: 'good' });
    expect(value.metadata.attempts).toBe(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('AI reply could not be used (the reply is not usable)'),
    );
  });

  it('fails once retries are exhausted', async () => {
    respondWith(reply('bad'), reply('bad'));
    const { error } = await run(2, { parse: strict });
    expect(error.message).toBe('AI reply could not be used: the reply is not usable');
  });

  // The same request would hit the same output token limit again.
  it('does not retry a reply cut off at the token limit', async () => {
    const fetch = respondWith(reply('bad', 'length'), reply('good'));
    const { error } = await run(2, { parse: strict });
    expect(error.message).toMatch(/could not be used/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('hands parse the finish reason', async () => {
    respondWith(reply('good', 'length'));
    const parse = vi.fn(() => 'ok');
    await run(1, { parse });
    expect(parse).toHaveBeenCalledWith('good', { finishReason: 'length' });
  });
});

describe('callAI final HTTP error message', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(core.warning).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const upstreamBody = JSON.stringify({
    error: {
      message: 'Provider returned error',
      code: 429,
      metadata: {
        provider_name: 'ExampleHost',
        is_byok: false,
        limit_source: 'upstream_provider_shared_pool',
      },
    },
  });

  /** Stubs fetch to return the same error response on every attempt. */
  function alwaysFail(status, body, init = {}) {
    const fetch = vi.fn(async () => new Response(body, { status, ...init }));
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }

  it('explains an upstream shared-pool rate limit', async () => {
    alwaysFail(429, upstreamBody);
    const { error } = await run(2);
    expect(error.message).toMatch(
      /^AI API error 429: The model's upstream provider \(ExampleHost\)/,
    );
    expect(error.message).toMatch(/not just this API key/);
    expect(error.message).toMatch(/openrouter#retries-and-rate-limits/);
    expect(error.message).toMatch(/Response: \{"error"/);
  });

  it('explains an upstream rate limit sent as a 200 error body', async () => {
    respondWith(JSON.parse(upstreamBody), JSON.parse(upstreamBody));
    const { error } = await run(2);
    expect(error.message).toMatch(/429: Provider returned error/);
    expect(error.message).toMatch(/upstream provider \(ExampleHost\)/);
  });

  it('leaves a 429 on the API key itself unexplained', async () => {
    alwaysFail(429, JSON.stringify({ error: { message: 'Rate limit exceeded', code: 429 } }));
    const { error } = await run(1);
    expect(error.message).toBe(
      'AI API error 429: {"error":{"message":"Rate limit exceeded","code":429}}',
    );
  });

  it('omits the empty status text HTTP/2 sends', async () => {
    alwaysFail(503, 'busy');
    const { error } = await run(2);
    expect(error.message).toBe('AI API error 503: busy');
    expect(core.warning).toHaveBeenCalledWith(expect.stringMatching(/^AI request returned 503\. /));
  });

  it('keeps a status text when one is sent', async () => {
    alwaysFail(503, 'busy', { statusText: 'Service Unavailable' });
    const { error } = await run(1);
    expect(error.message).toBe('AI API error 503 Service Unavailable: busy');
  });
});
