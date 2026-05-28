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
              Opens a new Issue in the student's repository with the assessment. Useful as a
              persistent record. Requires <code>issues: write</code> permission.
            </div>
          </span>
        </label>
      </div>

      {/* Discussion */}
      <div className={styles.fieldGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={cfg.postDiscussion}
            onChange={(e) => onChange({ postDiscussion: e.target.checked })}
          />
          <span>
            <strong>Create a GitHub Discussion</strong>
            <div className={styles.radioDescription}>
              Posts the assessment as a Discussion. The action auto-enables Discussions on the repo
              if they are not already active. Requires <code>discussions: write</code> permission.
            </div>
          </span>
        </label>
        {cfg.postDiscussion && (
          <div className={styles.subField} style={{ marginTop: '0.75rem' }}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Discussion category <span className={styles.optionalBadge}>optional</span></label>
              <span className={styles.hint}>
                The category name to post under. This category must already exist in the repository's
                Discussion settings. The default <code>Assessments</code> category will be used if
                you leave this as-is, but you can rename it to any existing category.
              </span>
              <input
                type="text"
                className={styles.input}
                value={cfg.discussionCategory}
                onChange={(e) => onChange({ discussionCategory: e.target.value })}
                placeholder="Assessments"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
