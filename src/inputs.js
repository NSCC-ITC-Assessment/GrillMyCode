/**
 * Input Handling
 *
 * Reads and normalises all INPUT_* environment variables set by the GitHub
 * Action. Responsible for parsing, applying defaults, and clamping values
 * to valid ranges.
 */

import * as core from '@actions/core';
import {
  DEFAULT_EXCLUDE_PATTERNS,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  DEFAULT_ASSIGNMENT_CONTEXT_MAX_CHARS,
  DEFAULT_AI_RETRY_MAX_ATTEMPTS,
  DEFAULT_AI_TEMPERATURE,
} from './constants.js';

export function readInputs() {
  const includeStr = core.getInput('include_patterns');
  const excludeStr = core.getInput('exclude_patterns');

  const rawNumQuestions = Math.max(
    MIN_QUESTIONS,
    parseInt(core.getInput('num_questions') || '10', 10),
  );
  const numQuestions = Math.min(MAX_QUESTIONS, rawNumQuestions);
  if (rawNumQuestions > MAX_QUESTIONS) {
    core.warning(
      `num_questions was set to ${rawNumQuestions}, which exceeds the maximum of ${MAX_QUESTIONS}. Capping to ${MAX_QUESTIONS}.`,
    );
  }

  const excludeWorkflowFiles = core.getInput('exclude_workflow_files') !== 'false';

  const baseExcludePatterns = excludeStr
    ? excludeStr
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    : DEFAULT_EXCLUDE_PATTERNS;

  const excludePatterns = excludeWorkflowFiles
    ? [...new Set([...baseExcludePatterns, '.github/workflows/**'])]
    : baseExcludePatterns;

  return {
    githubToken: core.getInput('github_token', { required: true }),
    aiProvider: core.getInput('ai_provider') || 'github-models',
    aiModel: core.getInput('ai_model') || 'gpt-4.1',
    aiRetryMaxAttempts: Math.max(
      1,
      parseInt(core.getInput('ai_retry_max_attempts') || String(DEFAULT_AI_RETRY_MAX_ATTEMPTS), 10),
    ),
    aiTemperature: Math.min(
      1,
      Math.max(0, parseFloat(core.getInput('ai_temperature') || String(DEFAULT_AI_TEMPERATURE))),
    ),
    apiKey: core.getInput('api_key') || '',
    azureEndpoint: core.getInput('azure_endpoint') || '',
    numQuestions,
    includePatterns: includeStr
      ? includeStr
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
      : [],
    excludePatterns,
    outputFile: core.getInput('output_file') || 'grill-my-code.md',
    postPrComment: core.getInput('post_pr_comment') !== 'false',
    postIssue: core.getInput('post_issue') === 'true',
    postDiscussion: core.getInput('post_discussion') === 'true',
    discussionCategory: core.getInput('discussion_category') || 'Assessments',
    additionalContext: core.getInput('additional_context') || '',
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
    skipInitialCommit: core.getInput('skip_initial_commit') !== 'false',
    // Three-way logic for skip_committers:
    //   • Input not provided (empty string from Actions default) → use the
    //     built-in default list of known Classroom/Actions bot accounts.
    //   • Input explicitly set to '' (empty) → disabled; return [] so no
    //     commits are skipped.
    //   • Input set to a non-empty string → parse it as a comma-separated
    //     list and use exactly those values.
    // Matching is case-insensitive substring on commit author name OR email,
    // and only consecutive commits from the start of the range are skipped.
    skipCommitters: (() => {
      const raw = core.getInput('skip_committers');
      if (raw === '') return [];
      const val = raw || 'github-classroom[bot],github-actions[bot]';
      return val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    })(),
    baseSha: core.getInput('base_sha') || '',
    headSha: core.getInput('head_sha') || '',
    instructorRepoToken: core.getInput('instructor_repo_token') || '',
  };
}
