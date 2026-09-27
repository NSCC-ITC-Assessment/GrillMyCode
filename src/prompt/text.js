/**
 * Prompt text helpers shared by the modules of the prompt template.
 */

/** "a, b, and c" (or "a, b, or c") — the list style the rest of the prompt uses. */
export function listWith(items, conjunction = 'and') {
  return items.length < 2
    ? items.join('')
    : `${items.slice(0, -1).join(', ')}, ${conjunction} ${items[items.length - 1]}`;
}
