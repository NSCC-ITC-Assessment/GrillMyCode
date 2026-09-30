import { afterEach, describe, expect, it, vi } from 'vitest';
import { callAI } from '../src/ai.js';
import { AI_ALLOWED_QUANTIZATIONS } from '../src/constants.js';

vi.mock('@actions/core', async (importOriginal) => ({
  ...(await importOriginal()),
  warning: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('callAI quantization filter', () => {
  const ok = { choices: [{ message: { content: 'reply' }, finish_reason: 'stop' }] };

  async function call(response = new Response(JSON.stringify(ok))) {
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetch);
    const result = await callAI({
      provider: 'openrouter',
      model: 'test/model',
      apiKey: 'key',
      messages: [],
      retryMaxAttempts: 1,
    }).catch((error) => ({ error }));
    return { body: JSON.parse(fetch.mock.calls[0][1].body), result };
  }

  it('sends the allowed precisions with every request', async () => {
    const { body } = await call();
    expect(body.provider).toEqual({ quantizations: AI_ALLOWED_QUANTIZATIONS });
  });

  it('allows fp8 and unknown but no compressed precision', () => {
    expect(AI_ALLOWED_QUANTIZATIONS).toEqual(expect.arrayContaining(['fp8', 'unknown']));
    for (const compressed of ['fp6', 'fp4', 'mxfp4', 'nvfp4', 'int4']) {
      expect(AI_ALLOWED_QUANTIZATIONS).not.toContain(compressed);
    }
  });

  it('explains a 404 as possibly a model served only compressed', async () => {
    const { result } = await call(
      new Response('{"error":{"code":404,"message":"No allowed providers are available"}}', {
        status: 404,
      }),
    );
    expect(result.error.message).toMatch(/runs a compressed copy/);
    expect(result.error.message).toMatch(/openrouter#compressed-models/);
  });

  it('leaves the guardrail 404 to its own explanation', async () => {
    const { result } = await call(
      new Response(
        '{"error":{"code":404,"message":"No endpoints available matching your guardrail restrictions and data policy"}}',
        { status: 404 },
      ),
    );
    expect(result.error.message).not.toMatch(/compressed/);
  });

  it('adds no compressed-model note to other errors', async () => {
    const { result } = await call(new Response('{"error":{}}', { status: 400 }));
    expect(result.error.message).not.toMatch(/compressed/);
  });
});
