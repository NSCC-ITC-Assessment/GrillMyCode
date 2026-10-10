import React, { useState } from 'react';
import clsx from 'clsx';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

import StepAssignment from './steps/StepAssignment';
import StepRepositories from './steps/StepRepositories';
import StepTrigger from './steps/StepTrigger';
import StepFiles from './steps/StepFiles';
import StepAIProvider from './steps/StepAIProvider';
import StepQuestions from './steps/StepQuestions';
import StepDelivery from './steps/StepDelivery';
import StepManualRuns from './steps/StepManualRuns';
import StepAdvanced from './steps/StepAdvanced';
import StepReview from './steps/StepReview';
import { DEFAULT_DISPATCH_OVERRIDES, resolveDispatchOverrides } from './dispatchInputs';
import {
  instructorRepoActive,
  invalidSubmissionTags,
  isTagTrigger,
  namedDiffBaseTagError,
  submissionTagList,
  starterQuestionsOneInError,
  starterShareDefaultError,
  temperatureError,
} from './generateYaml';

// Order follows .github/prompts/plan-workflowWizard.prompt.md: the facts
// about the student repositories first, then what the AI should know about the
// assignment — both before the model, so everything that sets how much is sent
// to the AI is decided before choosing one, and the repositories before the
// Delivery step that depends on them; then which files are assessed; then how
// questions are made and who receives them; then when the workflow runs, once
// what it produces is settled; then the manual run overrides — placed after
// every setting they can expose, so each one ticked is a setting already
// seen — and finally the edge-case settings most readers can leave at their
// defaults.
// getStepError keys on `label`, not position, so reordering this list cannot
// move a validation check onto the wrong step. A step with `skippedWhen` is
// passed over by Next and Back while it returns true, and stays on the
// progress bar, greyed out with `skippedReason` as its tooltip, so the step
// numbers don't shift. `hostSubtitle` replaces the subtitle where the wizard has
// a host (see WorkflowWizard below), which changes what the step offers.
const STEPS = [
  { label: 'Repositories', title: 'Student repositories',                  subtitle: 'Say how students\' repositories are created and what they start with.',                            Component: StepRepositories },
  { label: 'Assignment',   title: 'About your assignment',                 subtitle: 'Point the AI to any assignment documents, if your repositories include one or more.',             Component: StepAssignment,
    // An empty repository holds only the student's own files, so any brief
    // listed here would be one the student wrote.
    skippedWhen: (cfg) => cfg.repoStart === 'empty', skippedReason: 'not needed for empty repositories' },
  { label: 'Files',        title: 'Which files are left out?',             subtitle: 'Choose which files are left out of what the AI sees, and which are brought back.',            Component: StepFiles },
  { label: 'AI',           title: 'Which model should GrillMyCode use?',   subtitle: 'Select the model that will generate the comprehension questions.',                            Component: StepAIProvider },
  { label: 'Questions',    title: 'Question settings',                     subtitle: 'Choose how many questions GrillMyCode should generate, what kind, and what they should focus on.',     Component: StepQuestions },
  { label: 'Delivery',     title: 'What do students and instructors get?', subtitle: 'Students always get a GitHub issue and a PDF. Choose whether they see answers, and whether you get a private copy.', Component: StepDelivery },
  { label: 'Trigger',      title: 'When should GrillMyCode run?',          subtitle: 'Choose the GitHub event(s) that starts the workflow.',                                                   Component: StepTrigger },
  { label: 'Manual runs',  title: 'Manual run overrides',                  subtitle: 'Optionally put chosen settings on the Run workflow form, so you can change them for one run without editing the workflow file.', Component: StepManualRuns },
  { label: 'Advanced',     title: 'Other advanced settings',               subtitle: 'Fine-tune edge-case options. Safe to leave at defaults for most setups.',                                Component: StepAdvanced },
  { label: 'Review',       title: 'Your workflow is ready',                subtitle: 'Copy the generated YAML into your assignment repository.',                                              Component: StepReview,
    hostSubtitle: 'Create the workflow file in your assignment repository, or copy the YAML into it.' },
];

/**
 * The Wizard's answers so far, as INITIAL_CONFIG starts them. Every step is
 * given it as `cfg`, and generateYaml turns it into the workflow.
 *
 * @typedef {typeof INITIAL_CONFIG} WizardConfig
 */

/**
 * What every step is given. `onChange` takes the fields to change.
 *
 * @typedef {object} StepProps
 * @property {WizardConfig} cfg
 * @property {(patch: Partial<WizardConfig>) => void} onChange
 * @property {string} [actionRef]
 * @property {string} [docsBase]
 * @property {WizardHost} [host]
 */

/**
 * What the Wizard can ask of where it runs (see WorkflowWizard below).
 *
 * @typedef {object} WizardHost
 * @property {string} openFolder
 * @property {(options?: { choose?: boolean }) => Promise<any>} pickFolder
 * @property {(yaml: string) => Promise<boolean>} saveWorkflow
 */

const INITIAL_CONFIG = {
  triggerEvent: 'workflow_dispatch',
  branchMode: 'specify',
  pushBranches: ['main', 'master'],
  // Tag trigger: the tag names the instructor defines, and the diff base a tag
  // run uses. Tags are never inferred — only what is listed here fires a run.
  submissionTags: '',
  tagDiffBase: 'cumulative',
  // Action inputs additionally exposed as workflow_dispatch inputs, so a manual
  // run can change them from the Actions tab. Copied, not referenced, so the
  // exported default list is never mutated through wizard state.
  dispatchOverrides: [...DEFAULT_DISPATCH_OVERRIDES],
  // The Manual runs step's Yes/No: null until answered, and the step cannot
  // be left until it is. No leaves every override out of the workflow without
  // clearing dispatchOverrides, so Yes brings the ticks back.
  dispatchOverridesEnabled: /** @type {boolean | null} */ (null),

  aiProvider: 'openrouter',
  // null until a model is chosen, so the AI step can't be passed without one;
  // '' once "Own Choice" is selected and nothing is picked from its list yet.
  aiModel: /** @type {string | null} */ (null),
  // OpenRouter routing variant appended to the model ID: '', 'nitro' or 'floor'.
  aiModelVariant: '',
  // ai_reasoning_effort: 'default' leaves reasoning to the model. The AI step
  // lists only the levels OpenRouter's catalogue says the model supports.
  aiReasoningEffort: 'default',
  // ai_temperature is opt-in: unticking clears the value, and nothing is
  // emitted unless the box is ticked and holds 0 to 2 with at most two decimal places.
  aiTemperatureEnabled: false,
  aiTemperature: '',
  apiKeySecret: 'OPENROUTER_API_KEY',

  // Repository label: whether the action writes a topic and a description
  // note to the student repository's own metadata once questions exist.
  // Shares the instructor PAT, so the Delivery step offers it under the token.
  labelRepos: true,

  numQuestions: 20,
  questionEmphasis: 'balanced',
  includeAnswers: false,
  instructorContext: '',
  assignmentContext: '',
  assignmentContextMaxChars: 20000,

  // Instructor repository delivery works only in Classroom 50 assignment
  // repositories, so the Repositories step asks first: null until answered, and the
  // step cannot be left until it is. See instructorRepoActive in generateYaml.js.
  usesClassroom50: /** @type {boolean | null} */ (null),
  instructorRepoEnabled: true,
  instructorRepoTokenSecret: 'INSTRUCTOR_REPO_TOKEN',

  excludePatternOverrides: '',
  additionalExcludePatterns: '',
  // The Files step's preview, which tries the two lists above on real files.
  // Neither is written to the workflow. previewSource is the folder chosen or
  // the list pasted — { kind, label, paths, unopened, truncated, texts } — or
  // null; previewLanguages holds the languages the instructor ticked or
  // unticked against the preview's own guess (name → true or false).
  previewSource: /** @type {Record<string, any> | null} */ (null),
  previewLanguages: /** @type {Record<string, boolean>} */ ({}),
  // stack_templates: the stack templates every run applies, in place of
  // detecting them in each repository. '' until the preview's "Use these
  // templates for every student" is ticked, which writes the stack it shows.
  stackTemplates: '',
  // The action's preview_only input. No step changes it: it reaches the
  // workflow only as a manual-run override, with this as its default.
  previewOnly: false,
  keepComments: false,
  // How students' repositories start, for the Repositories step's radios only:
  // 'empty' or 'template'. It is not an action input — starterCode is — but
  // the starter code question needs an answer of its own under 'template', so
  // the choice is kept separately.
  // Nothing is preselected: null until answered, and the Repositories step
  // cannot be left until it is.
  repoStart: /** @type {'empty' | 'template' | null} */ (null),
  // starter_code. "What should the AI do with the starter template?" has no
  // preselected answer either: null until answered, and the Repositories step
  // cannot be left until it is. Empty sets it itself.
  starterCode: /** @type {string | null} */ (null),
  // starter_questions_one_in. Asked on the Questions step under ask only,
  // where it can't exceed the number of questions.
  // '' while its box is empty, which the Questions step reports as an error.
  starterQuestionsOneIn: /** @type {number | ''} */ (5),
  // previous_work. Offered on the Trigger step when a tag run starts after an
  // earlier tag, the only runs besides a base_sha override with earlier work.
  previousWork: 'context',
  codebaseContextMaxChars: 50000,
  skipCommitters: 'github-actions[bot]',

  aiRetryMaxAttempts: 5,
  baseSha: '',
  headSha: '',
};

const OPENROUTER_MODEL_VALUES = ['google/gemini-3.5-flash-lite', 'openai/gpt-6-luna-pro', 'deepseek/deepseek-v4-flash', 'minimax/minimax-m2.7', 'stepfun/step-3.7-flash', 'tencent/hy3', 'xiaomi/mimo-v2.5-pro'];

/**
 * @param {number} stepIndex
 * @param {WizardConfig} cfg
 */
function getStepError(stepIndex, cfg) {
  const label = STEPS[stepIndex]?.label;
  if (label === 'AI') {
    if (cfg.aiModel === null) {
      return 'Please select a model before continuing.';
    }
    if (!OPENROUTER_MODEL_VALUES.includes(cfg.aiModel)) {
      if (!cfg.aiModel.trim()) {
        return 'Please select a model from the list below before continuing.';
      }
    }
    if (!cfg.apiKeySecret || !cfg.apiKeySecret.trim()) {
      return 'Please enter the name of the secret holding your OpenRouter API key.';
    }
    const tempError = temperatureError(cfg);
    if (tempError) return tempError;
  }
  if (label === 'Trigger' && isTagTrigger(cfg)) {
    if (submissionTagList(cfg).length === 0) {
      return 'Please enter at least one submission tag name before continuing.';
    }
    const invalid = invalidSubmissionTags(cfg);
    if (invalid.length > 0) {
      return `Unsupported tag pattern(s): ${invalid.join(', ')}. Use letters, digits and . _ / - plus the wildcards * ? + and [ ].`;
    }
    const namedTagError = namedDiffBaseTagError(cfg);
    if (namedTagError) return namedTagError;
  }
  if (label === 'Questions') {
    const oneInError = starterQuestionsOneInError(cfg);
    if (oneInError) return oneInError;
  }
  if (label === 'Repositories') {
    if (cfg.usesClassroom50 === null) {
      return 'Please say whether your student repositories are created by Classroom 50 before continuing.';
    }
    if (!cfg.repoStart) {
      return "Please say how students' repositories start before continuing.";
    }
    if (!cfg.starterCode) {
      return 'Please choose what the AI should do with the starter template before continuing.';
    }
  }
  if (label === 'Manual runs') {
    if (cfg.dispatchOverridesEnabled === null) {
      return 'Please say whether you want to change settings for a single manual run before continuing.';
    }
    // The starter code share's run form value, set on this step only when the
    // starter code answer isn't ask (under ask, the Questions step checks it).
    const overrides = resolveDispatchOverrides(cfg.dispatchOverrides, {
      tagTrigger: isTagTrigger(cfg),
      emptyRepo: cfg.repoStart === 'empty',
      starterAsk: cfg.starterCode === 'ask',
      enabled: cfg.dispatchOverridesEnabled === true,
    });
    if (overrides.includes('starter_questions_one_in') && cfg.starterCode !== 'ask') {
      const shareError = starterShareDefaultError(cfg);
      if (shareError) return shareError;
    }
  }
  if (label === 'Delivery') {
    if (instructorRepoActive(cfg) && (!cfg.instructorRepoTokenSecret || !cfg.instructorRepoTokenSecret.trim())) {
      return 'Please enter a secret name for the instructor repo token before continuing.';
    }
  }
  return null;
}

/**
 * `host` is given only where the wizard runs somewhere that can do more than a
 * web page can. Today that is the VS Code extension, which bundles this folder
 * (see extensions/vscode/src/webview/). On the docs site it is undefined.
 *
 *   host.openFolder          the name of the folder open in the editor, or ''
 *   host.pickFolder({ choose })
 *                            resolves to a folder to read, shaped like the
 *                            answer of showDirectoryPicker: the open folder,
 *                            or with `choose` one the instructor picks. Its
 *                            `ignoredLeftOut` is true if the host lists it
 *                            without the files Git ignores
 *   host.saveWorkflow(yaml)  writes the workflow file. Resolves to true once
 *                            it is written, and false if that was cancelled
 *
 * @param {{ actionRef?: string, docsBase?: string, host?: WizardHost }} props
 */
export default function WorkflowWizard({ actionRef = 'v0', docsBase = '/docs', host }) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState(INITIAL_CONFIG);
  const wizardIconUrl = useBaseUrl('/img/grillmycode-wizard.svg');

  if (!started) {
    return (
      <div className={styles.introPage}>
        <div className={styles.introCard}>
          <img className={styles.introIcon} src={wizardIconUrl} alt="" />
          <h1 className={styles.introTitle}>Workflow Wizard</h1>
          <p className={styles.introLead}>
            Generate a ready-to-use GitHub Actions workflow for{' '}
            <strong>GrillMyCode</strong> — without writing a single line of YAML by hand.
          </p>
          <ul className={styles.introFeatures}>
            <li>Describe your students' <strong>repositories</strong>: Classroom 50, and any starter code</li>
            <li>Point the AI to any <strong>assignment</strong> documents</li>
            <li>Fine-tune which <strong>files</strong> are assessed, and try the patterns on a folder of your own</li>
            <li>Pick your <strong>AI model</strong> and configure <strong>question generation</strong></li>
            <li>Decide what <strong>students and instructors</strong> receive</li>
            <li>Choose your <strong>trigger</strong>: every push, a submission tag, or manual runs only</li>
            <li>Expose chosen settings as <strong>manual run overrides</strong> you can change from the Actions tab</li>
            <li>Adjust <strong>advanced options</strong> if you need to</li>
            {host ? (
              <li>Create the finished <strong>workflow file</strong> in the folder you have open</li>
            ) : (
              <li>Copy the finished <strong>YAML</strong> straight into your repository</li>
            )}
          </ul>
          <p className={styles.introNote}>
            The wizard takes about two minutes and walks you through each setting one step at a time.
            You can go back and change anything before copying the final workflow.
          </p>
          <button className={styles.btnStart} onClick={() => setStarted(true)}>
            Start Wizard →
          </button>
        </div>
      </div>
    );
  }

  /** @param {Partial<WizardConfig>} patch */
  function handleChange(patch) {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      return next;
    });
  }

  const isSkipped = (i) => Boolean(STEPS[i].skippedWhen?.(cfg));

  // The nearest step in `direction` that isn't skipped. The first and last
  // steps never are, so there is always one.
  function nearestStep(from, direction) {
    let i = from + direction;
    while (isSkipped(i)) i += direction;
    return i;
  }

  function handleNext() {
    if (getStepError(step, cfg)) return;
    setStep((s) => nearestStep(s, 1));
  }

  function handleBack() {
    setStep((s) => nearestStep(s, -1));
  }

  const { title, Component } = STEPS[step];
  const subtitle = (host && STEPS[step].hostSubtitle) || STEPS[step].subtitle;
  const isLast = step === STEPS.length - 1;
  const stepError = getStepError(step, cfg);

  return (
    <div className={styles.wizard}>
      {/* Progress bar */}
      <nav className={styles.progressBar} aria-label="Wizard progress">
        {STEPS.map((s, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <div className={clsx(styles.connector, i <= step && styles.connectorDone)} />
            )}
            <div className={clsx(styles.step, isSkipped(i) && styles.stepSkipped)}>
              <div
                className={styles.stepWrapper}
                title={isSkipped(i) ? `Skipped: ${s.skippedReason}` : undefined}
              >
                <div
                  className={clsx(
                    styles.stepDot,
                    i === step && styles.stepDotActive,
                    i < step && !isSkipped(i) && styles.stepDotDone,
                  )}
                  aria-current={i === step ? 'step' : undefined}
                >
                  {isSkipped(i) ? '–' : i < step ? '✓' : i + 1}
                </div>
                <span
                  className={clsx(styles.stepLabel, i === step && styles.stepLabelActive)}
                >
                  {s.label}
                </span>
              </div>
            </div>
          </React.Fragment>
        ))}
      </nav>

      {/* Step panel */}
      <div className={styles.panel}>
        <div className={styles.stepTitle}>{title}</div>
        <div className={styles.stepSubtitle}>{subtitle}</div>
        <Component cfg={cfg} onChange={handleChange} actionRef={actionRef} docsBase={docsBase} host={host} />
      </div>

      {/* Navigation */}
      <div className={styles.nav}>
        {step > 0 ? (
          <button className={styles.btnSecondary} onClick={handleBack}>
            ← Back
          </button>
        ) : (
          <span />
        )}
        {!isLast && (
          <button
            className={styles.btnPrimary}
            onClick={handleNext}
            disabled={!!stepError}
            style={stepError ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            title={stepError || undefined}
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
