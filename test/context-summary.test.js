import { describe, expect, it, vi } from 'vitest';
import * as core from '@actions/core';
import { extractContextSummary } from '../src/postprocess.js';

vi.mock('@actions/core', () => ({ warning: vi.fn() }));

const SENTENCE =
  'These questions are focused towards output escaping, template partial inclusion with require_once, and array data structures.';

/** The model's response: one question block, then the summary it appends last. */
function response(closingMarker) {
  return [
    '**`index.php`**',
    '',
    '1. **What is the value of `$pageTitle`?**',
    '',
    '   <!-- gmc:answer -->',
    '   **Answer:**',
    '   - `TODO`',
    '',
    '   **Distractors for Multiple-Choice Quiz:**',
    '   - `index.php`',
    '   <!-- /gmc:answer -->',
    '',
    '---',
    '',
    '<!-- CONTEXT_SUMMARY -->',
    SENTENCE,
    ...(closingMarker ? [closingMarker] : []),
  ].join('\n');
}

describe('extractContextSummary', () => {
  it('reads and removes a correctly marked summary', () => {
    const { summary, rest } = extractContextSummary(response('<!-- /CONTEXT_SUMMARY -->'));
    expect(summary).toBe(SENTENCE);
    expect(rest).not.toContain(SENTENCE);
    expect(rest).not.toContain('CONTEXT_SUMMARY');
    expect(rest).toContain('**Answer:**');
    expect(core.warning).not.toHaveBeenCalled();
  });

  it('recovers a summary whose closing marker drifted, and warns', () => {
    // Verbatim from a delivered questions.md: gemini-3.5-flash-lite wrote
    // CONSAR where it should have written CONTEXT, which cost the report its
    // Instructor Note and left the block visible in the student's issue.
    const { summary, rest } = extractContextSummary(response('<!-- /CONSAR_SUMMARY -->'));
    expect(summary).toBe(SENTENCE);
    expect(rest).not.toContain(SENTENCE);
    expect(rest).not.toContain('CONSAR_SUMMARY');
    expect(core.warning).toHaveBeenCalledOnce();
  });

  it('recovers a summary with no closing marker at all', () => {
    const { summary, rest } = extractContextSummary(response(null));
    expect(summary).toBe(SENTENCE);
    expect(rest).not.toContain(SENTENCE);
  });

  it('stops at the blank line when the opening marker drifts mid-response', () => {
    // The fallback must never swallow the questions below a stray marker.
    const stray = ['<!-- CONTEXT_SUMMARY -->', SENTENCE, '', '2. **A later question**', ''].join(
      '\n',
    );
    const { summary, rest } = extractContextSummary(stray);
    expect(summary).toBe(SENTENCE);
    expect(rest).toContain('2. **A later question**');
  });

  it('leaves a response with no summary untouched', () => {
    const plain = '**`index.php`**\n\n1. **A question**\n';
    expect(extractContextSummary(plain)).toEqual({ summary: '', rest: plain });
  });
});
