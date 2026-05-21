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
import { GIT_SHA_SHORT_LENGTH, INSTRUCTOR_REPO_DEFAULT_BRANCH } from '../constants.js';

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
 * Ensures the instructor repository exists, creating it (private) if not.
 *
 * When the repository is first created the student-questions workflow is
 * committed as the initial commit using the Git Data API.  This avoids the
 * race condition where GitHub's auto_init may not have landed by the time
 * the Contents API is called.
 */
async function ensureInstructorRepo(octokit, owner, instructorRepoName) {
  try {
    await octokit.rest.repos.get({ owner, repo: instructorRepoName });
    return; // already exists
  } catch (err) {
    if (err.status !== 404) throw err;
  }

  core.info(`Instructor repository ${owner}/${instructorRepoName} not found — creating it now.`);
  await octokit.rest.repos.createInOrg({
    org: owner,
    name: instructorRepoName,
    private: true,
  });

  // Build the initial commit with the workflow file using the Git Data API.
  // The Contents API cannot write to a repo that has no commits yet.
  const { data: blob } = await octokit.rest.git.createBlob({
    owner,
    repo: instructorRepoName,
    content: STUDENT_QUESTIONS_WORKFLOW,
    encoding: 'utf-8',
  });

  const { data: tree } = await octokit.rest.git.createTree({
    owner,
    repo: instructorRepoName,
    tree: [
      {
        path: STUDENT_QUESTIONS_WORKFLOW_PATH,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      },
    ],
  });

  const { data: commit } = await octokit.rest.git.createCommit({
    owner,
    repo: instructorRepoName,
    message: 'chore: add student-questions-added workflow [skip ci]',
    tree: tree.sha,
    parents: [],
  });

  await octokit.rest.git.createRef({
    owner,
    repo: instructorRepoName,
    ref: `refs/heads/${INSTRUCTOR_REPO_DEFAULT_BRANCH}`,
    sha: commit.sha,
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
