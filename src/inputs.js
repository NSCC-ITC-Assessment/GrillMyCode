/**
 * Input Handling
 *
 * Reads and normalises all INPUT_* environment variables set by the GitHub
 * Action. Responsible for parsing, applying defaults, and clamping values
 * to valid ranges.
 */

import * as core from '@actions/core';
import {
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  DEFAULT_ASSIGNMENT_CONTEXT_MAX_CHARS,
  DEFAULT_CODEBASE_CONTEXT_MAX_CHARS,
  DEFAULT_AI_RETRY_MAX_ATTEMPTS,
  DEFAULT_AI_REASONING_EFFORT,
  AI_REASONING_EFFORTS,
  AI_TEMPERATURE_MIN,
  AI_TEMPERATURE_MAX,
  DEFAULT_NUM_QUESTIONS,
  DEFAULT_AI_PROVIDER,
  DEFAULT_AI_MODEL,
  DEFAULT_TAG_DIFF_BASE,
  TAG_DIFF_BASE_MODES,
  TAG_DIFF_BASE_NAMED_PREFIX,
  DEFAULT_LABEL_REPOS,
  DEFAULT_LOG_PROMPT,
  DEFAULT_QUESTION_EMPHASIS,
  QUESTION_EMPHASIS_MODES,
  STARTER_CODE_MODES,
  DEFAULT_STARTER_CODE,
  PREVIOUS_WORK_MODES,
  DEFAULT_PREVIOUS_WORK,
  DEFAULT_STARTER_QUESTIONS_ONE_IN,
  MIN_STARTER_QUESTIONS_ONE_IN,
} from './constants.js';
import { isSafeTagName, isSafeTagPattern } from './tags.js';

/**
 * Parses submission_tags. Accepts commas, newlines or both as separators, since
 * the natural way to write a tag list in YAML is one per line.
 *
 * A pattern outside the supported filter syntax is a configuration error, not
 * something to drop quietly: this list must agree with the workflow's
 * `on.push.tags`, and silently ignoring an entry would fail every tag run it
 * should have matched with a less useful message.
 */
function readSubmissionTags() {
  const patterns = (core.getInput('submission_tags') || '')
    .split(/[,\r\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const unsafe = patterns.filter((p) => !isSafeTagPattern(p));
  if (unsafe.length > 0) {
    throw new Error(
      `submission_tags contains unsupported pattern(s): ${unsafe.join(', ')}. Patterns may use ` +
        'letters, digits and . _ / - plus the wildcards * ** ? + and [ ] character classes; ' +
        '! negation is not supported.',
    );
  }
  return patterns;
}

/**
 * Reads tag_diff_base: one of TAG_DIFF_BASE_MODES, or "tag:<name>" naming the
 * tag to diff from. The mode is case-insensitive; the tag name is not, because
 * git tag names are case-sensitive. Returned as the mode, or as the prefix plus
 * the name exactly as written.
 */
function readTagDiffBase() {
  const raw = (core.getInput('tag_diff_base') || DEFAULT_TAG_DIFF_BASE).trim();
  if (raw.toLowerCase().startsWith(TAG_DIFF_BASE_NAMED_PREFIX)) {
    const name = raw.slice(TAG_DIFF_BASE_NAMED_PREFIX.length).trim();
    if (!isSafeTagName(name)) {
      throw new Error(
        `tag_diff_base "${raw}" does not name a usable tag. Write it as ` +
          `"${TAG_DIFF_BASE_NAMED_PREFIX}<tag name>", e.g. "${TAG_DIFF_BASE_NAMED_PREFIX}phase1"; ` +
          'the name may use letters, digits and . _ / - but no wildcards.',
      );
    }
    return `${TAG_DIFF_BASE_NAMED_PREFIX}${name}`;
  }
  const value = raw.toLowerCase();
  if (!TAG_DIFF_BASE_MODES.includes(value)) {
    throw new Error(
      `tag_diff_base must be one of ${TAG_DIFF_BASE_MODES.map((m) => `"${m}"`).join(', ')}, ` +
        `or "${TAG_DIFF_BASE_NAMED_PREFIX}<tag name>"; got "${value}".`,
    );
  }
  return value;
}

/**
 * Reads label_repos. Like tag_diff_base, an unrecognised value is a
 * configuration error rather than something to fall back from quietly:
 * guessing which way the instructor meant it would either write labels they
 * turned off or silently write none.
 */
function readLabelRepos() {
  const value = core.getInput('label_repos').trim().toLowerCase();
  if (value === '') return DEFAULT_LABEL_REPOS;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`label_repos must be "true" or "false"; got "${value}".`);
}

/**
 * Reads ai_reasoning_effort, case-insensitively. An unknown level is a
 * configuration error: falling back to the model's default could quietly run a
 * whole class at a far higher effort, and cost, than the instructor meant.
 */
function readReasoningEffort() {
  const value = (core.getInput('ai_reasoning_effort') || DEFAULT_AI_REASONING_EFFORT)
    .trim()
    .toLowerCase();
  if (!AI_REASONING_EFFORTS.includes(value)) {
    throw new Error(
      `ai_reasoning_effort must be one of ${AI_REASONING_EFFORTS.map((e) => `"${e}"`).join(', ')}; ` +
        `got "${value}".`,
    );
  }
  return value;
}

/**
 * Reads ai_temperature. Returns null when it is empty, so no temperature is sent
 * and the model runs at its own. A value that is not a number from
 * AI_TEMPERATURE_MIN to AI_TEMPERATURE_MAX is ignored with a warning rather than
 * failing the run: the model's own temperature is a safe fallback, and older
 * workflows that set a value outside today's range keep running.
 */
function readTemperature() {
  const raw = core.getInput('ai_temperature').trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < AI_TEMPERATURE_MIN || value > AI_TEMPERATURE_MAX) {
    core.warning(
      `ai_temperature must be a number from ${AI_TEMPERATURE_MIN} to ${AI_TEMPERATURE_MAX}; ` +
        `got "${raw}". It was ignored, so the model runs at its own temperature.`,
    );
    return null;
  }
  return value;
}

/**
 * Reads question_emphasis, case-insensitively. An unrecognised value fails the
 * run rather than falling back to balanced: an instructor who asked for an emphasis
 * and silently got none would read the questions as that emphasis's result.
 */
function readQuestionEmphasis() {
  const value = (core.getInput('question_emphasis') || DEFAULT_QUESTION_EMPHASIS)
    .trim()
    .toLowerCase();
  if (!QUESTION_EMPHASIS_MODES.includes(value)) {
    throw new Error(
      `question_emphasis must be one of ${QUESTION_EMPHASIS_MODES.map((m) => `"${m}"`).join(', ')}; ` +
        `got "${value}".`,
    );
  }
  return value;
}

/**
 * Reads a deprecated true/false input: true, false, or null when it was not
 * set. Anything but "true" counts as false, as it always did.
 */
function readDeprecatedFlag(name, replacement) {
  const raw = core.getInput(name).trim().toLowerCase();
  if (raw === '') return null;
  core.warning(
    `${name} is deprecated and will be removed in the next major version. Use ${replacement} instead.`,
  );
  return raw === 'true';
}

/**
 * Reads one of a fixed set of values, case-insensitively, or null when the
 * input was not set. An unrecognised value fails the run: each value changes
 * which code is assessed or sent, and guessing would do it silently.
 */
function readMode(name, modes) {
  const value = core.getInput(name).trim().toLowerCase();
  if (value === '') return null;
  if (!modes.includes(value)) {
    throw new Error(
      `${name} must be one of ${modes.map((m) => `"${m}"`).join(', ')}; got "${value}".`,
    );
  }
  return value;
}

/**
 * Reads starter_code and previous_work, falling back to the two inputs they
 * replace when they are not set:
 *
 *   include_initial_commit: true   → starter_code: none
 *   include_codebase_context: true → starter_code: context, previous_work: context
 *   include_codebase_context: false (set explicitly) → previous_work: ignore
 *
 * include_initial_commit wins over include_codebase_context for starter_code,
 * because with the first commit assessed there was never starter code to send.
 * A new input that is set wins over the old ones, which are then ignored with a
 * warning. Old workflows keep working, since GitHub only warns about an input
 * an action no longer declares: dropping include_initial_commit outright would
 * silently leave every empty-repository student's first push unassessed.
 */
function readStarterCodeInputs() {
  const initialCommit = readDeprecatedFlag('include_initial_commit', 'starter_code: none');
  const codebaseContext = readDeprecatedFlag(
    'include_codebase_context',
    'starter_code: context and previous_work',
  );
  let starterCode = readMode('starter_code', STARTER_CODE_MODES);
  let previousWork = readMode('previous_work', PREVIOUS_WORK_MODES);

  if (starterCode === null) {
    if (initialCommit) starterCode = 'none';
    else if (codebaseContext) starterCode = 'context';
    else starterCode = DEFAULT_STARTER_CODE;
  } else if (initialCommit !== null || codebaseContext !== null) {
    core.warning(
      `starter_code is set, so include_initial_commit and include_codebase_context are ignored ` +
        `for starter code.`,
    );
  }

  if (previousWork === null) {
    if (codebaseContext !== null) previousWork = codebaseContext ? 'context' : 'ignore';
    else previousWork = DEFAULT_PREVIOUS_WORK;
  } else if (codebaseContext !== null) {
    core.warning('previous_work is set, so include_codebase_context is ignored for earlier work.');
  }

  return { starterCode, previousWork };
}

/**
 * Reads starter_questions_one_in, clamped to MIN_STARTER_QUESTIONS_ONE_IN and
 * MAX_QUESTIONS. Only starter_code: ask uses it.
 */
function readStarterQuestionsOneIn() {
  const raw = parseInt(core.getInput('starter_questions_one_in'), 10);
  if (Number.isNaN(raw)) return DEFAULT_STARTER_QUESTIONS_ONE_IN;
  return Math.min(MAX_QUESTIONS, Math.max(MIN_STARTER_QUESTIONS_ONE_IN, raw));
}

export function readInputs() {
  const excludeStr = core.getInput('additional_exclude_patterns');
  const overrideStr = core.getInput('exclude_pattern_overrides');

  const rawNumQuestions = Math.max(
    MIN_QUESTIONS,
    parseInt(core.getInput('num_questions') || String(DEFAULT_NUM_QUESTIONS), 10),
  );
  const numQuestions = Math.min(MAX_QUESTIONS, rawNumQuestions);
  if (rawNumQuestions > MAX_QUESTIONS) {
    core.warning(
      `num_questions was set to ${rawNumQuestions}, which exceeds the maximum of ${MAX_QUESTIONS}. Capping to ${MAX_QUESTIONS}.`,
    );
  }

  const additionalExcludePatterns = excludeStr
    ? excludeStr
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  const overridePatterns = overrideStr
    ? overrideStr
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  const apiKey = core.getInput('api_key') || '';
  if (!apiKey) {
    throw new Error(
      'api_key is required. GrillMyCode generates questions via OpenRouter, which needs ' +
        'its own API key — github_token cannot be used for this. Create a key at ' +
        'https://openrouter.ai/keys, store it as an organization-level secret, and pass ' +
        'it as api_key. See ' +
        'https://grillmycode.org/docs/ai-providers/openrouter',
    );
  }

  return {
    githubToken: core.getInput('github_token', { required: true }),
    aiProvider: core.getInput('ai_provider') || DEFAULT_AI_PROVIDER,
    aiModel: core.getInput('ai_model') || DEFAULT_AI_MODEL,
    aiRetryMaxAttempts: Math.max(
      1,
      parseInt(core.getInput('ai_retry_max_attempts') || String(DEFAULT_AI_RETRY_MAX_ATTEMPTS), 10),
    ),
    aiTemperature: readTemperature(),
    aiReasoningEffort: readReasoningEffort(),
    apiKey,
    numQuestions,
    questionEmphasis: readQuestionEmphasis(),
    additionalExcludePatterns,
    excludePatternOverrides: overridePatterns,
    instructorContext: core.getInput('instructor_context') || '',
    assignmentContextGlobs: (() => {
      const raw = core.getInput('assignment_context') || '';
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    })(),
    assignmentContextMaxChars: Math.max(
      1,
      parseInt(
        core.getInput('assignment_context_max_chars') ||
          String(DEFAULT_ASSIGNMENT_CONTEXT_MAX_CHARS),
        10,
      ),
    ),
    keepComments: core.getInput('keep_comments') === 'true',
    includeAnswers: core.getInput('include_answers') === 'true',
    ...readStarterCodeInputs(),
    starterQuestionsOneIn: readStarterQuestionsOneIn(),
    codebaseContextMaxChars: Math.max(
      1,
      parseInt(
        core.getInput('codebase_context_max_chars') || String(DEFAULT_CODEBASE_CONTEXT_MAX_CHARS),
        10,
      ),
    ),
    // Defaults to false so that accepting an assignment does not immediately
    // fail every student repository: at accept time the diff is legitimately
    // empty (template repos) or contains only the excluded .classroom50.yaml
    // setup commit, both of which end the run with nothing to assess.
    failOnEmptyAssessment: core.getInput('fail_on_empty_assessment') === 'true',
    // Three-way logic for skip_committers:
    //   • Input not provided (empty string from Actions default) → use the
    //     built-in default list of known Actions bot accounts.
    //   • Input explicitly set to '' (empty) → disabled; return [] so no
    //     commits are skipped.
    //   • Input set to a non-empty string → parse it as a comma-separated
    //     list and use exactly those values.
    // Matching is case-insensitive substring on commit author name OR email,
    // and only consecutive commits from the start of the range are skipped.
    skipCommitters: (() => {
      const raw = core.getInput('skip_committers');
      if (raw === '') return [];
      const val = raw || 'github-actions[bot]';
      return val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    })(),
    submissionTags: readSubmissionTags(),
    tagDiffBase: readTagDiffBase(),
    baseSha: core.getInput('base_sha') || '',
    headSha: core.getInput('head_sha') || '',
    instructorRepoToken: core.getInput('instructor_repo_token') || '',
    labelRepos: readLabelRepos(),
    // Undocumented diagnostic. Anything but an explicit "true" leaves it off,
    // and deliberately without the error readLabelRepos raises: an unknown
    // value must not fail a run, or announce the input in the log.
    logPrompt:
      (core.getInput('log_prompt').trim().toLowerCase() || String(DEFAULT_LOG_PROMPT)) === 'true',
  };
}
