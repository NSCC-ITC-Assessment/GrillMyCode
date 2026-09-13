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
 *   7. Optionally write a full instructor copy (with answers) to a private instructor repo
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { minimatch } from 'minimatch';
import {
  EMPTY_ASSESSMENT_FILE_LIST_LIMIT,
  SUMMARY_FILE_TABLE_LIMIT,
  GIT_SHA_SHORT_LENGTH,
  GITHUB_API_VERSION,
  INSTRUCTOR_REPO_SUFFIX,
} from './constants.js';
import { readInputs } from './inputs.js';
import { resolveSHAs, resolveBranch, safeFilePart } from './context.js';
import { resolveSubmissionIdentity } from './submission-identity.js';
import { getChangedFiles, getDiff, getDiffStat } from './git.js';
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
import {
  ANSWER_MARKER_LINE_RE,
  boldQuestionLines,
  countQuestions,
  extractCorrectAnswers,
  normaliseSeparators,
  redactStudentQuestions,
  renumberQuestions,
  splitBoldAroundCode,
  stripAnswers,
  truncateToMaxQuestions,
} from './postprocess.js';

// ─── Run Summary ─────────────────────────────────────────────────────────────
//
// Renders the job summary — the markdown block shown on a run's landing page,
// beneath the job list. Before this, only the "nothing to assess" path wrote a
// summary, so a run that actually produced an assessment left the page blank.
//
// AUDIENCE: this page lives in the student's own repository and they can read
// every run, so the summary is written for both readers at once. It reports
// what was assessed, what was filtered out, and how the run was configured —
// all of which is either already visible to the student (the workflow file, the
// diff) or actively useful to them (why a file was not assessed).
//
// It must never carry assessment content. Question text, answer text and the
// generation prompt stay out of it unconditionally: include_answers already
// governs what reaches the student report, and a summary that rendered any of
// it would be a second channel around the redaction below. The same applies to
// the withheld-question guards — the student sees the count, because they
// already do in the issue, but the reason stays in the log and the instructor
// copy so a prompt-injection attempt gets no feedback signal.

function createRunState() {
  return {
    // Set by reportEmptyAssessment, which writes its own summary. Suppresses
    // the final flush so the two do not both render.
    handled: false,

    repoSlug: '',
    // Submission identity (see submission-identity.js). submitter is the student
    // login, or `group-<n>` for a team repo, in which case studentLogin is ''.
    assignmentName: '',
    submitter: '',
    studentLogin: '',
    identityError: '',
    branchName: '',
    baseSha: '',
    headSha: '',

    allFiles: [],
    files: [],
    fileStats: [],
    excludePatterns: [],
    excludePatternOverrides: [],
    assignmentContextFiles: [],

    diffChars: null,
    rawChars: null,
    strippedChars: null,

    questionsRequested: null,
    questionsGenerated: null,
    questionsWithheld: 0,

    issueUrl: '',
    issueNumber: null,
    pdfUrl: '',
    pdfError: '',
    instructorDelivery: 'skipped',
    instructorError: '',

    inputs: null,
    diagnostics: [],
    failureMessage: '',
  };
}

const fmtNum = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : '—');

const shortSha = (sha) => (sha ? sha.substring(0, GIT_SHA_SHORT_LENGTH) : '');

/**
 * Links a SHA to its commit page. The empty tree SHA (used as the base when
 * include_initial_commit is set) has no commit page, so it is rendered plain.
 */
function commitLink(repoSlug, sha) {
  const short = shortSha(sha);
  if (!short) return '—';
  if (!repoSlug) return `\`${short}\``;
  return `[\`${short}\`](https://github.com/${repoSlug}/commit/${sha})`;
}

/**
 * Wraps content in a collapsed <details> block. The blank lines around the body
 * are required — without them GitHub renders the markdown inside as literal
 * text rather than as a table.
 */
function details(label, body) {
  return `<details>\n<summary>${label}</summary>\n\n${body}\n\n</details>\n`;
}

/** Renders rows as a markdown table, or returns '' when there are none. */
function table(headers, rows) {
  if (rows.length === 0) return '';
  const head = `| ${headers.join(' | ')} |`;
  const rule = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return `${head}\n${rule}\n${body}\n`;
}

/** "and N more" footer for any table clipped at SUMMARY_FILE_TABLE_LIMIT. */
function overflowNote(total, shown) {
  const remainder = total - shown;
  return remainder > 0 ? `\n_…and ${fmtNum(remainder)} more — full list in the run log._\n` : '';
}

/** Returns the first exclude pattern that removed a path, for the why column. */
function matchingPattern(filepath, excludePatterns) {
  const opts = { dot: true, matchBase: true };
  return excludePatterns.find((p) => minimatch(filepath, p, opts)) ?? '';
}

function renderHeadline(state) {
  const counts = [];
  if (state.questionsGenerated !== null) {
    counts.push(`**${fmtNum(state.questionsGenerated)} questions**`);
  }
  counts.push(
    `**${fmtNum(state.files.length)} file${state.files.length === 1 ? '' : 's'}** assessed`,
  );

  const links = [];
  if (state.issueUrl) {
    links.push(`[Assessment issue #${state.issueNumber}](${state.issueUrl})`);
  }
  if (state.pdfUrl) links.push(`[Download PDF](${state.pdfUrl})`);

  return [counts.join(' from '), ...links].join(' · ');
}

function renderOverview(state) {
  const rows = [
    ['Assignment', state.assignmentName ? `\`${state.assignmentName}\`` : '—'],
    [
      'Student',
      state.studentLogin
        ? `@${state.studentLogin}`
        : state.submitter
          ? `\`${state.submitter}\``
          : '—',
    ],
    ['Branch', state.branchName ? `\`${state.branchName}\`` : '—'],
    [
      'Commits assessed',
      `${commitLink(state.repoSlug, state.baseSha)} → ${commitLink(state.repoSlug, state.headSha)}`,
    ],
  ];
  return table(['', ''], rows);
}

function renderAssessedFiles(state) {
  if (state.files.length === 0) return '';

  const statByPath = new Map(state.fileStats.map((s) => [s.filepath, s]));
  const shown = state.files.slice(0, SUMMARY_FILE_TABLE_LIMIT);
  const rows = shown.map((f) => {
    const stat = statByPath.get(f);
    if (!stat) return [`\`${f}\``, '—', '—'];
    if (stat.added === null) return [`\`${f}\``, '_binary_', '_binary_'];
    return [`\`${f}\``, `+${fmtNum(stat.added)}`, `−${fmtNum(stat.removed)}`];
  });

  const totals = state.fileStats.reduce(
    (acc, s) => ({
      added: acc.added + (s.added ?? 0),
      removed: acc.removed + (s.removed ?? 0),
    }),
    { added: 0, removed: 0 },
  );

  const sizes = [];
  if (state.diffChars !== null) sizes.push(`diff ${fmtNum(state.diffChars)} chars`);
  if (state.rawChars !== null && state.strippedChars !== null) {
    sizes.push(
      state.rawChars === state.strippedChars
        ? `code ${fmtNum(state.rawChars)} chars (comments kept)`
        : `code ${fmtNum(state.rawChars)} → ${fmtNum(state.strippedChars)} chars after comment stripping`,
    );
  }

  return (
    `### Files assessed\n\n` +
    table(['File', 'Added', 'Removed'], rows) +
    overflowNote(state.files.length, shown.length) +
    `\n**Total:** +${fmtNum(totals.added)} / −${fmtNum(totals.removed)} lines` +
    (sizes.length > 0 ? ` · ${sizes.join(' · ')}` : '') +
    `\n`
  );
}

function renderExcludedFiles(state) {
  const excluded = state.allFiles.filter((f) => !state.files.includes(f));
  if (excluded.length === 0) return '';

  const shown = excluded.slice(0, SUMMARY_FILE_TABLE_LIMIT);
  const rows = shown.map((f) => {
    const pattern = matchingPattern(f, state.excludePatterns);
    return [`\`${f}\``, pattern ? `\`${pattern}\`` : '—'];
  });

  const body =
    table(['File', 'Excluded by'], rows) +
    overflowNote(excluded.length, shown.length) +
    `\nRe-include any of these with \`exclude_pattern_overrides\` — pass the exact path ` +
    `(e.g. \`${excluded[0]}\`) or the pattern that matched it.\n`;

  return details(
    `Excluded from assessment (${fmtNum(excluded.length)} of ${fmtNum(state.allFiles.length)} changed files)`,
    body,
  );
}

/**
 * The configuration block doubles as the run's provenance record: it shows the
 * settings the run actually used, rendered, rather than leaving them to be
 * diffed out of the workflow YAML across every student repository. Nothing here
 * is secret — all of it is already readable in that workflow file — but a value
 * that has drifted from the assignment's intent is far easier to spot here.
 */
function renderConfiguration(state) {
  const i = state.inputs;
  if (!i) return '';

  const flag = (on) => (on ? ' ⚠️' : '');
  const rows = [
    ['Provider', `\`${i.aiProvider}\``],
    ['Model', `\`${i.aiModel}\``],
    ['Temperature', String(i.aiTemperature)],
    [
      'Questions requested',
      `${fmtNum(i.numQuestions)}${
        state.questionsGenerated !== null && state.questionsGenerated !== i.numQuestions
          ? ` (${fmtNum(state.questionsGenerated)} generated)`
          : ''
      }`,
    ],
    [
      'Comments kept in assessed code',
      `${i.keepComments ? '**yes**' : 'no'}${flag(i.keepComments)}`,
    ],
    ['Answers shown to student', `${i.includeAnswers ? '**YES**' : 'no'}${flag(i.includeAnswers)}`],
    [
      'Initial commit assessed',
      `${i.includeInitialCommit ? '**yes**' : 'no'}${flag(i.includeInitialCommit)}`,
    ],
    ['Manual SHA override', i.baseSha || i.headSha ? `**in effect**${flag(true)}` : 'none'],
    [
      'Exclude patterns',
      `${fmtNum(state.excludePatterns.length)} applied` +
        (i.additionalExcludePatterns.length > 0
          ? `, ${fmtNum(i.additionalExcludePatterns.length)} from \`additional_exclude_patterns\``
          : '') +
        (state.excludePatternOverrides.length > 0
          ? `, ${fmtNum(state.excludePatternOverrides.length)} re-included by \`exclude_pattern_overrides\``
          : ''),
    ],
    [
      'Assignment context',
      state.assignmentContextFiles.length > 0
        ? state.assignmentContextFiles.map((f) => `\`${f}\``).join(', ')
        : 'none',
    ],
  ];

  const note = i.includeAnswers
    ? `\n⚠️ **\`include_answers\` is enabled — the student report contains the answers.** ` +
      `This defeats the assessment; it should be \`false\` in almost all cases.\n`
    : '';

  return details('Configuration used by this run', table(['Setting', 'Value'], rows) + note);
}

function renderDelivery(state) {
  const rows = [
    [
      'Assessment issue',
      state.issueUrl ? `✅ [#${state.issueNumber}](${state.issueUrl})` : '❌ not posted',
    ],
    [
      'PDF',
      state.pdfUrl
        ? `✅ [attached to release](${state.pdfUrl})`
        : `⚠️ not attached${state.pdfError ? ` — ${state.pdfError}` : ''}`,
    ],
    [
      'Instructor copy',
      {
        delivered: '✅ written',
        skipped: '— not configured',
        unresolved: `⚠️ skipped — ${state.identityError}`,
        failed: `❌ failed${state.instructorError ? ` — ${state.instructorError}` : ''}`,
      }[state.instructorDelivery] ?? '—',
    ],
  ];
  return `### Delivery\n\n${table(['Output', 'Status'], rows)}`;
}

function renderNotes(state) {
  const notes = [...state.diagnostics];
  if (state.questionsWithheld > 0) {
    // Count only. The guard that caught it stays out of the student's view so a
    // prompt-injection attempt gets no feedback on which attempts landed.
    notes.push(
      `${fmtNum(state.questionsWithheld)} question(s) were withheld from the student report pending instructor review.`,
    );
  }
  if (notes.length === 0) return '';
  return `### Notes\n\n${notes.map((n) => `- ${n}`).join('\n')}\n`;
}

/**
 * Writes the job summary. Never throws: a summary is a convenience, and losing
 * it must not cost the run or mask the real diagnosis.
 */
async function writeRunSummary(state) {
  if (state.handled) return;

  try {
    const heading = state.failureMessage
      ? 'GrillMyCode — run failed'
      : 'GrillMyCode — assessment generated';

    const banner = state.failureMessage
      ? `❌ **${state.failureMessage}**\n\nThe sections below show how far the run got before it stopped.`
      : renderHeadline(state);

    // Assembled as discrete blocks and joined with a blank line: the <details>
    // and table blocks only render as HTML/markdown when a blank line separates
    // them from the block above.
    const blocks = [
      `## 🔥 ${heading}`,
      banner,
      renderOverview(state),
      renderAssessedFiles(state),
      renderExcludedFiles(state),
      renderDelivery(state),
      renderConfiguration(state),
      renderNotes(state),
    ];

    const md = blocks
      .map((b) => b.trim())
      .filter(Boolean)
      .join('\n\n')
      .concat('\n');

    await core.summary.addRaw(md).write();
  } catch (err) {
    // Never fail the run over the summary — but say so out loud. This catch
    // once hid a TypeError that discarded the summary on every successful run,
    // and at core.debug nobody saw it.
    core.warning(`Could not write job summary: ${err.message}`);
  }
}

/**
 * Reports a run that produced no assessment, and decides whether that ends the
 * run as a success or a failure.
 *
 * The two reasons need different fixes, so each gets its own message and its own
 * "what to check" list rather than a shared one naming filters that may not be
 * involved. Everything is also written to the job summary: a warning annotation
 * shows on the run page but not in a list of runs, so an instructor scanning a
 * cohort sees an unbroken row of green ticks and no indication that one of the
 * repositories was never assessed.
 *
 * Failing is opt-in via fail_on_empty_assessment because both reasons occur
 * normally at accept time — see that input's description in action.yml.
 */
async function reportEmptyAssessment({
  reason,
  baseSha,
  headSha,
  allFiles,
  excludePatterns,
  inputs,
}) {
  const shortBase = baseSha.substring(0, GIT_SHA_SHORT_LENGTH);
  const shortHead = headSha.substring(0, GIT_SHA_SHORT_LENGTH);

  let headline;
  let detail;
  let checks;

  if (reason === 'empty-range') {
    // The accept-time explanation only holds when the first commit is being
    // excluded and no SHA override is in play. With include_initial_commit
    // enabled the base is the empty tree, so a freshly accepted repository has
    // files in range and this is genuinely unexpected — saying otherwise would
    // send the reader looking for a cause that cannot apply.
    const acceptTimeExplains = !inputs.includeInitialCommit && !inputs.baseSha && !inputs.headSha;
    headline = `No assessment generated: the commit range ${shortBase}..${shortHead} contains no changed files.`;
    detail =
      `Nothing was compared, so the exclude patterns were never involved.` +
      (acceptTimeExplains
        ? ` This is expected immediately after an assignment is accepted, when the ` +
          `repository's only commit is the starter code.`
        : '');
    checks = [
      `The range assessed was \`${shortBase}..${shortHead}\`${baseSha === headSha ? ' — base and head are the same commit.' : '.'}`,
      inputs.includeInitialCommit
        ? '`include_initial_commit` is **true**, so the base is the empty tree and every commit should be in range. An empty range here means the repository has no commits with files.'
        : '`include_initial_commit` is **false** (the default), so the first commit is excluded. If this is a Classroom 50 empty-repository assignment (`--empty-repo`), the student\'s own first push is that first commit — set `include_initial_commit: "true"` so their work is assessed.',
      inputs.baseSha || inputs.headSha
        ? 'A manual `base_sha`/`head_sha` override is set on this workflow. Check it still points at the range you intend.'
        : 'No manual SHA override is set, so the range came from the event and `include_initial_commit`.',
    ];
  } else {
    // Only claim the accept-time explanation when the excluded set actually is
    // the Classroom 50 setup commit. Asserting it for an arbitrary set of
    // excluded files would point the reader at a cause that is not theirs.
    const isClassroomSetupCommit = allFiles.length === 1 && allFiles[0] === '.classroom50.yaml';
    headline = `No assessment generated: all ${allFiles.length} changed file(s) were removed by the exclude patterns.`;
    detail =
      `Files did change in ${shortBase}..${shortHead}, but none survived filtering, ` +
      `so there was nothing to send to the AI.` +
      (isClassroomSetupCommit
        ? ` This is the Classroom 50 setup commit, so this is expected immediately ` +
          `after the assignment is accepted and before the student has pushed any work.`
        : '');
    // A whole excluded tree can run to hundreds of paths; enough to identify the
    // pattern at fault is enough, and the full list is already in the run log.
    const shown = allFiles.slice(0, EMPTY_ASSESSMENT_FILE_LIST_LIMIT);
    const remainder = allFiles.length - shown.length;
    checks = [
      `Excluded files: ${shown.map((f) => `\`${f}\``).join(', ')}` +
        (remainder > 0 ? `, and ${remainder} more (full list in the run log).` : ''),
      `Re-include any of these with \`exclude_pattern_overrides\` — pass the exact path (e.g. \`${allFiles[0]}\`) or the default pattern that matched it.`,
      `${excludePatterns.length} exclude pattern(s) were applied, combining the auto-detected stack patterns with \`additional_exclude_patterns\`. The full list is in the run log above.`,
    ];
  }

  // The summary is the part an instructor can actually find later; the
  // annotation only makes the run page show something is off.
  try {
    await core.summary
      .addHeading('GrillMyCode: no assessment generated', 2)
      .addRaw(`**${headline}**\n\n${detail}\n`)
      .addHeading('What to check', 3)
      .addList(checks)
      .addRaw(
        `\nNo questions, issue or PDF were produced by this run. ` +
          (inputs.failOnEmptyAssessment
            ? 'The run is marked as failed because `fail_on_empty_assessment` is enabled.'
            : 'The run is reported as successful; set `fail_on_empty_assessment: "true"` to have this fail instead.'),
      )
      .write();
  } catch (err) {
    // A summary is a convenience, never a reason to lose the actual diagnosis.
    core.debug(`Could not write job summary: ${err.message}`);
  }

  const logMessage = `${headline} ${detail}`;
  if (inputs.failOnEmptyAssessment) {
    core.setFailed(logMessage);
  } else {
    core.warning(logMessage);
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

async function run() {
  // Filled in as the run progresses and flushed in the finally below, so a run
  // that throws part-way still reports how far it got.
  const state = createRunState();

  try {
    const inputs = readInputs();
    state.inputs = inputs;
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
    state.repoSlug = `${ctx.repo.owner}/${ctx.repo.repo}`;

    // Prevent the external API key from appearing in workflow logs.
    if (inputs.apiKey && inputs.apiKey !== inputs.githubToken) {
      core.setSecret(inputs.apiKey);
    }
    if (inputs.instructorRepoToken) {
      core.setSecret(inputs.instructorRepoToken);
    }

    // ── Resolve the commit range ────────────────────────────────────────────
    const { baseSha, headSha } = await resolveSHAs(ctx, octokit, inputs);
    state.baseSha = baseSha;
    state.headSha = headSha;
    core.info(
      `Commit range: ${baseSha.substring(0, GIT_SHA_SHORT_LENGTH)}..${headSha.substring(0, GIT_SHA_SHORT_LENGTH)}`,
    );

    // ── Resolve the branch name ─────────────────────────────────────────────
    const branchName = resolveBranch(ctx);
    state.branchName = branchName;
    core.info(`Branch: ${branchName}`);

    // ── Resolve the submission identity ─────────────────────────────────────
    // The assignment and submitter come from the repository name and its direct
    // collaborators only — never from who pushed, who started the run, or who
    // authored the commits (see submission-identity.js).
    const identity = await resolveSubmissionIdentity({
      octokit,
      owner: ctx.repo.owner,
      repo: ctx.repo.repo,
    });
    const { assignment: assignmentName = '', submitter = '', studentLogin = '' } = identity;
    state.assignmentName = assignmentName;
    state.submitter = submitter;
    state.studentLogin = studentLogin;
    if (identity.error) {
      state.identityError = identity.error;
      core.info(`Submission identity unresolved: ${identity.error}.`);
    } else {
      core.info(`Assignment: ${assignmentName} · Submitter: ${submitter}`);
    }

    // ── Collect changed files and apply filters ─────────────────────────────
    const allFiles = getChangedFiles(baseSha, headSha);
    state.allFiles = allFiles;
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
    state.files = files;
    state.excludePatterns = excludePatterns;
    state.excludePatternOverrides = inputs.excludePatternOverrides;

    if (files.length === 0) {
      // Two distinct failures reach this point and they need different fixes,
      // so report them separately rather than behind one "no files" message.
      //
      //   Empty range     — base and head resolved to the same commit, so there
      //                     were no changed files to filter in the first place.
      //   Fully excluded  — files did change, but every one was removed by the
      //                     exclude patterns.
      //
      // Both occur normally at assignment-accept time, which is why this is not
      // a failure unless the instructor opts in. See fail_on_empty_assessment.
      // reportEmptyAssessment writes its own summary; suppress the final flush
      // so the run page does not show two.
      state.handled = true;
      await reportEmptyAssessment({
        reason: allFiles.length === 0 ? 'empty-range' : 'fully-excluded',
        baseSha,
        headSha,
        allFiles,
        excludePatterns,
        inputs,
      });
      return;
    }
    core.info(`Assessing ${files.length} file(s): ${files.join(', ')}`);
    state.fileStats = getDiffStat(baseSha, headSha, files);

    // ── Fetch diff content ──────────────────────────────────────────────────
    const diff = getDiff(baseSha, headSha, files);
    state.diffChars = diff.length;
    core.info(`Total diff size: ${diff.length} characters`);

    // ── Strip comments from changed files (unless keep_comments is set) ────
    const rawFiles = collectRawFiles(files, headSha);
    const rawContent = buildCodeContent(rawFiles);
    state.rawChars = rawContent.length;
    core.info(`Code size before comment stripping: ${rawContent.length} characters`);

    let processedFiles;
    if (inputs.keepComments) {
      core.info('Comment stripping skipped (keep_comments is true).');
      core.debug('No comments were removed from the code (keep_comments is true).');
      state.strippedChars = rawContent.length;
      processedFiles = rawFiles;
    } else {
      const { strippedFiles, strippedCharCount } = stripCommentsFromFiles(rawFiles);
      core.info(`Code size after comment stripping: ${strippedCharCount} characters`);
      core.debug(
        `--- CODE AFTER COMMENT STRIPPING ---\n${buildCodeContent(strippedFiles)}\n--- END CODE AFTER COMMENT STRIPPING ---`,
      );
      state.strippedChars = strippedCharCount;
      processedFiles = strippedFiles;
    }

    let codeContent = buildCodeContent(processedFiles);
    // Fall back to the raw diff if processing produced no output
    if (codeContent.trim() === '') {
      codeContent = diff;
      state.diagnostics.push('Processed code was empty, so the raw diff was assessed instead.');
      core.warning('Code content was empty after processing — falling back to raw diff.');
    }

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
    // Paths only — the contents are instructor material and never rendered.
    state.assignmentContextFiles = assignmentContextFiles;

    const messages = buildPrompt({
      codeContent,
      files,
      numQuestions: inputs.numQuestions,
      instructorContext: inputs.instructorContext,
      assignmentContext,
    });
    core.debug(`Prompt messages:\n${JSON.stringify(messages, null, 2)}`);

    core.info(
      `Calling ${inputs.aiProvider} (model: ${inputs.aiModel}) to generate ${inputs.numQuestions} questions…`,
    );

    const rawQuestions = truncateToMaxQuestions(
      renumberQuestions(
        await callAI({
          provider: inputs.aiProvider,
          model: inputs.aiModel,
          apiKey: inputs.apiKey,
          messages,
          retryMaxAttempts: inputs.aiRetryMaxAttempts,
          temperature: inputs.aiTemperature,
        }),
      ),
      inputs.numQuestions,
    );

    // Extract the AI-generated context summary (only present when instructorContext was set).
    const contextSummaryMatch = rawQuestions.match(
      /<!--\s*CONTEXT_SUMMARY\s*-->\n?([\s\S]*?)\n?<!--\s*\/CONTEXT_SUMMARY\s*-->/,
    );
    const contextSummary = contextSummaryMatch ? contextSummaryMatch[1].trim() : '';
    const cleanedQuestions = splitBoldAroundCode(
      boldQuestionLines(
        rawQuestions
          .replace(/<!--\s*CONTEXT_SUMMARY\s*-->[\s\S]*?<!--\s*\/CONTEXT_SUMMARY\s*-->\n*/g, '')
          .trim(),
      ),
    );

    // Always strip incorrect options for quiz; also strip the correct answer when
    // include_answers is false. cleanedQuestions retains answers for the instructor copy.
    const correctAnswers = extractCorrectAnswers(cleanedQuestions);
    let questions = stripAnswers(cleanedQuestions, { keepAnswers: inputs.includeAnswers });
    // Fail-closed backstop: withhold any question that either lacked a
    // recognisable answer block or whose correct-answer text survived redaction
    // (e.g. the model was injected into echoing it), rather than risk a leak.
    if (!inputs.includeAnswers) {
      const { text, structural, leak, dropped } = redactStudentQuestions(
        cleanedQuestions,
        questions,
        correctAnswers,
      );
      questions = text;
      state.questionsWithheld = dropped;
      if (structural > 0) {
        core.warning(
          `Structural guard: withheld ${structural} question(s) whose original block carried no ` +
            `recognisable **Answer:** heading, so the stripped view could not be confirmed ` +
            `answer-free — check the submitted code for prompt injection.`,
        );
      }
      if (leak > 0) {
        core.warning(
          `Answer-leak guard: withheld ${leak} question(s) whose correct-answer text survived ` +
            `redaction in the student view — check the submitted code for prompt injection.`,
        );
      }
      if (dropped > 0) {
        questions += `\n\n> [!NOTE]\n> ${dropped} question(s) were withheld from this report pending instructor review.`;
      }
    }
    questions = normaliseSeparators(questions);
    state.questionsGenerated = countQuestions(questions);

    // ── Build base report (PDF source — no self-referencing link) ───────────
    const sourceRepo = `${ctx.repo.owner}/${ctx.repo.repo}`;

    const baseReport = formatReport({
      questions,
      files,
      baseSha,
      headSha,
      provider: inputs.aiProvider,
      model: inputs.aiModel,
      branchName,
      assignmentContextFiles,
      contextSummary,
      studentLogin: submitter,
      sourceRepo,
    });

    // ── Generate PDF and upload to rolling release ───────────────────────────
    // Named after the repository, which for a Classroom 50 repo already carries
    // the assignment and student, so the asset name never depends on identity.
    const pdfFilename = `grill-my-code-${safeFilePart(ctx.repo.repo)}.pdf`;
    let pdfUrl = null;
    let pdfBuffer = null;
    try {
      pdfBuffer = await generatePdf(baseReport);
    } catch (err) {
      state.pdfError = err.message;
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
        state.pdfError = err.message;
        core.warning(`PDF upload failed: ${err.message} — issue will post without a PDF link.`);
      }
    }
    state.pdfUrl = pdfUrl || '';
    core.setOutput('pdf_url', pdfUrl || '');

    // ── Format issue body (base report + PDF download link) ─────────────────
    const issueBody = formatReport({
      questions,
      files,
      baseSha,
      headSha,
      provider: inputs.aiProvider,
      model: inputs.aiModel,
      branchName,
      assignmentContextFiles,
      contextSummary,
      studentLogin: submitter,
      sourceRepo,
      pdfUrl,
    });

    core.setOutput('questions', questions);
    core.setOutput('code_before_strip', rawContent);
    core.setOutput('code_after_strip', buildCodeContent(processedFiles));

    // ── Guard: GitHub issue bodies cap at 65 536 characters ──────────────────
    const ISSUE_BODY_LIMIT = 65_000;
    core.info(`Issue body: ${issueBody.length} characters`);
    const safeIssueBody =
      issueBody.length > ISSUE_BODY_LIMIT
        ? issueBody.slice(0, ISSUE_BODY_LIMIT) +
          '\n\n---\n\n> [!WARNING]\n> The assessment was too long to display in full here. ' +
          (pdfUrl
            ? `[Download the complete PDF](${pdfUrl}) for all questions.`
            : 'Re-run with fewer questions to see the full output.')
        : issueBody;

    if (issueBody.length > ISSUE_BODY_LIMIT) {
      state.diagnostics.push(
        `The assessment was too long for a GitHub issue and was truncated there` +
          `${pdfUrl ? ' — the PDF has the complete set' : ''}.`,
      );
      core.warning(
        `Issue body exceeded ${ISSUE_BODY_LIMIT} characters (${issueBody.length}) and was truncated. ` +
          'Consider reducing num_questions or using a shorter instructor_context.',
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
    state.issueUrl = issueResult.url;
    state.issueNumber = issueResult.number;

    // ── Write to instructor repository ──────────────────────────────────────
    if (!inputs.instructorRepoToken) {
      state.instructorDelivery = 'skipped';
      core.info('instructor_repo_token is not set — skipping instructor repository delivery.');
    } else if (identity.error) {
      // Filing under a guessed name is worse than not filing: it lands under the
      // wrong student or creates a stray instructor repository.
      state.instructorDelivery = 'unresolved';
      core.warning(
        `Instructor repository delivery skipped: ${identity.error}. ` +
          `Delivery needs a repository created by Classroom 50 whose student is still a ` +
          `direct collaborator on it. The student's assessment issue and PDF are unaffected.`,
      );
    } else {
      const instructorOctokit = github.getOctokit(inputs.instructorRepoToken, {
        headers: { 'X-GitHub-Api-Version': GITHUB_API_VERSION },
      });
      const instructorRepoName = assignmentName + INSTRUCTOR_REPO_SUFFIX;
      // Keep answers and distractors for the instructor copy; only drop the
      // invisible answer-container markers so the rendered Markdown stays clean.
      const instructorQuestions = cleanedQuestions.replace(ANSWER_MARKER_LINE_RE, '');
      const instructorReport = formatReport({
        questions: instructorQuestions,
        files,
        baseSha,
        headSha,
        provider: inputs.aiProvider,
        model: inputs.aiModel,
        branchName,
        assignmentContextFiles,
        contextSummary,
        studentLogin: submitter,
        sourceRepo: `${ctx.repo.owner}/${ctx.repo.repo}`,
      });
      try {
        await deliverToInstructorRepo({
          octokit: instructorOctokit,
          owner: ctx.repo.owner,
          instructorRepoName,
          studentLogin: submitter,
          content: instructorReport,
          headSha,
        });
        state.instructorDelivery = 'delivered';
      } catch (err) {
        state.instructorDelivery = 'failed';
        state.instructorError = err.message;
        core.error(
          `Failed to write to instructor repository ${ctx.repo.owner}/${instructorRepoName}: ${err.message}`,
        );
      }
    }
  } catch (err) {
    state.failureMessage = err.message;
    core.setFailed(`Assessment failed: ${err.message}`);
  } finally {
    await writeRunSummary(state);
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

run();
