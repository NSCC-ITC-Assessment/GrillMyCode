/**
 * Pure function: config state → GitHub Actions workflow YAML string.
 * Only emits inputs that differ from their defaults to keep output minimal.
 */

import { DISPATCH_OVERRIDES_BY_KEY, resolveDispatchOverrides } from './dispatchInputs';
import { splitPatternList } from './fileSelection';

/**
 * Normalises a pattern string that may use commas, newlines, or a mix as
 * delimiters. Returns a single comma-separated string with each entry trimmed
 * and empty entries removed. The list is split by the action's own code (see
 * fileSelection.js), so a comma inside braces stays with its pattern.
 */
function normalizePatterns(value) {
  return splitPatternList(value).join(', ');
}

/**
 * OpenRouter's routing variants: a suffix on the model ID that changes which of
 * the providers serving that model is tried first, without changing the model
 * itself. `nitro` sorts the endpoints by throughput and lets priority-tier
 * endpoints compete; `floor` sorts by price and lets discounted flex-tier
 * endpoints compete. Both keep OpenRouter's normal fallbacks.
 *
 * They are an OpenRouter feature, carried in the model ID rather than in an
 * action input, so a future non-OpenRouter provider is unaffected: the suffix is
 * only ever appended while ai_provider is openrouter.
 * https://openrouter.ai/docs/guides/routing/model-variants/overview
 */
export const MODEL_ROUTING_VARIANTS = ['nitro', 'floor'];

/**
 * The model ID as the workflow should request it: the chosen model plus the
 * routing variant, if any.
 *
 * A model the instructor typed with a variant already on it is left alone —
 * OpenRouter would let the last sorting suffix win, but `model:nitro:floor`
 * reads like a mistake in a workflow file someone else has to maintain.
 */
export function effectiveAiModel(cfg) {
  const model = (cfg.aiModel || '').trim();
  const variant = cfg.aiModelVariant || '';
  if (!model || !variant || cfg.aiProvider !== 'openrouter') return model;
  if (MODEL_ROUTING_VARIANTS.some((v) => model.endsWith(`:${v}`))) return model;
  return `${model}:${variant}`;
}

/**
 * Instructor repository delivery works only in Classroom 50 assignment
 * repositories — the action identifies the assignment and student from Classroom
 * 50's repository naming — so it counts as enabled only once the user has
 * confirmed they use Classroom 50. This also covers ticking the checkbox and then
 * switching that answer to "No". Shared with the Review step's checklist.
 */
/**
 * Whether a run can have earlier work — the student's own code from before the
 * assessed range — which only a base later than the first commit leaves: a tag
 * run diffed from an earlier tag, or a base_sha override. previous_work has no
 * effect otherwise, so it is neither offered nor emitted.
 */
export function hasEarlierWork(cfg) {
  return (isTagTrigger(cfg) && (cfg.tagDiffBase || 'cumulative') !== 'cumulative') || Boolean(cfg.baseSha);
}

/** Smallest starter_questions_one_in, as MIN_STARTER_QUESTIONS_ONE_IN in src/constants.js. */
export const MIN_STARTER_QUESTIONS_ONE_IN = 2;

/**
 * How many questions may be about starter code alone under starter_code: ask,
 * as maxStarterQuestions in src/prompt/prompt.js: one in starterQuestionsOneIn,
 * rounded down, but at least one once there are two questions.
 */
export function maxStarterQuestions(cfg) {
  if (cfg.numQuestions < 2) return 0;
  return Math.max(1, Math.floor(cfg.numQuestions / cfg.starterQuestionsOneIn));
}

/**
 * Validation message for the Questions step's starter question share, or ''.
 * It is asked only under starter_code: ask with two or more questions, and
 * runs from MIN_STARTER_QUESTIONS_ONE_IN to the number of questions, where it
 * allows one.
 */
export function starterQuestionsOneInError(cfg) {
  if (cfg.starterCode !== 'ask' || cfg.numQuestions < 2) return '';
  const n = cfg.starterQuestionsOneIn;
  if (!Number.isInteger(n) || n < MIN_STARTER_QUESTIONS_ONE_IN || n > cfg.numQuestions) {
    return `Enter a whole number from ${MIN_STARTER_QUESTIONS_ONE_IN} to ${cfg.numQuestions}, the number of questions.`;
  }
  return '';
}

/** Largest starter_questions_one_in the action accepts: MAX_QUESTIONS in src/constants.js. */
export const MAX_STARTER_QUESTIONS_ONE_IN = 50;

/**
 * Validation message for the starter code share set on the Manual runs step,
 * or ''. That field appears only when the share is a dispatch override and the
 * starter code answer isn't ask, so it is only the run form's pre-filled value:
 * the run may also change the number of questions, so it is checked against
 * the action's own range rather than the number of questions.
 */
export function starterShareDefaultError(cfg) {
  const n = cfg.starterQuestionsOneIn;
  if (!Number.isInteger(n) || n < MIN_STARTER_QUESTIONS_ONE_IN || n > MAX_STARTER_QUESTIONS_ONE_IN) {
    return `Enter a whole number from ${MIN_STARTER_QUESTIONS_ONE_IN} to ${MAX_STARTER_QUESTIONS_ONE_IN} for the starter code question share.`;
  }
  return '';
}

/** Whether the starter code answer sends starter code as codebase context. */
export function sendsStarterContext(cfg) {
  return cfg.starterCode === 'context' || cfg.starterCode === 'ask';
}

/**
 * Whether the run sends any codebase context, and so whether its size limit
 * matters: starter code under context or ask, or earlier work where there is
 * any. Shared with codebaseLimitStep, which shows the limit only then.
 */
export function sendsCodebaseContext(cfg) {
  return sendsStarterContext(cfg) || (cfg.previousWork === 'context' && hasEarlierWork(cfg));
}

export function instructorRepoActive(cfg) {
  return cfg.usesClassroom50 === true && cfg.instructorRepoEnabled;
}

// ── Submission tags ──────────────────────────────────────────────────────────

/** True when the workflow is triggered by submission tags rather than pushes. */
export function isTagTrigger(cfg) {
  return cfg.triggerEvent === 'tag+workflow_dispatch';
}

/**
 * The tag patterns the workflow fires on, in the order the instructor listed
 * them — order is kept because the action files an overlapping tag under the
 * first pattern it matches.
 */
export function submissionTagList(cfg) {
  const typed = (cfg.submissionTags || '')
    .split(/[,\r\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return [...new Set(typed)];
}

// Mirrors isSafeTagPattern in the action's src/tags.js — the action rejects
// anything else, so the wizard must not emit it. Keep the two in step.
const TAG_PATTERN_CHARSET_RE = /^[A-Za-z0-9._/*?+[\]-]+$/;
const STACKED_QUANTIFIER_RE = /^[?+]|[*?+]\+/;

/** Patterns from the instructor's list that the action would reject. */
export function invalidSubmissionTags(cfg) {
  return submissionTagList(cfg).filter(
    (p) => !TAG_PATTERN_CHARSET_RE.test(p) || STACKED_QUANTIFIER_RE.test(p),
  );
}

// Mirrors isSafeTagName in the action's src/tags.js, for tag_diff_base's
// "tag:<name>" form. Keep the two in step.
const TAG_NAME_RE = /^[A-Za-z0-9._][A-Za-z0-9._/-]*$/;

/**
 * Why the "tag:<name>" diff base cannot be emitted, or '' when it can (or when
 * another mode is chosen). The action fails every run on a bad name.
 */
export function namedDiffBaseTagError(cfg) {
  const value = cfg.tagDiffBase || '';
  if (!value.startsWith('tag:')) return '';
  const name = value.slice('tag:'.length);
  if (!name) return 'Please enter the tag to compare against before continuing.';
  if (!TAG_NAME_RE.test(name) || name.includes('..') || name.endsWith('/')) {
    return `"${name}" is not a usable tag name. Use letters, digits and . _ / - with no wildcards.`;
  }
  return '';
}

/**
 * OpenRouter's temperature range; the action ignores anything outside it.
 * Mirrors AI_TEMPERATURE_MIN / AI_TEMPERATURE_MAX in src/constants.js. The
 * Wizard accepts at most two decimal places (#.##), and its box steps by
 * TEMPERATURE_STEP; finer values imply a precision no model documents, though
 * the action accepts them.
 */
export const TEMPERATURE_MIN = 0;
export const TEMPERATURE_MAX = 2;
export const TEMPERATURE_STEP = 0.01;

/** A plain decimal with at most two places: 1, 0.7, 0.75, .5 — no exponents. */
const TEMPERATURE_FORMAT_RE = /^(\d+(\.\d{0,2})?|\.\d{1,2})$/;

/**
 * Validation message for the AI step's temperature box, or '' when it is fine.
 * A temperature is only emitted once the instructor opts in, so an unticked box
 * is never an error; a ticked one must hold a number in range.
 */
export function temperatureError(cfg) {
  if (!cfg.aiTemperatureEnabled) return '';
  const raw = String(cfg.aiTemperature ?? '').trim();
  if (!raw) {
    return `Enter a temperature from ${TEMPERATURE_MIN} to ${TEMPERATURE_MAX}, or untick "Set a temperature" to let the model use its own.`;
  }
  // The format is checked on the text as typed, not on the parsed number, so
  // floating-point rounding can't make 0.07 look like it has more places.
  const value = Number(raw);
  if (!TEMPERATURE_FORMAT_RE.test(raw) || value < TEMPERATURE_MIN || value > TEMPERATURE_MAX) {
    return `Temperature must be from ${TEMPERATURE_MIN} to ${TEMPERATURE_MAX} with at most two decimal places, such as 0.75.`;
  }
  return '';
}

export const DEFAULTS = {
  aiProvider: 'openrouter',
  // Compared against the resolved model (base + routing variant), so choosing a
  // variant on the default model counts as a change and emits the input.
  aiModel: 'google/gemini-3.5-flash-lite',
  aiModelVariant: '',
  aiReasoningEffort: 'default',
  aiRetryMaxAttempts: 5,
  numQuestions: 20,
  questionEmphasis: 'balanced',
  includeAnswers: false,
  instructorContext: '',
  assignmentContext: '',
  assignmentContextMaxChars: 20000,
  excludePatternOverrides: '',
  additionalExcludePatterns: '',
  keepComments: false,
  starterCode: 'ignore',
  starterQuestionsOneIn: 5,
  previousWork: 'context',
  codebaseContextMaxChars: 50000,
  skipCommitters: 'github-actions[bot]',
  instructorRepoEnabled: false,
  labelRepos: false,
  tagDiffBase: 'cumulative',
  baseSha: '',
  headSha: '',
};

function differ(cfg, key) {
  return cfg[key] !== DEFAULTS[key];
}

function yamlStr(val) {
  // Wrap in double quotes; escape any internal double quotes.
  return `"${String(val).replace(/"/g, '\\"')}"`;
}

function secretRef(name) {
  return `\${{ secrets.${name} }}`;
}

// ── workflow_dispatch overrides ──────────────────────────────────────────────

/** Single-quoted YAML scalar. Inside single quotes YAML escapes ' by doubling. */
function yamlSingle(val) {
  return `'${String(val).replace(/'/g, "''")}'`;
}

/**
 * Collapses a value to the single line that both a dispatch input default and a
 * GitHub expression string literal are limited to. Applies the pattern
 * normaliser for the comma/newline-delimited inputs.
 *
 * Inputs carrying an `envFallback` never reach here with a multi-line value —
 * usesEnvFallback routes those to a job-level env var instead, so nothing is
 * silently flattened.
 */
function overrideValue(cfg, meta) {
  const raw = cfg[meta.cfgKey];
  const str = raw === undefined || raw === null ? '' : String(raw);
  const value = meta.normalize ? normalizePatterns(str) : str;
  return value.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * True when this override's default must live in a job-level env var rather
 * than inline in the expression — i.e. it declares an envFallback and its value
 * actually spans multiple lines, which neither a dispatch `default:` nor an
 * expression string literal can hold.
 *
 * A single-line value needs none of this and is inlined like any other input.
 */
function usesEnvFallback(cfg, meta) {
  if (!meta.envFallback) return false;
  const raw = cfg[meta.cfgKey];
  return typeof raw === 'string' && raw.trim() !== '' && /\r?\n/.test(raw.trim());
}

/**
 * The `with:` value for an overridden input.
 *
 * Uses `github.event.inputs.*` rather than the `inputs` context deliberately.
 * `inputs` hands back a real boolean for a boolean-typed dispatch input, and
 * `false || 'true'` would then silently substitute the fallback for a value the
 * instructor explicitly chose. `github.event.inputs.*` is always a string, and
 * GitHub casts the non-empty string 'false' to true, so the `||` fallback fires
 * only when the key is genuinely absent — i.e. on a non-dispatch run. Boolean
 * inputs are declared as `type: choice` below for the same reason.
 *
 * The whole expression is double-quoted so a fallback containing ': ' or a
 * leading special character cannot break the YAML.
 */
function dispatchExpr(key, fallback, { envVar = null } = {}) {
  if (envVar) {
    // env is available in a step's `with:`, so a multi-line default can be held
    // in a block scalar and referenced here without being flattened.
    return `"\${{ github.event.inputs.${key} || env.${envVar} }}"`;
  }
  const literal = String(fallback).replace(/'/g, "''").replace(/"/g, '\\"');
  return `"\${{ github.event.inputs.${key} || '${literal}' }}"`;
}

/** The `on.workflow_dispatch.inputs:` block for the selected override keys. */
function dispatchInputLines(cfg, overrideKeys) {
  const lines = [];
  lines.push('    # Manual-run overrides. Starting this workflow from the Actions tab');
  lines.push('    # shows a form pre-filled with these defaults; anything changed there');
  lines.push('    # applies to that run only. Any run that supplies no value — a cleared');
  lines.push('    # field, or any automatic trigger — uses the fallback baked into the');
  lines.push("    # matching `${{ ... || '...' }}` expression below.");
  lines.push('    #');
  lines.push('    # Keep each default here in sync with its fallback below — they are the');
  lines.push('    # same value in two places, and if they drift, clearing a field on the');
  lines.push('    # form stops matching what leaving it at its default does.');
  lines.push('    inputs:');
  overrideKeys.forEach((key) => {
    const meta = DISPATCH_OVERRIDES_BY_KEY[key];
    const value = overrideValue(cfg, meta);
    lines.push(`      ${key}:`);
    // The Run workflow form labels each field with its description alone — the
    // input name is never shown — so prefix it, or an instructor faced with two
    // similar-sounding fields cannot tell which action input they are editing.
    lines.push(`        description: ${yamlSingle(`${key} - ${meta.description}`)}`);
    if (meta.type === 'boolean') {
      // Declared as choice, not boolean — see dispatchExpr for why.
      lines.push('        type: choice');
      lines.push("        options: ['false', 'true']");
      lines.push(`        default: ${yamlSingle(value === 'true' ? 'true' : 'false')}`);
    } else if (meta.type === 'choice') {
      // A value outside the fixed options — tag_diff_base's "tag:<name>" form —
      // is offered as an extra option rather than dropped, so the form's
      // default still matches what an automatic run uses.
      const options = meta.options.includes(value) || !value ? meta.options : [...meta.options, value];
      lines.push('        type: choice');
      lines.push(`        options: [${options.map(yamlSingle).join(', ')}]`);
      lines.push(`        default: ${yamlSingle(options.includes(value) ? value : options[0])}`);
    } else {
      lines.push('        required: false');
      lines.push(`        default: ${yamlSingle(value)}`);
    }
  });
  return lines;
}

export function generateYaml(inputCfg, { actionRef = 'v0' } = {}) {
  // The routing variant is part of the model ID everywhere it is emitted — the
  // input, the commented-out default and the dispatch-input default — so it is
  // folded in once, here, rather than at each use.
  const cfg = { ...inputCfg, aiModel: effectiveAiModel(inputCfg) };
  const lines = [];

  const tagTrigger = isTagTrigger(cfg);
  const overrideKeys = resolveDispatchOverrides(cfg.dispatchOverrides, {
    tagTrigger,
    emptyRepo: cfg.repoStart === 'empty',
    starterAsk: cfg.starterCode === 'ask',
    enabled: cfg.dispatchOverridesEnabled === true,
  });
  const overridden = new Set(overrideKeys);

  /**
   * Emits one action input under `with:`.
   *
   * An overridden key is always emitted, even when its value matches the action
   * default — the expression is the only thing wiring the dispatch input to the
   * action, so omitting it as "same as default" would silently discard the
   * override. Non-overridden keys keep the existing minimal-output behaviour.
   */
  function pushInput(actionKey, cfgKey, rendered) {
    if (overridden.has(actionKey)) {
      const meta = DISPATCH_OVERRIDES_BY_KEY[actionKey];
      const envVar = usesEnvFallback(cfg, meta) ? meta.envFallback : null;
      lines.push(
        `          ${actionKey}: ${dispatchExpr(actionKey, overrideValue(cfg, meta), { envVar })}`,
      );
      return true;
    }
    if (differ(cfg, cfgKey)) {
      lines.push(`          ${actionKey}: ${rendered}`);
      return true;
    }
    return false;
  }

  // ── name ───────────────────────────────────────────────────────────────────
  lines.push('name: GrillMyCode');
  lines.push('');

  // ── on ────────────────────────────────────────────────────────────────────
  lines.push('on:');

  const hasPush = cfg.triggerEvent === 'push+workflow_dispatch';
  const dynamicBranch = hasPush && cfg.branchMode === 'default';

  if (hasPush) {
    lines.push('  push:');
    if (!dynamicBranch) {
      const branches =
        cfg.pushBranches && cfg.pushBranches.length > 0 ? cfg.pushBranches : ['main', 'master'];
      lines.push(`    branches: [${branches.map((b) => `"${b}"`).join(', ')}]`);
    }
  }

  if (tagTrigger) {
    // Only tags fire the workflow — no branches: line, so an ordinary push
    // never starts a run. Keep this list identical to submission_tags below.
    lines.push('  push:');
    lines.push(`    tags: [${submissionTagList(cfg).map((t) => `"${t}"`).join(', ')}]`);
  }

  lines.push('  workflow_dispatch:');
  if (overrideKeys.length > 0) {
    dispatchInputLines(cfg, overrideKeys).forEach((l) => lines.push(l));
  }

  lines.push('');

  // ── concurrency ─────────────────────────────────────────────────────────────
  // Kept identical to the concurrency comment used by every workflow example in
  // the docs, so a wizard-generated file and a copied example look the same.
  if (tagTrigger) {
    lines.push('# Re-pushing a tag cancels any run still in progress for that tag,');
    lines.push('# so only its latest commit is ever assessed (see FAQ).');
  } else {
    lines.push('# A new push cancels any run still in progress for the same branch,');
    lines.push('# so only the latest commit is ever assessed (see FAQ).');
  }
  lines.push('# Do not modify this setting unless you have a compelling reason to.');
  lines.push('concurrency:');
  lines.push('  group: grillmycode-${{ github.workflow }}-${{ github.ref }}');
  lines.push('  cancel-in-progress: true');
  lines.push('');

  // ── jobs ──────────────────────────────────────────────────────────────────
  lines.push('jobs:');
  lines.push('  generate-questions:');
  if (dynamicBranch) {
    lines.push(
      `    if: github.event_name == 'workflow_dispatch' || github.ref == format('refs/heads/{0}', github.event.repository.default_branch)`,
    );
  }
  lines.push('    runs-on: ubuntu-latest');
  lines.push('    timeout-minutes: 15');

  // permissions
  lines.push('    permissions:');
  lines.push('      contents: write  # gmc-assessments release + PDF asset');
  lines.push('      issues: write    # assessment issue');

  // ── env (multi-line dispatch defaults) ─────────────────────────────────────
  // GitHub has no multi-line workflow_dispatch input, and an expression string
  // literal cannot contain newlines either — so a multi-line default is held
  // here as a block scalar and referenced from the step's `with:` (the env
  // context is available there). Leaving the dispatch input blank falls back to
  // this value with its formatting intact.
  const envDefaults = overrideKeys
    .map((key) => DISPATCH_OVERRIDES_BY_KEY[key])
    .filter((meta) => usesEnvFallback(cfg, meta));
  if (envDefaults.length > 0) {
    lines.push('    env:');
    envDefaults.forEach((meta) => {
      lines.push(`      # Canonical default for "${meta.key}", used by every automatic run`);
      lines.push(`      # and by a manual run that clears the field. The dispatch form prefills`);
      lines.push(`      # the same text collapsed to one line (GitHub has no multi-line input),`);
      lines.push(`      # so a manual run submitted as-is sends that single-line form. Edit both`);
      lines.push(`      # if you change the wording.`);
      lines.push(`      ${meta.envFallback}: |`);
      String(cfg[meta.cfgKey])
        .replace(/\s+$/, '')
        .split('\n')
        .forEach((l) => lines.push(`        ${l}`));
    });
  }

  lines.push('    steps:');
  lines.push('      - uses: actions/checkout@v6');
  lines.push('        with:');
  lines.push('          fetch-depth: 0    # full history required for diff resolution');
  lines.push('');
  lines.push(`      - uses: NSCC-ITC-Assessment/GrillMyCode@${actionRef}`);
  lines.push('        with:');

  // ── Authentication ─────────────────────────────────────────────────────────
  // Both credentials are emitted together so they read as a pair in the copied
  // file. api_key is always emitted: OpenRouter requires it and the action
  // fails without it.
  lines.push('          github_token: ${{ secrets.GITHUB_TOKEN }}');
  {
    const secretName = cfg.apiKeySecret || 'OPENROUTER_API_KEY';
    lines.push(`          api_key: ${secretRef(secretName)}`);
  }

  // ── AI Provider ────────────────────────────────────────────────────────────
  if (differ(cfg, 'aiProvider')) {
    lines.push(`          ai_provider: ${yamlStr(cfg.aiProvider)}`);
  }
  if (!pushInput('ai_model', 'aiModel', yamlStr(cfg.aiModel))) {
    // The model is the input instructors are most likely to revisit later, so
    // keep it visible even when it matches the default — commented out, so
    // uncommenting the line is the only edit needed to switch models.
    lines.push(`          # If desired, uncomment this input and edit to use a different one —`);
    lines.push(`          # any model from https://openrouter.ai/models (provider/model-name).`);
    lines.push(`          # ai_model: ${yamlStr(cfg.aiModel)}`);
  }
  pushInput('ai_reasoning_effort', 'aiReasoningEffort', yamlStr(cfg.aiReasoningEffort));
  // Opt-in only: an unticked box emits nothing, so the model runs at its own
  // temperature, whatever was typed before the box was unticked.
  if (cfg.aiTemperatureEnabled && !temperatureError(cfg)) {
    lines.push(`          ai_temperature: ${yamlStr(Number(String(cfg.aiTemperature).trim()))}`);
  }
  if (differ(cfg, 'aiRetryMaxAttempts')) {
    lines.push(`          ai_retry_max_attempts: ${yamlStr(cfg.aiRetryMaxAttempts)}`);
  }

  // ── Question generation ────────────────────────────────────────────────────
  pushInput('num_questions', 'numQuestions', yamlStr(cfg.numQuestions));
  pushInput('question_emphasis', 'questionEmphasis', yamlStr(cfg.questionEmphasis));
  pushInput('include_answers', 'includeAnswers', yamlStr(cfg.includeAnswers));
  // Normalised on the way out like the other glob-list inputs, so a value typed
  // with newlines emits as the comma-separated form the action parses.
  pushInput(
    'assignment_context',
    'assignmentContext',
    yamlStr(normalizePatterns(cfg.assignmentContext)),
  );
  if (differ(cfg, 'assignmentContextMaxChars')) {
    lines.push(`          assignment_context_max_chars: ${yamlStr(cfg.assignmentContextMaxChars)}`);
  }
  if (overridden.has('instructor_context')) {
    // A dispatch form field and an expression literal are both single-line, so
    // the multi-line block scalar cannot be used here — overrideValue has
    // already collapsed the context to one line.
    pushInput('instructor_context', 'instructorContext', null);
  } else if (cfg.instructorContext && differ(cfg, 'instructorContext')) {
    lines.push('          instructor_context: |');
    cfg.instructorContext.split('\n').forEach((l) => {
      lines.push(`            ${l}`);
    });
  }

  // ── File filtering ─────────────────────────────────────────────────────────
  if (overridden.has('exclude_pattern_overrides') || cfg.excludePatternOverrides) {
    pushInput(
      'exclude_pattern_overrides',
      'excludePatternOverrides',
      yamlStr(normalizePatterns(cfg.excludePatternOverrides)),
    );
  }
  if (overridden.has('additional_exclude_patterns') || cfg.additionalExcludePatterns) {
    pushInput(
      'additional_exclude_patterns',
      'additionalExcludePatterns',
      yamlStr(normalizePatterns(cfg.additionalExcludePatterns)),
    );
  }
  pushInput('keep_comments', 'keepComments', yamlStr(cfg.keepComments));
  pushInput('starter_code', 'starterCode', yamlStr(cfg.starterCode));
  // Also emitted when starter_code is a dispatch override, so a manual run
  // that switches to ask still gets the share the instructor configured.
  if (cfg.starterCode === 'ask' || overridden.has('starter_code')) {
    pushInput('starter_questions_one_in', 'starterQuestionsOneIn', yamlStr(cfg.starterQuestionsOneIn));
  }
  if (hasEarlierWork(cfg)) pushInput('previous_work', 'previousWork', yamlStr(cfg.previousWork));
  // Also emitted when starter_code is a dispatch override, so a manual run
  // that switches context on still gets the limit the instructor configured.
  if (
    (sendsCodebaseContext(cfg) || overridden.has('starter_code')) &&
    differ(cfg, 'codebaseContextMaxChars')
  ) {
    lines.push(`          codebase_context_max_chars: ${yamlStr(cfg.codebaseContextMaxChars)}`);
  }
  if (differ(cfg, 'skipCommitters')) {
    lines.push(`          skip_committers: ${yamlStr(cfg.skipCommitters)}`);
  }

  // ── Instructor repository ──────────────────────────────────────────────────
  if (instructorRepoActive(cfg)) {
    const tokenSecret = cfg.instructorRepoTokenSecret || 'INSTRUCTOR_REPO_TOKEN';
    lines.push('          # Classroom 50 assignment repositories only — any other repository');
    lines.push('          # skips instructor repository delivery with a warning.');
    lines.push(`          instructor_repo_token: ${secretRef(tokenSecret)}`);

    // Emitted inside the instructor block because the label writes to
    // repository metadata, which is out of reach of GITHUB_TOKEN — it shares
    // this PAT. Without instructor delivery there is no token to write with,
    // so the action writes no labels whatever the input says. Off in the
    // action and ticked in the Wizard, so a Wizard-built workflow carries it.
    if (differ(cfg, 'labelRepos')) {
      lines.push('          # Adds a grillmycode topic and the question count to the student');
      lines.push("          # repository's description. Uses the PAT above, not GITHUB_TOKEN.");
      lines.push(`          label_repos: ${yamlStr(cfg.labelRepos)}`);
    }
  }

  // ── Submission tags ────────────────────────────────────────────────────────
  if (tagTrigger) {
    lines.push('          # Must list the same patterns as on.push.tags above — a tag that');
    lines.push('          # fires the workflow but is missing here fails the run.');
    lines.push(`          submission_tags: ${yamlStr(submissionTagList(cfg).join(', '))}`);
    pushInput('tag_diff_base', 'tagDiffBase', yamlStr(cfg.tagDiffBase));
  }

  // ── SHA overrides ──────────────────────────────────────────────────────────
  // Deliberately not exposed as workflow_dispatch inputs — see dispatchInputs.js
  // for why. Set on the Advanced step, each is emitted independently: the action
  // applies either override on its own, so gating them as a pair silently
  // dropped a lone base_sha or head_sha from the generated file.
  if (cfg.baseSha) {
    lines.push(`          base_sha: ${yamlStr(cfg.baseSha)}`);
  }
  if (cfg.headSha) {
    lines.push(`          head_sha: ${yamlStr(cfg.headSha)}`);
  }

  return lines.join('\n');
}
