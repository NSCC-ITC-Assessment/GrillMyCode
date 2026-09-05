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
  INSTRUCTOR_REPO_SUFFIX,
  INSTRUCTOR_WRITE_MAX_ATTEMPTS,
  INSTRUCTOR_WRITE_BASE_DELAY_MS,
  INSTRUCTOR_WRITE_MAX_DELAY_MS,
  INSTRUCTOR_RATE_LIMIT_FALLBACK_MS,
  INSTRUCTOR_RATE_LIMIT_MAX_WAIT_MS,
} from '../constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STUDENT_QUESTIONS_WORKFLOW = readFileSync(
  join(__dirname, '../workflows/generate-lms-quiz.yml'),
  'utf-8',
);
const INSTRUCTOR_REPO_README_TEMPLATE = readFileSync(
  join(__dirname, '../templates/instructor-repo-readme.md'),
  'utf-8',
);

const STUDENT_QUESTIONS_WORKFLOW_PATH = '.github/workflows/generate-lms-quiz.yml';

/** Resolves after `ms` milliseconds. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a full-jitter backoff delay in milliseconds for the given attempt
 * number (0-indexed): a random value in [0, min(maxMs, base * 2^attempt)].
 */
function backoffDelay(attempt, baseMs, maxMs) {
  const cap = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  return Math.floor(Math.random() * cap);
}

/**
 * True when an error from a Contents API write reflects a concurrent-write
 * collision that retrying (with a freshly fetched blob SHA) can resolve:
 *   - 409 Conflict: another commit landed on the branch first, or the repo is
 *     still initialising (auto_init not yet landed — GitHub returns 409 while a
 *     repository is empty).
 *   - 422 with a SHA / fast-forward message: the supplied blob SHA is now stale,
 *     or a file we believed absent was created by a racing run a moment ago.
 * Genuine 422 validation errors (bad path, oversized content) are not retried.
 */
function isWriteConflict(err) {
  if (err.status === 409) return true;
  if (err.status === 422 && /fast.?forward|\bsha\b|conflict/i.test(err.message ?? '')) return true;
  return false;
}

/**
 * True when an error reflects a rate limit that warrants backing off and
 * retrying rather than failing:
 *   - 403 / 429: primary or secondary rate limit.
 *   - 422 whose message reports the endpoint has been "spammed" — GitHub's
 *     wording for content-creation abuse throttling; treat it as a rate limit
 *     (wait, don't hammer) rather than a fast conflict retry.
 */
function isRateLimited(err) {
  if (err.status === 403 || err.status === 429) return true;
  if (err.status === 422 && /spam|abuse/i.test(err.message ?? '')) return true;
  return false;
}

/**
 * Computes how long to wait before retrying a rate-limited request, following
 * GitHub's guidance: honour Retry-After (seconds) for secondary limits; for a
 * primary limit (x-ratelimit-remaining: 0) wait until x-ratelimit-reset; absent
 * both, wait a fixed fallback. The result is capped so a far-off primary reset
 * cannot stall the Action indefinitely.
 */
function rateLimitDelayMs(err) {
  const headers = err.response?.headers ?? {};
  const cap = (ms) => Math.min(Math.max(0, ms), INSTRUCTOR_RATE_LIMIT_MAX_WAIT_MS);

  const retryAfter = parseInt(headers['retry-after'], 10);
  if (!Number.isNaN(retryAfter)) return cap(retryAfter * 1000);

  if (headers['x-ratelimit-remaining'] === '0') {
    const reset = parseInt(headers['x-ratelimit-reset'], 10);
    if (!Number.isNaN(reset)) return cap(reset * 1000 - Date.now());
  }

  return cap(INSTRUCTOR_RATE_LIMIT_FALLBACK_MS);
}

/**
 * Fetches the current blob SHA of a file, or undefined if it does not yet exist.
 * The Contents API requires this SHA when updating an existing file.
 */
async function fetchFileSha(octokit, owner, repo, path) {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path });
    return data.sha;
  } catch (err) {
    if (err.status === 404) return undefined;
    throw err;
  }
}

/**
 * Writes a file to the instructor repository, retrying on concurrent-write
 * conflicts. Before each attempt (after the first) the file's current blob SHA
 * is re-fetched so the retry commits on top of whatever landed in the meantime.
 */
async function writeFileWithRetry({ octokit, owner, repo, path, message, content }) {
  let sha = await fetchFileSha(octokit, owner, repo, path);

  for (let attempt = 0; attempt < INSTRUCTOR_WRITE_MAX_ATTEMPTS; attempt++) {
    try {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content, 'utf-8').toString('base64'),
        sha,
      });
      return;
    } catch (err) {
      const lastAttempt = attempt === INSTRUCTOR_WRITE_MAX_ATTEMPTS - 1;

      if (isRateLimited(err)) {
        if (lastAttempt) throw err;
        const delay = rateLimitDelayMs(err);
        core.warning(
          `Instructor repository write to ${owner}/${repo}/${path} was rate limited ` +
            `(${err.status}). Attempt ${attempt + 1}/${INSTRUCTOR_WRITE_MAX_ATTEMPTS}. ` +
            `Waiting ${delay}ms before retrying…`,
        );
        await sleep(delay);
        // The file is unchanged by us during a rate-limit wait, so keep the
        // current SHA; a stale SHA would surface as a conflict and self-correct.
        continue;
      }

      if (isWriteConflict(err)) {
        if (lastAttempt) throw err;
        const delay = backoffDelay(
          attempt,
          INSTRUCTOR_WRITE_BASE_DELAY_MS,
          INSTRUCTOR_WRITE_MAX_DELAY_MS,
        );
        core.warning(
          `Instructor repository write to ${owner}/${repo}/${path} hit a concurrent-write ` +
            `conflict (${err.status}). Attempt ${attempt + 1}/${INSTRUCTOR_WRITE_MAX_ATTEMPTS}. ` +
            `Re-fetching the latest revision and retrying in ${delay}ms…`,
        );
        await sleep(delay);
        sha = await fetchFileSha(octokit, owner, repo, path);
        continue;
      }

      throw err;
    }
  }
}

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
  let newRepo;
  try {
    ({ data: newRepo } = await octokit.rest.repos.createInOrg({
      org: owner,
      name: instructorRepoName,
      private: true,
      auto_init: true,
    }));
  } catch (err) {
    // Another student's run created the repository between our 404 check and
    // this call. Treat the existing repository as success — the winning run
    // seeds the workflow and README; we proceed straight to writing questions.
    if (err.status === 422) {
      core.info(
        `Instructor repository ${owner}/${instructorRepoName} was created concurrently by ` +
          `another run — using the existing repository.`,
      );
      return;
    }
    throw err;
  }

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
    message: 'chore: add generate-lms-quiz workflow [skip ci]',
    content: Buffer.from(STUDENT_QUESTIONS_WORKFLOW, 'utf-8').toString('base64'),
  });

  // Replace the auto_init placeholder README with a descriptive one.
  const assignmentName = instructorRepoName.replace(INSTRUCTOR_REPO_SUFFIX, '');
  const workflowFilename = STUDENT_QUESTIONS_WORKFLOW_PATH.split('/').at(-1);
  const workflowUrl = `https://github.com/${owner}/${instructorRepoName}/actions/workflows/${workflowFilename}`;
  const readmeContent = INSTRUCTOR_REPO_README_TEMPLATE.replace(
    /\{\{ASSIGNMENT_NAME\}\}/g,
    assignmentName,
  ).replace(/\{\{WORKFLOW_URL\}\}/g, workflowUrl);
  let readmeSha;
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo: instructorRepoName,
      path: 'README.md',
    });
    readmeSha = data.sha;
  } catch {
    // README doesn't exist yet — will be created fresh.
  }
  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo: instructorRepoName,
    path: 'README.md',
    message: 'docs: add instructor repository README [skip ci]',
    content: Buffer.from(readmeContent, 'utf-8').toString('base64'),
    sha: readmeSha,
  });

  core.info(
    `Instructor repository ${owner}/${instructorRepoName} created (private) with student-questions workflow and README.`,
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

  // Many student runs commit to this shared branch at once; write with a
  // retry-and-refetch loop so a 409 from a racing commit doesn't drop this
  // student's assessment. The student folder is created implicitly by the API.
  await writeFileWithRetry({
    octokit,
    owner,
    repo: instructorRepoName,
    path: filePath,
    message,
    content,
  });

  core.info(`Instructor assessment written to ${owner}/${instructorRepoName}/${filePath}`);
}
