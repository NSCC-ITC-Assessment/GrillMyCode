import React from 'react';
import styles from '../styles.module.css';

export default function StepDelivery({ cfg }) {
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
              and automatically assigned to the student. Every push regenerates the questions and
              overwrites the existing issue body. Requires <code>issues: write</code>{' '}
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
    </div>
  );
}
