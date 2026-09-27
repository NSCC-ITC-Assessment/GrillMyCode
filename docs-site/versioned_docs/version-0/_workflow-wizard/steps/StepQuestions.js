import React from 'react';
import styles from '../styles.module.css';

const EMPHASES = [
  {
    value: 'balanced',
    label: 'Balanced',
    description:
      'A mix of question types: tracing the code, predicting changes and edge cases, and how the language or libraries behave.',
  },
  {
    value: 'research',
    label: 'Research',
    description:
      'Only questions that send the student to documentation or ask about edge cases: why a line is needed, what a built-in or library call does here, or what happens on an edge case or after a change.',
  },
  {
    value: 'tracing',
    label: 'Tracing',
    description:
      'Only questions the student answers by running their code in their head: the value a function returns, how many times a loop runs, the order things happen in, or where a value comes from.',
  },
];

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
        <label className={styles.label}>Question emphasis</label>
        <span className={styles.hint}>
          Limits the questions to one kind. Research and Tracing are all-or-nothing: when the code
          can't supply enough good questions of that kind, the AI writes easier or repetitive ones of
          the same kind rather than switching.
        </span>
        <div className={styles.radioGroup}>
          {EMPHASES.map((e) => (
            <label key={e.value} className={styles.radioLabel}>
              <input
                type="radio"
                name="questionEmphasis"
                value={e.value}
                checked={cfg.questionEmphasis === e.value}
                onChange={() => onChange({ questionEmphasis: e.value })}
              />
              <span>
                <strong>{e.label}</strong>
                <div className={styles.radioDescription}>{e.description}</div>
              </span>
            </label>
          ))}
        </div>
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
          field below for anything that must take effect regardless.
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Instructor context / instructions <span className={styles.optionalBadge}>optional</span></label>
        <span className={styles.hint}>
          Instructor-specific instructions injected at the end of the AI system prompt. Use this to
          focus questions on particular topics, concepts, or requirements. Supports multi-line text.{' '}
          <em>Example: </em> "Focus on list comprehensions and their performance trade-offs."
        </span>
        <textarea
          className={styles.textarea}
          value={cfg.instructorContext}
          onChange={(e) => onChange({ instructorContext: e.target.value })}
          placeholder={
            'Assignment 3 — Python list comprehensions.\nFocus questions on: when list comprehensions are appropriate,\nperformance trade-offs, and readability.'
          }
          rows={4}
        />
      </div>
    </div>
  );
}
