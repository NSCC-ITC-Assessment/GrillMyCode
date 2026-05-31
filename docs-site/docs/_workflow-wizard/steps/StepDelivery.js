import React from 'react';
import styles from '../styles.module.css';

export default function StepDelivery({ cfg, onChange }) {
  const isPrTrigger = [
    'pull_request+workflow_dispatch',
    'push+pull_request+workflow_dispatch',
  ].includes(cfg.triggerEvent);

  return (
    <div>
      <p className={styles.hint} style={{ marginBottom: '1.25rem' }}>
        Choose where the assessment is delivered. You can enable multiple destinations simultaneously.
      </p>

      {/* Always-on: output file */}
      <div className={styles.fieldGroup}>
        <label className={styles.checkboxLabel} style={{ cursor: 'default' }}>
          <input type="checkbox" checked disabled />
          <span>
            <strong>Write to the student's repository</strong>
            <div className={styles.radioDescription}>
              Always enabled. The assessment is written as a Markdown file to the{' '}
              <code>.assessment/</code> folder in the student's repository. This is the primary
              output and cannot be disabled. Requires <code>contents: write</code> permission.
            </div>
          </span>
        </label>
      </div>

      {/* Issue */}
      <div className={styles.fieldGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={cfg.postIssue}
            onChange={(e) => onChange({ postIssue: e.target.checked })}
          />
          <span>
            <strong>Create a GitHub Issue</strong>
            <div className={styles.radioDescription}>
              Opens an Issue in the student's repository with the assessment. Each run of the
              workflow overwrites the same Issue rather than creating a new one. Requires{' '}
              <code>issues: write</code> permission.
            </div>
          </span>
        </label>
      </div>

      {/* PR comment */}
      <div className={styles.fieldGroup}>
        <label className={isPrTrigger ? styles.checkboxLabel : styles.checkboxLabelDisabled}>
          <input
            type="checkbox"
            checked={cfg.postPrComment}
            disabled={!isPrTrigger}
            onChange={(e) => onChange({ postPrComment: e.target.checked })}
          />
          <span>
            <strong>Post as a pull request comment</strong>
            <div className={styles.radioDescription}>
              Posts the assessment directly on the student's pull request. Requires a PR-based
              trigger event and <code>pull-requests: write</code> permission.
              {!isPrTrigger && (
                <span> Not available — your selected trigger does not include a pull request event.</span>
              )}
            </div>
          </span>
        </label>
      </div>
    </div>
  );
}
