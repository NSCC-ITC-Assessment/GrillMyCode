// Writes what the VS Code extension knows about the action's inputs to
// extensions/vscode/src/shared/action-inputs.js, so its workflow help
// (completion, hover text and checks in a workflow file) describes the inputs
// the action declares, not a second list kept by hand.
//
// Each input's description, default and required flag come from action.yml.
// What a value may be comes from RULES below, which names the constants
// src/inputs.js reads the input with.
//
// Run after changing an input in action.yml, a constant named below, or how
// src/inputs.js reads an input:
//   node scripts/build-extension-action-inputs.js
//
// A test checks the committed file against action.yml and src/constants.js.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { format, resolveConfig } from 'prettier';
import { parse } from 'yaml';
import {
  AI_REASONING_EFFORTS,
  AI_TEMPERATURE_MAX,
  AI_TEMPERATURE_MIN,
  DEFAULT_AI_PROVIDER,
  DEFAULT_PREVIOUS_WORK,
  DEFAULT_STARTER_CODE,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  MIN_STARTER_QUESTIONS_ONE_IN,
  PREVIOUS_WORK_MODES,
  QUESTION_EMPHASIS_MODES,
  STARTER_CODE_MODES,
  TAG_DIFF_BASE_MODES,
  TAG_DIFF_BASE_NAMED_PREFIX,
} from '../src/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ACTION_PATH = join(__dirname, '..', 'action.yml');
export const OUT_PATH = join(
  __dirname,
  '..',
  'extensions',
  'vscode',
  'src',
  'shared',
  'action-inputs.js',
);

const BANNER = `// GENERATED FILE — do not edit. This is what action.yml declares for each
// input, with what src/inputs.js accepts for it. To change it, edit those files
// and run: node scripts/build-extension-action-inputs.js

`;

/**
 * The smallest value src/inputs.js accepts for ai_retry_max_attempts,
 * assignment_context_max_chars and codebase_context_max_chars. It clamps a
 * lower one to this.
 */
const MIN_COUNT = 1;

/**
 * What src/inputs.js accepts for each input that is more than free text. An
 * input with no entry is not checked. `kind` is one of:
 *
 *   enum      one of `values`, in any letter case unless `caseSensitive`.
 *             Anything else fails the run. `prefix` also allows that prefix
 *             followed by a tag name.
 *   boolean   "true" or "false". `strict` says anything else fails the run;
 *             otherwise anything but "true" is read as false.
 *   integer   a whole number, clamped to `min` and `max`.
 *   number    a number from `min` to `max`. Anything else is ignored.
 *   tags      a list of submission tag patterns.
 *
 * Beside those: `default` is the value used when the input is empty, where
 * action.yml's own default is empty; `secret` marks an input that must not be
 * written into the workflow; `replacement` is what a deprecated input's
 * warning says to use instead; and `hidden` keeps an input out of completion.
 */
const RULES = {
  github_token: { secret: true },
  api_key: { secret: true },
  instructor_repo_token: { secret: true },
  // The provider switch in src/ai.js has one case.
  ai_provider: { kind: 'enum', values: [DEFAULT_AI_PROVIDER], caseSensitive: true },
  ai_reasoning_effort: { kind: 'enum', values: AI_REASONING_EFFORTS },
  ai_temperature: { kind: 'number', min: AI_TEMPERATURE_MIN, max: AI_TEMPERATURE_MAX },
  ai_retry_max_attempts: { kind: 'integer', min: MIN_COUNT },
  num_questions: { kind: 'integer', min: MIN_QUESTIONS, max: MAX_QUESTIONS },
  question_emphasis: { kind: 'enum', values: QUESTION_EMPHASIS_MODES },
  include_answers: { kind: 'boolean' },
  label_repos: { kind: 'boolean', strict: true },
  assignment_context_max_chars: { kind: 'integer', min: MIN_COUNT },
  starter_code: { kind: 'enum', values: STARTER_CODE_MODES, default: DEFAULT_STARTER_CODE },
  starter_questions_one_in: {
    kind: 'integer',
    min: MIN_STARTER_QUESTIONS_ONE_IN,
    max: MAX_QUESTIONS,
  },
  previous_work: { kind: 'enum', values: PREVIOUS_WORK_MODES, default: DEFAULT_PREVIOUS_WORK },
  include_initial_commit: { kind: 'boolean', replacement: 'starter_code: none' },
  include_codebase_context: {
    kind: 'boolean',
    replacement: 'starter_code: context and previous_work',
  },
  codebase_context_max_chars: { kind: 'integer', min: MIN_COUNT },
  fail_on_empty_assessment: { kind: 'boolean' },
  preview_only: { kind: 'boolean', strict: true },
  keep_comments: { kind: 'boolean' },
  submission_tags: { kind: 'tags' },
  tag_diff_base: {
    kind: 'enum',
    values: TAG_DIFF_BASE_MODES,
    prefix: TAG_DIFF_BASE_NAMED_PREFIX,
  },
  log_prompt: { hidden: true },
};

/** How action.yml marks an input that is on its way out. */
const DEPRECATED_RE = /^Deprecated:/;

/** A folded description as one paragraph per blank line, each on one line. */
function tidy(description) {
  return String(description ?? '')
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .join('\n\n');
}

/** What action-inputs.js exports, for the text of an action.yml. */
export function buildActionInputs(actionYaml) {
  const declared = parse(actionYaml).inputs;
  const unknown = Object.keys(RULES).filter((name) => !(name in declared));
  if (unknown.length > 0) {
    throw new Error(`RULES names inputs action.yml does not declare: ${unknown.join(', ')}`);
  }
  const inputs = {};
  for (const [name, input] of Object.entries(declared)) {
    const description = tidy(input.description);
    const { default: fallback, ...rule } = RULES[name] ?? {};
    // github_token's default is an expression, which says nothing as a value.
    const written = String(input.default ?? '');
    const defaultValue = fallback ?? (written.includes('${{') ? '' : written);
    inputs[name] = {
      description,
      default: defaultValue,
      required: input.required === true,
      ...(DEPRECATED_RE.test(description) ? { deprecated: true } : {}),
      ...rule,
    };
  }
  return inputs;
}

// Run directly (not imported by the test): write the file, formatted as
// `pnpm format:check` expects it.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const built = buildActionInputs(readFileSync(ACTION_PATH, 'utf-8'));
  const source = `${BANNER}export const ACTION_INPUTS = ${JSON.stringify(built)};\n`;
  const options = await resolveConfig(OUT_PATH);
  writeFileSync(OUT_PATH, await format(source, { ...options, filepath: OUT_PATH }));
  console.log(`Wrote ${OUT_PATH} (${Object.keys(built).length} inputs)`);
}
