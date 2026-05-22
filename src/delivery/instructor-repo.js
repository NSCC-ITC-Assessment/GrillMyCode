/**
 * Delivery: Write Assessment to Instructor Repository
 *
 * Creates or replaces the instructor assessment file (questions + answers) in
 * a private instructor-only repository using the GitHub Contents API. The
 * repository is created automatically if it does not already exist.
 *
 * The file is written to {studentLogin}/questions.md inside the repository.
 * The repository is named {assignmentName}-grillmycode and lives in the same
 * organisation as the student repositories.
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

      - name: Extract questions and answers for Brightspace
        env:
          STUDENT_DIR: \${{ steps.student.outputs.dir }}
          STUDENT: \${{ github.actor }}
          TIMESTAMP: \${{ github.event.head_commit.timestamp }}
        run: |
          python3 <<'PYEOF'
          import os
          student_dir = os.environ['STUDENT_DIR']
          student = os.environ.get('STUDENT', 'unknown')
          timestamp = os.environ.get('TIMESTAMP', '')
          qmd = os.path.join(student_dir, 'questions.md')
          out = os.path.join(student_dir, 'future_brightspace_quiz.txt')
          with open(qmd) as f:
              content = f.read()
          NL = chr(10)
          blocks = content.split(NL + '---' + NL)
          results = []
          for block in blocks:
              question = None
              answer = None
              incorrect = []
              in_inc = False
              for line in block.splitlines():
                  if not question and line and line[0].isdigit() and '. ' in line:
                      question = line.split('. ', 1)[1].strip()
                  elif line.startswith('   **Answer:** '):
                      answer = line[15:].strip()
                      in_inc = False
                  elif line.startswith('   **Incorrect Options:**'):
                      in_inc = True
                  elif in_inc and line.startswith('   - '):
                      incorrect.append(line[5:].strip())
              if question and answer:
                  results.append((question, answer, incorrect))
          with open(out, 'w') as f:
              print('Brightspace Quiz Extract', file=f)
              print('========================', file=f)
              print('Student  :', student, file=f)
              print('Triggered:', timestamp, file=f)
              print(file=f)
              for i, (q, a, opts) in enumerate(results, 1):
                  print(f'Question {i}:', file=f)
                  print(q, file=f)
                  print(file=f)
                  print(file=f)
                  print(f'- [CORRECT] {a}', file=f)
                  for opt in opts:
                      print(f'- {opt}', file=f)
                  print(file=f)
                  print('-' * 40, file=f)
                  print(file=f)
          PYEOF

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
