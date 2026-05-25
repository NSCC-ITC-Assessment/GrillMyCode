/**
 * Delivery: Write Assessment to Instructor Repository
 *
 * Creates or replaces the instructor assessment file (questions + answers) in
 * a private instructor-only repository using the GitHub Contents API. The
 * repository is created automatically if it does not already exist.
 *
 * The file is written to {studentLogin}/questions.md inside the repository.
 * The repository is named {assignmentName}-grillmycode-instructor and lives in the same
 * organization as the student repositories.
 *
 * A separate instructor PAT (instructor_repo_token) is used for all API calls
 * in this module — the student's github_token is never used here.
 */

import * as core from '@actions/core';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';
import {
  GIT_SHA_SHORT_LENGTH,
  INSTRUCTOR_REPO_DEFAULT_BRANCH,
  INSTRUCTOR_REPO_INIT_RETRIES,
  INSTRUCTOR_REPO_INIT_RETRY_DELAY_MS,
} from '../constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STUDENT_QUESTIONS_WORKFLOW = readFileSync(
  join(__dirname, '../workflows/student-questions-added.yml'),
  'utf-8',
);

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
