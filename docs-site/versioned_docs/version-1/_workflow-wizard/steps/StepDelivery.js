import React from 'react';
import styles from '../styles.module.css';

export default function StepDelivery({ cfg }) {
  const isPrTrigger = [
    'pull_request+workflow_dispatch',
    'push+pull_request+workflow_dispatch',
  ].includes(cfg.triggerEvent);

  return (
    <div>
      <p className={styles.hint} style={{ marginBottom: '1.25rem' }}>
        GrillMyCode always delivers the assessment as a GitHub Issue with a PDF download link. No
        configuration is required.
      </p>

      {/* Always-on: GitHub Issue */}
      <div className={styles.fieldGroup}>
        <label className={styles.checkboxLabel} style={{ cursor: 'default' }}>
          <input type="checkbox" checked disabled />
          <span>
            <strong>GitHub Issue</strong>
            <div className={styles.radioDescription}>
              Always enabled. An Issue is created (or updated in place) in the student's repository
              and automatically assigned to the student. Requires <code>issues: write</code>{' '}
              permission.
            </div>
          </span>
        </label>
      </div>

      {/* Always-on: PDF */}
      <div className={styles.fieldGroup}>
        <label className={styles.checkboxLabel} style={{ cursor: 'default' }}>
          <input type="checkbox" checked disabled />
          <span>
            <strong>PDF download</strong>
            <div className={styles.radioDescription}>
              Always enabled. A PDF of the assessment is generated and attached to a rolling GitHub
              Release tagged <code>gmc-assessments</code>. A download link is included in the Issue
              body. Requires <code>contents: write</code> permission.
            </div>
          </span>
        </label>
      </div>

      {/* Conditional: PR link comment */}
      <div className={styles.fieldGroup}>
        <label className={styles.checkboxLabel} style={{ cursor: 'default' }}>
          <input type="checkbox" checked={isPrTrigger} disabled />
          <span>
            <strong>Pull request link comment</strong>
            <div className={styles.radioDescription}>
              {isPrTrigger
                ? 'Automatically enabled when a pull request event triggers the workflow. A short link comment pointing to the assessment Issue is posted on the PR. Requires '
                : 'Automatically posted when the workflow is triggered by a pull request. Not applicable for your current trigger selection. Would require '}
              <code>pull-requests: write</code> permission.
              {!isPrTrigger && (
                <span> Select a PR-based trigger to enable this.</span>
              )}
            </div>
          </span>
        </label>
      </div>
    </div>
  );
}
