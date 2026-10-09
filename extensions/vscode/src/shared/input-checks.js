/**
 * Input checks
 *
 * What is wrong with the inputs a workflow file gives the GrillMyCode action,
 * as far as the file alone can say. Each check follows what the action does
 * with the value (src/inputs.js), so nothing here is a rule of its own:
 *
 *   error    the action fails the run, or cannot use the value
 *   warning  the action carries on, but not with what was written
 *   info     the input is fine and has no effect as the workflow stands
 *
 * A value GitHub works out at run time, such as `${{ inputs.num_questions }}`,
 * is not checked: the file does not say what it will be.
 */

import { ACTION_INPUTS } from './action-inputs.js';
import { INPUT_NAME_MAX_EDITS } from './constants.js';
import { isSafeTagName, isSafeTagPattern, splitTagList } from './tags.js';
import { readWorkflow } from './workflow.js';

/** A secret read from a workflow input, which a run records as plain text. */
const INPUT_EXPRESSION_RE = /\$\{\{[^}]*\binputs\./;

const quote = (value) => `"${value}"`;

/** `"a", "b" or "c"`. */
function listValues(values) {
  const quoted = values.map(quote);
  if (quoted.length < 2) return quoted.join('');
  return `${quoted.slice(0, -1).join(', ')} or ${quoted.at(-1)}`;
}

/** How many single-letter edits turn `a` into `b`. */
function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        previous[j] + 1,
        row[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = row;
  }
  return previous[b.length];
}

/** The input a misspelled name most likely meant, if one is close enough. */
export function closestInput(name) {
  let best;
  for (const known of Object.keys(ACTION_INPUTS)) {
    if (ACTION_INPUTS[known].hidden) continue;
    const edits = editDistance(name.toLowerCase(), known);
    if (edits <= INPUT_NAME_MAX_EDITS && (!best || edits < best.edits)) best = { known, edits };
  }
  return best?.known;
}

/** What is wrong with one value, as `{ severity, code, message }`, or undefined. */
function checkValue(name, rule, raw) {
  // The action trims every input, and treats an empty one as not set.
  const value = raw.trim();
  if (value === '') return undefined;

  if (rule.kind === 'enum') {
    const given = rule.caseSensitive ? value : value.toLowerCase();
    if (rule.prefix && given.startsWith(rule.prefix)) {
      const tag = value.slice(rule.prefix.length).trim();
      if (isSafeTagName(tag)) return undefined;
      return {
        severity: 'error',
        code: 'invalid-value',
        message:
          `${name}: ${quote(value)} does not name a usable tag. Write it as ` +
          `${quote(`${rule.prefix}phase1`)}. The name may use letters, digits and . _ / - but ` +
          'no wildcards. A run with this value fails.',
      };
    }
    if (rule.values.includes(given)) return undefined;
    const allowed = rule.prefix
      ? `${rule.values.map(quote).join(', ')} or ${quote(`${rule.prefix}<tag name>`)}`
      : listValues(rule.values);
    return {
      severity: 'error',
      code: 'invalid-value',
      message:
        `${name} must be ${rule.values.length > 1 || rule.prefix ? 'one of ' : ''}${allowed}; ` +
        `got ${quote(value)}. A run with this value fails.`,
    };
  }

  if (rule.kind === 'boolean') {
    if (rule.strict) {
      if (['true', 'false'].includes(value.toLowerCase())) return undefined;
      return {
        severity: 'error',
        code: 'invalid-value',
        message: `${name} must be "true" or "false"; got ${quote(value)}. A run with this value fails.`,
      };
    }
    if (value === 'true' || value === 'false') return undefined;
    return {
      severity: 'warning',
      code: 'invalid-value',
      message: `${name} is on only when it is exactly "true". ${quote(value)} is read as "false".`,
    };
  }

  if (rule.kind === 'integer') {
    const number = parseInt(value, 10);
    if (Number.isNaN(number)) {
      return {
        severity: 'error',
        code: 'invalid-value',
        message: `${name} must be a whole number; got ${quote(value)}.`,
      };
    }
    if (number < rule.min) {
      return {
        severity: 'warning',
        code: 'out-of-range',
        message: `${name} is below the smallest value, ${rule.min}, so ${rule.min} is used.`,
      };
    }
    if (rule.max !== undefined && number > rule.max) {
      return {
        severity: 'warning',
        code: 'out-of-range',
        message: `${name} is above the largest value, ${rule.max}, so ${rule.max} is used.`,
      };
    }
    if (!/^[+-]?\d+$/.test(value)) {
      return {
        severity: 'warning',
        code: 'invalid-value',
        message: `${name} must be a whole number. ${quote(value)} is read as ${number}.`,
      };
    }
    return undefined;
  }

  if (rule.kind === 'number') {
    const number = Number(value);
    if (Number.isFinite(number) && number >= rule.min && number <= rule.max) return undefined;
    return {
      severity: 'warning',
      code: 'out-of-range',
      message:
        `${name} must be a number from ${rule.min} to ${rule.max}; got ${quote(value)}. ` +
        'The action ignores it.',
    };
  }

  if (rule.kind === 'tags') {
    const unsafe = splitTagList(value).filter((pattern) => !isSafeTagPattern(pattern));
    if (unsafe.length === 0) return undefined;
    return {
      severity: 'error',
      code: 'invalid-value',
      message:
        `${name} has ${unsafe.length > 1 ? 'patterns' : 'a pattern'} the action does not ` +
        `support: ${unsafe.map(quote).join(', ')}. A pattern may use letters, digits and ` +
        '. _ / - plus the wildcards * ** ? + and [ ] character classes; ! negation is not ' +
        'supported. A run with this value fails.',
    };
  }

  return undefined;
}

/** The problems with one step, each as `{ start, end, severity, code, message }`. */
function checkStep(step, { tagFilters, unknownInputs }) {
  const problems = [];
  const at = (where, problem) => problems.push({ start: where.start, end: where.end, ...problem });
  const atValue = (input, problem) => at({ start: input.valueStart, end: input.valueEnd }, problem);

  // GitHub ignores letter case in an input's name. The last of a repeated
  // name is the one it keeps.
  const set = new Map(step.inputs.map((input) => [input.name.toLowerCase(), input]));
  /** The text of an input that is set to something the file spells out. */
  const literal = (name) => {
    const input = set.get(name);
    return input?.value !== undefined && !input.expression ? input.value.trim() : undefined;
  };
  /** True when an input is absent or empty, so the action uses its default. */
  const unset = (name) => !set.has(name) || literal(name) === '';
  const starterCode = literal('starter_code')?.toLowerCase();
  const previousWork = literal('previous_work');

  for (const input of step.inputs) {
    const name = input.name.toLowerCase();
    const known = Object.hasOwn(ACTION_INPUTS, name) ? ACTION_INPUTS[name] : undefined;
    if (!known) {
      if (!unknownInputs) continue;
      const meant = closestInput(input.name);
      at(input, {
        severity: 'warning',
        code: 'unknown-input',
        message: meant
          ? `GrillMyCode has no input ${quote(input.name)}, so GitHub ignores it. Did you mean ${quote(meant)}?`
          : `${quote(input.name)} is not an input this version of GrillMyCode Companion knows. ` +
            'GitHub ignores an input the action does not declare. If the input is new, ' +
            'update the extension.',
      });
      continue;
    }

    if (known.deprecated) {
      const ignored =
        name === 'include_initial_commit'
          ? starterCode
          : starterCode && previousWork !== undefined && previousWork !== '';
      at(input, {
        severity: 'warning',
        code: 'deprecated-input',
        deprecated: true,
        message:
          `${name} is deprecated and will be removed in the next major version. ` +
          `Use ${known.replacement} instead.` +
          (ignored ? ' It is ignored here, because its replacement is set.' : ''),
      });
      continue;
    }

    if (input.value === undefined) continue;

    if (known.secret && input.value.trim() !== '') {
      if (!input.expression) {
        atValue(input, {
          severity: 'warning',
          code: 'secret-in-workflow',
          message:
            `${name} looks like it is written into the workflow file, where everyone ` +
            'who can read the repository can read it. Store it as a secret and refer to it ' +
            'as ${{ secrets.NAME }}.',
        });
      } else if (INPUT_EXPRESSION_RE.test(input.value)) {
        atValue(input, {
          severity: 'warning',
          code: 'secret-in-workflow',
          message:
            `${name} is read from a workflow input, which GitHub records with the run ` +
            'as plain text. Store it as a secret and refer to it as ${{ secrets.NAME }}.',
        });
      }
    }

    if (input.expression) continue;
    const problem = checkValue(name, known, input.value);
    if (problem) atValue(input, problem);
  }

  // ── Inputs that depend on one another ─────────────────────────────────────

  // Where a problem with something that is missing is shown.
  const stepItself = step.with ?? step.uses;

  // A preview stops before the AI is called, so it alone needs no key.
  const preview =
    set.get('preview_only')?.expression || literal('preview_only')?.toLowerCase() === 'true';
  if (unset('api_key') && !preview) {
    at(set.get('api_key') ?? stepItself, {
      severity: 'error',
      code: 'missing-api-key',
      message:
        'api_key is not set. GrillMyCode writes its questions through OpenRouter, which ' +
        'needs its own API key, so the run fails. Only a preview_only run works without one.',
    });
  }

  if (literal('label_repos')?.toLowerCase() === 'true' && unset('instructor_repo_token')) {
    at(set.get('label_repos'), {
      severity: 'warning',
      code: 'needs-other-input',
      message:
        'label_repos needs instructor_repo_token, which is not set. The run writes no ' +
        'labels and warns about it.',
    });
  }

  const shareSet = set.has('starter_questions_one_in') && !unset('starter_questions_one_in');
  if (shareSet && (unset('starter_code') || (starterCode && starterCode !== 'ask'))) {
    at(set.get('starter_questions_one_in'), {
      severity: 'info',
      code: 'no-effect',
      message: 'starter_questions_one_in has no effect unless starter_code is "ask".',
    });
  }

  // Earlier work exists only when the assessed range starts after the first
  // commit: a tag run diffed from an earlier tag, or a base_sha.
  const diffBase = literal('tag_diff_base')?.toLowerCase();
  const fromEarlierTag = set.has('tag_diff_base') && diffBase !== '' && diffBase !== 'cumulative';
  if (set.has('previous_work') && !unset('previous_work') && !fromEarlierTag && unset('base_sha')) {
    at(set.get('previous_work'), {
      severity: 'info',
      code: 'no-effect',
      message:
        'previous_work has no effect here. A run has earlier work only when tag_diff_base ' +
        'is "previous-tag" or "tag:<tag name>", or base_sha is set.',
    });
  }

  // ── Submission tags ───────────────────────────────────────────────────────

  if (unset('submission_tags')) {
    if (tagFilters) {
      at(set.get('submission_tags') ?? stepItself, {
        severity: 'error',
        code: 'missing-submission-tags',
        message:
          'This workflow runs when a tag is pushed (on.push.tags), but submission_tags is not ' +
          'set, so every run started by a tag fails. List the same tag patterns in ' +
          'submission_tags.',
      });
    } else if (diffBase && diffBase !== 'cumulative') {
      at(set.get('tag_diff_base'), {
        severity: 'info',
        code: 'no-effect',
        message:
          'tag_diff_base applies only to a run started by a submission tag, and ' +
          'submission_tags is not set.',
      });
    }
  } else if (tagFilters && literal('submission_tags') !== undefined) {
    // The two are copies of one list. GitHub's own `!` entries have no
    // counterpart in submission_tags, so they are left out of the comparison.
    const listed = splitTagList(literal('submission_tags'));
    const filters = tagFilters.filter((filter) => !filter.startsWith('!'));
    const notListed = filters.filter((filter) => !listed.includes(filter));
    const notFiltered = listed.filter((pattern) => !filters.includes(pattern));
    if (notListed.length > 0) {
      atValue(set.get('submission_tags'), {
        severity: 'warning',
        code: 'tag-lists-differ',
        message:
          `submission_tags does not list ${listValues(notListed)}, which the workflow's ` +
          'on.push.tags does. A run started by a tag that matches no submission_tags ' +
          'entry fails. Keep the two lists the same.',
      });
    }
    if (notFiltered.length > 0) {
      atValue(set.get('submission_tags'), {
        severity: 'warning',
        code: 'tag-lists-differ',
        message:
          `submission_tags lists ${listValues(notFiltered)}, which the workflow's ` +
          'on.push.tags does not, so pushing a tag only that entry matches starts no run. ' +
          'Keep the two lists the same.',
      });
    }
  }

  return problems;
}

/**
 * Every problem found in a workflow file's text, in the order written. A file
 * with no GrillMyCode step has none.
 *
 * `unknownInputs: false` leaves out inputs the action does not declare, for
 * when something else in the editor already reports them.
 */
export function checkWorkflow(text, { unknownInputs = true } = {}) {
  const { steps, tagFilters } = readWorkflow(text);
  return steps
    .flatMap((step) => checkStep(step, { tagFilters, unknownInputs }))
    .sort((a, b) => a.start - b.start);
}
