/**
 * Question detail markup
 *
 * Builds the HTML shown in the Question view. Every piece of text from the
 * issue is escaped before it reaches the page, and the page runs no script,
 * so nothing an edited issue contains can act.
 */

import { describeLines } from './questions.js';

/** Escapes text for use in HTML content or a double-quoted attribute. */
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A line of prose as HTML, with its `inline code` spans as <code> elements. */
export function proseToHtml(text) {
  return text
    .split(/(`[^`]+`)/)
    .map((part, i) =>
      i % 2 === 1 ? `<code>${escapeHtml(part.slice(1, -1))}</code>` : escapeHtml(part),
    )
    .join('');
}

/** The body of the Question view for one question, or a prompt when none is selected. */
export function questionToHtml(question) {
  if (!question) return '<p class="hint">Select a question to read it here.</p>';
  const snippets = question.snippets
    .map(
      (snippet) =>
        (snippet.file
          ? `<p class="caption"><code>${escapeHtml(snippet.file)}</code>, ${escapeHtml(describeLines(snippet))}</p>`
          : '') + `<pre><code>${escapeHtml(snippet.code)}</code></pre>`,
    )
    .join('');
  return (
    `<h2>Question ${escapeHtml(question.number)}</h2>` +
    `<p class="question">${proseToHtml(question.question)}</p>` +
    snippets
  );
}
