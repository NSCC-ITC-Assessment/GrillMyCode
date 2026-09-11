import React, { useState } from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

import StepTrigger from './steps/StepTrigger';
import StepAIProvider from './steps/StepAIProvider';
import StepQuestions from './steps/StepQuestions';
import StepDelivery from './steps/StepDelivery';
import StepInstructorRepo from './steps/StepInstructorRepo';
import StepFiles from './steps/StepFiles';
import StepFileOptions from './steps/StepFileOptions';
import StepAdvanced from './steps/StepAdvanced';
import StepReview from './steps/StepReview';
import { DEFAULT_DISPATCH_OVERRIDES } from './dispatchInputs';
import { instructorRepoActive } from './generateYaml';

const STEPS = [
  { label: 'AI',         title: 'Which model should GrillMyCode use?',                   subtitle: 'Select the OpenRouter model that will generate the comprehension questions.',                              Component: StepAIProvider },
  { label: 'Questions',  title: 'Question settings',                    subtitle: 'Configure how many questions GrillMyCode should generate and what context the chosen AI receives.',             Component: StepQuestions },
  { label: 'Files',      title: 'Which files are assessed?',            subtitle: 'Control which student files are included in the diff that\'s sent to the AI.',                    Component: StepFiles },
  { label: 'File opts',  title: 'File handling options',                 subtitle: 'Configure how the diff is built — what to skip, how comments are handled, and which commits count.', Component: StepFileOptions },
  { label: 'Trigger',    title: 'When should GrillMyCode run?',     subtitle: 'Choose the GitHub event(s) that starts the workflow.',                                              Component: StepTrigger },
  { label: 'Delivery',   title: 'Where is the assessment delivered?',   subtitle: 'Choose one or more destinations for the generated questions.',                             Component: StepDelivery },
  { label: 'Instructor', title: 'Instructor repository',                subtitle: 'Optionally write questions and answers to a private instructor-only repository. Available for Classroom 50 assignment repositories only.', Component: StepInstructorRepo },
  { label: 'Advanced',   title: 'Advanced settings',                    subtitle: 'Fine-tune edge-case options. Safe to leave at defaults for most setups.',                 Component: StepAdvanced },
  { label: 'Review',     title: 'Your workflow is ready',               subtitle: 'Copy the generated YAML into your assignment repository.',                                Component: StepReview },
];

const INITIAL_CONFIG = {
  triggerEvent: 'workflow_dispatch',
  branchMode: 'specify',
  pushBranches: ['main', 'master'],
  // Action inputs additionally exposed as workflow_dispatch inputs, so a manual
  // run can change them from the Actions tab. Copied, not referenced, so the
  // exported default list is never mutated through wizard state.
  dispatchOverrides: [...DEFAULT_DISPATCH_OVERRIDES],

  aiProvider: 'openrouter',
  aiModel: 'google/gemini-3.5-flash-lite',
  apiKeySecret: 'OPENROUTER_API_KEY',

  numQuestions: 20,
  includeAnswers: false,
  instructorContext: '',
  assignmentContext: '',
  assignmentContextMaxChars: 20000,

  // Instructor repository delivery works only in Classroom 50 assignment
  // repositories, so the Instructor step asks first: null until answered, and the
  // step cannot be left until it is. See instructorRepoActive in generateYaml.js.
  usesClassroom50: null,
  instructorRepoEnabled: true,
  instructorRepoTokenSecret: 'INSTRUCTOR_REPO_TOKEN',

  excludePatternOverrides: '',
  additionalExcludePatterns: '',
  keepComments: false,
  includeInitialCommit: false,
  skipCommitters: 'github-actions[bot]',

  aiTemperature: 0.5,
  aiRetryMaxAttempts: 5,
  baseSha: '',
  headSha: '',
};

const OPENROUTER_MODEL_VALUES = ['google/gemini-3.5-flash-lite', 'deepseek/deepseek-v4-flash', 'minimax/minimax-m2.7', 'stepfun/step-3.5-flash', 'tencent/hy3', 'xiaomi/mimo-v2.5-pro'];

function getStepError(stepIndex, cfg) {
  if (stepIndex === 0) {
    if (!OPENROUTER_MODEL_VALUES.includes(cfg.aiModel)) {
      if (!cfg.aiModel || !cfg.aiModel.trim()) {
        return 'Please enter a model ID for OpenRouter before continuing.';
      }
      if (!/^[^/]+\/[^/]+$/.test(cfg.aiModel.trim())) {
        return 'Model ID must be in provider/model format (e.g. deepseek/deepseek-v4-flash).';
      }
    }
    if (!cfg.apiKeySecret || !cfg.apiKeySecret.trim()) {
      return 'Please enter the name of the secret holding your OpenRouter API key.';
    }
  }
  if (stepIndex === 6) {
    if (cfg.usesClassroom50 === null) {
      return 'Please say whether your student repositories are created by Classroom 50 before continuing.';
    }
    if (instructorRepoActive(cfg) && (!cfg.instructorRepoTokenSecret || !cfg.instructorRepoTokenSecret.trim())) {
      return 'Please enter a secret name for the instructor repo token before continuing.';
    }
  }
  return null;
}

export default function WorkflowWizard({ actionRef = 'v1', docsBase = '/docs' }) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState(INITIAL_CONFIG);

  if (!started) {
    return (
      <div className={styles.introPage}>
        <div className={styles.introCard}>
          <div className={styles.introIcon} aria-hidden="true">🧙</div>
          <h1 className={styles.introTitle}>Workflow Wizard</h1>
          <p className={styles.introLead}>
            Generate a ready-to-use GitHub Actions workflow for{' '}
            <strong>GrillMyCode</strong> — without writing a single line of YAML by hand.
          </p>
          <ul className={styles.introFeatures}>
            <li>Choose your <strong>trigger event</strong> (manual dispatch, push to default branch, or both)</li>
            <li>Expose chosen settings as <strong>manual run overrides</strong> you can change from the Actions tab</li>
            <li>Pick your <strong>AI provider</strong> and model</li>
            <li>Configure <strong>question generation</strong> and delivery destinations</li>
            <li>Fine-tune <strong>file patterns</strong> and advanced options</li>
            <li>Copy the finished <strong>YAML</strong> straight into your repository</li>
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

  function handleChange(patch) {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      return next;
    });
  }

  function handleNext() {
    if (getStepError(step, cfg)) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function handleBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  const { title, subtitle, Component } = STEPS[step];
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
            <div className={styles.step}>
              <div className={styles.stepWrapper}>
                <div
                  className={clsx(
                    styles.stepDot,
                    i === step && styles.stepDotActive,
                    i < step && styles.stepDotDone,
                  )}
                  aria-current={i === step ? 'step' : undefined}
                >
                  {i < step ? '✓' : i + 1}
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
        <Component cfg={cfg} onChange={handleChange} actionRef={actionRef} docsBase={docsBase} />
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
