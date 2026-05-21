/**
 * Shared constants for the Code Comprehension Question Generator.
 *
 * Centralising these values avoids magic numbers scattered throughout the
 * codebase and makes tuning easier — change a value here and it takes effect
 * everywhere automatically.
 */

/**
 * Default glob patterns for files that should never be assessed.
 * Applied when the user has not supplied a custom exclude_patterns input.
 */
export const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules/**',
  '**/*.lock',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '**/*.min.js',
  '**/*.min.css',
  'dist/**',
  'build/**',
  '.next/**',
  '.nuxt/**',
  '__pycache__/**',
  '**/*.pyc',
  '.git/**',
  '**/*.png',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.gif',
  '**/*.ico',
  '**/*.svg',
  '**/*.woff',
  '**/*.woff2',
  '**/*.ttf',
  '**/*.eot',
  '**/*.md',
  '**/*.pdf',
  '**/*.zip',
  '**/*.tar.gz',
  '.assessment/**',
  '_assessment/**',
];

/**
 * Maximum number of questions that can be generated in a single run.
 * Values supplied via num_questions above this limit are silently capped.
 */
export const MAX_QUESTIONS = 50;

/**
 * Number of characters to display from a git SHA in log messages and reports.
 */
export const GIT_SHA_SHORT_LENGTH = 7;

/**
 * Maximum stdout buffer size for git spawnSync calls.
 */
export const GIT_MAX_BUFFER = 20 * 1024 * 1024; // 20 MB

/**
 * Timeout in milliseconds for the comment-stripping (rmcm) child process.
 */
export const COMMENT_STRIP_TIMEOUT_MS = 10_000;

/**
 * Default AI model sampling temperature (0 = deterministic, 1 = most random).
 * Overridable via the ai_temperature action input.
 * 0.5 keeps questions tightly anchored to the submitted code while still
 * producing enough phrasing variation that repeated runs differ meaningfully.
 */
export const DEFAULT_AI_TEMPERATURE = 0.5;

/**
 * Fallback default branch name for a newly created instructor repository,
 * used when the API response does not include a default_branch value.
 */
export const INSTRUCTOR_REPO_DEFAULT_BRANCH = 'main';

/**
 * How many times to poll for the instructor repository's default branch ref
 * after creation before giving up.  GitHub's auto_init commit is
 * asynchronous, so the ref may not appear immediately.
 *
 * Note: writing to `.github/workflows/` via the Contents API requires the
 * `workflow` scope on a classic PAT, or Workflows: Read and Write on a
 * fine-grained PAT.  Without it the API returns 404 regardless of timing.
 */
export const INSTRUCTOR_REPO_INIT_RETRIES = 10;

/**
 * Milliseconds to wait between each polling attempt while waiting for the
 * instructor repository's default branch to become available.
 */
export const INSTRUCTOR_REPO_INIT_RETRY_DELAY_MS = 1000;

/**
 * AI nucleus-sampling probability mass cutoff.
 * Keeps the model focused while still allowing varied phrasing.
 */
export const AI_TOP_P = 0.95;

/**
 * Bot account substrings that are always excluded when resolving the student
 * login from the commit history. This list is applied unconditionally,
 * regardless of the user-configured skip_committers input (which controls
 * diff-base advancement, a separate concern). It ensures that the action's
 * own assessment-file commit never gets mistaken for a student commit even
 * when skip_committers has been overridden or cleared by the user.
 */
export const STUDENT_RESOLUTION_SKIP_COMMITTERS = ['github-actions[bot]', 'github-classroom[bot]'];

/**
 * Maximum number of open issues to fetch when searching for predecessors.
 */
export const ISSUES_PER_PAGE = 100;

/**
 * Maximum number of discussion categories to fetch via GraphQL.
 */
export const DISCUSSION_CATEGORIES_FETCH_LIMIT = 25;

/**
 * Maximum number of recent discussions to fetch when searching for predecessors.
 */
export const DISCUSSIONS_FETCH_LIMIT = 50;

/**
 * Path to the comment-remover binary (rmcm) installed in the Docker image.
 */
export const COMMENT_REMOVER_BIN = '/usr/local/bin/rmcm';

/**
 * Minimum number of questions that can be requested. Values below this are
 * clamped up to this floor before any further processing.
 */
export const MIN_QUESTIONS = 1;

/**
 * Suffix appended to the assignment name to form the instructor repository
 * name (e.g. "assignment-1" + INSTRUCTOR_REPO_SUFFIX → "assignment-1-grillmycode").
 */
export const INSTRUCTOR_REPO_SUFFIX = '-grillmycode';

/**
 * Default maximum total characters read from all assignment_context files
 * combined. Overridable via the assignment_context_max_chars action input.
 * Prevents large files from flooding the prompt.
 */
export const DEFAULT_ASSIGNMENT_CONTEXT_MAX_CHARS = 20000;

/**
 * Azure OpenAI REST API version sent as the api-version query parameter.
 * Update this when Microsoft releases a newer stable GA version.
 */
export const AZURE_OPENAI_API_VERSION = '2024-02-01';

/**
 * GitHub REST API version sent in the X-GitHub-Api-Version header on every
 * Octokit request. Update when adopting a newer stable GitHub API version.
 */
export const GITHUB_API_VERSION = '2022-11-28';

/**
 * SHA of git's well-known empty tree object. Used as the diff base when the
 * full repository history — including the initial commit — should be included
 * in the assessed diff (i.e. when skip_initial_commit is false).
 * This value is a fixed constant in git and never changes.
 */
export const GIT_EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

/**
 * Default number of total attempts (initial + retries) when calling the AI
 * provider. Overridable via the ai_retry_max_attempts action input.
 * A value of 5 means one initial attempt followed by up to 4 retries.
 */
export const DEFAULT_AI_RETRY_MAX_ATTEMPTS = 5;

/**
 * Base delay in milliseconds for exponential-backoff retry calculations.
 * Each retry's delay is derived from: Math.random() * min(maxDelay, base * 2^attempt)
 * (full-jitter strategy).
 */
export const AI_RETRY_BASE_DELAY_MS = 1000;

/**
 * Maximum delay cap in milliseconds applied to retry backoff calculations.
 * Prevents runaway wait times on later retry attempts.
 */
export const AI_RETRY_MAX_DELAY_MS = 30_000;

/**
 * HTTP status codes that are considered transient and eligible for retry.
 * 429 = rate-limited; 500/502/503/504 = transient server-side errors.
 */
export const AI_RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];
