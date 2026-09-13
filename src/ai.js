/**
 * AI Client
 *
 * Calls the configured AI provider's chat completions endpoint and returns
 * the model's response text. OpenRouter is the only supported provider.
 *
 * Transient failures (429, 500, 502, 503, 504, network errors) are retried
 * automatically using exponential backoff with full jitter. 429 responses
 * that include a Retry-After header have that value honoured in preference
 * to the calculated backoff delay, up to the same AI_RETRY_MAX_DELAY_MS cap
 * as every other wait. The same status codes are retried when a
 * 200 response carries them in an error body (a failure after generation
 * started), as are 200 responses whose body is not valid JSON.
 */

import * as core from '@actions/core';
import {
  AI_TOP_P,
  AI_RETRY_BASE_DELAY_MS,
  AI_RETRY_MAX_DELAY_MS,
  AI_RETRYABLE_STATUS_CODES,
} from './constants.js';

/** Resolves after `ms` milliseconds. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a full-jitter backoff delay in milliseconds for the given attempt
 * number (0-indexed). The delay is a random value in [0, min(maxMs, base * 2^attempt)].
 */
function backoffDelay(attempt, baseMs, maxMs) {
  const cap = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  return Math.floor(Math.random() * cap);
}

/**
 * Reads the Retry-After header from a response and returns the value in
 * milliseconds, or null if the header is absent or unparseable.
 * Handles both integer-seconds and HTTP-date formats.
 */
function parseRetryAfterMs(response) {
  const header = response.headers.get('retry-after');
  if (!header) return null;

  // Integer seconds format
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds) && String(seconds) === header.trim()) {
    return seconds * 1000;
  }

  // HTTP-date format
  const date = Date.parse(header);
  if (!isNaN(date)) {
    const delay = date - Date.now();
    return delay > 0 ? delay : 0;
  }

  return null;
}

/**
 * Calls the configured AI provider and returns the generated questions text.
 *
 * @param {object} opts
 * @param {string} opts.provider       - AI provider key
 * @param {string} opts.model          - Model identifier
 * @param {string} opts.apiKey         - Provider API key
 * @param {Array}  opts.messages       - Chat messages array
 * @param {number} opts.retryMaxAttempts - Total attempts (initial + retries)
 */
export async function callAI({ provider, model, apiKey, messages, retryMaxAttempts, temperature }) {
  let url;
  const headers = { 'Content-Type': 'application/json' };

  switch (provider) {
    case 'openrouter':
      url = 'https://openrouter.ai/api/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['HTTP-Referer'] = 'https://github.com/NSCC-ITC-Assessment/GrillMyCode';
      headers['X-Title'] = 'GrillMyCode';
      break;

    // GitHub Models was permanently discontinued by GitHub. Workflows that
    // still specify it get a migration message rather than a generic
    // "unknown provider" error, since it was the default for a long time.
    case 'github-models':
      throw new Error(
        'ai_provider "github-models" is no longer supported: GitHub permanently ' +
          'discontinued GitHub Models. Set ai_provider to "openrouter" and supply an ' +
          'OpenRouter api_key. See https://nscc-itc-assessment.github.io/GrillMyCode/docs/ai-providers/openrouter',
      );

    default:
      throw new Error(`Unknown ai_provider: "${provider}". Valid values: openrouter`);
  }

  const body = JSON.stringify({
    model,
    messages,
    temperature: temperature,
    top_p: AI_TOP_P,
  });

  let lastError;

  for (let attempt = 0; attempt < retryMaxAttempts; attempt++) {
    let response;

    try {
      response = await fetch(url, { method: 'POST', headers, body });
    } catch (networkError) {
      lastError = networkError;
      if (attempt < retryMaxAttempts - 1) {
        const delay = backoffDelay(attempt, AI_RETRY_BASE_DELAY_MS, AI_RETRY_MAX_DELAY_MS);
        core.warning(
          `AI request failed (network error: ${networkError.message}). ` +
            `Attempt ${attempt + 1}/${retryMaxAttempts}. Retrying in ${delay}ms…`,
        );
        await sleep(delay);
        continue;
      }
      throw networkError;
    }

    if (!response.ok) {
      const isRetryable = AI_RETRYABLE_STATUS_CODES.includes(response.status);

      if (!isRetryable || attempt === retryMaxAttempts - 1) {
        const errorText = await response.text().catch(() => '(no body)');
        throw new Error(`AI API error ${response.status} ${response.statusText}: ${errorText}`);
      }

      let delay;
      let cappedNote = '';
      const retryAfterMs = response.status === 429 ? parseRetryAfterMs(response) : null;
      if (retryAfterMs !== null) {
        // Retry-After is capped like every other wait: an hour-long value would
        // otherwise sleep once per remaining attempt, past the job's useful
        // lifetime. Retrying early at worst spends the attempt budget and fails
        // with the 429 as the diagnosis.
        delay = Math.min(Math.max(0, retryAfterMs), AI_RETRY_MAX_DELAY_MS);
        if (delay < retryAfterMs) {
          cappedNote = ` (Retry-After asked for ${retryAfterMs}ms; capped)`;
        }
      } else {
        delay = backoffDelay(attempt, AI_RETRY_BASE_DELAY_MS, AI_RETRY_MAX_DELAY_MS);
      }

      core.warning(
        `AI request returned ${response.status} ${response.statusText}. ` +
          `Attempt ${attempt + 1}/${retryMaxAttempts}. Retrying in ${delay}ms${cappedNote}…`,
      );
      await sleep(delay);
      continue;
    }

    // A 200 whose body will not parse is almost always a transport failure — a
    // connection dropped mid-body, or a proxy's HTML page — so it is retried
    // like a network error.
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      lastError = parseError;
      if (attempt < retryMaxAttempts - 1) {
        const delay = backoffDelay(attempt, AI_RETRY_BASE_DELAY_MS, AI_RETRY_MAX_DELAY_MS);
        core.warning(
          `AI response body was not valid JSON (${parseError.message}). ` +
            `Attempt ${attempt + 1}/${retryMaxAttempts}. Retrying in ${delay}ms…`,
        );
        await sleep(delay);
        continue;
      }
      throw new Error(
        `AI API returned a response body that is not valid JSON: ${parseError.message}`,
        { cause: parseError },
      );
    }

    // OpenRouter normalises many upstream providers imperfectly, so nothing
    // below the top level is trusted: a null choice, a streaming-shaped choice
    // with `delta` instead of `message`, or non-string content must reach the
    // retry path below rather than escape as a TypeError.
    const choice = data?.choices?.[0];
    if (!choice) {
      // Once generation has started OpenRouter cannot change the HTTP status, so
      // an upstream failure arrives as a 200 carrying { error: { code, message } },
      // where code mirrors the status it would have sent. Retry it on the same
      // codes as a real HTTP error.
      const providerError = data?.error;
      if (providerError) {
        const code = Number(providerError.code);
        const detail = `${providerError.code ?? 'no code'}: ${providerError.message ?? 'no details'}`;
        if (AI_RETRYABLE_STATUS_CODES.includes(code) && attempt < retryMaxAttempts - 1) {
          const delay = backoffDelay(attempt, AI_RETRY_BASE_DELAY_MS, AI_RETRY_MAX_DELAY_MS);
          core.warning(
            `AI provider reported an error during generation (${detail}). ` +
              `Attempt ${attempt + 1}/${retryMaxAttempts}. Retrying in ${delay}ms…`,
          );
          await sleep(delay);
          continue;
        }
        throw new Error(`AI provider reported an error during generation (${detail}).`);
      }
      throw new Error('AI API returned an empty choices array — no questions were generated.');
    }

    const content = choice.message?.content;
    const finishReason = choice.finish_reason ?? 'unknown';

    if (typeof content !== 'string') {
      if (attempt < retryMaxAttempts - 1) {
        const delay = backoffDelay(attempt, AI_RETRY_BASE_DELAY_MS, AI_RETRY_MAX_DELAY_MS);
        core.warning(
          `AI returned no text content (finish_reason: ${finishReason}) — model may have refused or hit a quota limit. ` +
            `Attempt ${attempt + 1}/${retryMaxAttempts}. Retrying in ${delay}ms…`,
        );
        await sleep(delay);
        continue;
      }
      throw new Error(
        `AI API returned no text content (finish_reason: ${finishReason}) — the model may have refused the request or hit a quota limit.`,
      );
    }

    if (finishReason === 'error') {
      const providerMessage = data.error?.message ?? 'no details';
      const nativeReason = choice.native_finish_reason;
      const detail = nativeReason ? `${providerMessage}; native: ${nativeReason}` : providerMessage;
      if (attempt < retryMaxAttempts - 1) {
        const delay = backoffDelay(attempt, AI_RETRY_BASE_DELAY_MS, AI_RETRY_MAX_DELAY_MS);
        core.warning(
          `AI returned partial content with finish_reason "error" (${detail}). ` +
            `Attempt ${attempt + 1}/${retryMaxAttempts}. Retrying in ${delay}ms…`,
        );
        await sleep(delay);
        continue;
      }
      throw new Error(
        `AI API returned finish_reason "error" after all retry attempts (${detail}).`,
      );
    }

    if (finishReason === 'length') {
      core.warning(
        `AI response was cut off because the output token limit was reached. ` +
          `The generated questions may be incomplete. `,
      );
    }

    return content.trim();
  }

  // Should be unreachable; satisfies linters if retryMaxAttempts is clamped to >= 1.
  throw lastError ?? new Error('AI request failed after all retry attempts.');
}
