import React from 'react';
import styles from '../styles.module.css';
import {
  MIN_STARTER_QUESTIONS_ONE_IN,
  maxStarterQuestions,
  starterQuestionsOneInError,
} from '../generateYaml';

/** @import { StepProps } from '../index' */

const EMPHASES = [
  {
    value: 'balanced',
    label: 'Balanced',
    description:
      'A mix of question types: tracing the code, predicting changes and edge cases, and how the language or libraries behave.',
  },
  {
    value: 'tracing',
    label: 'Tracing',
    description:
      'Only questions the student answers by running their code in their head: the value a function returns, how many times a loop runs, the order things happen in, or where a value comes from.',
  },
  {
    value: 'research',
    label: 'Research',
    description:
      'Only questions that send the student to documentation or ask about edge cases: why a line is needed, what a built-in or library call does here, or what happens on an edge case or after a change.',
  },
];

/** @param {StepProps} props */
export default function StepQuestions({ cfg, onChange }) {
  const oneInError = starterQuestionsOneInError(cfg);
  const starterMax = maxStarterQuestions(cfg);

  // The share can't exceed the number of questions, so lowering the number
  // lowers it with it.
  function setNumQuestions(numQuestions) {
    const oneIn = cfg.starterQuestionsOneIn;
    onChange({
      numQuestions,
      ...(numQuestions >= MIN_STARTER_QUESTIONS_ONE_IN && oneIn > numQuestions
        ? { starterQuestionsOneIn: numQuestions }
        : {}),
    });
  }

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
          onChange={(e) => setNumQuestions(Math.min(50, Math.max(1, Number(e.target.value))))}
        />
      </div>

      {/* Only under starter_code: ask, chosen on the Repositories step. Here
          rather than there because the share depends on the number of
          questions above. */}
      {cfg.starterCode === 'ask' && (
        <div className={styles.fieldGroup}>
          {cfg.numQuestions < 2 ? (
            <span className={styles.hint}>
              You chose to allow questions about your starter code, but a single question is always
              about the student's own work.
            </span>
          ) : (
            <>
              <label className={styles.label}>
                Ask up to 1 in{' '}
                <input
                  type="number"
                  aria-label="Starter code question share"
                  className={`${styles.input} ${styles.numberInput}`}
                  style={{
                    display: 'inline-block',
                    width: '5rem',
                    margin: '0 0.3rem',
                    borderColor: oneInError ? 'var(--ifm-color-danger)' : undefined,
                  }}
                  min={MIN_STARTER_QUESTIONS_ONE_IN}
                  max={cfg.numQuestions}
                  step={1}
                  value={cfg.starterQuestionsOneIn}
                  onChange={(e) =>
                    onChange({
                      starterQuestionsOneIn:
                        e.target.value === '' ? '' : parseInt(e.target.value, 10),
                    })
                  }
                />{' '}
                questions about non student submitted code
              </label>
              {oneInError ? (
                <span
                  className={styles.hint}
                  style={{ color: 'var(--ifm-color-danger)', marginTop: '0.3rem', display: 'block' }}
                >
                  {oneInError}
                </span>
              ) : (
                <span className={styles.hint} style={{ marginTop: '0.3rem' }}>
                  With {cfg.numQuestions} questions, up to {starterMax} may be about your starter
                  code alone; the rest are about the student's own work. Choose from{' '}
                  {MIN_STARTER_QUESTIONS_ONE_IN}, which allows half, to {cfg.numQuestions}, which
                  allows one. Answers to these questions can be shared between students.
                </span>
              )}
            </>
          )}
        </div>
      )}

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Question emphasis</label>
        <span className={styles.hint}>
          Limits the questions to one kind. Tracing and Research are all-or-nothing: when the code
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

      {/* Here rather than on the Files step: whether comments are kept is a
          choice about what the questions focus on, not about which files go. */}
      <div className={styles.fieldGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={cfg.keepComments}
            onChange={(e) => onChange({ keepComments: e.target.checked })}
          />
          <span>
            <strong>Keep code comments</strong>
            <div className={styles.radioDescription}>
              When left unchecked (default), inline and block comments are stripped from the
              student's code before sending it to the AI. This focuses the AI on what the code does
              rather than what the student wrote as annotations, and can drastically reduce the
              number of tokens sent to the AI. Enable this to preserve comments exactly as written,
              for example when the comments are the work being assessed.
            </div>
          </span>
        </label>
      </div>
    </div>
  );
}
