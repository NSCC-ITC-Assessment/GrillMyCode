import React from 'react';
import styles from '../styles.module.css';

export default function StepInstructorRepo({ cfg, onChange }) {
  return (
    <div>
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
      </div>

      {cfg.instructorRepoEnabled && (
        <div className={styles.subField} style={{ marginTop: '0.75rem' }}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Instructor repo token secret name{' '}
              <span className={styles.optionalBadge}>optional</span>
            </label>
            <span className={styles.hint}>
              The name of the GitHub Actions secret holding your instructor PAT. Add it as an
              org-level secret so all student repos inherit it automatically. See the{' '}
              <a href="/docs/guides/instructor-setup" target="_blank" rel="noopener noreferrer">
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
  );
}
