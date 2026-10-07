/**
 * Catalogue of action inputs that can be exposed as `workflow_dispatch` inputs,
 * letting an instructor change them on the fly when starting a manual run from
 * the Actions tab.
 *
 * Shared by the Manual runs step (which renders the checkboxes) and generateYaml
 * (which emits both the `on.workflow_dispatch.inputs` block and the matching
 * `${{ github.event.inputs.* || <fallback> }}` expressions), so the two can
 * never disagree about which keys exist or how they are typed.
 *
 * Only inputs an instructor plausibly varies between runs of the *same*
 * assignment are listed. Credentials (api_key, github_token,
 * instructor_repo_token) are deliberately absent — a dispatch input is typed
 * into the Actions UI in plaintext and recorded in the run's metadata, so a
 * secret must never be one. ai_provider and assignment_context_max_chars are
 * absent as structural: varying them mid-assignment produces results that are
 * not comparable across students, and neither is a setting an instructor
 * reaches for on a re-run.
 *
 * include_answers, base_sha, head_sha and skip_committers are absent for a
 * shared reason: a dispatch input can be set by anyone who can run the
 * workflow, which in a Classroom repository includes the student whose work is
 * being assessed. include_answers would put a "show me the answers" button on
 * the run form; the other three all narrow what gets assessed — a SHA pair
 * collapsed to a single commit, or a skip_committers list naming the student's
 * own login, yields an empty diff, and main.js treats that as a warning and a
 * clean exit — the run succeeds with no assessment, carrying an annotation that
 * is visible on the run page but not in a list of runs.
 *
 * All four remain settable in the workflow file (base_sha/head_sha via the
 * wizard's Advanced step), where changing them takes a commit that is visible
 * in the history being assessed.
 *
 * assignment_context was held back on that same "the student can dispatch too"
 * reasoning — it is a glob matched against the student's working tree, so a
 * student could re-point it at a file they wrote. It is listed now, and ticked
 * by default, because that reasoning did not survive contact with the rest of
 * the catalogue: instructor_context is exposed and ticked too, and it steers
 * question focus by free text that a dispatching student can equally supply.
 * The assessed code is student-authored and reaches the prompt in full, so
 * student-controlled text in the prompt is the tool's baseline condition rather
 * than something this input introduces, and the prompt already treats
 * assignment context as reference data that cannot override the rubric or
 * surface answers. What it cannot do is what disqualified the four above —
 * quietly empty the assessment. The paths it matched are rendered in the run
 * summary's configuration block, so a re-pointed glob shows up on the run page.
 *
 * tag_diff_base narrows what is assessed too — previous-tag assesses only the
 * work since the last submission tag — but unlike the four above it cannot
 * empty the assessment: the action never diffs from a tag on the assessed
 * commit itself (tag:<name> fails the run instead), so the range always holds
 * at least that tag's commits. A tag:<name> value is added to the choice's
 * options by generateYaml.js, since the fixed list cannot hold it. The
 * mode a run used is shown in the run summary's configuration block. It is
 * offered only for tag-triggered workflows (tagTriggerOnly), where it has an
 * effect at all, and is unticked by default.
 *
 * question_emphasis only changes which kinds of question are asked about the
 * same code, so it cannot narrow or empty the assessment either.
 *
 * starter_code is listed for two recoveries: none brings back a first commit
 * that an empty-repository student filled with all their work, and context adds
 * preview_only produces no assessment at all, which sounds like what
 * disqualified the four above, and is not. Those four make a run that looks
 * like an assessment of a student with nothing to assess. A preview says what
 * it is: its summary is headed as a preview, a notice on the run page says no
 * questions were generated, and nothing a run delivers — the issue, the PDF,
 * the instructor copy, the submission record — is written or replaced, so the
 * assessment from the last real run stands. It is also the one run a student
 * gains nothing from starting: the summary of every ordinary run already
 * lists the same files. It is ticked by default and listed first, because the
 * run it makes is the one to do before any other, and it costs nothing.
 *
 * starter_code is listed for two recoveries: none brings back a first commit
 * that an empty-repository student filled with all their work, and context adds
 * the starter code as background when a run's questions came out shallow for
 * want of it. Its size limit, codebase_context_max_chars, stays in the file:
 * like assignment_context_max_chars it is a structural cap, not a per-run
 * choice. previous_work is not offered: it matters only on tag runs diffed from
 * an earlier tag, whose setting belongs with tag_diff_base in the file.
 */

/**
 * GitHub hard-caps `workflow_dispatch` at 25 inputs; a workflow declaring more
 * fails to parse. The catalogue below is well short of that, so the cap cannot
 * bite yet — the check stays so a growing catalogue can never emit an invalid
 * workflow.
 */
export const MAX_DISPATCH_INPUTS = 25;

/**
 * `cfgKey`   — the wizard config field supplying the fallback/default value.
 * `type`     — 'boolean' renders a true/false dropdown, 'choice' a dropdown
 *              of `options`, 'string' a text box.
 * `normalize`— run the value through the comma/newline pattern normaliser.
 * `envFallback`— name of a job-level env var to hold a multi-line default,
 *              used as the expression fallback instead of an inline literal.
 * `defaultSelected` — ticked when the wizard first opens (see
 *              DEFAULT_DISPATCH_OVERRIDES).
 * `tagTriggerOnly` — offered, and emitted, only when the workflow is
 *              triggered by submission tags; the action ignores it otherwise.
 * `starterAskOnly` — offered, and emitted, only when it can take effect: the
 *              starter code answer is ask, or starter_code is itself an
 *              override, which can switch a run to ask.
 * `templateOnly` — offered, and emitted, only when repositories start from a
 *              starter template. An empty repository holds only the
 *              student's own files, so the Wizard skips the step that sets it.
 */
export const DISPATCH_OVERRIDES = [
  {
    key: 'preview_only',
    cfgKey: 'previewOnly',
    label: 'Preview only',
    type: 'boolean',
    defaultSelected: true,
    description:
      'true lists the files a run would assess and the files left out, then stops: the AI is not called and no questions are produced',
    hint: 'Check which files a run would assess, in a real repository, before the first assessed run or after changing a pattern. The run summary lists the files assessed and the files left out, with the pattern responsible for each. The AI is not called, so the run costs nothing, and an existing assessment is left as it is.',
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
    key: 'ai_reasoning_effort',
    cfgKey: 'aiReasoningEffort',
    label: 'Reasoning effort',
    type: 'choice',
    options: ['default', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
    description:
      "How much the model thinks before answering: default keeps the model's own; a level it does not support is mapped to its nearest one, and none fails on a model that always reasons",
    hint: 'Re-run with less reasoning to cut the cost or time of a run, or with more when a set of questions came out shallow. Reasoning is billed as output, so a higher level can multiply what that run costs, and none fails the run on a model that always reasons.',
  },
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
    key: 'question_emphasis',
    cfgKey: 'questionEmphasis',
    label: 'Question emphasis',
    type: 'choice',
    options: ['balanced', 'tracing', 'research'],
    defaultSelected: true,
    description:
      'balanced mixes question types; tracing asks only questions answered by running the code in your head; research only questions that need documentation or edge cases',
    hint: 'Re-run with the other kind of question — for example, research questions for a student who can trace the code but not explain it.',
  },
  {
    key: 'assignment_context',
    cfgKey: 'assignmentContext',
    label: 'Assignment context files',
    type: 'string',
    defaultSelected: true,
    templateOnly: true,
    normalize: true,
    description:
      'Comma-separated file glob(s) whose contents are given to the AI as assignment context',
    hint: 'Point a single run at a different brief or rubric — useful when an assignment’s instructions moved, or to test how a new brief steers the questions before committing it. The globs match the student’s own working tree, and anyone who can run the workflow can set them; the paths matched are listed in the run summary.',
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
    key: 'tag_diff_base',
    cfgKey: 'tagDiffBase',
    label: 'Tag diff base',
    type: 'choice',
    options: ['cumulative', 'previous-tag'],
    tagTriggerOnly: true,
    description:
      'cumulative assesses all work to date; previous-tag only the work since the last submission tag; tag:<name> only the work since that tag',
    hint: 'Re-run a milestone either way — for example, a cumulative assessment of phase2 when the workflow normally assesses only the work since phase1.',
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
    key: 'keep_comments',
    cfgKey: 'keepComments',
    label: 'Keep code comments',
    type: 'boolean',
    defaultSelected: true,
    description: 'Preserve code comments instead of stripping them before analysis',
    hint: 'Re-run with comments preserved when a student’s comments are themselves part of what you want to assess.',
  },
  {
    key: 'starter_code',
    cfgKey: 'starterCode',
    label: 'Starter code',
    type: 'choice',
    options: ['none', 'ignore', 'context', 'ask'],
    description: 'What the first commit is, and what the AI does with starter code: none, ignore, context or ask',
    hint: 'Re-run with none when a student committed everything at once to an empty repository, or with context when questions came out shallow because the AI could not see the code the student built on. Context and ask likely increase the cost of that run.',
  },
  {
    key: 'starter_questions_one_in',
    cfgKey: 'starterQuestionsOneIn',
    label: 'Starter code question share',
    type: 'string',
    starterAskOnly: true,
    description:
      'Under starter_code ask, up to one in this many questions may be about the starter code alone (2 or more)',
    hint: 'Allow more or fewer questions about your starter code on a single run — for example, alongside switching Starter code to ask.',
  },
];

/**
 * Ticked when the wizard first opens: the file preview, and the model,
 * question, context and file-filtering settings an instructor varies between
 * runs of the same assignment.
 *
 * The rest stay unticked because they are situational rather than routine —
 * ai_reasoning_effort can multiply what a run costs, tag_diff_base re-scopes a
 * milestone, and starter_code and starter_questions_one_in are per-assignment
 * structural choices that can also raise the cost of a run.
 *
 * The catalogue's order is the order of the fields on the Run workflow form.
 */
export const DEFAULT_DISPATCH_OVERRIDES = DISPATCH_OVERRIDES.filter((o) => o.defaultSelected).map(
  (o) => o.key,
);

/** Lookup by action input key (e.g. 'num_questions'). */
export const DISPATCH_OVERRIDES_BY_KEY = Object.fromEntries(
  DISPATCH_OVERRIDES.map((o) => [o.key, o]),
);

/**
 * The overrides on offer: every entry, less the tagTriggerOnly ones unless the
 * workflow is triggered by submission tags, the templateOnly ones when
 * repositories start empty, and the starterAskOnly ones unless starterAsk is
 * set (see resolveDispatchOverrides).
 */
export function availableDispatchOverrides({
  tagTrigger = false,
  emptyRepo = false,
  starterAsk = false,
} = {}) {
  return DISPATCH_OVERRIDES.filter(
    (o) =>
      (tagTrigger || !o.tagTriggerOnly) &&
      !(emptyRepo && o.templateOnly) &&
      (starterAsk || !o.starterAskOnly),
  );
}

/**
 * Returns the selected override keys in catalogue order, deduplicated, with
 * unknown keys dropped — and tagTriggerOnly keys too, unless tagTrigger is set,
 * templateOnly keys under emptyRepo, and starterAskOnly keys unless the starter
 * code answer is ask (starterAsk) or starter_code is selected too — and the
 * list truncated to GitHub's input cap. Empty when `enabled` is false: the
 * instructor answered No to manual run overrides, which keeps their ticks for
 * a change of mind. The UI, the generator and the review checklist all go
 * through this, so an over-long selection, or one left over from a trigger the
 * instructor has since switched away from, can never reach the emitted YAML.
 */
export function resolveDispatchOverrides(
  selected,
  { tagTrigger = false, emptyRepo = false, starterAsk = false, enabled = true } = {},
) {
  if (!enabled || !Array.isArray(selected) || selected.length === 0) return [];
  const wanted = new Set(selected);
  return availableDispatchOverrides({
    tagTrigger,
    emptyRepo,
    starterAsk: starterAsk || wanted.has('starter_code'),
  })
    .filter((o) => wanted.has(o.key))
    .map((o) => o.key)
    .slice(0, MAX_DISPATCH_INPUTS);
}
