/**
 * Delivery: Write Assessment to Instructor Repository
 *
 * Creates or replaces the instructor assessment file (questions + answers) in
 * a private instructor-only repository using the GitHub Contents API. The
 * repository is created automatically if it does not already exist.
 *
 * The quiz-generation workflow and the README that documents it are owned by
 * this action: every delivery brings both into line with the copies shipped
 * here, so a repository created by an earlier release picks up later fixes on
 * its own rather than by hand.
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
 *   - 429: always a rate limit.
 *   - 403 carrying rate-limit evidence — a Retry-After header, an exhausted
 *     x-ratelimit-remaining, or GitHub's wording for a primary or secondary
 *     limit. GitHub also returns 403 for a token that simply lacks the scope
 *     for the write (notably `workflow`, required under .github/workflows/),
 *     and waiting cannot fix that: without this evidence check, a missing
 *     scope would sit through every backoff before failing anyway.
 *   - 422 whose message reports the endpoint has been "spammed" — GitHub's
 *     wording for content-creation abuse throttling; treat it as a rate limit
 *     (wait, don't hammer) rather than a fast conflict retry.
 */
function isRateLimited(err) {
  if (err.status === 429) return true;
  if (err.status === 403) {
    const headers = err.response?.headers ?? {};
    if (headers['retry-after'] !== undefined) return true;
    if (headers['x-ratelimit-remaining'] === '0') return true;
    return /rate limit|secondary|abuse|spam|throttl/i.test(err.message ?? '');
  }
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
 * Fetches a file's current blob SHA and decoded content, or an empty object if
 * it does not yet exist. The Contents API requires the SHA when updating an
 * existing file; the content comes back on the same request, so a caller can
 * skip a write that would change nothing without spending a second call.
 *
 * `content` is undefined when GitHub declines to inline it — a file over 1MB is
 * returned with `encoding: 'none'` — which reads as "differs" to any comparison
 * against it. Rewriting is the safe answer in that case.
 */
async function fetchFile(octokit, owner, repo, path) {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path });
    if (Array.isArray(data)) return {}; // the path is a directory, not a file
    const content =
      data.encoding === 'base64'
        ? Buffer.from(data.content, 'base64').toString('utf-8')
        : undefined;
    return { sha: data.sha, content };
  } catch (err) {
    if (err.status === 404) return {};
    throw err;
  }
}

/**
 * Writes a file to the instructor repository, retrying on concurrent-write
 * conflicts. Before each attempt (after the first) the file's current blob SHA
 * is re-fetched so the retry commits on top of whatever landed in the meantime.
 *
 * With `skipIfUnchanged`, a file whose content already matches is left alone —
 * both up front and after a conflict, where the conflict may well have been a
 * racing run committing the very same bytes. Returns true when a commit was
 * made, false when the write was skipped as unnecessary.
 */
async function writeFileWithRetry({
  octokit,
  owner,
  repo,
  path,
  message,
  content,
  skipIfUnchanged = false,
}) {
  let { sha, content: current } = await fetchFile(octokit, owner, repo, path);
  if (skipIfUnchanged && current === content) return false;

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
      return true;
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
        ({ sha, content: current } = await fetchFile(octokit, owner, repo, path));
        if (skipIfUnchanged && current === content) return false;
        continue;
      }

      throw err;
    }
  }
}

/**
 * Ensures the instructor repository exists, creating it (private) if not.
 * On creation, polls until auto_init's commit lands so the caller can write to
 * the default branch straight away. The action-managed files are written by
 * syncInstructorRepoFiles afterwards, on this run and on every later one.
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
    // this call. Treat the existing repository as success — whichever run gets
    // there first seeds the workflow and README, and the loser's own sync (see
    // syncInstructorRepoFiles) retries through any 409 raised while the
    // winner's auto_init commit is still landing.
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

  core.info(`Instructor repository ${owner}/${instructorRepoName} created (private).`);
}

/** Fills the instructor README template in for this repository. */
function renderInstructorReadme(owner, instructorRepoName) {
  const assignmentName = instructorRepoName.replace(INSTRUCTOR_REPO_SUFFIX, '');
  const workflowFilename = STUDENT_QUESTIONS_WORKFLOW_PATH.split('/').at(-1);
  const workflowUrl = `https://github.com/${owner}/${instructorRepoName}/actions/workflows/${workflowFilename}`;
  return INSTRUCTOR_REPO_README_TEMPLATE.replace(
    /\{\{ASSIGNMENT_NAME\}\}/g,
    assignmentName,
  ).replace(/\{\{WORKFLOW_URL\}\}/g, workflowUrl);
}

/**
 * Brings the two action-managed files — the student-questions workflow and the
 * README describing it — into line with the copies shipped in this action,
 * committing each only when its content differs from what the repository has.
 *
 * This runs on every delivery rather than only at creation. A repository
 * created by an earlier release would otherwise keep that release's workflow
 * for good, so every fix to quiz generation had to be pasted into each
 * instructor repository by hand; repositories predating the rename to
 * generate-lms-quiz.yml never received a push-triggered workflow at all. Both
 * files are owned by the action, so a local edit to either is replaced here.
 *
 * Every failure is a warning, never a throw. The likely cause is an instructor
 * PAT without the `workflow` scope, which GitHub refuses for any write under
 * .github/workflows/ — and losing the student's assessment, which is written
 * next and needs no such scope, would be a far worse outcome than running one
 * more time on a stale workflow. The next run retries the sync.
 */
async function syncInstructorRepoFiles(octokit, owner, instructorRepoName) {
  const files = [
    {
      path: STUDENT_QUESTIONS_WORKFLOW_PATH,
      content: STUDENT_QUESTIONS_WORKFLOW,
      message: 'chore: sync generate-lms-quiz workflow [skip ci]',
    },
    {
      path: 'README.md',
      content: renderInstructorReadme(owner, instructorRepoName),
      message: 'docs: sync instructor repository README [skip ci]',
    },
  ];

  // Independently guarded: a workflow-scope rejection on the first file must
  // not stop the second, which any `repo`-scoped token can write.
  for (const file of files) {
    try {
      const written = await writeFileWithRetry({
        octokit,
        owner,
        repo: instructorRepoName,
        path: file.path,
        message: file.message,
        content: file.content,
        skipIfUnchanged: true,
      });
      if (written) {
        core.info(`Updated ${file.path} in ${owner}/${instructorRepoName}.`);
      }
    } catch (err) {
      core.warning(
        `Could not update ${file.path} in ${owner}/${instructorRepoName}: ${err.message}. ` +
          `The assessment is still being written. If this persists, check that the ` +
          `instructor PAT carries both the \`repo\` and \`workflow\` scopes.`,
      );
    }
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

  // Before the questions.md write below, so that the push it makes is handled
  // by the current workflow rather than whatever the repository was seeded with.
  await syncInstructorRepoFiles(octokit, owner, instructorRepoName);

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
