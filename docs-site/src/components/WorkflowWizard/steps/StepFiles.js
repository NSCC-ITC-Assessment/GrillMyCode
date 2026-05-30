import React from 'react';
import styles from '../styles.module.css';

const DEFAULT_PATTERN_GROUPS = [
  {
    heading: 'JavaScript / Frontend',
    patterns: [
      'node_modules/**', '**/*.lock', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
      '**/*.min.js', '**/*.min.css', 'dist/**', 'build/**', 'out/**', 'coverage/**',
      '.nyc_output/**', '.next/**', '.nuxt/**', '.output/**', '.svelte-kit/**',
      '.astro/**', '.expo/**', '.parcel-cache/**', '.turbo/**',
    ],
  },
  {
    heading: 'Python',
    patterns: [
      '__pycache__/**', '**/*.pyc', '.venv/**', 'venv/**',
      '.pytest_cache/**', '**/*.egg-info/**', '.tox/**',
    ],
  },
  {
    heading: 'Java',
    patterns: ['target/**', '.gradle/**'],
  },
  {
    heading: 'Ruby · PHP / Go · .NET',
    patterns: ['.bundle/**', 'vendor/**', 'obj/**'],
  },
  {
    heading: 'C / C++',
    patterns: ['CMakeFiles/**', 'cmake-build-*/**', 'CMakeCache.txt'],
  },
  {
    heading: 'Text assets & Misc',
    patterns: [
      '.git/**', '.gitignore',
      '**/*.svg', '**/*.md',
      '**/*.map', '**/*.log', '.assessment/**',
    ],
  },
];

export default function StepFiles({ cfg, onChange }) {
  return (
    <div>
      <div className={styles.notice}>
        <strong>Binary files are never assessed</strong> regardless of include/exclude settings.
        Any file whose content contains a null byte is automatically skipped before being sent to
        the AI. Only text-based source files are eligible.
      </div>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Exclude patterns <span className={styles.optionalBadge}>optional</span></label>
        <span className={styles.hint}>
          Glob patterns for <strong>additional</strong> files to exclude — merged with the built-in
          defaults above, which are always applied. Enter one pattern per line, comma-separated, or
          a mix of both. Only add patterns for files specific to your assignment.
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.6rem' }}>
          {DEFAULT_PATTERN_GROUPS.map(g => (
            <div key={g.heading} style={{ flex: '1 1 28%', minWidth: '140px', fontSize: '0.72rem' }}>
              <strong style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.72rem' }}>{g.heading}</strong>
              {g.patterns.map(p => (
                <span key={p}><code style={{ fontSize: '0.68rem' }}>{p}</code>{' '}</span>
              ))}
            </div>
          ))}
        </div>
        <div>
          <textarea
            className={styles.input}
            style={{ resize: 'vertical', minHeight: '4rem', fontFamily: 'var(--ifm-font-family-monospace)', fontSize: '0.82rem' }}
            value={cfg.excludePatterns}
            onChange={(e) => onChange({ excludePatterns: e.target.value })}
            placeholder="Leave empty to use only the built-in defaults above"
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Exclude pattern overrides <span className={styles.optionalBadge}>optional</span></label>
        <span className={styles.hint}>
          Comma-separated entries to allow specific files through the default exclude list. Each
          entry can be an <strong>exact default pattern</strong> (e.g. <code>**/*.md</code> —
          re-includes all Markdown files) or a <strong>specific file path</strong> (e.g.{' '}
          <code>README.md</code> — only that file passes through while <code>**/*.md</code> still
          excludes everything else).
        </span>
        <input
          type="text"
          className={styles.input}
          value={cfg.excludePatternOverrides}
          onChange={(e) => onChange({ excludePatternOverrides: e.target.value })}
          placeholder="e.g. **/*.md, vendor/**"
        />
      </div>

    </div>
  );
}
