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
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={cfg.includeInitialCommit}
            onChange={(e) => onChange({ includeInitialCommit: e.target.checked })}
          />
          <span>
            <strong>Include initial (template) commit</strong>
            <div className={styles.radioDescription}>
              When left unchecked (default), the diff base is pinned to the repository's first commit,
              excluding template or starter code provided by the instructor. Only the student's own
              additions are assessed. Enable to include the initial commit's eligible files in the diff.
            </div>
          </span>
        </label>
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
