import React from 'react';
import styles from '../styles.module.css';

export default function StepFileOptions({ cfg, onChange }) {
  return (
    <div>
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
              When left unchecked (default), inline and block comments are stripped from the student's code before
              sending it to the AI. This focuses the AI on what the code does rather than what the
              student wrote as annotations, and can drastically reduce the number of tokens sent
              to the AI. Enable this to preserve comments exactly as written.
            </div>
          </span>
        </label>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>How do students' repositories start?</label>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="repoStart"
              value="empty"
              checked={cfg.repoStart === 'empty'}
              onChange={() => onChange({ repoStart: 'empty', starterCode: 'none' })}
            />
            <span>
              <strong>Empty</strong> <code>starter_code: none</code>
              <div className={styles.radioDescription}>
                A Classroom 50 assignment registered with{' '}
                <code>gh teacher assignment add --empty-repo</code>. Each student gets a bare
                repository, so its first commit is the student's own first push, and it is
                assessed.
              </div>
            </span>
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="repoStart"
              value="template"
              checked={cfg.repoStart === 'template'}
              onChange={() => onChange({ repoStart: 'template', starterCode: 'ignore' })}
            />
            <span>
              <strong>From a template, with no starter code</strong>
              <div className={styles.radioDescription}>
                The template holds only instructions, such as a README, or the assignment is
                seeded with a README. That first commit is left out.
              </div>
            </span>
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="repoStart"
              value="template-code"
              checked={cfg.repoStart === 'template-code'}
              onChange={() =>
                onChange({
                  repoStart: 'template-code',
                  starterCode: cfg.starterCode === 'none' ? 'ignore' : cfg.starterCode,
                })
              }
            />
            <span>
              <strong>From a template, with starter code</strong>
              <div className={styles.radioDescription}>
                The template holds code for the student to build on. That first commit is left
                out, and the next question sets what the AI does with the starter code.
              </div>
            </span>
          </label>
        </div>
      </div>

      {cfg.repoStart === 'template-code' && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>What should the AI do with the starter code?</label>
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
                <strong>Ignore it</strong> <code>ignore</code>
                <div className={styles.radioDescription}>
                  Questions come only from the student's work, and starter files the student
                  hasn't changed aren't sent to the AI.
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
                <strong>Use it as background</strong> <code>context</code> (Recommended)
                <div className={styles.radioDescription}>
                  Starter files the student hasn't changed are sent to the AI as background, so
                  questions can cover how the student's code uses them. No question is about the
                  starter code alone.{' '}
                  <strong>This will likely increase the cost of each run,</strong> because the
                  starter code is sent every time. The limit is under <strong>Advanced</strong>.
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
                <strong>Ask about it too</strong> <code>ask</code>
                <div className={styles.radioDescription}>
                  As above, and up to one in five questions may be about the starter code itself,
                  worded as about the provided code. The starter code is the same for every
                  student, so answers to those questions can be shared. Costs the same as
                  background.
                </div>
              </span>
            </label>
          </div>
        </div>
      )}

      <div className={styles.fieldGroup}>
        <span className={styles.hint}>
          Whatever you choose, when a student edits a file that already existed, only the lines
          they added or changed are treated as their work.
        </span>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Skip committers <span className={styles.optionalBadge}>optional</span></label>
        <span className={styles.hint}>
          Comma-separated list of author name or email substrings. A leading run of commits whose
          author matches any entry is skipped (e.g. bot commits from a template's own CI). Only
          skips a <em>contiguous leading run</em>, not all matching commits. Set to empty to disable
          entirely. Classroom 50's own setup commit isn't bot-authored, so this default has no
          effect on it — its metadata file is excluded by pattern instead.
        </span>
        <input
          type="text"
          className={styles.input}
          value={cfg.skipCommitters}
          onChange={(e) => onChange({ skipCommitters: e.target.value })}
          placeholder="github-actions[bot]"
        />
      </div>
    </div>
  );
}
