/**
 * Submission tags
 *
 * What the action accepts as a submission tag pattern and as a tag name. These
 * are copies of the action's rules in src/tags.js, which the extension cannot
 * import. test/extension-action-inputs.test.js fails if the two disagree.
 */

/** Characters a submission_tags pattern may contain. */
const TAG_PATTERN_CHARSET_RE = /^[A-Za-z0-9._/*?+[\]-]+$/;

/** A quantifier with nothing to repeat, or a `+` straight after another one. */
const STACKED_QUANTIFIER_RE = /^[?+]|[*?+]\+/;

/** A single tag name: the pattern characters without the wildcards. */
const TAG_NAME_RE = /^[A-Za-z0-9._][A-Za-z0-9._/-]*$/;

/**
 * True when `name` is a plain tag name usable in tag_diff_base's `tag:` form.
 *
 * @param {string} name
 */
export function isSafeTagName(name) {
  return TAG_NAME_RE.test(name) && !name.includes('..') && !name.endsWith('/');
}

/**
 * True when the action accepts `pattern` as a submission_tags entry.
 *
 * @param {string} pattern
 */
export function isSafeTagPattern(pattern) {
  return TAG_PATTERN_CHARSET_RE.test(pattern) && !STACKED_QUANTIFIER_RE.test(pattern);
}

/**
 * A tag list as the action splits it: on commas and line breaks, without blanks.
 *
 * @param {unknown} value
 */
export function splitTagList(value) {
  return String(value ?? '')
    .split(/[,\r\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
