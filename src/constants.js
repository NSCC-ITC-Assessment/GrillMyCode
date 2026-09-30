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
 * Number of hex characters kept from the SHA-256 of the src/prompt/ modules,
 * recorded in raw-ai-output.md as the prompt version. Twelve is ample to tell prompt
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
 * Maximum number of rows rendered in the job summary's assessed-files table.
 * A 1 MiB summary that GitHub refuses to display helps nobody; the full list
 * is always in the run log.
 */
export const SUMMARY_FILE_TABLE_LIMIT = 50;

/**
 * Maximum number of paths listed in each file list of the job summary's
 * configuration table (excluded files, codebase context files). These lists are
 * collapsed, so they can be far longer than a visible table, but a committed
 * dependency tree can run to tens of thousands of paths; at this cap a list
 * stays around 100 KB, well inside GitHub's 1 MiB summary limit. The full list
 * is always in the run log.
 */
export const SUMMARY_FILE_LIST_LIMIT = 1000;

/**
 * Length at which the assessment issue body is truncated. GitHub rejects issue
 * bodies over 65,536 characters; the margin leaves room for the truncation
 * notice appended after the cut. The PDF always carries the full report.
 */
export const ISSUE_BODY_LIMIT = 65_000;

/**
 * Maximum stdout buffer size for git spawnSync calls.
 */
export const GIT_MAX_BUFFER = 20 * 1024 * 1024; // 20 MB

/**
 * Timeout in milliseconds for the comment-stripping (rmcm) child process.
 */
export const COMMENT_STRIP_TIMEOUT_MS = 10_000;

/**
 * Default AI provider. OpenRouter is currently the only supported provider.
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
 * Accepted range of the ai_temperature action input: OpenRouter's range.
 * There is no default: when the input is empty no temperature is sent, so the
 * model runs at its own. Models differ in the range they accept, their default
 * and whether they use temperature at all, and OpenRouter publishes none of
 * that per model, so a value is sent only when the instructor sets one.
 * https://openrouter.ai/docs/api/reference/parameters
 */
export const AI_TEMPERATURE_MIN = 0;
export const AI_TEMPERATURE_MAX = 2;

/**
 * Accepted values of the ai_reasoning_effort action input — the union of the
 * effort levels OpenRouter's catalogue lists across its models, plus two of our
 * own: `default`, which sends no reasoning setting so the model's own default
 * applies, and `none`, which sends `reasoning: { enabled: false }`. OpenRouter
 * maps a level a model does not list to its nearest supported one, but rejects
 * `none` with a 400 for a model whose reasoning cannot be switched off.
 * https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
 */
export const AI_REASONING_EFFORTS = [
  'default',
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
];

/**
 * Default reasoning effort. `default` leaves reasoning to the model: models
 * differ too much for one level to suit them all — some reason at `minimal`
 * unless told otherwise, which `low` would raise, and others at `high`.
 * Overridable via the ai_reasoning_effort action input.
 */
export const DEFAULT_AI_REASONING_EFFORT = 'default';

/**
 * Quantization levels an OpenRouter endpoint may serve the model at, sent as
 * `provider.quantizations` on every request. OpenRouter only allow-lists, so
 * this names every level except the compressed ones — fp6 and the 4-bit
 * formats (fp4, mxfp4, nvfp4, int4) — which lose the most on the precise
 * reasoning, long prompts and strict JSON output question generation relies
 * on. fp8 stays in: many models are released at fp8 and their makers serve
 * them that way.
 *
 * `unknown` must stay in. Endpoints that don't report a precision, including
 * Google and OpenAI serving their own models, report `unknown`, and leaving it
 * out would exclude every endpoint of such a model. A model served only at a
 * compressed level gets a 404 from OpenRouter instead of a reply.
 * https://openrouter.ai/docs/guides/routing/provider-selection
 */
export const AI_ALLOWED_QUANTIZATIONS = ['fp32', 'bf16', 'fp16', 'fp8', 'mxfp8', 'int8', 'unknown'];

/**
 * Quantization levels deliberately left out of AI_ALLOWED_QUANTIZATIONS. Never
 * sent — OpenRouter has no exclusion list — but recorded so the weekly
 * check-openrouter-quantizations workflow can tell a level already decided on
 * from one OpenRouter has added since. Every level OpenRouter lists belongs in
 * exactly one of the two lists.
 */
export const AI_EXCLUDED_QUANTIZATIONS = ['fp6', 'fp4', 'mxfp4', 'nvfp4', 'int4'];

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
 * Most lines one snippet may show. The model names a snippet by its first and
 * last line rather than copying the code, and a range any longer than this is
 * most often a whole file named instead of the lines a question is about, so a
 * question showing one is dropped.
 */
export const SNIPPET_MAX_LINES = 50;

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
 * Accepted values of question_emphasis, which restricts the question set to
 * questions that send the student to documentation or to questions they answer
 * by mentally executing their own code:
 *   balanced — no restriction; the question types and openings are mixed as
 *              usual.
 *   research — every question turns on how the language or a library behaves,
 *              including how that behaviour responds to an input, change or
 *              condition the code does not show (causal why, language and API
 *              behaviour, edge cases).
 *   tracing  — every question is answered by executing the code in the head or
 *              following a value through it.
 * research and tracing are all-or-nothing: the model never relaxes them to
 * reach the question count, even at some cost to question quality. See
 * EMPHASES and buildEmphasisRules in prompt/prompt.js and QUESTION_OPENINGS
 * in prompt/openings.js.
 */
export const QUESTION_EMPHASIS_MODES = ['balanced', 'research', 'tracing'];

/**
 * Default question_emphasis. Balanced leaves the prompt exactly as it was
 * before the input existed, so existing workflows are unaffected.
 */
export const DEFAULT_QUESTION_EMPHASIS = 'balanced';

/**
 * Under research, the minimum share of questions (rounded up) that must be
 * causal-why or language-and-API questions (types 8 and 10) — the two types
 * most likely to send a student to documentation. Kept below the per-type cap
 * of one-third so two types can always meet it. Unlike the restriction to the
 * research types, it is an ordinary MIXING RULES quota the model may relax.
 */
export const RESEARCH_LOOKUP_QUESTION_SHARE = 1 / 4;

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
 * Accepted values of the starter_code input, which says what the repository's
 * first commit is and what the AI does with the starter code in it:
 *   none    — there is no starter code: the repository was created empty, so
 *             the first commit is the student's own work and is assessed.
 *   ignore  — the first commit is the instructor's and is left out; starter
 *             files the student never changed are not sent.
 *   context — as ignore, but unchanged starter files are sent as background,
 *             never a question target on their own.
 *   ask     — as context, and up to maxStarterQuestions() of the questions may
 *             be about the starter code itself, including the unchanged starter
 *             lines of files the student edited, in this submission or before.
 */
export const STARTER_CODE_MODES = ['none', 'ignore', 'context', 'ask'];

/**
 * Default starter_code. Matches the behaviour before the input existed, when
 * include_initial_commit and include_codebase_context both defaulted to false.
 */
export const DEFAULT_STARTER_CODE = 'ignore';

/**
 * Accepted values of the previous_work input: whether the student's own
 * earlier work that this submission did not touch is sent as background. It
 * exists only when the assessed range starts after the first commit
 * (tag_diff_base: previous-tag or tag:<name>, or base_sha).
 */
export const PREVIOUS_WORK_MODES = ['context', 'ignore'];

/** Default previous_work. */
export const DEFAULT_PREVIOUS_WORK = 'context';

/**
 * Under starter_code: ask, the largest share of the questions (rounded down,
 * but at least one once there are two questions) that may be about starter
 * code alone. Starter code is the same in every student's repository, so a
 * question about it can be answered once and passed around; the cap keeps most
 * of the set on the student's own work. Unlike the MIXING RULES quotas, the
 * model is told never to relax it.
 */
export const STARTER_QUESTION_MAX_SHARE = 1 / 5;

/**
 * Default maximum total characters of codebase context — unchanged starter
 * code (starter_code: context or ask) and earlier student work
 * (previous_work: context) — sent to the AI. Overridable via the
 * codebase_context_max_chars action input. Files are added whole, nearest to
 * the student's changed files first, and a file that would overflow the limit
 * is left out rather than cut off part-way.
 */
export const DEFAULT_CODEBASE_CONTEXT_MAX_CHARS = 50000;

/**
 * Marker column prefixed to every line of an assessed file that already
 * existed before the assessed range, so the AI can tell the student's lines
 * from the code they started with. `added`, `removed` and `unchanged` mirror
 * unified-diff notation, which models read reliably. `starter` replaces
 * `unchanged` on a line that is also unchanged since the first commit, under
 * starter_code: ask only, where those lines may be asked about. Under ask, an
 * earlier-work file that began as starter code carries the column too, with
 * only `starter` and `unchanged` in it.
 */
export const LINE_MARKERS = Object.freeze({
  added: '+',
  removed: '-',
  unchanged: ' ',
  starter: 's',
});

/**
 * Heading added after the path of an earlier-work file that began as starter
 * code: a file from the first commit that the student changed before the
 * assessed range but not in it, so it mixes the instructor's code with the
 * student's. The prompt quotes it, so the AI can tell such a file apart.
 */
export const EARLIER_STARTER_HEADING = ' (began as starter code)';

/**
 * GitHub REST API version sent in the X-GitHub-Api-Version header on every
 * Octokit request. Update when adopting a newer stable GitHub API version.
 */
export const GITHUB_API_VERSION = '2026-03-10';

/**
 * SHA of git's well-known empty tree object. Used as the diff base when the
 * full repository history — including the initial commit — should be included
 * in the assessed diff (i.e. when starter_code is none).
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
 * Minimum wait, and backoff base, in milliseconds for a 429 that carries no
 * Retry-After header. A rate limit — above all an upstream provider's shared
 * pool — outlasts a sub-second jittered retry, so each wait is a full-jitter
 * value from min(maxDelay, base * 2^attempt), raised to at least this value.
 */
export const AI_RETRY_RATE_LIMIT_DELAY_MS = 5000;

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
 *                  tree with starter_code: none), so each tag assesses all
 *                  of the student's work to date.
 *   previous-tag — the nearest earlier submission tag, so each tag assesses
 *                  only the work since the one before it. Falls back to the
 *                  cumulative base when there is no earlier tag.
 *
 * A value may instead name one tag, as TAG_DIFF_BASE_NAMED_PREFIX + the tag
 * name (see below).
 */
export const TAG_DIFF_BASE_MODES = ['cumulative', 'previous-tag'];

/**
 * Prefix of a tag_diff_base value that names the tag to diff from, as in
 * "tag:phase1": each run assesses only the work since that tag. Unlike
 * previous-tag it never falls back — a named tag that is missing, is not an
 * ancestor of the assessed commit, or is on that commit fails the run, since
 * the instructor asked for that tag specifically.
 */
export const TAG_DIFF_BASE_NAMED_PREFIX = 'tag:';

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
 * question count. A label means questions were generated for the repository
 * at least once.
 */
export const DEFAULT_LABEL_REPOS = false;

/**
 * Default for log_prompt, an undocumented diagnostic input. When on, the chat
 * messages sent to the model are filed as data/prompt.md in the instructor
 * assessment's folder. Off by default: the prompt repeats the student's whole diff and
 * any assignment context, so it is only worth the space while investigating
 * how a prompt produced the questions it did.
 */
export const DEFAULT_LOG_PROMPT = false;

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
 * Public URL of the GrillMyCode logo, shown beside the heading of the issue
 * report and the instructor repository README. Those are rendered on GitHub
 * inside other people's repositories, so a repo-relative path would not
 * resolve; the docs site serves the same file from docs-site/static/img/.
 */
export const LOGO_URL = 'https://grillmycode.org/img/grillmycode-logo.svg';

/** Height in pixels of the logo beside a report, PDF or README heading. */
export const LOGO_HEADING_HEIGHT_PX = 28;
