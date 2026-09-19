/**
 * Submission Tags
 *
 * Pure helpers for the tag trigger: matching a pushed tag against the
 * instructor's submission_tags patterns, and choosing the previous submission
 * tag for the previous-tag diff mode. No git, Actions or Octokit dependencies —
 * callers pass the data in.
 *
 * Patterns follow the subset of GitHub Actions filter syntax that a workflow's
 * `on.push.tags` evaluates, so the action and GitHub agree on which tags fire:
 *
 *   - a literal name matches exactly (case-sensitive)
 *   - `*`  matches zero or more characters, not crossing `/`
 *   - `**` matches zero or more characters, crossing `/`
 *   - `?`  matches zero or one of the preceding character
 *   - `+`  matches one or more of the preceding character
 *   - `[abc]` / `[a-z]` character classes
 *
 * `!` negation is not supported: a negated entry would need the order-dependent
 * evaluation GitHub applies across the whole list, and an instructor who wants
 * one is better served by listing the tags they do want.
 */

/**
 * Characters a pattern may contain: tag-name characters plus the glob
 * metacharacters above. Everything that could break out of the quoted YAML
 * list the wizard renders (quotes, whitespace, backslashes) is excluded.
 */
const TAG_PATTERN_CHARSET_RE = /^[A-Za-z0-9._/*?+[\]-]+$/;

/**
 * A leading quantifier has nothing to repeat, and a `+` straight after another
 * quantifier (`v*+`, `a++`) compiles to a possessive quantifier in some regex
 * engines and is an error in others — reject both rather than guess.
 */
const STACKED_QUANTIFIER_RE = /^[?+]|[*?+]\+/;

/** True when a pattern is in the supported syntax (see the module comment). */
export function isSafeTagPattern(pattern) {
  return TAG_PATTERN_CHARSET_RE.test(pattern) && !STACKED_QUANTIFIER_RE.test(pattern);
}

/** Escapes a single character for literal use inside a RegExp. */
function escapeRegExp(ch) {
  return ch.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
}

/**
 * Translates one filter pattern into an anchored RegExp, character by
 * character so that `.` and other regex metacharacters stay literal.
 */
export function compileTagPattern(pattern) {
  let src = '^';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        src += '.*';
        i++;
      } else {
        src += '[^/]*';
      }
    } else if (ch === '?' || ch === '+') {
      src += ch;
    } else if (ch === '[') {
      const close = pattern.indexOf(']', i + 1);
      if (close === -1) {
        src += escapeRegExp(ch);
      } else {
        src += pattern.slice(i, close + 1);
        i = close;
      }
    } else {
      src += escapeRegExp(ch);
    }
  }
  return new RegExp(`${src}$`);
}

/**
 * Returns the first pattern in `patterns` that matches `tagName`, or null.
 * The first listed pattern wins when several match, so an instructor controls
 * which group an overlapping tag files under by the order they list them.
 */
export function findMatchingTagPattern(patterns, tagName) {
  for (const pattern of patterns) {
    if (!isSafeTagPattern(pattern)) continue;
    let re;
    try {
      re = compileTagPattern(pattern);
    } catch {
      continue;
    }
    if (re.test(tagName)) return pattern;
  }
  return null;
}

/**
 * Chooses the nearest earlier submission tag for the previous-tag diff mode.
 *
 * @param {object}   params
 * @param {Array<{name: string, commit: string}>} params.tags
 *   Every tag in the repository with the commit it points at (peeled).
 * @param {string[]} params.ancestors
 *   Commits reachable from the head, nearest first (`git rev-list --topo-order`).
 *   Membership is what makes a tag "earlier"; position is how near it is.
 * @param {string[]} params.patterns  The submission_tags patterns.
 * @param {string}   params.headSha   The commit being assessed.
 *
 * A tag counts when it matches any configured pattern and points at a strict
 * ancestor of the head. Tags on the head commit itself — the tag that started
 * this run, or a second tag pushed at the same commit — are ignored, since
 * diffing from them would leave nothing to assess.
 *
 * Returns `{ name, commit }` or null when no earlier submission tag exists.
 */
export function pickPreviousSubmissionTag({ tags, ancestors, patterns, headSha }) {
  const position = new Map(ancestors.map((sha, idx) => [sha, idx]));
  let best = null;
  let bestPos = Infinity;
  for (const tag of tags) {
    if (tag.commit === headSha) continue;
    const pos = position.get(tag.commit);
    if (pos === undefined) continue;
    if (!findMatchingTagPattern(patterns, tag.name)) continue;
    // Ties (two tags on one commit) break by name so the choice is stable.
    if (pos < bestPos || (pos === bestPos && tag.name < best.name)) {
      best = tag;
      bestPos = pos;
    }
  }
  return best ? { name: best.name, commit: best.commit } : null;
}
