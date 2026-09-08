/**
 * Catalogue of action inputs that can be exposed as `workflow_dispatch` inputs,
 * letting an instructor change them on the fly when starting a manual run from
 * the Actions tab.
 *
 * Shared by the Trigger step (which renders the checkboxes) and generateYaml
 * (which emits both the `on.workflow_dispatch.inputs` block and the matching
 * `${{ github.event.inputs.* || <fallback> }}` expressions), so the two can
 * never disagree about which keys exist or how they are typed.
 *
 * Only inputs an instructor plausibly varies between runs of the *same*
 * assignment are listed. Credentials (api_key, github_token,
 * instructor_repo_token) are deliberately absent — a dispatch input is typed
 * into the Actions UI in plaintext and recorded in the run's metadata, so a
 * secret must never be one. Structural inputs (ai_provider, assignment_context,
 * assignment_context_max_chars) are absent because changing them mid-assignment
 * produces results that are not comparable across students — and
 * assignment_context in particular is a glob matched against the student's own
 * working tree, so letting it be re-pointed at dispatch time would hand the
 * student a lever on what the questions focus on.
 *
 * include_answers, base_sha, head_sha and skip_committers are absent for a
 * shared reason: a dispatch input can be set by anyone who can run the
 * workflow, which in a Classroom repository includes the student whose work is
 * being assessed. include_answers would put a "show me the answers" button on
 * the run form; the other three all narrow what gets assessed — a SHA pair
 * collapsed to a single commit, or a skip_committers list naming the student's
 * own login, yields an empty diff, and main.js treats that as a warning and a
 * clean exit, so the run goes green with no assessment and nothing looks wrong.
 *
 * All four remain settable in the workflow file (base_sha/head_sha via the
 * wizard's Advanced step), where changing them takes a commit that is visible
 * in the history being assessed.
 */

/**
 * GitHub hard-caps `workflow_dispatch` at 10 inputs; a workflow declaring more
 * fails to parse. The catalogue below holds fewer than that today, so the cap
 * cannot bite — the check stays because it is the constraint that decides
 * whether a new entry can simply be added or has to displace an existing one.
 */
export const MAX_DISPATCH_INPUTS = 10;

/**
 * `cfgKey`   — the wizard config field supplying the fallback/default value.
 * `type`     — 'boolean' renders a true/false dropdown, 'string' a text box.
 * `normalize`— run the value through the comma/newline pattern normaliser.
 * `envFallback`— name of a job-level env var to hold a multi-line default,
 *              used as the expression fallback instead of an inline literal.
 * `defaultSelected` — ticked when the wizard first opens (see
 *              DEFAULT_DISPATCH_OVERRIDES).
 */
export const DISPATCH_OVERRIDES = [
  {
    key: 'num_questions',
    cfgKey: 'numQuestions',
    label: 'Number of questions',
    type: 'string',
    defaultSelected: true,
    description: 'Number of comprehension questions to generate (1-50)',
    hint: 'Re-run with a shorter or longer question set without editing the workflow.',
  },
  {
    key: 'ai_model',
    cfgKey: 'aiModel',
    label: 'AI model',
    type: 'string',
    defaultSelected: true,
    description: 'OpenRouter model ID in provider/model-name format',
    hint: 'Try a different model on a single run — useful when one model produces weak questions for a particular assignment.',
  },
  {
    key: 'instructor_context',
    cfgKey: 'instructorContext',
    label: 'Instructor context',
    type: 'string',
    defaultSelected: true,
    // The dispatch form prefills with the configured context so it can be read
    // and edited in place, which is the whole point of exposing it.
    //
    // A multi-line context cannot be prefilled verbatim: a dispatch `default:`
    // and a `${{ ... || '...' }}` literal are both single-line only. So the
    // form gets the text collapsed to one line, while the canonical multi-line
    // version is emitted as a job-level env var and used as the expression
    // fallback — automatic runs keep the formatting exactly as before, and
    // clearing the field on a manual run restores it too.
    envFallback: 'GMC_DEFAULT_INSTRUCTOR_CONTEXT',
    description:
      'Assignment context given to the AI (clear the field to use the workflow default unchanged)',
    hint: 'Retarget the questions for one run — the field prefills with your current context so you can edit it in place. GitHub has no multi-line dispatch field, so a multi-line context is shown collapsed to one line; automatic runs still use the full version, and `gh workflow run` can pass multi-line text.',
  },
  {
    key: 'keep_comments',
    cfgKey: 'keepComments',
    label: 'Keep code comments',
    type: 'boolean',
    defaultSelected: true,
    description: 'Preserve code comments instead of stripping them before analysis',
    hint: 'Re-run with comments preserved when a student’s comments are themselves part of what you want to assess.',
  },
  {
    key: 'additional_exclude_patterns',
    cfgKey: 'additionalExcludePatterns',
    label: 'Additional exclude patterns',
    type: 'string',
    defaultSelected: true,
    normalize: true,
    description: 'Comma-separated extra glob patterns to exclude from assessment',
    hint: 'Exclude a file you only noticed after the first run — a data dump or generated file that flooded the diff.',
  },
  {
    key: 'exclude_pattern_overrides',
    cfgKey: 'excludePatternOverrides',
    label: 'Exclude pattern overrides',
    type: 'string',
    defaultSelected: true,
    normalize: true,
    description: 'Comma-separated entries to re-include from the default exclude list',
    hint: 'Pull a file back in that the default exclusions removed.',
  },
  {
    key: 'include_initial_commit',
    cfgKey: 'includeInitialCommit',
    label: 'Include initial commit',
    type: 'boolean',
    description: 'Include the repository’s first commit in the assessed diff',
    hint: 'Lets you recover a run where a student committed everything at once and the first-commit exclusion left nothing to assess.',
  },
  {
    key: 'ai_temperature',
    cfgKey: 'aiTemperature',
    label: 'AI temperature',
    type: 'string',
    description: 'Randomness of the AI output, 0.0 (deterministic) to 1.0 (most varied)',
    hint: 'Rarely worth exposing — most instructors should leave temperature fixed.',
  },
];

/**
 * Ticked when the wizard first opens: the question, context and file-filtering
 * settings an instructor varies between runs of the same assignment, in
 * catalogue order from num_questions through exclude_pattern_overrides.
 *
 * The two below that range stay unticked because they are situational rather
 * than routine — include_initial_commit is a per-assignment structural choice,
 * and ai_temperature is best left fixed.
 */
export const DEFAULT_DISPATCH_OVERRIDES = DISPATCH_OVERRIDES.filter(
  (o) => o.defaultSelected,
).map((o) => o.key);

/** Lookup by action input key (e.g. 'num_questions'). */
export const DISPATCH_OVERRIDES_BY_KEY = Object.fromEntries(
  DISPATCH_OVERRIDES.map((o) => [o.key, o]),
);

/**
 * Returns the selected override keys in catalogue order, deduplicated, with
 * unknown keys dropped and the list truncated to GitHub's 10-input cap. Both
 * the UI and the generator go through this, so an over-long selection can never
 * reach the emitted YAML.
 */
export function resolveDispatchOverrides(selected) {
  if (!Array.isArray(selected) || selected.length === 0) return [];
  const wanted = new Set(selected);
  return DISPATCH_OVERRIDES.filter((o) => wanted.has(o.key))
    .map((o) => o.key)
    .slice(0, MAX_DISPATCH_INPUTS);
}
