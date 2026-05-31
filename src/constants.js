/**
 * Shared constants for the Code Comprehension Question Generator.
 *
 * Centralizing these values avoids magic numbers scattered throughout the
 * codebase and makes tuning easier — change a value here and it takes effect
 * everywhere automatically.
 */

/**
 * Fallback glob patterns used when automatic stack detection fails or returns
 * no results. Covers the most common languages and build artefacts so that
 * assessments still work if the GitHub API is unreachable.
 */
export const FALLBACK_EXCLUDE_PATTERNS = [
  // JavaScript / Node.js
  'node_modules/**',
  '**/*.lock',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '**/*.min.js',
  '**/*.min.css',

  // Common build output
  'dist/**',
  'build/**',
  'out/**',
  'coverage/**',
  '.nyc_output/**',
  // Next.js / Nuxt
  '.next/**',
  '.nuxt/**',
  '.output/**',

  // SvelteKit / Astro / Expo / Parcel / Turborepo
  '.svelte-kit/**',
  '.astro/**',
  '.expo/**',
  '.parcel-cache/**',
  '.turbo/**',

  // Python
  '__pycache__/**',
  '**/*.pyc',
  '.venv/**',
  'venv/**',
  '.pytest_cache/**',
  '**/*.egg-info/**',
  '.tox/**',

  // Java / JVM
  'target/**',
  '.gradle/**',

  // Ruby
  '.bundle/**',

  // PHP / Go / Ruby vendor
  'vendor/**',

  // .NET
  'obj/**',

  // C / C++
  'CMakeFiles/**',
  'cmake-build-*/**',
  'CMakeCache.txt',
  'CMakeCache.txt.dir/**',

  // Version control
  '.git/**',
  '.gitignore',

  // Environment files — may contain secrets
  '.env',
  '.env.*',
  '**/.env',
  '**/.env.*',

  // Minified assets
  '**/*.tsbuildinfo',

  // OS noise
  '.DS_Store',
  'Thumbs.db',

  // Text assets (SVG is XML, source maps and logs are plain text)
  '**/*.svg',
  '**/*.map',
  '**/*.log',

  // Documents
  '**/*.md',

  // GrillMyCode assessment internals
  '.assessment/**',
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
 * Maximum character count for a "short" correct answer. At least one in
 * every three questions must target a correct answer within this length
 * (e.g. a literal return value, boolean, numeric result, or short identifier)
 * so that overall answer lengths span from a few characters up to multi-sentence
 * explanations.
 */
export const SHORT_ANSWER_MAX_CHARS = 20;

/**
 * Maximum character count for a "long" correct answer (i.e. all non-short-answer
 * questions).  Distractors are exempt from this cap and may be longer to allow
 * for visual balance across the four options.
 */
export const LONG_ANSWER_MAX_CHARS = 100;

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
 * Number of attempts (initial + retries) when writing an assessment file to the
 * instructor repository via the Contents API.
 *
 * Many student repositories commit to the same branch of the shared instructor
 * repository concurrently. GitHub returns a 409 Conflict when two commits race
 * on the same ref — even for different files — so each write is retried after
 * re-fetching the file's current blob SHA. Five attempts comfortably absorbs a
 * deadline-time pile-up for typical class sizes.
 */
export const INSTRUCTOR_WRITE_MAX_ATTEMPTS = 5;

/**
 * Base delay in milliseconds for the instructor-repository write backoff.
 * Each retry waits a random value in [0, min(maxDelay, base * 2^attempt)]
 * (full-jitter), matching the AI client's strategy.
 */
export const INSTRUCTOR_WRITE_BASE_DELAY_MS = 500;

/**
 * Maximum delay cap in milliseconds for the instructor-repository write backoff.
 */
export const INSTRUCTOR_WRITE_MAX_DELAY_MS = 8_000;

/**
 * Delay in milliseconds to wait before retrying a rate-limited instructor write
 * when the response carries no usable Retry-After / X-RateLimit-Reset header.
 * GitHub's guidance for secondary rate limits with no Retry-After is to wait at
 * least one minute before retrying.
 */
export const INSTRUCTOR_RATE_LIMIT_FALLBACK_MS = 60_000;

/**
 * Upper bound in milliseconds on any single rate-limit wait. A primary
 * rate-limit reset can be many minutes away; rather than stall the Action that
 * long we cap the wait, retry, and let the attempt budget run out if the limit
 * has not cleared — the delivery then fails non-fatally and self-heals on the
 * student's next push.
 */
export const INSTRUCTOR_RATE_LIMIT_MAX_WAIT_MS = 60_000;

/**
 * AI nucleus-sampling probability mass cutoff.
 * Keeps the model focused while still allowing varied phrasing.
 */
export const AI_TOP_P = 0.95;

/**
 * Maximum output tokens for the AI response.
 * 50 questions with code snippets + answers typically requires 12,000–16,000
 * tokens. Setting a generous limit prevents early truncation by the API.
 */
export const AI_MAX_OUTPUT_TOKENS = 16_384;

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
 * Path to the comment-remover binary (rmcm) installed in the Docker image.
 */
export const COMMENT_REMOVER_BIN = '/usr/local/bin/rmcm';

/**
 * Minimum number of questions that can be requested. Values below this are
 * clamped up to this floor before any further processing.
 */
export const MIN_QUESTIONS = 1;

/**
 * Default number of questions generated when num_questions is not supplied.
 */
export const DEFAULT_NUM_QUESTIONS = 20;

/**
 * Suffix appended to the assignment name to form the instructor repository
 * name (e.g. "assignment-1" + INSTRUCTOR_REPO_SUFFIX → "assignment-1-grillmycode-instructor").
 */
export const INSTRUCTOR_REPO_SUFFIX = '-grillmycode-instructor';

/**
 * Default maximum total characters read from all assignment_context files
 * combined. Overridable via the assignment_context_max_chars action input.
 * Prevents large files from flooding the prompt.
 */
export const DEFAULT_ASSIGNMENT_CONTEXT_MAX_CHARS = 20000;

/**
 * GitHub REST API version sent in the X-GitHub-Api-Version header on every
 * Octokit request. Update when adopting a newer stable GitHub API version.
 */
export const GITHUB_API_VERSION = '2022-11-28';

/**
 * SHA of git's well-known empty tree object. Used as the diff base when the
 * full repository history — including the initial commit — should be included
 * in the assessed diff (i.e. when include_initial_commit is true).
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
