/**
 * Delivery: Write Assessment to Instructor Repository
 *
 * Creates or replaces the instructor assessment file (questions + answers) in
 * a private instructor-only repository using the GitHub Contents API. The
 * repository is created automatically if it does not already exist.
 *
 * The file is written to {studentLogin}/questions.md inside the repository.
 * The repository is named {assignmentName}-grillmycode and lives in the same
 * organization as the student repositories.
 *
 * A separate instructor PAT (instructor_repo_token) is used for all API calls
 * in this module — the student's github_token is never used here.
 */

import * as core from '@actions/core';
import { Buffer } from 'node:buffer';
import {
  GIT_SHA_SHORT_LENGTH,
  INSTRUCTOR_REPO_DEFAULT_BRANCH,
  INSTRUCTOR_REPO_INIT_RETRIES,
  INSTRUCTOR_REPO_INIT_RETRY_DELAY_MS,
} from '../constants.js';

/**
 * GitHub Actions workflow YAML committed into each newly-created instructor
 * repository.  It fires whenever a student's questions.md file is pushed.
 * Currently it logs the trigger event and writes a future_brightspace_quiz.txt
 * placeholder — a stub for the Brightspace quiz generation that will be
 * implemented here in a future release.
 */
const STUDENT_QUESTIONS_WORKFLOW = `name: Student Questions Added

on:
  push:
    paths:
      - '*/questions.md'

jobs:
  notify:
    name: Acknowledge student questions
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v6
        with:
          fetch-depth: 2

      - name: Log trigger
        run: |
          echo "A student questions file was added or updated."
          echo "Repository : \${{ github.repository }}"
          echo "Triggered by: \${{ github.actor }}"
          echo "Ref        : \${{ github.ref }}"

      - name: Get student directory
        id: student
        run: |
          CHANGED=$(git diff HEAD~1 HEAD --name-only | grep 'questions[.]md$' | head -1)
          echo "dir=$(dirname "$CHANGED")" >> "$GITHUB_OUTPUT"

      - name: Install Node.js dependencies
        run: npm install --prefix /tmp/quiz-deps prismjs

      - name: Extract questions and answers for Brightspace
        env:
          STUDENT_DIR: \${{ steps.student.outputs.dir }}
          STUDENT: \${{ github.actor }}
          TIMESTAMP: \${{ github.event.head_commit.timestamp }}
        run: |
          node <<'JSEOF'
          const fs = require('fs');
          const path = require('path');
          const Prism = require('/tmp/quiz-deps/node_modules/prismjs');
          const loadLanguages = require('/tmp/quiz-deps/node_modules/prismjs/components/index.js');
          loadLanguages(['javascript','typescript','jsx','tsx','python','ruby','java','kotlin','csharp','cpp','c','go','rust','php','swift','bash','css','scss','yaml','json','sql','markdown']);

          function detectLang(fp) {
            if (!fp) return 'plaintext';
            const ext = fp.split('.').pop().toLowerCase();
            const map = {
              js: 'javascript', mjs: 'javascript', cjs: 'javascript',
              ts: 'typescript', tsx: 'tsx', jsx: 'jsx',
              py: 'python', rb: 'ruby', java: 'java', kt: 'kotlin',
              cs: 'csharp', cpp: 'cpp', c: 'c', go: 'go', rs: 'rust',
              php: 'php', swift: 'swift', sh: 'bash', bash: 'bash',
              html: 'markup', htm: 'markup', xml: 'markup',
              css: 'css', scss: 'scss', json: 'json',
              yml: 'yaml', yaml: 'yaml', sql: 'sql', md: 'markdown',
            };
            return map[ext] || 'plaintext';
          }

          const studentDir = process.env.STUDENT_DIR;
          const student = process.env.STUDENT || 'unknown';
          const timestamp = process.env.TIMESTAMP || '';

          const qmd = path.join(studentDir, 'questions.md');
          const out = path.join(studentDir, 'future_brightspace_quiz.txt');

          const content = fs.readFileSync(qmd, 'utf8');
          const blocks = content.split('\\n---\\n');
          const results = [];
          let lastFilePath = null;
          let lastSnippet = null;

          for (const block of blocks) {
            let question = null, answer = null, filePath = null;
            const incorrect = [], snippetLines = [];
            let inInc = false, inSnippet = false;

            for (const line of block.split('\\n')) {
              const stripped = line.trim();
              const fpMatch = !question && stripped.match(/^\\*\\*\`(.+?)\`\\*\\*\\s*$/);
              if (fpMatch) {
                filePath = fpMatch[1];
              } else if (stripped.startsWith('\`\`\`') && !question) {
                inSnippet = !inSnippet;
              } else if (inSnippet) {
                snippetLines.push(line.trimEnd());
              } else if (!question && line && /^\\d+\\. /.test(line)) {
                question = line.split('. ').slice(1).join('. ').trim();
              } else if (stripped.startsWith('**Answer:** ')) {
                answer = stripped.slice('**Answer:** '.length).trim();
                inInc = false;
              } else if (stripped.startsWith('**Incorrect Options for Quiz:**')) {
                inInc = true;
              } else if (inInc && stripped.startsWith('- ')) {
                incorrect.push(stripped.slice(2).trim());
              }
            }

            if (filePath) lastFilePath = filePath;
            else filePath = lastFilePath;
            const finalSnippet = snippetLines.length ? snippetLines : (lastSnippet || []);
            if (snippetLines.length) lastSnippet = snippetLines;

            if (question && answer) {
              results.push({ question, answer, incorrect, filePath, snippet: finalSnippet });
            }
          }

          const lines = [
            'Brightspace Quiz Extract',
            '========================',
            'Student  : ' + student,
            'Triggered: ' + timestamp,
            '',
          ];

          results.forEach(function(item, i) {
            lines.push('Question ' + (i + 1) + ':');
            if (item.filePath) lines.push('File: ' + item.filePath);
            if (item.snippet.length) {
              const lang = detectLang(item.filePath);
              const code = item.snippet.join('\n');
              const grammar = Prism.languages[lang];
              const highlighted = grammar ? Prism.highlight(code, grammar, lang) : code;
              lines.push('Language: ' + lang + '  [colorized-html]');
              lines.push('');
              highlighted.split('\n').forEach(function(hl) { lines.push(hl); });
            }
            lines.push('', item.question, '', '- [CORRECT] ' + item.answer);
            item.incorrect.forEach(function(opt) { lines.push('- ' + opt); });
            lines.push('', '-'.repeat(40), '');
          });

          fs.writeFileSync(out, lines.join('\\n'));
          JSEOF

      - name: Commit placeholder file
        run: |
          STUDENT_DIR="\${{ steps.student.outputs.dir }}"
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add "$STUDENT_DIR/future_brightspace_quiz.txt"
          git diff --staged --quiet || git commit -m "chore: update Brightspace quiz extract for \${{ github.actor }} [skip ci]"
          git pull --rebase
          git push
`;

const STUDENT_QUESTIONS_WORKFLOW_PATH = '.github/workflows/student-questions-added.yml';

/**
 * Ensures the instructor repository exists, creating it (private) if not.
 * On creation: polls until auto_init's commit lands, then commits the
 * student-questions workflow so it is present before the first questions.md
 * write triggers it.
 */
async function ensureInstructorRepo(octokit, owner, instructorRepoName) {
  try {
    await octokit.rest.repos.get({ owner, repo: instructorRepoName });
    return; // already exists
  } catch (err) {
    if (err.status !== 404) throw err;
  }

  core.info(`Instructor repository ${owner}/${instructorRepoName} not found — creating it now.`);
  const { data: newRepo } = await octokit.rest.repos.createInOrg({
    org: owner,
    name: instructorRepoName,
    private: true,
    auto_init: true,
  });

  const defaultBranch = newRepo.default_branch || INSTRUCTOR_REPO_DEFAULT_BRANCH;

  // auto_init is asynchronous — poll until the branch ref exists before writing.
  for (let attempt = 1; attempt <= INSTRUCTOR_REPO_INIT_RETRIES; attempt++) {
    try {
      await octokit.rest.git.getRef({
        owner,
        repo: instructorRepoName,
        ref: `heads/${defaultBranch}`,
      });
      break; // branch is ready
    } catch (err) {
      if (err.status !== 404 && err.status !== 409) throw err;
      if (attempt === INSTRUCTOR_REPO_INIT_RETRIES) {
        throw new Error(
          `Timed out waiting for ${owner}/${instructorRepoName} default branch to initialise.`,
          { cause: err },
        );
      }
      core.info(
        `Waiting for ${owner}/${instructorRepoName} to initialise (attempt ${attempt}/${INSTRUCTOR_REPO_INIT_RETRIES})…`,
      );
      await new Promise((resolve) => setTimeout(resolve, INSTRUCTOR_REPO_INIT_RETRY_DELAY_MS));
    }
  }

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo: instructorRepoName,
    path: STUDENT_QUESTIONS_WORKFLOW_PATH,
    message: 'chore: add student-questions-added workflow [skip ci]',
    content: Buffer.from(STUDENT_QUESTIONS_WORKFLOW, 'utf-8').toString('base64'),
  });

  core.info(
    `Instructor repository ${owner}/${instructorRepoName} created (private) with student-questions workflow.`,
  );
}

/**
 * Writes the instructor assessment file to the instructor repository.
 *
 * @param {object} params
 * @param {import('@octokit/rest').Octokit} params.octokit  - Instructor PAT Octokit instance.
 * @param {string}  params.owner               - GitHub org/user owning the instructor repo.
 * @param {string}  params.instructorRepoName  - Instructor repository name (no owner prefix).
 * @param {string}  params.studentLogin        - GitHub login of the assessed student.
 * @param {string}  params.content             - Markdown report content to write.
 * @param {string}  params.headSha             - Head commit SHA (used in commit message).
 */
export async function deliverToInstructorRepo({
  octokit,
  owner,
  instructorRepoName,
  studentLogin,
  content,
  headSha,
}) {
  await ensureInstructorRepo(octokit, owner, instructorRepoName);

  const filePath = `${studentLogin}/questions.md`;
  const shortHead = headSha.substring(0, GIT_SHA_SHORT_LENGTH);
  const message = `chore: update assessment for ${studentLogin} at ${shortHead}`;

  // Fetch the existing file's blob SHA (required by the API when updating).
  // The student folder is created implicitly by the API if it does not exist.
  let existingSha;
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo: instructorRepoName,
      path: filePath,
    });
    existingSha = data.sha;
  } catch (err) {
    if (err.status !== 404) throw err;
    // File (and folder) does not exist yet — both will be created.
  }

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo: instructorRepoName,
    path: filePath,
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    sha: existingSha,
  });

  core.info(`Instructor assessment written to ${owner}/${instructorRepoName}/${filePath}`);
  // Note: [skip ci] is intentionally absent from this commit message.
  // The student-questions-added workflow in the instructor repository is
  // triggered by this push and must not be suppressed.
}
