/**
 * Code Comprehension Question Generator — Main Script
 *
 * Orchestrates the full assessment pipeline:
 *   1. Read and validate GitHub Actions inputs
 *   2. Resolve commit SHAs and branch name from the event context
 *   3. Collect changed files, filter them, strip comments, and build the prompt
 *   4. Call the configured AI provider to generate comprehension questions
 *   5. Generate a PDF of the assessment and attach it to the gmc-assessments release
 *   6. Create or update a GitHub Issue with the assessment questions and PDF link
 *   7. Post a link comment on the PR (when triggered by a pull request)
 *   8. Optionally write a full instructor copy (with answers) to a private instructor repo
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  GIT_SHA_SHORT_LENGTH,
  GITHUB_API_VERSION,
  INSTRUCTOR_REPO_SUFFIX,
  ISSUES_PER_PAGE,
  STUDENT_RESOLUTION_SKIP_COMMITTERS,
} from './constants.js';
import { readInputs } from './inputs.js';
import { resolveSHAs, resolveBranch, safeBranchName, resolveAssignmentName } from './context.js';
import { getChangedFiles, getDiff, findStudentCommitSha } from './git.js';
import {
  filterFiles,
  collectRawFiles,
  stripCommentsFromFiles,
  buildCodeContent,
  readAssignmentContextFiles,
} from './files.js';
import { detectExcludePatterns } from './stack-detection.js';
import { buildPrompt } from './prompt.js';
import { callAI } from './ai.js';
import { formatReport } from './report.js';
import { postIssue } from './delivery/issue.js';
import { deliverToInstructorRepo } from './delivery/instructor-repo.js';
import { generatePdf } from './delivery/pdf.js';
import { uploadPdfAsset } from './delivery/release-asset.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Strips distractor content from AI-generated Q+A output.
 *
 * Incorrect options for quiz (header + bullets) are always removed — they are
 * generated solely to enable quiz-style delivery and should not appear in
 * any rendered report.
 *
 * The correct answer line is removed only when keepAnswers is false
 * (i.e. when producing student-facing output without include_answers).
 *
 * Collapses any resulting triple+ blank lines down to a double blank line.
 */
function stripAnswers(text, { keepAnswers = false } = {}) {
  let result = text;
  if (!keepAnswers) {
    result = result.replace(/^ {3,4}\*\*Answer:\*\*[^\n]*/gm, '');
  }
  return result
    .replace(/^ {3,4}\*\*Incorrect Options for Quiz:\*\*[^\n]*/gm, '')
    .replace(/^ {3,4}- [^\n]*/gm, '')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Truncates AI output to at most `maxQuestions` numbered questions.
 *
 * If the model over-generates (e.g. produces more questions than were
 * requested because it hit the token limit), this finds the start of question
 * maxQuestions+1 and removes everything from that point onward.
 */
function truncateToMaxQuestions(text, maxQuestions) {
  // Questions are numbered: "1.", "2.", … at the start of a line (possibly
  // preceded by whitespace). Look for the start of question maxQuestions+1.
  const overflowPattern = new RegExp(`(?:^|\\n)(?=\\s*${maxQuestions + 1}\\.\\s)`);
  const match = overflowPattern.exec(text);
  if (match) {
    core.warning(
      `AI generated more than ${maxQuestions} questions — truncating to the requested count.`,
    );
    return text.substring(0, match.index).trimEnd();
  }
  return text;
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

async function run() {
  try {
    const inputs = readInputs();
    core.debug(
      `Resolved inputs:\n${JSON.stringify(
        { ...inputs, githubToken: '[REDACTED]', apiKey: inputs.apiKey ? '[REDACTED]' : '' },
        null,
        2,
      )}`,
    );
    const octokit = github.getOctokit(inputs.githubToken, {
      headers: { 'X-GitHub-Api-Version': GITHUB_API_VERSION },
    });
    const ctx = github.context;

    // Prevent the external API key from appearing in workflow logs.
    if (inputs.apiKey && inputs.apiKey !== inputs.githubToken) {
      core.setSecret(inputs.apiKey);
    }
    if (inputs.instructorRepoToken) {
      core.setSecret(inputs.instructorRepoToken);
    }

    // ── Resolve the commit range ────────────────────────────────────────────
    const { baseSha, headSha, prNumber } = await resolveSHAs(ctx, octokit, inputs);
    core.info(
      `Commit range: ${baseSha.substring(0, GIT_SHA_SHORT_LENGTH)}..${headSha.substring(0, GIT_SHA_SHORT_LENGTH)}`,
    );

    // ── Resolve the branch name ─────────────────────────────────────────────
    const branchName = resolveBranch(ctx);
    core.info(`Branch: ${branchName}`);

    // ── Resolve the student login from the most recent non-bot commit ────────
    // headSha may point to the action's own assessment-file commit on re-runs
    // triggered by that push. Walk the range to find the last student commit.
    // Merge the user's skip_committers with the hardcoded bot list so that
    // github-actions[bot] is always excluded even if the user clears the input.
    const studentResolutionSkipList = [
      ...new Set([...STUDENT_RESOLUTION_SKIP_COMMITTERS, ...inputs.skipCommitters]),
    ];
    const studentCommitSha = findStudentCommitSha(baseSha, headSha, studentResolutionSkipList);
    const { data: studentCommitData } = await octokit.rest.repos.getCommit({
      owner: ctx.repo.owner,
      repo: ctx.repo.repo,
      ref: studentCommitSha,
    });
    const studentLogin = studentCommitData.author?.login ?? ctx.actor;
    core.info(
      `Student login: ${studentLogin} (resolved from commit ${studentCommitSha.substring(0, GIT_SHA_SHORT_LENGTH)})`,
    );

    // ── Collect changed files and apply filters ─────────────────────────────
    const allFiles = getChangedFiles(baseSha, headSha);
    const detectedPatterns = await detectExcludePatterns(
      inputs.githubToken,
      ctx.repo.owner,
      ctx.repo.repo,
    );
    const excludePatterns = [
      ...new Set([
        ...detectedPatterns,
        ...inputs.additionalExcludePatterns,
        '.github/workflows/**',
      ]),
    ];
    if (inputs.additionalExcludePatterns.length > 0) {
      core.info(
        `Additional exclude patterns (from input): ${inputs.additionalExcludePatterns.join(', ')}`,
      );
    }
    if (inputs.excludePatternOverrides.length > 0) {
      core.info(
        `Exclude pattern overrides (re-included): ${inputs.excludePatternOverrides.join(', ')}`,
      );
    }
    core.info(
      `Exclude patterns applied (${excludePatterns.length}):\n${excludePatterns.map((p) => `  ${p}`).join('\n')}`,
    );
    const files = filterFiles(allFiles, excludePatterns, inputs.excludePatternOverrides);

    if (files.length === 0) {
      core.warning('No assessable files found after applying include/exclude filters. Skipping.');
      return;
    }
    core.info(`Assessing ${files.length} file(s): ${files.join(', ')}`);

    // ── Fetch diff content ──────────────────────────────────────────────────
    const diff = getDiff(baseSha, headSha, files);
    core.info(`Total diff size: ${diff.length} characters`);

    // ── Strip comments from changed files (unless keep_comments is set) ────
    const rawFiles = collectRawFiles(files, headSha);
    const rawContent = buildCodeContent(rawFiles);
    core.info(`Code size before comment stripping: ${rawContent.length} characters`);

    let processedFiles;
    if (inputs.keepComments) {
      core.info('Comment stripping skipped (keep_comments is true).');
      core.debug('No comments were removed from the code (keep_comments is true).');
      processedFiles = rawFiles;
    } else {
      const { strippedFiles, strippedCharCount } = stripCommentsFromFiles(rawFiles);
      core.info(`Code size after comment stripping: ${strippedCharCount} characters`);
      core.debug(
        `--- CODE AFTER COMMENT STRIPPING ---\n${buildCodeContent(strippedFiles)}\n--- END CODE AFTER COMMENT STRIPPING ---`,
      );
      processedFiles = strippedFiles;
    }

    let codeContent = buildCodeContent(processedFiles);
    // Fall back to the raw diff if processing produced no output
    if (codeContent.trim() === '') {
      codeContent = diff;
      core.warning('Code content was empty after processing — falling back to raw diff.');
    }

    const truncated = false;

    // ── Generate questions using AI ─────────────────────────────────────────
    const { content: assignmentContext, matchedFiles: assignmentContextFiles } =
      await readAssignmentContextFiles(
        inputs.assignmentContextGlobs,
        inputs.assignmentContextMaxChars,
      );
    if (inputs.assignmentContextGlobs.length > 0 && !assignmentContext) {
      core.warning(
        `assignment_context was set but no matching files were found for: ${inputs.assignmentContextGlobs.join(', ')}. Check that the glob(s) are correct and the files exist in the repository.`,
      );
    } else if (assignmentContext) {
      core.info(`Assignment context loaded (${assignmentContext.length} characters).`);
    }

    const messages = buildPrompt({
      codeContent,
      files,
      numQuestions: inputs.numQuestions,
      context: inputs.additionalContext,
      assignmentContext,
      truncated,
    });
    core.debug(`Prompt messages:\n${JSON.stringify(messages, null, 2)}`);

    core.info(
      `Calling ${inputs.aiProvider} (model: ${inputs.aiModel}) to generate ${inputs.numQuestions} questions…`,
    );

    const effectiveApiKey =
      inputs.aiProvider === 'github-models' ? inputs.apiKey || inputs.githubToken : inputs.apiKey;

    const rawQuestions = truncateToMaxQuestions(
      await callAI({
        provider: inputs.aiProvider,
        model: inputs.aiModel,
        apiKey: effectiveApiKey,
        messages,
        retryMaxAttempts: inputs.aiRetryMaxAttempts,
        temperature: inputs.aiTemperature,
      }),
      inputs.numQuestions,
    );

    // Extract the AI-generated context summary (only present when additionalContext was set).
    const contextSummaryMatch = rawQuestions.match(
      /<!--\s*CONTEXT_SUMMARY\s*-->\n?([\s\S]*?)\n?<!--\s*\/CONTEXT_SUMMARY\s*-->/,
    );
    const contextSummary = contextSummaryMatch ? contextSummaryMatch[1].trim() : '';
    const cleanedQuestions = rawQuestions
      .replace(/<!--\s*CONTEXT_SUMMARY\s*-->[\s\S]*?<!--\s*\/CONTEXT_SUMMARY\s*-->\n*/g, '')
      .trim();

    // Always strip incorrect options for quiz; also strip the correct answer when
    // include_answers is false. cleanedQuestions retains answers for the instructor copy.
    const questions = stripAnswers(cleanedQuestions, { keepAnswers: inputs.includeAnswers });

    // ── Build base report (PDF source — no self-referencing link) ───────────
    const sourceRepo = `${ctx.repo.owner}/${ctx.repo.repo}`;

    const baseReport = formatReport({
      questions,
      files,
      baseSha,
      headSha,
      truncated,
      provider: inputs.aiProvider,
      model: inputs.aiModel,
      branchName,
      assignmentContextFiles,
      contextSummary,
      sourceRepo,
    });

    // ── Generate PDF and upload to rolling release ───────────────────────────
    const safe = safeBranchName(branchName);
    const pdfFilename = safe ? `grill-my-code-${safe}.pdf` : 'grill-my-code.pdf';
    let pdfUrl = null;
    let pdfBuffer = null;
    try {
      pdfBuffer = await generatePdf(baseReport);
    } catch (err) {
      core.warning(`PDF generation failed: ${err.message} — issue will post without a PDF link.`);
    }
    if (pdfBuffer) {
      try {
        pdfUrl = await uploadPdfAsset({
          octokit,
          owner: ctx.repo.owner,
          repo: ctx.repo.repo,
          pdfBuffer,
          filename: pdfFilename,
          token: inputs.githubToken,
        });
        core.info(`Assessment PDF uploaded: ${pdfUrl}`);
      } catch (err) {
        core.warning(`PDF upload failed: ${err.message} — issue will post without a PDF link.`);
      }
    }
    core.setOutput('pdf_url', pdfUrl || '');

    // ── Format issue body (base report + PDF download link) ─────────────────
    const issueBody = formatReport({
      questions,
      files,
      baseSha,
      headSha,
      truncated,
      provider: inputs.aiProvider,
      model: inputs.aiModel,
      branchName,
      assignmentContextFiles,
      contextSummary,
      sourceRepo,
      pdfUrl,
    });

    core.setOutput('questions', questions);
    core.setOutput('code_before_strip', rawContent);
    core.setOutput('code_after_strip', buildCodeContent(processedFiles));

    // ── Guard: GitHub issue bodies cap at 65 536 characters ──────────────────
    const ISSUE_BODY_LIMIT = 65_000;
    const safeIssueBody =
      issueBody.length > ISSUE_BODY_LIMIT
        ? issueBody.slice(0, ISSUE_BODY_LIMIT) +
          '\n\n---\n\n> [!WARNING]\n> The assessment was too long to display in full here. ' +
          (pdfUrl
            ? `[Download the complete PDF](${pdfUrl}) for all questions.`
            : 'Re-run with fewer questions to see the full output.')
        : issueBody;

    if (issueBody.length > ISSUE_BODY_LIMIT) {
      core.warning(
        `Issue body exceeded ${ISSUE_BODY_LIMIT} characters (${issueBody.length}) and was truncated. ` +
          'Consider reducing num_questions or using a shorter additional_context.',
      );
    }

    // ── Create / update GitHub Issue ─────────────────────────────────────────
    const issueResult = await postIssue({
      octokit,
      ctx,
      report: safeIssueBody,
      branchName,
      headSha,
      studentLogin,
    });
    core.setOutput('issue_url', issueResult.url);
    core.setOutput('issue_number', String(issueResult.number));

    // ── Post PR link comment ─────────────────────────────────────────────────
    if (prNumber) {
      const marker = '<!-- gmc-pr-link -->';
      const body = `${marker}\n> [!NOTE]\n> GrillMyCode has generated assessment questions for this pull request. [View questions →](${issueResult.url})`;
      const existingComments = await octokit.rest.issues.listComments({
        owner: ctx.repo.owner,
        repo: ctx.repo.repo,
        issue_number: prNumber,
        per_page: ISSUES_PER_PAGE,
      });
      const prev = existingComments.data.find((c) => c.body?.includes(marker));
      if (prev) {
        await octokit.rest.issues.updateComment({
          owner: ctx.repo.owner,
          repo: ctx.repo.repo,
          comment_id: prev.id,
          body,
        });
        core.info(`Updated PR link comment on PR #${prNumber} → Issue #${issueResult.number}`);
      } else {
        await octokit.rest.issues.createComment({
          owner: ctx.repo.owner,
          repo: ctx.repo.repo,
          issue_number: prNumber,
          body,
        });
        core.info(`PR link comment posted on PR #${prNumber} → Issue #${issueResult.number}`);
      }
    }

    // ── Write to instructor repository ──────────────────────────────────────
    if (!inputs.instructorRepoToken) {
      core.info('instructor_repo_token is not set — skipping instructor repository delivery.');
    } else {
      const instructorOctokit = github.getOctokit(inputs.instructorRepoToken, {
        headers: { 'X-GitHub-Api-Version': GITHUB_API_VERSION },
      });
      const assignmentName = await resolveAssignmentName(ctx, octokit, studentLogin);
      const instructorRepoName = assignmentName + INSTRUCTOR_REPO_SUFFIX;
      const instructorReport = formatReport({
        questions: cleanedQuestions,
        files,
        baseSha,
        headSha,
        truncated,
        provider: inputs.aiProvider,
        model: inputs.aiModel,
        branchName,
        assignmentContextFiles,
        contextSummary,
        studentLogin,
        sourceRepo: `${ctx.repo.owner}/${ctx.repo.repo}`,
      });
      try {
        await deliverToInstructorRepo({
          octokit: instructorOctokit,
          owner: ctx.repo.owner,
          instructorRepoName,
          studentLogin,
          content: instructorReport,
          headSha,
        });
      } catch (err) {
        core.error(
          `Failed to write to instructor repository ${ctx.repo.owner}/${instructorRepoName}: ${err.message}`,
        );
      }
    }
  } catch (err) {
    core.setFailed(`Assessment failed: ${err.message}`);
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

run();
