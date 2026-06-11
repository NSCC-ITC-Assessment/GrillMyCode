/**
 * AI Client
 *
 * Calls the configured AI provider's chat completions endpoint and returns
 * the model's response text. Supports github-models and openrouter.
 *
 * Transient failures (429, 500, 502, 503, 504, network errors) are retried
 * automatically using exponential backoff with full jitter. 429 responses
 * that include a Retry-After header have that value honoured in preference
 * to the calculated backoff delay.
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
    case 'github-models':
      url = 'https://models.inference.ai.azure.com/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      break;

    case 'openrouter':
      url = 'https://openrouter.ai/api/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['HTTP-Referer'] = 'https://github.com/NSCC-ITC-Assessment/GrillMyCode';
      headers['X-Title'] = 'GrillMyCode';
      break;

    default:
      throw new Error(
        `Unknown ai_provider: "${provider}". Valid values: github-models | openrouter`,
      );
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
      if (response.status === 429) {
        const retryAfterMs = parseRetryAfterMs(response);
        delay =
          retryAfterMs !== null
            ? retryAfterMs
            : backoffDelay(attempt, AI_RETRY_BASE_DELAY_MS, AI_RETRY_MAX_DELAY_MS);
      } else {
        delay = backoffDelay(attempt, AI_RETRY_BASE_DELAY_MS, AI_RETRY_MAX_DELAY_MS);
      }

      core.warning(
        `AI request returned ${response.status} ${response.statusText}. ` +
          `Attempt ${attempt + 1}/${retryMaxAttempts}. Retrying in ${delay}ms…`,
      );
      await sleep(delay);
      continue;
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('AI API returned an empty choices array — no questions were generated.');
    }

    const content = data.choices[0].message.content;
    const finishReason = data.choices[0].finish_reason ?? 'unknown';

    if (content === null || content === undefined) {
      if (attempt < retryMaxAttempts - 1) {
        const delay = backoffDelay(attempt, AI_RETRY_BASE_DELAY_MS, AI_RETRY_MAX_DELAY_MS);
        core.warning(
          `AI returned null content (finish_reason: ${finishReason}) — model may have refused or hit a quota limit. ` +
            `Attempt ${attempt + 1}/${retryMaxAttempts}. Retrying in ${delay}ms…`,
        );
        await sleep(delay);
        continue;
      }
      throw new Error(
        `AI API returned a null response content (finish_reason: ${finishReason}) — the model may have refused the request or hit a quota limit.`,
      );
    }

    if (finishReason === 'error') {
      const providerMessage = data.error?.message ?? 'no details';
      const nativeReason = data.choices[0].native_finish_reason;
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
