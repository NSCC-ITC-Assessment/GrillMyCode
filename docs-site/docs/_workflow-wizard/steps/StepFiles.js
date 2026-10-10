import React from 'react';
import styles from '../styles.module.css';
import ExcludeListsDisclosure from './ExcludeListsDisclosure';
import FilePreview, { PatternChecks, useFilePreview } from './FilePreview';

export default function StepFiles({ cfg, onChange, host }) {
  // Worked out here, not in FilePreview, so each pattern box can say what its
  // patterns do to the chosen files.
  const preview = useFilePreview(cfg);
  return (
    <div>
      <ExcludeListsDisclosure />

      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          Additional exclude patterns <span className={styles.optionalBadge}>optional</span>
        </label>
        <span className={styles.hint}>
          Glob patterns for files to exclude <strong>on top of</strong> the auto-detected stack
          patterns. Use this for assignment-specific files such as provided starter code, test
          fixtures, or data files. Enter one pattern per line, comma-separated, or a mix of both.
          A name with no wildcards, or one ending in <code>/</code>, covers a whole folder (
          <code>data/</code>). Capital letters don’t matter.
        </span>
        <textarea
          className={styles.input}
          style={{ resize: 'vertical', minHeight: '8rem', fontFamily: 'var(--ifm-font-family-monospace)', fontSize: '0.82rem' }}
          value={cfg.additionalExcludePatterns}
          onChange={(e) => onChange({ additionalExcludePatterns: e.target.value })}
          placeholder="e.g. data/**, tests/fixtures/**, provided_starter/**"
        />
        <PatternChecks
          text={cfg.additionalExcludePatterns}
          checks={preview.result?.excludeChecks}
          kind="exclude"
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          Exclude pattern overrides <span className={styles.optionalBadge}>optional</span>
        </label>
        <span className={styles.hint}>
          Entries to allow specific files through the auto-detected exclude patterns. Each entry
          can be an <strong>exact pattern</strong> (e.g. <code>**/*.md</code> — re-includes all
          Markdown files) or a <strong>specific file path</strong> (e.g. <code>README.md</code> —
          only that file passes through while <code>**/*.md</code> still excludes everything
          else). Enter one entry per line, comma-separated, or a mix of both. Environment files,
          lock files and dependency folders come back only when an entry names them (e.g.{' '}
          <code>frontend/.env</code>), not under a broader one such as <code>frontend/**</code>.
        </span>
        <textarea
          className={styles.input}
          style={{ resize: 'vertical', minHeight: '8rem', fontFamily: 'var(--ifm-font-family-monospace)', fontSize: '0.82rem' }}
          value={cfg.excludePatternOverrides}
          onChange={(e) => onChange({ excludePatternOverrides: e.target.value })}
          placeholder="e.g. README.md, **/*.md"
        />
        <PatternChecks
          text={cfg.excludePatternOverrides}
          checks={preview.result?.overrideChecks}
          kind="override"
        />
      </div>

      <FilePreview cfg={cfg} onChange={onChange} preview={preview} host={host} />
    </div>
  );
}
