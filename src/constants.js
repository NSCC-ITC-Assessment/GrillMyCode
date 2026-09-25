/**
 * Shared constants for the Code Comprehension Question Generator.
 *
 * Centralizing these values avoids magic numbers scattered throughout the
 * codebase and makes tuning easier — change a value here and it takes effect
 * everywhere automatically.
 */

/**
 * Editor, IDE and AI-assistant configuration, excluded on every run whatever
 * the detected stack. Stack detection only enables an editor's gitignore
 * template when its directory sits at the repository root, and those templates
 * deliberately keep the project files a team shares (.idea/misc.xml, *.iml,
 * .vscode/settings.json once negations are dropped) — none of which is student
 * code. Listed here rather than per-editor so a project nested one directory
 * down, or a run on the fallback list, is covered the same way.
 */
export const EDITOR_CONFIG_EXCLUDE_PATTERNS = [
  // VS Code and its forks
  '**/.vscode/**',
  '**/.vscode-test/**',
  '**/*.code-workspace',
  '**/.history/**',
  // Visual Studio
  '**/.vs/**',
  // JetBrains IDEs and Fleet
  '**/.idea/**',
  '**/*.iml',
  '**/*.ipr',
  '**/*.iws',
  '**/.fleet/**',
  // Eclipse
  '**/.project',
  '**/.classpath',
  '**/.factorypath',
  '**/.settings/**',
  // NetBeans
  '**/nbproject/**',
  // Xcode project bundles (generated project settings, not source)
  '**/*.xcodeproj/**',
  '**/*.xcworkspace/**',
  '**/xcuserdata/**',
  // Sublime Text, Zed, Nova, Theia
  '**/*.sublime-project',
  '**/*.sublime-workspace',
  '**/.zed/**',
  '**/.nova/**',
  '**/.theia/**',
  // Vim and Emacs swap, backup and session files
  '**/*.swp',
  '**/*.swo',
  '**/*~',
  '**/.#*',
  '**/#*#',
  '**/.netrwhist',
  '**/Session.vim',
  // AI coding assistants
  '**/.cursor/**',
  '**/.cursorrules',
  '**/.cursorignore',
  '**/.windsurf/**',
  '**/.windsurfrules',
  '**/.claude/**',
  '**/.continue/**',
  // Editor-agnostic settings and dev container definitions
  '**/.editorconfig',
  '**/.devcontainer/**',
];

/**
 * Text files that describe or support a solution without being part of it —
 * diagrams a student drew of what they built, and tabular data — excluded on
 * every run. Each is plain text, so the binary check lets it through, and no
 * language's gitignore template names it; without this list the model writes
 * questions about a diagram's XML. An instructor who wants one assessed
 * re-includes it with exclude_pattern_overrides.
 */
export const NON_CODE_ASSET_EXCLUDE_PATTERNS = [
  // Diagrams (draw.io, Excalidraw, BPMN, PlantUML, Mermaid)
  '**/*.drawio',
  '**/*.dio',
  '**/*.excalidraw',
  '**/*.bpmn',
  '**/*.puml',
  '**/*.plantuml',
  '**/*.mmd',
  // Tabular data
  '**/*.csv',
  '**/*.tsv',
];

/**
 * Fallback glob patterns used when automatic stack detection fails or returns
 * no results. Covers the most common languages and build artefacts so that
 * assessments still work if the GitHub API is unreachable.
 */
export const FALLBACK_EXCLUDE_PATTERNS = [
  // Every directory pattern carries an explicit `**/` prefix so it matches at
  // any depth, not only at the repository root. Without it a monorepo layout —
  // frontend/node_modules, backend/venv — ships its whole dependency tree to
  // the AI provider.

  // JavaScript / Node.js
  '**/node_modules/**',
  '**/*.lock',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '**/*.min.js',
  '**/*.min.css',

  // Common build output
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/coverage/**',
  '**/.nyc_output/**',
  // Next.js / Nuxt
  '**/.next/**',
  '**/.nuxt/**',
  '**/.output/**',

  // SvelteKit / Astro / Expo / Parcel / Turborepo
  '**/.svelte-kit/**',
  '**/.astro/**',
  '**/.expo/**',
  '**/.parcel-cache/**',
  '**/.turbo/**',

  // Python
  '**/__pycache__/**',
  '**/*.pyc',
  '**/.venv/**',
  '**/venv/**',
  '**/.pytest_cache/**',
  '**/*.egg-info/**',
  '**/.tox/**',

  // Java / JVM
  '**/target/**',
  '**/.gradle/**',

  // Ruby
  '**/.bundle/**',

  // PHP / Go / Ruby vendor
  '**/vendor/**',

  // .NET
  '**/obj/**',

  // C / C++
  '**/CMakeFiles/**',
  '**/cmake-build-*/**',
  '**/CMakeCache.txt',
  '**/CMakeCache.txt.dir/**',

  // Version control
  '**/.git/**',
  '**/.gitignore',

  // Classroom 50 accept-time metadata (not student-authored)
  '**/.classroom50.yaml',

  // Environment files — may contain secrets
  '**/.env',
  '**/.env.*',

  // Minified assets
  '**/*.tsbuildinfo',

  // OS noise
  '**/.DS_Store',
  '**/Thumbs.db',

  // Text assets (SVG is XML, source maps and logs are plain text)
  '**/*.svg',
  '**/*.map',
  '**/*.log',

  // Documents
  '**/*.md',

  ...EDITOR_CONFIG_EXCLUDE_PATTERNS,
  ...NON_CODE_ASSET_EXCLUDE_PATTERNS,
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
 * Number of hex characters kept from the SHA-256 of src/prompt.js recorded in
 * raw-ai-output.md as the prompt version. Twelve is ample to tell prompt
 * revisions apart while staying readable.
 */
export const PROMPT_HASH_LENGTH = 12;

/**
 * Maximum number of excluded file paths listed in the job summary when a run
 * finds nothing to assess. Enough to identify the pattern at fault; the full
 * list is always in the run log.
 */
export const EMPTY_ASSESSMENT_FILE_LIST_LIMIT = 20;

/**
 * Maximum number of rows rendered in the job summary's assessed-files and
 * excluded-files tables. A whole excluded tree can run to hundreds of paths,
 * and a 1 MiB summary that GitHub refuses to display helps nobody; the full
 * list is always in the run log.
 */
export const SUMMARY_FILE_TABLE_LIMIT = 50;

/**
 * Maximum stdout buffer size for git spawnSync calls.
 */
export const GIT_MAX_BUFFER = 20 * 1024 * 1024; // 20 MB

/**
 * Timeout in milliseconds for the comment-stripping (rmcm) child process.
 */
export const COMMENT_STRIP_TIMEOUT_MS = 10_000;

/**
 * Default AI provider. OpenRouter is currently the only supported provider:
 * GitHub Models, formerly the default, was permanently discontinued by GitHub.
 * Overridable via the ai_provider action input.
 */
export const DEFAULT_AI_PROVIDER = 'openrouter';

/**
 * Default AI model, expressed as an OpenRouter provider/model identifier.
 * Overridable via the ai_model action input.
 * Gemini Flash Lite is inexpensive at classroom scale and, of the tested
 * models, produces the most effective distractors for multiple-choice
 * questions.
 */
export const DEFAULT_AI_MODEL = 'google/gemini-3.5-flash-lite';

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
 * Page size when listing a student repository's direct collaborators to resolve
 * the submission identity. A Classroom 50 repository has one direct collaborator
 * per student (a handful for a legacy group), so one page is the norm.
 */
export const COLLABORATORS_PER_PAGE = 100;

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
export const GITHUB_API_VERSION = '2026-03-10';

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
 * Maximum delay cap in milliseconds applied to every AI retry wait, including
 * a 429's Retry-After value. Prevents runaway wait times on later retry attempts.
 */
export const AI_RETRY_MAX_DELAY_MS = 30_000;

/**
 * HTTP status codes that are considered transient and eligible for retry.
 * 429 = rate-limited; 500/502/503/504 = transient server-side errors.
 */
export const AI_RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

/**
 * Accepted values of the tag_diff_base input, which picks the diff base for a
 * run started by a submission tag:
 *   cumulative   — the same base as any other run (first commit, or the empty
 *                  tree with include_initial_commit), so each tag assesses all
 *                  of the student's work to date.
 *   previous-tag — the nearest earlier submission tag, so each tag assesses
 *                  only the work since the one before it. Falls back to the
 *                  cumulative base when there is no earlier tag.
 */
export const TAG_DIFF_BASE_MODES = ['cumulative', 'previous-tag'];

/**
 * Default tag_diff_base. Cumulative keeps a tag run's range identical to a push
 * run's, so switching an assignment from push to tag triggering changes when
 * the assessment runs but not what it covers.
 */
export const DEFAULT_TAG_DIFF_BASE = 'cumulative';

/**
 * Name a tag group's PDF and instructor-repository folder are filed under when
 * its pattern has no filename-safe characters at all (e.g. a bare `**`).
 */
export const SUBMISSION_TAG_GROUP_FALLBACK = 'tag';

/**
 * Default label_repos. Off, so that writing to repository metadata the
 * instructor owns — topics they set by hand, the description text they wrote —
 * is always visible in the workflow as an explicit label_repos: "true". The
 * Workflow Wizard ticks it by default, so Wizard-built workflows carry that
 * line. When on, the student repository gets both labels — the
 * REPO_LABEL_TOPIC topic for filtering and the description note for the
 * question count — and the instructor repository gets the daily
 * reconciliation sweep that clears them again.
 */
export const DEFAULT_LABEL_REPOS = false;

/**
 * Topic added when label_repos is on. Lowercase because GitHub
 * lowercases every topic name it stores, so any other casing would never match
 * the value read back and the topic list would be rewritten on every run.
 */
export const REPO_LABEL_TOPIC = 'grillmycode';

/**
 * Separator placed between the instructor's description and the label text.
 * A middle dot rather than a hyphen or pipe: it reads as punctuation in the
 * repository list and is unlikely to appear at the end of a description already.
 */
export const REPO_LABEL_DESCRIPTION_SEPARATOR = ' · ';

/**
 * Fixed leading text of the description label. This is the sentinel that makes
 * the write idempotent: before appending, any existing run of
 * separator + sigil + trailing text is stripped, so a repository assessed ten
 * times carries one label with the current question count, not ten labels.
 * Changing this value orphans labels written by earlier versions of the action.
 */
export const REPO_LABEL_DESCRIPTION_SIGIL = '🔥 GrillMyCode';

/**
 * Maximum length GitHub accepts for a repository description. A description
 * that would exceed this once the label is appended is left alone entirely —
 * the alternative, truncating text the instructor wrote to make room for a
 * label, destroys more than the label is worth.
 */
export const REPO_DESCRIPTION_MAX_CHARS = 350;

/**
 * Days of assignment inactivity after which the label-reconciliation sweep
 * stops doing work on its schedule.
 *
 * The sweep is seeded into the instructor repository and runs daily, but the
 * action only re-syncs it when a student pushes. An assignment nobody submits
 * to any more would therefore keep sweeping on whatever version it last
 * received, indefinitely and unfixably. Measured against the instructor
 * repository's own last push, which advances on every delivery and on nothing
 * the sweep itself does, so a quiet assignment winds down on its own and
 * resumes the moment a student pushes again.
 *
 * A manual run ignores this: an instructor who presses Run wants it to run.
 */
export const REPO_LABEL_SWEEP_IDLE_DAYS = 10;

/**
 * Public URL of the GrillMyCode logo, shown beside the heading of the issue
 * report and the instructor repository README. Those are rendered on GitHub
 * inside other people's repositories, so a repo-relative path would not
 * resolve; the docs site serves the same file from docs-site/static/img/.
 */
export const LOGO_URL = 'https://grillmycode.org/img/grillmycode-logo.svg';

/** Height in pixels of the logo beside a report, PDF or README heading. */
export const LOGO_HEADING_HEIGHT_PX = 28;
