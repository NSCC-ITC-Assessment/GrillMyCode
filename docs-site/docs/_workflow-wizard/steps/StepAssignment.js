import React from 'react';
import styles from '../styles.module.css';

// What the AI should know about the assignment: the brief or rubric files in
// the repository. Before the AI step, so how much is sent to the model is
// largely decided before choosing one. The instructor's own instructions are
// on the Questions step, with the other settings that steer the questions.
export default function StepAssignment({ cfg, onChange }) {
  return (
    <div>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Assignment context files <span className={styles.optionalBadge}>optional</span></label>
        <span className={styles.hint}>
          Comma-separated file glob(s) whose contents are read from the repo and injected into the
          AI prompt as assignment context — useful for README files, assignment briefs, rubrics, or
          coding style guides. Leave empty to skip. Supported: plain text, source files, PDF (text
          layer), Word (.doc/.docx).{' '}
          <em>Example: </em>
          <code>docs/assignment.pdf, marking/rubric.docx</code>
        </span>
        <input
          type="text"
          className={styles.input}
          value={cfg.assignmentContext}
          onChange={(e) => onChange({ assignmentContext: e.target.value })}
          placeholder="docs/assignment.pdf, marking/rubric.docx"
        />
        <div className={styles.notice} style={{ borderLeftColor: 'var(--ifm-color-warning, #f59e0b)', marginTop: '0.5rem' }}>
          <strong>Note: globs match the student's checked-out files.</strong> A path like{' '}
          <code>README.md</code> or <code>**/*.md</code> may pick up files the student has edited,
          which affects which topics the questions focus on. Prefer instructor-maintained paths (a{' '}
          <code>docs/</code> directory, a PDF brief) where possible. Use the instructor instructions
          on the Questions step for anything that must take effect regardless.
        </div>
      </div>
    </div>
  );
}
