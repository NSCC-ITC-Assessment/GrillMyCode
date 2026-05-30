import React from 'react';
import styles from '../styles.module.css';

export default function StepFiles({ cfg, onChange }) {
  return (
    <div>
      <div className={styles.notice}>
        <strong>Binary files are never assessed</strong> regardless of include/exclude settings.
        Any file whose content contains a null byte is automatically skipped before being sent to
        the AI. Only text-based source files are eligible.
      </div>

      <div className={styles.notice} style={{ marginTop: '0.75rem', borderColor: 'var(--ifm-color-primary-light)' }}>
        <strong>Exclude patterns are auto-detected.</strong> When the action runs it queries the
        GitHub Languages API to identify your repository&apos;s stack and automatically applies the
        relevant{' '}
        <a href="https://github.com/github/gitignore" target="_blank" rel="noopener noreferrer">
          github/gitignore
        </a>{' '}
        templates — covering build artefacts, dependency directories, IDE files, and more for every
        detected language and framework. You only need to add patterns below for files specific to
        your assignment.
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          Additional exclude patterns <span className={styles.optionalBadge}>optional</span>
        </label>
        <span className={styles.hint}>
          Glob patterns for files to exclude <strong>on top of</strong> the auto-detected stack
          patterns. Use this for assignment-specific files such as provided starter code, test
          fixtures, or data files. Enter one pattern per line, comma-separated, or a mix of both.
        </span>
        <textarea
          className={styles.input}
          style={{ resize: 'vertical', minHeight: '4rem', fontFamily: 'var(--ifm-font-family-monospace)', fontSize: '0.82rem' }}
          value={cfg.excludePatterns}
          onChange={(e) => onChange({ excludePatterns: e.target.value })}
          placeholder="e.g. data/**, tests/fixtures/**, provided_starter/**"
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          Exclude pattern overrides <span className={styles.optionalBadge}>optional</span>
        </label>
        <span className={styles.hint}>
          Comma-separated entries to allow specific files through the auto-detected exclude
          patterns. Each entry can be an <strong>exact pattern</strong> (e.g.{' '}
          <code>**/*.md</code> — re-includes all Markdown files) or a{' '}
          <strong>specific file path</strong> (e.g. <code>README.md</code> — only that file passes
          through while <code>**/*.md</code> still excludes everything else).
        </span>
        <input
          type="text"
          className={styles.input}
          value={cfg.excludePatternOverrides}
          onChange={(e) => onChange({ excludePatternOverrides: e.target.value })}
          placeholder="e.g. README.md, **/*.md"
        />
      </div>
    </div>
  );
}
