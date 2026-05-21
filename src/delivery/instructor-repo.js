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
  INSTRUCTOR_REPO_INIT_RETRIES,
  INSTRUCTOR_REPO_INIT_RETRY_DELAY_MS,
} from '../constants.js';

/**
 * GitHub Actions workflow YAML committed into each newly-created instructor
 * repository.  It fires whenever a student's questions.md file is pushed and
 * currently serves as a proof-of-concept trigger — the "notify" step simply
 * logs the event so you can confirm the pipeline executes.
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
    steps:
      - name: Log trigger
        run: |
          echo "A student questions file was added or updated."
          echo "Repository : \${{ github.repository }}"
          echo "Triggered by: \${{ github.actor }}"
          echo "Ref        : \${{ github.ref }}"
`;

const STUDENT_QUESTIONS_WORKFLOW_PATH = '.github/workflows/student-questions-added.yml';

/**
 * Commits the student-questions workflow into the instructor repo if it does
 * not already exist.  Called once, immediately after repo creation.
 */
async function ensureStudentQuestionsWorkflow(octokit, owner, instructorRepoName) {
  try {
    await octokit.rest.repos.getContent({
      owner,
      repo: instructorRepoName,
      path: STUDENT_QUESTIONS_WORKFLOW_PATH,
    });
    // File already present — nothing to do.
    return;
  } catch (err) {
    if (err.status !== 404) throw err;
  }

  // Retry because GitHub's auto_init is asynchronous — the default branch may
  // not be ready for writes until a moment after createInOrg returns.
  let lastErr;
  for (let attempt = 1; attempt <= INSTRUCTOR_REPO_INIT_RETRIES; attempt++) {
    try {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo: instructorRepoName,
        path: STUDENT_QUESTIONS_WORKFLOW_PATH,
        message: 'chore: add student-questions-added workflow [skip ci]',
        content: Buffer.from(STUDENT_QUESTIONS_WORKFLOW, 'utf-8').toString('base64'),
      });
      core.info(
        `Workflow committed to ${owner}/${instructorRepoName}/${STUDENT_QUESTIONS_WORKFLOW_PATH}`,
      );
      return;
    } catch (err) {
      if (err.status !== 404) throw err;
      core.info(
        `Instructor repo not yet ready (attempt ${attempt}/${INSTRUCTOR_REPO_INIT_RETRIES}) — retrying in ${INSTRUCTOR_REPO_INIT_RETRY_DELAY_MS}ms…`,
      );
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, INSTRUCTOR_REPO_INIT_RETRY_DELAY_MS));
    }
  }
  throw lastErr;
}

/**
 * Ensures the instructor repository exists, creating it (private) if not.
 * When the repository is first created the student-questions workflow is also
 * committed so it is available from the very first push.
 */
async function ensureInstructorRepo(octokit, owner, instructorRepoName) {
  try {
    await octokit.rest.repos.get({ owner, repo: instructorRepoName });
  } catch (err) {
    if (err.status !== 404) throw err;

    core.info(`Instructor repository ${owner}/${instructorRepoName} not found — creating it now.`);
    await octokit.rest.repos.createInOrg({
      org: owner,
      name: instructorRepoName,
      private: true,
      auto_init: true,
    });
    core.info(`Instructor repository ${owner}/${instructorRepoName} created (private).`);

    await ensureStudentQuestionsWorkflow(octokit, owner, instructorRepoName);
  }
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
  const message = `chore: update assessment for ${studentLogin} at ${shortHead} [skip ci]`;

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
}
