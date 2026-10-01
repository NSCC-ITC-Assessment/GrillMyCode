import React from 'react';
import styles from '../styles.module.css';

// Everything GrillMyCode writes and who can see it: the student's issue and PDF
// (always on), whether answers go to the student, and the private instructor
// copy. Include answers sits here rather than with the other question settings
// so both places answers can go are decided side by side.
export default function StepDelivery({ cfg, onChange, docsBase = '/docs' }) {
  return (
    <div>
      {/* Headings sit close to the items under them. */}
      <div className={styles.fieldGroup} style={{ marginBottom: '1rem' }}>
        <label className={styles.label}>What students get</label>
        <span className={styles.hint}>
          GrillMyCode always delivers the assessment as a GitHub Issue with a PDF download link. No
          configuration is required.
        </span>
      </div>

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

      <div className={styles.fieldGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={cfg.includeAnswers}
            onChange={(e) => onChange({ includeAnswers: e.target.checked })}
          />
          <span>
            <strong>Include answers</strong>
            <div className={styles.radioDescription}>
              When enabled, answers are shown to the student immediately after each
              question (labelled "Answer:"). In almost all cases you should leave
              this <strong>unchecked</strong> — the entire point of the assessment is for
              the student to research and determine the answers themselves. The instructor
              repository delivery always includes answers regardless of this setting.
            </div>
          </span>
        </label>
      </div>

      <div className={styles.fieldGroup} style={{ marginTop: '2.5rem', marginBottom: '1rem' }}>
        <label className={styles.label}>What Classroom 50 instructors get</label>
      </div>

      {cfg.usesClassroom50 === false && (
        <div
          className={styles.notice}
          style={{ borderLeftColor: 'var(--ifm-color-warning, #f59e0b)' }}
        >
          <strong>Instructor repository delivery is not available for these repositories</strong>, so
          it is left out of the generated workflow. It needs repositories created by Classroom 50,
          which you can change on the Repositories step. Students still receive their assessment issue
          and PDF as normal.
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
                <strong>A private instructor repository for the assignment</strong> (Recommended)
                <div className={styles.radioDescription}>
                  Creates (or updates) a private repo named{' '}
                  <code>{'{'}</code>assignment-name<code>{'}'}</code>-grillmycode-instructor in the same
                  org, containing questions <em>and</em> answers for every student. Students never see
                  this. Requires a Personal Access Token with <code>repo</code> and{' '}
                  <code>workflow</code> scopes.
                  <div style={{ marginTop: '0.4rem' }}>
                    This is also what asks the AI for multiple-choice distractors. They are used only
                    by the quiz built from the instructor copy — student reports always strip them —
                    so leaving this off generates the correct answer alone, which costs less per
                    assessment.
                  </div>
                </div>
              </span>
            </label>
          </div>

          {/* The label and the token appear only with the instructor copy, since
              both use its PAT; the token comes last, as the one thing to fill in. */}
          {cfg.instructorRepoEnabled && (
            <>
              {/*
                The repository label lives here rather than on its own step
                because it writes to repository metadata, which GITHUB_TOKEN
                cannot reach at any permissions: setting — it shares the PAT
                below. Offering it anywhere else would let an instructor
                configure a label that could never be written.
              */}
              <div className={styles.fieldGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={cfg.labelRepos}
                    onChange={(e) => onChange({ labelRepos: e.target.checked })}
                  />
                  <span>
                    <strong>Labelled student repositories in the organization list</strong> (Recommended)
                    <div className={styles.radioDescription}>
                      Once questions have been generated, adds a <code>grillmycode</code> topic to the
                      student repository and appends <code>· 🔥 GrillMyCode: N questions</code> to its
                      description, so you can tell which repositories have a question set without
                      opening them, and filter for them with{' '}
                      <code>org:&lt;your-org&gt; topic:grillmycode</code>. Existing topics are kept,
                      and the label replaces itself on each run rather than stacking up. See the{' '}
                      <a
                        href={`${docsBase}/example-workflows/repo-labels`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Repository labels example
                      </a>
                      .
                    </div>
                  </span>
                </label>
              </div>

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
            </>
          )}
        </>
      )}
    </div>
  );
}
