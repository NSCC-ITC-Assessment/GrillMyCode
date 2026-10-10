/**
 * Report Formatter
 *
 * Pure Markdown assembly — takes the generated questions and metadata and
 * returns the final report string. No side effects, no I/O.
 */

import {
  DEFAULT_QUESTION_EMPHASIS,
  GIT_SHA_SHORT_LENGTH,
  ISSUE_LAYOUT_VERSION,
  LOGO_HEADING_HEIGHT_PX,
  LOGO_URL,
} from './constants.js';

/**
 * Logo beside the report heading. The report is also the PDF source, where
 * pdf.js drops all raw HTML except this exact tag, which it swaps for an
 * embedded copy of the logo.
 */
export const LOGO_IMG = `<img src="${LOGO_URL}" alt="" height="${LOGO_HEADING_HEIGHT_PX}" align="absmiddle">`;

/** How the hidden comment that carries an issue's questions as data opens. */
export const QUESTIONS_COMMENT_OPEN = '<!-- gmc:questions ';

/**
 * JSON for embedding in an HTML comment in a report. `<` and `>` are written
 * as JSON escapes so no value can close the comment early, and so are `@`, `#`
 * and the backtick, which postIssue's auto-link defusing would otherwise act
 * on, putting a zero-width space into a file path. The result still parses as
 * the same JSON.
 */
function commentJson(record) {
  return JSON.stringify(record).replace(
    /[<>@#`]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

/**
 * The hidden comment that carries a student's questions as data, for the
 * editor extensions and as the mark postIssue knows its own issues by:
 *
 *   <!-- gmc:questions {"version":1,"headSha":"…","questions":[…]} -->
 *
 * Each question is its entry in questions.json (buildQuestionsJson in
 * src/delivery/instructor-repo.js) less the question text, the code, the
 * answer and the distractors: its number, whether it is a broader question,
 * and the file and lines of each snippet. The student can read this comment,
 * so it must never carry an answer or a distractor.
 *
 * `version` is ISSUE_LAYOUT_VERSION, which covers the Markdown around the
 * comment as well. `headSha` is the full SHA the report prints the start of.
 *
 * @param {object} data
 * @param {string} data.headSha
 * @param {{ number: number, broader: boolean, snippets: { file: string, start: number, end: number }[] }[]} data.questions -
 *   The numbered questions the report shows, less any the answer-leak guard
 *   withheld.
 */
export function questionsComment({ headSha, questions }) {
  const record = {
    version: ISSUE_LAYOUT_VERSION,
    headSha,
    questions: questions.map((q) => ({
      number: q.number,
      broader: q.broader,
      snippets: q.snippets.map(({ file, start, end }) => ({
        file,
        start_line: start,
        end_line: end,
      })),
    })),
  };
  return `${QUESTIONS_COMMENT_OPEN}${commentJson(record)} -->`;
}

/**
 * Assembles the full Markdown assessment report.
 *
 * The optional `studentLogin`, `sourceRepo`, and `allChangedFiles` parameters
 * are used when generating the instructor copy of the report:
 *   - studentLogin     — GitHub login of the assessed student
 *   - sourceRepo       — full "owner/repo" name of the student's repository
 *   - allChangedFiles  — unfiltered list of all files changed since the base
 *                        SHA; when provided it replaces the filtered `files`
 *                        list in the report metadata
 *
 * `issueQuestions` is given for the student's issue alone: the questions the
 * report shows, as data, which go under the heading as a hidden comment (see
 * questionsComment). It sits at the top so a report cut short for length
 * keeps it, and after the heading because a reader written before the comment
 * existed expects the heading first.
 *
 * @param {object} report
 * @param {string} report.questions - The questions, already rendered as Markdown.
 * @param {string[]} report.files
 * @param {string} report.baseSha
 * @param {string} report.headSha
 * @param {string} report.provider
 * @param {string} report.model
 * @param {string} [report.branchName]
 * @param {string} [report.tagName]
 * @param {string} [report.previousTagName]
 * @param {string[]} [report.assignmentContextFiles]
 * @param {string[]} [report.codebaseContextFiles]
 * @param {number} [report.starterQuestions]
 * @param {string} [report.contextSummary]
 * @param {string} [report.studentLogin]
 * @param {string} [report.sourceRepo]
 * @param {string[]} [report.allChangedFiles]
 * @param {string | null} [report.pdfUrl]
 * @param {string} [report.submissionNote]
 * @param {Parameters<typeof questionsComment>[0]['questions']} [report.issueQuestions]
 */
export function formatReport({
  questions,
  files,
  baseSha,
  headSha,
  provider,
  model,
  branchName,
  tagName,
  previousTagName,
  assignmentContextFiles,
  codebaseContextFiles,
  starterQuestions = 0,
  contextSummary,
  studentLogin,
  sourceRepo,
  allChangedFiles,
  pdfUrl,
  submissionNote,
  issueQuestions,
}) {
  const date = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  const shortBase = baseSha.substring(0, GIT_SHA_SHORT_LENGTH);
  const shortHead = headSha.substring(0, GIT_SHA_SHORT_LENGTH);
  const displayFiles = allChangedFiles ?? files;
  const fileList = displayFiles.map((f) => `\`${f}\``).join(', ');

  const isDefaultBranch = !branchName || branchName === 'main' || branchName === 'master';
  const branchNote = isDefaultBranch ? '' : `> **Branch:** \`${branchName}\`\n`;

  // A backtick is legal in a tag name and would close the code span early.
  const refCode = (name) => `\`${name.replace(/`/g, "'")}\``;
  const tagNote = tagName
    ? `> **Submission tag:** ${refCode(tagName)}` +
      (previousTagName ? ` (changes since ${refCode(previousTagName)})` : '') +
      '\n'
    : '';

  const contextNote =
    assignmentContextFiles && assignmentContextFiles.length > 0
      ? `> **Assignment Context:** ${assignmentContextFiles.map((f) => `\`${f}\``).join(', ')}\n`
      : '';

  // A count rather than a list: the rest of a codebase can run to dozens of
  // files, and the run log carries the names. "Not assessed" alone would read
  // to a student as safe to ignore, but an answer may depend on those files.
  const codebaseContextNote =
    codebaseContextFiles && codebaseContextFiles.length > 0
      ? `> **Codebase context:** ${codebaseContextFiles.length} other file${codebaseContextFiles.length === 1 ? '' : 's'}, not assessed; answers may depend on ${codebaseContextFiles.length === 1 ? 'it' : 'them'}\n`
      : '';

  // starter_code: ask. Said outright, so a student is not left wondering why
  // a question asks about code they never wrote.
  const starterNote =
    starterQuestions > 0
      ? `> **Starter code:** ${starterQuestions} question${starterQuestions === 1 ? ' is' : 's are'} about the provided starter code\n`
      : '';

  const instructorContextNote = contextSummary ? `> **Instructor Note:** ${contextSummary}\n` : '';

  const studentNote = studentLogin ? `\n> **Student:** \`${studentLogin}\`\n` : '';
  // Instructor copy only: flags a resubmission under the same tag.
  const submissionLine = submissionNote ? `> **Submission:** ${submissionNote}\n` : '';
  const sourceRepoNote = sourceRepo ? `> **Repository:** \`${sourceRepo}\`\n` : '';

  const pdfBadge = pdfUrl
    ? [
        `[![Download as PDF](https://img.shields.io/badge/Download_as_PDF-DC143C?style=for-the-badge&logo=adobeacrobatreader&logoColor=white)](${pdfUrl})`,
        '',
      ]
    : [];

  const dataComment = issueQuestions
    ? [questionsComment({ headSha, questions: issueQuestions }), '']
    : [];

  return [
    `## ${LOGO_IMG} GrillMyCode`,
    '',
    ...dataComment,
    ...pdfBadge,
    `> **Generated:** ${date}`,
    studentNote,
    sourceRepoNote,
    `> **Commits reviewed:** \`${shortBase}\` → \`${shortHead}\``,
    branchNote,
    tagNote,
    submissionLine,
    `> **Code Files Assessed:** ${fileList}`,
    contextNote,
    codebaseContextNote,
    starterNote,
    instructorContextNote,
    '---',
    '',
    questions,
    '',
    '---',
    '',
    `_Generated by **GrillMyCode** · ${model} via ${provider}${process.env.GITHUB_ACTION_REF ? ` · ${process.env.GITHUB_ACTION_REF}` : ''}_`,
  ].join('\n');
}

/**
 * Plain-language glosses for the finish reasons worth explaining in the raw
 * output header. Anything else is shown as the bare value.
 */
const FINISH_REASON_NOTES = {
  stop: 'the model finished its reply',
  length: 'the output token limit was reached, so the reply is incomplete',
  content_filter: 'a content filter stopped the reply, so it may be incomplete',
};

/** Formats a count with thousands separators, or "?" when it is unknown. */
function formatCount(value) {
  return typeof value === 'number' ? value.toLocaleString('en-US') : '?';
}

/**
 * Serialises the provenance record for embedding in an HTML comment. `<` and
 * `>` are written as JSON escapes so no value — a model name, a provider's
 * error text — can close the comment early; the result still parses as JSON.
 */
function provenanceComment(record) {
  const json = JSON.stringify(record).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  return `<!-- gmc:provenance ${json} -->`;
}

/**
 * Assembles the verbatim copy of the model's reply, with a short provenance
 * header above it.
 *
 * The reply is JSON (see prompt/prompt.js), so it is fenced as JSON, unaltered. The
 * fence is one backtick longer than the longest run in the reply, as in
 * formatPrompt, so nothing the model wrote — a reply it wrapped in a fence of
 * its own, say — can close it early and corrupt the very copy this file exists
 * to preserve.
 *
 * The header is written twice over: readable lines for an instructor, and a
 * `<!-- gmc:provenance {...} -->` comment holding the same facts as JSON, with
 * full SHAs, for tooling. The comment renders as nothing. Its `version` field
 * is bumped whenever a field changes meaning or is removed.
 *
 * @param {object} opts
 * @param {string} opts.rawOutput
 * @param {string} opts.baseSha
 * @param {string} opts.headSha
 * @param {string} opts.provider
 * @param {string} opts.model
 * @param {string} [opts.studentLogin]
 * @param {string} [opts.sourceRepo]
 * @param {any} [opts.request]  - What was asked for: `numQuestions`,
 *   `questionsAsked` (num_questions plus the spares the prompt asked for),
 *   `questionEmphasis`, `temperature` (null when none was sent),
 *   `reasoningEffort`, `promptHash`, `actionRef`
 * @param {any} [opts.response] - The metadata callAI returns
 */
export function formatRawOutput({
  rawOutput,
  baseSha,
  headSha,
  provider,
  model,
  studentLogin,
  sourceRepo,
  request,
  response,
}) {
  const generatedAt = new Date().toISOString();
  const date = generatedAt.replace('T', ' ').substring(0, 19) + ' UTC';
  const shortBase = baseSha.substring(0, GIT_SHA_SHORT_LENGTH);
  const shortHead = headSha.substring(0, GIT_SHA_SHORT_LENGTH);

  const studentNote = studentLogin ? `> **Student:** \`${studentLogin}\`\n` : '';
  const sourceRepoNote = sourceRepo ? `> **Repository:** \`${sourceRepo}\`\n` : '';

  const requestLines = [];
  if (request) {
    // The reply below holds up to `questionsAsked` questions, so the count is
    // given beside num_questions wherever spares were asked for.
    const asked =
      request.questionsAsked > request.numQuestions
        ? ` (${request.questionsAsked} asked of the model, with spares)`
        : '';
    const settings = [`${request.numQuestions} questions requested${asked}`];
    // Only a tilt is worth a mention; balanced is the prompt as it always was.
    if (request.questionEmphasis && request.questionEmphasis !== DEFAULT_QUESTION_EMPHASIS) {
      settings.push(`${request.questionEmphasis} emphasis`);
    }
    // Only a temperature that was sent is worth a mention; otherwise the model
    // ran at its own.
    if (typeof request.temperature === 'number') {
      settings.push(`temperature ${request.temperature}`);
    }
    // `default` sends no reasoning setting, so the model decided — say so
    // rather than print a level nobody asked for.
    if (request.reasoningEffort) {
      settings.push(
        request.reasoningEffort === 'default'
          ? 'reasoning: model default'
          : `reasoning \`${request.reasoningEffort}\``,
      );
    }
    if (request.promptHash) settings.push(`prompt \`${request.promptHash}\``);
    if (request.actionRef) settings.push(`action \`${request.actionRef}\``);
    requestLines.push(`> - **Settings:** ${settings.join(' · ')}`);
  }

  const responseLines = [];
  if (response) {
    const servedParts = [];
    if (response.servedModel && response.servedModel !== model) {
      servedParts.push(`\`${response.servedModel}\``);
    }
    if (response.servedProvider) servedParts.push(`via ${response.servedProvider}`);
    if (servedParts.length > 0) responseLines.push(`> - **Served by:** ${servedParts.join(' ')}`);

    const note = FINISH_REASON_NOTES[response.finishReason];
    const native =
      response.nativeFinishReason && response.nativeFinishReason !== response.finishReason
        ? ` (native: \`${response.nativeFinishReason}\`)`
        : '';
    responseLines.push(
      `> - **Stopped because:** \`${response.finishReason}\`${native}${note ? ` — ${note}` : ''}`,
    );

    if (response.usage) {
      const { promptTokens, completionTokens, reasoningTokens } = response.usage;
      const reasoning = reasoningTokens ? ` (${formatCount(reasoningTokens)} reasoning)` : '';
      responseLines.push(
        `> - **Tokens:** ${formatCount(promptTokens)} in · ${formatCount(completionTokens)} out${reasoning}`,
      );
    }

    const retries = response.attempts - 1;
    const retryNote = retries > 0 ? ` (${retries} ${retries === 1 ? 'retry' : 'retries'})` : '';
    const seconds = (response.durationMs / 1000).toFixed(1);
    responseLines.push(`> - **Attempts:** ${response.attempts}${retryNote} · ${seconds} s`);
  }

  const longestRun = Math.max(0, ...(rawOutput.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(Math.max(3, longestRun + 1));

  const provenance = provenanceComment({
    version: 2,
    generatedAt,
    studentLogin: studentLogin ?? null,
    sourceRepo: sourceRepo ?? null,
    baseSha,
    headSha,
    provider,
    model,
    request: request ?? null,
    response: response ?? null,
  });

  return [
    '## GrillMyCode — Raw AI Output',
    '',
    '> [!NOTE]',
    "> Everything below the rule is the model's reply exactly as received, before",
    '> GrillMyCode parsed, checked, numbered or formatted it. It is kept for',
    '> diagnosis and is not the assessment — see `questions.md` for that.',
    '',
    `> **Generated:** ${date}`,
    studentNote,
    sourceRepoNote,
    `> **Commits reviewed:** \`${shortBase}\` → \`${shortHead}\``,
    `> **Model:** \`${model}\` via ${provider}`,
    // A list, because GitHub joins consecutive quoted lines of a .md file into
    // one paragraph and these would otherwise run together.
    ...(responseLines.length + requestLines.length > 0 ? ['>'] : []),
    ...responseLines,
    ...requestLines,
    '',
    provenance,
    '',
    '---',
    '',
    `${fence}json`,
    rawOutput,
    fence,
    '',
  ].join('\n');
}

/**
 * Assembles the prompt copy filed by the undocumented log_prompt input: each
 * chat message sent to the model, under its role, verbatim.
 *
 * Unlike the raw output, each message is fenced — the system message is long
 * and full of Markdown that would otherwise render as this file's own
 * structure. The fence is one backtick longer than the longest run inside the
 * message, so the student's code and the prompt's own examples cannot close it
 * early.
 *
 * @param {object} opts
 * @param {Array<{role: string, content: string}>} opts.messages - As sent to callAI
 * @param {string} opts.baseSha
 * @param {string} opts.headSha
 * @param {string} opts.model
 * @param {string} [opts.studentLogin]
 */
export function formatPrompt({ messages, baseSha, headSha, model, studentLogin }) {
  const date = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  const shortBase = baseSha.substring(0, GIT_SHA_SHORT_LENGTH);
  const shortHead = headSha.substring(0, GIT_SHA_SHORT_LENGTH);

  const sections = messages.map(({ role, content }) => {
    const text = String(content ?? '');
    const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
    const fence = '`'.repeat(Math.max(3, longestRun + 1));
    return [`### ${role}`, '', `${fence}text`, text, fence].join('\n');
  });

  return [
    '## GrillMyCode — AI Prompt',
    '',
    // A list, because GitHub joins consecutive quoted lines into one paragraph.
    `> - **Generated:** ${date}`,
    ...(studentLogin ? [`> - **Student:** \`${studentLogin}\``] : []),
    `> - **Commits reviewed:** \`${shortBase}\` → \`${shortHead}\``,
    `> - **Model:** \`${model}\``,
    '',
    '---',
    '',
    sections.join('\n\n'),
    '',
  ].join('\n');
}
