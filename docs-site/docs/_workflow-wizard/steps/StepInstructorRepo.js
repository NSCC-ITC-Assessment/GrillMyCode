import React from 'react';
import styles from '../styles.module.css';

export default function StepInstructorRepo({ cfg, onChange, docsBase = '/docs' }) {
  return (
    <div>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Are your student repositories created by Classroom 50?</label>
        <span className={styles.hint}>
          Instructor repository delivery is only available in Classroom 50 assignment repositories —
          the repositories Classroom 50 creates when a student accepts an assignment. The action
          identifies the assignment and the student from Classroom 50's{' '}
          <code>&lt;classroom&gt;-&lt;assignment&gt;-&lt;username&gt;</code> repository naming, so it
          cannot file assessments for any other repository.
        </span>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="usesClassroom50"
              checked={cfg.usesClassroom50 === true}
              onChange={() => onChange({ usesClassroom50: true })}
            />
            <span>
              <strong>Yes — Classroom 50 creates them</strong>
              <div className={styles.radioDescription}>
                Students accept the assignment with <code>gh student accept</code> or the Classroom 50
                web app, which creates their repository.
              </div>
            </span>
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="usesClassroom50"
              checked={cfg.usesClassroom50 === false}
              onChange={() => onChange({ usesClassroom50: false })}
            />
            <span>
              <strong>No — they are created some other way</strong>
              <div className={styles.radioDescription}>
                Hand-made repositories, forks, or another classroom tool. The rest of GrillMyCode works
                as normal; only the instructor repository is unavailable.
              </div>
            </span>
          </label>
        </div>
        {cfg.usesClassroom50 === null && (
          <span style={{ fontSize: '0.78rem', color: 'var(--ifm-color-danger)', marginTop: '0.3rem', display: 'block' }}>
            Please choose an answer before continuing.
          </span>
        )}
      </div>

      {cfg.usesClassroom50 === false && (
        <div
          className={styles.notice}
          style={{ borderLeftColor: 'var(--ifm-color-warning, #f59e0b)' }}
        >
          <strong>Instructor repository delivery is not available for these repositories</strong>, so
          it is left out of the generated workflow. Students still receive their assessment issue and
          PDF as normal.
        </div>
      )}

      {cfg.usesClassroom50 === true && (
        <>
          <div className={styles.fieldGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={cfg.instructorRepoEnabled}
                onChange={(e) => onChange({ instructorRepoEnabled: e.target.checked })}
              />
              <span>
                <strong>Write to a private instructor repository</strong> (Recommended)
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
                  Instructor repo token secret name
                </label>
                <span className={styles.hint}>
                  The name of the org-level GitHub Actions secret holding your instructor PAT. Add it as an
                  org-level secret so all student repos inherit it automatically. See the{' '}
                  <a href={`${docsBase}/guides/instructor-setup`} target="_blank" rel="noopener noreferrer">
                    Instructor Setup guide
                  </a>{' '}
                  for full instructions.
                </span>
                <input
                  type="text"
                  className={styles.input}
                  style={(!cfg.instructorRepoTokenSecret || !cfg.instructorRepoTokenSecret.trim()) ? { borderColor: 'var(--ifm-color-danger)' } : undefined}
                  value={cfg.instructorRepoTokenSecret}
                  onChange={(e) => onChange({ instructorRepoTokenSecret: e.target.value })}
                  placeholder="INSTRUCTOR_REPO_TOKEN"
                />
                {(!cfg.instructorRepoTokenSecret || !cfg.instructorRepoTokenSecret.trim()) && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--ifm-color-danger)', marginTop: '0.3rem', display: 'block' }}>
                    Please enter a secret name before continuing.
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
