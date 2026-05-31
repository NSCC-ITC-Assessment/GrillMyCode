import React from 'react';
import styles from '../styles.module.css';

export default function StepQuestions({ cfg, onChange }) {
  return (
    <div>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Number of questions</label>
        <span className={styles.hint}>
          How many comprehension questions GrillMyCode should generate per run. Minimum 1, maximum
          50.
        </span>
        <input
          type="number"
          className={`${styles.input} ${styles.numberInput}`}
          min={1}
          max={50}
          value={cfg.numQuestions}
          onChange={(e) =>
            onChange({ numQuestions: Math.min(50, Math.max(1, Number(e.target.value))) })
          }
        />
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

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Assignment context files <span className={styles.optionalBadge}>optional</span></label>
        <span className={styles.hint}>
          Comma-separated file glob(s) whose contents are read from the repo and injected into the
          AI prompt as assignment context — useful for README files, assignment briefs, rubrics, or
          coding style guides. Leave empty to skip. Supported: plain text, source files, PDF (text
          layer), Word (.doc/.docx).{' '}
          <em>Example: </em>
          <code>README.md, assignment.pdf</code>
        </span>
        <input
          type="text"
          className={styles.input}
          value={cfg.assignmentContext}
          onChange={(e) => onChange({ assignmentContext: e.target.value })}
          placeholder="README.md, assignment.pdf, marking/rubric.docx"
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Additional context / instructions <span className={styles.optionalBadge}>optional</span></label>
        <span className={styles.hint}>
          Instructor-specific instructions injected at the end of the AI system prompt. Use this to
          focus questions on particular topics, concepts, or requirements. Supports multi-line text.{' '}
          <em>Example: </em> "Focus on list comprehensions and their performance trade-offs."
        </span>
        <textarea
          className={styles.textarea}
          value={cfg.additionalContext}
          onChange={(e) => onChange({ additionalContext: e.target.value })}
          placeholder={
            'Assignment 3 — Python list comprehensions.\nFocus questions on: when list comprehensions are appropriate,\nperformance trade-offs, and readability.'
          }
          rows={4}
        />
      </div>
    </div>
  );
}
