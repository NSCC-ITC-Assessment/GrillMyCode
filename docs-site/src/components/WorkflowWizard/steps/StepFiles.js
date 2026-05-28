import React from 'react';
import styles from '../styles.module.css';

export default function StepFiles({ cfg, onChange }) {
  return (
    <div>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Include patterns <span className={styles.optionalBadge}>optional</span></label>
        <span className={styles.hint}>
          Comma-separated glob patterns for files to <strong>include</strong> in the assessment. Leave
          empty to include all files not matched by the exclude list. Most instructors can leave this
          blank.{' '}
          <em>Example: </em>
          <code>src/**/*.py</code>
        </span>
        <input
          type="text"
          className={styles.input}
          value={cfg.includePatterns}
          onChange={(e) => onChange({ includePatterns: e.target.value })}
          placeholder="Leave empty to include all non-excluded files"
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Exclude patterns <span className={styles.optionalBadge}>optional</span></label>
        <span className={styles.hint}>
          Comma-separated glob patterns for files to <strong>exclude</strong>. The action has a
          sensible built-in default list (node_modules, lock files, build artefacts, images, etc.).{' '}
          <strong>Warning:</strong> providing a value here <em>replaces</em> the default list
          entirely — repeat the defaults alongside your additions if you want both.
        </span>
        <input
          type="text"
          className={styles.input}
          value={cfg.excludePatterns}
          onChange={(e) => onChange({ excludePatterns: e.target.value })}
          placeholder="Leave empty to use built-in defaults"
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={cfg.excludeWorkflowFiles}
            onChange={(e) => onChange({ excludeWorkflowFiles: e.target.checked })}
          />
          <span>
            <strong>Exclude workflow files</strong>
            <div className={styles.radioDescription}>
              When enabled (default), <code>.github/workflows/**</code> files are excluded from the
              assessed diff. This prevents questions being generated about the GrillMyCode workflow
              file itself. Disable only if you specifically want workflow files assessed.
            </div>
          </span>
        </label>
      </div>

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
              By default, inline and block comments are stripped from the student's code before
              sending it to the AI. This prevents students from gaming the assessment by writing
              comments that hint at answers, and can drastically reduce the number of tokens sent
              to the AI. Enable this to preserve comments exactly as written.
            </div>
          </span>
        </label>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={cfg.skipInitialCommit}
            onChange={(e) => onChange({ skipInitialCommit: e.target.checked })}
          />
          <span>
            <strong>Skip initial (template) commit</strong>
            <div className={styles.radioDescription}>
              When enabled (default), the diff base is pinned to the repository's first commit,
              excluding template or starter code provided by the instructor. Only the student's own
              additions are assessed. Disable to include the initial commit's files in the diff.
            </div>
          </span>
        </label>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Skip committers <span className={styles.optionalBadge}>optional</span></label>
        <span className={styles.hint}>
          Comma-separated list of author name or email substrings. A leading run of commits whose
          author matches any entry is skipped (e.g. bot commits from GitHub Classroom setup). Only
          skips a <em>contiguous leading run</em>, not all matching commits. Set to empty to disable
          entirely. The defaults skip the two most common bots.
        </span>
        <input
          type="text"
          className={styles.input}
          value={cfg.skipCommitters}
          onChange={(e) => onChange({ skipCommitters: e.target.value })}
          placeholder="github-classroom[bot],github-actions[bot]"
        />
      </div>
    </div>
  );
}
