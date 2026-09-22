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
  DEFAULT_AI_RETRY_MAX_ATTEMPTS,
  DEFAULT_AI_TEMPERATURE,
  DEFAULT_NUM_QUESTIONS,
  DEFAULT_AI_PROVIDER,
  DEFAULT_AI_MODEL,
  DEFAULT_TAG_DIFF_BASE,
  TAG_DIFF_BASE_MODES,
  DEFAULT_REPO_MARKER,
  REPO_MARKER_MODES,
} from './constants.js';
import { isSafeTagPattern } from './tags.js';

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

function readTagDiffBase() {
  const value = (core.getInput('tag_diff_base') || DEFAULT_TAG_DIFF_BASE).trim().toLowerCase();
  if (!TAG_DIFF_BASE_MODES.includes(value)) {
    throw new Error(
      `tag_diff_base must be one of ${TAG_DIFF_BASE_MODES.map((m) => `"${m}"`).join(', ')}; ` +
        `got "${value}".`,
    );
  }
  return value;
}

/**
 * Reads repo_marker. Like tag_diff_base, an unrecognised value is a
 * configuration error rather than something to fall back from quietly: the
 * instructor asked for a marker and silently writing none would look identical
 * to the feature not working.
 */
function readRepoMarker() {
  const value = (core.getInput('repo_marker') || DEFAULT_REPO_MARKER).trim().toLowerCase();
  if (!REPO_MARKER_MODES.includes(value)) {
    throw new Error(
      `repo_marker must be one of ${REPO_MARKER_MODES.map((m) => `"${m}"`).join(', ')}; ` +
        `got "${value}".`,
    );
  }
  return value;
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
    aiTemperature: Math.min(
      1,
      Math.max(0, parseFloat(core.getInput('ai_temperature') || String(DEFAULT_AI_TEMPERATURE))),
    ),
    apiKey,
    numQuestions,
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
    includeInitialCommit: core.getInput('include_initial_commit') === 'true',
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
    repoMarker: readRepoMarker(),
  };
}
