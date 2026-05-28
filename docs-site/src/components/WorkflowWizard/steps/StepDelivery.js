import React from 'react';
import styles from '../styles.module.css';

export default function StepDelivery({ cfg, onChange }) {
  const isPrTrigger =
    cfg.triggerEvent === 'pull_request' || cfg.triggerEvent === 'push+pull_request';

  return (
    <div>
      <p className={styles.hint} style={{ marginBottom: '1.25rem' }}>
        Choose where the assessment is delivered. You can enable multiple destinations simultaneously.
      </p>

      {/* PR comment */}
      <div className={styles.fieldGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={cfg.postPrComment}
            onChange={(e) => onChange({ postPrComment: e.target.checked })}
          />
          <span>
            <strong>Post as a pull request comment</strong>
            <div className={styles.radioDescription}>
              Posts the assessment directly on the student's pull request. Requires a PR-based
              trigger event and <code>pull-requests: write</code> permission.
              {!isPrTrigger && (
                <strong style={{ color: 'var(--ifm-color-warning)' }}>
                  {' '}
                  Note: your selected trigger is not a pull_request event — this option won't be
                  active.
                </strong>
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
              <label className={styles.label}>Discussion category</label>
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

      {/* Instructor repo */}
      <div className={styles.fieldGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={cfg.instructorRepoEnabled}
            onChange={(e) => onChange({ instructorRepoEnabled: e.target.checked })}
          />
          <span>
            <strong>Write to a private instructor repository</strong>
            <div className={styles.radioDescription}>
              Creates (or updates) a private repo named{' '}
              <code>{'{'}</code>assignment-name<code>{'}'}</code>-grillmycode-instructor in the same
              org, containing questions <em>and</em> answers for every student. Students never see
              this. Requires a Personal Access Token with <code>repo</code> and{' '}
              <code>workflow</code> scopes.
            </div>
          </span>
        </label>
        {cfg.instructorRepoEnabled && (
          <div className={styles.subField} style={{ marginTop: '0.75rem' }}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Instructor repo token secret name</label>
              <span className={styles.hint}>
                The name of the GitHub Actions secret holding your instructor PAT. Add it as an
                org-level secret so all student repos inherit it automatically. See the{' '}
                <a
                  href="/docs/guides/instructor-setup"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Instructor Setup guide
                </a>{' '}
                for full instructions.
              </span>
              <input
                type="text"
                className={styles.input}
                value={cfg.instructorRepoTokenSecret || 'INSTRUCTOR_REPO_TOKEN'}
                onChange={(e) => onChange({ instructorRepoTokenSecret: e.target.value })}
                placeholder="INSTRUCTOR_REPO_TOKEN"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
