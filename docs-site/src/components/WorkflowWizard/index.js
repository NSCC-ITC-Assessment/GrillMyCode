import React, { useState } from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

import StepTrigger from './steps/StepTrigger';
import StepAIProvider from './steps/StepAIProvider';
import StepQuestions from './steps/StepQuestions';
import StepDelivery from './steps/StepDelivery';
import StepInstructorRepo from './steps/StepInstructorRepo';
import StepFiles from './steps/StepFiles';
import StepAdvanced from './steps/StepAdvanced';
import StepReview from './steps/StepReview';

const STEPS = [
  { label: 'Trigger',    title: 'When should the assessment run?',     subtitle: 'Choose the GitHub event that starts the workflow.',                                              Component: StepTrigger },
  { label: 'AI',         title: 'Which AI provider?',                   subtitle: 'Select the model that generates the comprehension questions.',                              Component: StepAIProvider },
  { label: 'Questions',  title: 'Question settings',                    subtitle: 'Configure how many questions are generated and what context the AI receives.',             Component: StepQuestions },
  { label: 'Delivery',   title: 'Where is the assessment delivered?',   subtitle: 'Choose one or more destinations for the generated questions.',                             Component: StepDelivery },
  { label: 'Instructor', title: 'Instructor repository',                subtitle: 'Optionally write questions and answers to a private instructor-only repository.',          Component: StepInstructorRepo },
  { label: 'Files',      title: 'Which files are assessed?',            subtitle: 'Control which student files are included in the diff sent to the AI.',                    Component: StepFiles },
  { label: 'Advanced',   title: 'Advanced settings',                    subtitle: 'Fine-tune edge-case options. Safe to leave at defaults for most setups.',                 Component: StepAdvanced },
  { label: 'Review',     title: 'Your workflow is ready',               subtitle: 'Copy the generated YAML into your assignment repository.',                                Component: StepReview },
];

const INITIAL_CONFIG = {
  triggerEvent: 'workflow_dispatch',
  prTypes: ['opened', 'synchronize'],
  pushBranches: ['main'],

  aiProvider: 'github-models',
  aiModel: 'gpt-4.1',
  apiKeySecret: '',
  azureEndpointSecret: '',

  numQuestions: 10,
  includeAnswers: false,
  additionalContext: '',
  assignmentContext: '',
  assignmentContextMaxChars: 20000,

  postPrComment: false,
  postIssue: false,
  postDiscussion: false,
  discussionCategory: 'Assessments',
  instructorRepoEnabled: true,
  instructorRepoTokenSecret: 'INSTRUCTOR_REPO_TOKEN',

  includePatterns: '',
  excludePatterns: '',
  excludeWorkflowFiles: true,
  keepComments: false,
  skipInitialCommit: true,
  skipCommitters: 'github-classroom[bot],github-actions[bot]',

  outputFile: 'grill-my-code.md',
  aiTemperature: 0.5,
  aiRetryMaxAttempts: 5,
  baseSha: '',
  headSha: '',
};

const OPENROUTER_MODEL_VALUES = ['deepseek/deepseek-v4-flash', 'minimax/minimax-m2.7', 'stepfun/step-3.5-flash', 'tencent/hy3-preview'];

function getStepError(stepIndex, cfg) {
  if (stepIndex === 1) {
    if (cfg.aiProvider === 'openrouter' && !OPENROUTER_MODEL_VALUES.includes(cfg.aiModel)) {
      if (!cfg.aiModel || !cfg.aiModel.trim()) {
        return 'Please enter a model ID for OpenRouter before continuing.';
      }
      if (!/^[^/]+\/[^/]+$/.test(cfg.aiModel.trim())) {
        return 'Model ID must be in provider/model format (e.g. anthropic/claude-3-5-sonnet).';
      }
    }
    if (cfg.aiProvider === 'github-models' && (!cfg.aiModel || !cfg.aiModel.trim())) {
      return 'Please enter a model ID before continuing.';
    }
  }
  return null;
}

export default function WorkflowWizard() {
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState(INITIAL_CONFIG);

  function handleChange(patch) {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      // Auto-uncheck PR comment delivery when trigger no longer includes pull_request
      if ('triggerEvent' in patch) {
        const isPr = ['pull_request+workflow_dispatch', 'push+pull_request+workflow_dispatch'].includes(next.triggerEvent);
        if (!isPr) next.postPrComment = false;
      }
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
        <Component cfg={cfg} onChange={handleChange} />
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
