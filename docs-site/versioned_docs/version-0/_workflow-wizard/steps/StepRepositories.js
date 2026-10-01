import React from 'react';
import styles from '../styles.module.css';
import CodebaseContextLimit, { codebaseLimitStep } from './CodebaseContextLimit';

// Facts about the student repositories, which later steps depend on: the
// Delivery step offers the instructor repository only for Classroom 50
// repositories, which the action identifies by their naming, and the starter
// code choice decides whether codebase context is sent, with its size limit
// shown here when it is. The required Classroom 50 question comes first so it
// isn't missed.
export default function StepRepositories({ cfg, onChange }) {
  return (
    <div>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Are you using this workflow alongside Classroom 50?</label>
        <span className={styles.hint}>
          Your private copy of every student's questions and answers works only with repositories
          Classroom 50 creates.
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
              <strong>Yes — Classroom 50 creates the student repositories</strong>
              <div className={styles.radioDescription}>
                Students get their repository by accepting the assignment in Classroom 50.
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
              <strong>No — the student repositories are created some other way</strong>
              <div className={styles.radioDescription}>
                For example, forks or another classroom tool. Everything works except your private
                copy.
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

      {/* The rest stays hidden until the Classroom 50 question is answered, so
          it isn't missed. */}
      {cfg.usesClassroom50 !== null && (
        <>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>How do students' repositories start?</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="repoStart"
                  value="empty"
                  checked={cfg.repoStart === 'empty'}
                  onChange={() =>
                    // The Assignment step is skipped for an empty repository,
                    // so any paths entered there are cleared rather than left
                    // in the workflow out of sight.
                    onChange({ repoStart: 'empty', starterCode: 'none', assignmentContext: '' })
                  }
                />
                <span>
                  <strong>Empty</strong>
                  <div className={styles.radioDescription}>
                    Students start with nothing, so everything they push is their own work.
                  </div>
                </span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="repoStart"
                  value="template"
                  checked={cfg.repoStart === 'template'}
                  onChange={() =>
                    onChange({
                      repoStart: 'template',
                      // Kept only if it was chosen under this option; Empty sets
                      // it itself, which isn't an answer.
                      starterCode: cfg.repoStart === 'template' ? cfg.starterCode : null,
                    })
                  }
                />
                <span>
                  <strong>From a starter template</strong>
                  <div className={styles.radioDescription}>
                    Students start with your files, such as a README or code to build on. Your
                    files aren't treated as the student's work.
                  </div>
                </span>
              </label>
            </div>
            {!cfg.repoStart && (
              <span style={{ fontSize: '0.78rem', color: 'var(--ifm-color-danger)', marginTop: '0.3rem', display: 'block' }}>
                Please choose an answer before continuing.
              </span>
            )}
          </div>

          {cfg.repoStart === 'template' && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>What should the AI do with the starter template?</label>
              <div className={styles.radioGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="starterCode"
                    value="ignore"
                    checked={cfg.starterCode === 'ignore'}
                    onChange={() => onChange({ starterCode: 'ignore' })}
                  />
                  <span>
                    <strong>Ignore it</strong>
                    <div className={styles.radioDescription}>
                      The AI sees only the student's work. This costs the least, and suits a
                      template that holds only instructions, such as a README.
                    </div>
                  </span>
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="starterCode"
                    value="context"
                    checked={cfg.starterCode === 'context'}
                    onChange={() => onChange({ starterCode: 'context' })}
                  />
                  <span>
                    <strong>Use it as background context</strong>
                    <div className={styles.radioDescription}>
                      The AI also sees your starter files, so questions can cover how the student's
                      code uses them. No question is about your starter code alone.{' '}
                      <strong>This will likely increase the input token cost of each run.</strong> You
                      can set a size limit below.
                    </div>
                  </span>
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="starterCode"
                    value="ask"
                    checked={cfg.starterCode === 'ask'}
                    onChange={() => onChange({ starterCode: 'ask' })}
                  />
                  <span>
                    <strong>Allow GrillMyCode to also generate questions about available starter code</strong>
                    <div className={styles.radioDescription}>
                      As above, and some questions may be about your starter code itself. You
                      choose how many on the Questions step. Every student has the same starter
                      code, so they could share those answers.{' '}
                      <strong>This will likely increase the input token cost of each run.</strong> You
                      can set a size limit below.
                    </div>
                  </span>
                </label>
              </div>
              {!cfg.starterCode && (
                <span style={{ fontSize: '0.78rem', color: 'var(--ifm-color-danger)', marginTop: '0.3rem', display: 'block' }}>
                  Please choose an answer before continuing.
                </span>
              )}
            </div>
          )}

          {codebaseLimitStep(cfg) === 'Repositories' && <CodebaseContextLimit cfg={cfg} onChange={onChange} />}

          <div className={styles.fieldGroup}>
            <span className={styles.hint}>
              Either way, when a student edits one of your files, only the lines they change count
              as their work.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
